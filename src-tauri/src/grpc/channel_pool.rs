//! gRPC channel pool — Phase 7B.
//!
//! Thread-safe pool of lazy tonic channels, keyed by transport fingerprint.
//!
//! # Design
//! - Max capacity: [`MAX_CHANNEL_POOL_CAPACITY`] (32) channels.
//! - Eviction: LRU (least-recently-used) when pool is at capacity. On cache miss,
//!   the lazy channel is built **outside** the pool mutex (so other tabs/targets
//!   are not blocked), then inserted under lock with a double-check for races.
//!   Build happens before any eviction so a failed TLS build never drops a
//!   healthy pooled entry.
//! - All channels are built via `Endpoint::connect_lazy()`: the actual TCP/TLS
//!   handshake is deferred to the first RPC on the channel. Pool operations
//!   never block on network I/O.
//! - `tonic::transport::Channel` is internally reference-counted (cheap `clone()`).
//!   Callers receive a clone; in-flight RPCs are unaffected by pool eviction.
//!
//! # Auth exclusion
//! Auth credentials are NOT part of the channel fingerprint. They are attached
//! as per-call metadata interceptors in Phase 7C. See `fingerprint.rs`.
//!
//! # State registration
//! In Phase 7C, register the pool as Tauri managed state in the `lib.rs`
//! builder chain: `.manage(crate::grpc::channel_pool::ChannelPool::new())`.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use tonic::transport::{Channel, Endpoint};

use crate::grpc::fingerprint::{channel_fingerprint, normalize_grpc_address};
use crate::grpc::tls::build_client_tls_config;
use crate::grpc::types::GrpcTauriTarget;

/// Maximum number of channels the pool holds before evicting the LRU entry.
pub const MAX_CHANNEL_POOL_CAPACITY: usize = 32;

// ─── Pool internals ───────────────────────────────────────────────────────────

struct PoolEntry {
    channel: Channel,
    /// Wall-clock instant of the most recent `get_or_connect` hit.
    /// Reserved for Phase 7C+ idle-eviction: drop channels unused for > N minutes.
    #[allow(dead_code)]
    last_used: Instant,
    /// Number of times this entry has been returned from the pool (reuse count).
    hit_count: u64,
}

struct PoolInner {
    /// Channel store keyed by transport fingerprint.
    entries: HashMap<String, PoolEntry>,
    /// LRU order: front = least recently used, back = most recently used.
    /// Maintained in sync with `entries`.
    lru_order: Vec<String>,
}

// ─── Public API ───────────────────────────────────────────────────────────────

/// Pool-wide statistics snapshot.
#[derive(Debug, Clone)]
pub struct ChannelPoolStats {
    /// Number of channels currently in the pool.
    pub size: usize,
    /// Maximum pool capacity (always [`MAX_CHANNEL_POOL_CAPACITY`]).
    /// Used in pool tests and future diagnostics API.
    #[allow(dead_code)]
    pub capacity: usize,
    /// Sum of `hit_count` across all entries (total reuse events since last eviction).
    /// Used in pool tests and future diagnostics API.
    #[allow(dead_code)]
    pub hit_count_total: u64,
}

/// Thread-safe pool of lazy tonic channels.
///
/// Uses `std::sync::Mutex` for Tauri-thread compatibility — same pattern as
/// `WsState`, `KafkaState`, and `ExecutorState` in this codebase.
pub struct ChannelPool {
    inner: Arc<Mutex<PoolInner>>,
}

impl Clone for ChannelPool {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

impl ChannelPool {
    /// Create an empty pool.
    pub fn new() -> Self {
        ChannelPool {
            inner: Arc::new(Mutex::new(PoolInner {
                entries: HashMap::new(),
                lru_order: Vec::new(),
            })),
        }
    }

    /// Return an existing channel for `target`, or build a new lazy channel.
    ///
    /// On hit: updates the LRU order and increments the hit counter.
    /// On miss: builds a lazy channel first, then evicts the LRU entry (if at
    /// capacity) and inserts the new entry. A failed build never evicts.
    ///
    /// The returned `Channel` is a cheap clone of the pooled instance.
    /// In-flight RPCs on a previously returned clone are unaffected by eviction.
    pub fn get_or_connect(&self, target: &GrpcTauriTarget) -> Result<Channel, String> {
        let fp = channel_fingerprint(target);

        // Fast path — cache hit under lock
        {
            let mut pool = self
                .inner
                .lock()
                .map_err(|e| format!("channel pool lock poisoned: {e}"))?;

            if let Some(entry) = pool.entries.get_mut(&fp) {
                entry.last_used = Instant::now();
                entry.hit_count += 1;
                let ch = entry.channel.clone();
                pool.lru_order.retain(|k| k != &fp);
                pool.lru_order.push(fp);
                return Ok(ch);
            }
        }

        // Build outside the lock so other pool operations are not blocked.
        let channel = build_lazy_channel(target)?;

        let mut pool = self
            .inner
            .lock()
            .map_err(|e| format!("channel pool lock poisoned: {e}"))?;

        // Another thread may have inserted the same fingerprint while we built.
        if let Some(entry) = pool.entries.get_mut(&fp) {
            entry.last_used = Instant::now();
            entry.hit_count += 1;
            let ch = entry.channel.clone();
            pool.lru_order.retain(|k| k != &fp);
            pool.lru_order.push(fp);
            return Ok(ch);
        }

        if pool.entries.len() >= MAX_CHANNEL_POOL_CAPACITY {
            if let Some(lru_key) = pool.lru_order.first().cloned() {
                pool.entries.remove(&lru_key);
                pool.lru_order.remove(0);
            }
        }

        let now = Instant::now();
        pool.entries.insert(
            fp.clone(),
            PoolEntry {
                channel: channel.clone(),
                last_used: now,
                hit_count: 0,
            },
        );
        pool.lru_order.push(fp);

        debug_assert_eq!(
            pool.entries.len(),
            pool.lru_order.len(),
            "LRU order must stay in sync with entries"
        );

        Ok(channel)
    }

    /// Explicitly evict the channel for `target`.
    ///
    /// Returns `true` if an entry was found and removed, `false` if absent.
    /// Used in pool tests and by `grpc_tab_cleanup` (Phase 7H+).
    #[allow(dead_code)]
    pub fn evict(&self, target: &GrpcTauriTarget) -> bool {
        let fp = channel_fingerprint(target);
        let mut pool = self
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        pool.lru_order.retain(|k| k != &fp);
        let removed = pool.entries.remove(&fp).is_some();
        debug_assert_eq!(
            pool.entries.len(),
            pool.lru_order.len(),
            "LRU order must stay in sync with entries after evict"
        );
        removed
    }

    /// Evict all channels from the pool.
    pub fn evict_all(&self) {
        let mut pool = self
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        pool.entries.clear();
        pool.lru_order.clear();
    }

    /// Returns `true` if a channel for `target` is currently in the pool.
    /// Used in pool tests and future diagnostic commands.
    #[allow(dead_code)]
    pub fn contains(&self, target: &GrpcTauriTarget) -> bool {
        let fp = channel_fingerprint(target);
        let pool = self
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        pool.entries.contains_key(&fp)
    }

    /// Return a snapshot of current pool statistics.
    pub fn stats(&self) -> ChannelPoolStats {
        let pool = self
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let hit_count_total = pool.entries.values().map(|e| e.hit_count).sum();
        ChannelPoolStats {
            size: pool.entries.len(),
            capacity: MAX_CHANNEL_POOL_CAPACITY,
            hit_count_total,
        }
    }
}

impl Default for ChannelPool {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/// Build a lazy tonic channel for `target`.
///
/// Uses `Endpoint::connect_lazy()` — no TCP/TLS handshake occurs here.
/// The connection is established on the first RPC call.
fn build_lazy_channel(target: &GrpcTauriTarget) -> Result<Channel, String> {
    use crate::grpc::types::GrpcTauriTlsMode;

    let use_tls = !matches!(target.tls_mode, GrpcTauriTlsMode::Disabled);
    if use_tls {
        ensure_rustls_crypto_provider();
    }

    let scheme = if use_tls { "https" } else { "http" };

    let host = normalize_grpc_address(&target.address);

    let uri_str = format!("{scheme}://{host}");

    let mut endpoint = Endpoint::from_shared(uri_str.clone())
        .map_err(|e| format!("invalid gRPC endpoint URI '{uri_str}': {e}"))?;

    // Apply TLS config (if any)
    let tls_config = build_client_tls_config(target)?;
    if let Some(tls) = tls_config {
        endpoint = endpoint
            .tls_config(tls)
            .map_err(|e| format!("TLS configuration error for '{uri_str}': {e}"))?;
    }

    Ok(endpoint.connect_lazy())
}

/// Install the process-level rustls ring provider before any TLS endpoint build.
///
/// Idempotent — matches `lib.rs` startup and keeps unit tests from needing
/// per-test provider bootstrapping when they call `get_or_connect` with TLS.
fn ensure_rustls_crypto_provider() {
    use std::sync::Once;
    static INIT: Once = Once::new();
    INIT.call_once(|| {
        let _ = rustls::crypto::ring::default_provider().install_default();
    });
}
