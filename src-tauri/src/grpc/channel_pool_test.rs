//! Phase 7B channel pool integration tests.
//!
//! All tests run without a live gRPC server — channels are built via
//! `connect_lazy()` so no TCP/TLS handshake occurs.
//!
//! Tests use `#[tokio::test]` because `tonic::transport::Endpoint::connect_lazy()`
//! spawns internal background tasks that require a Tokio runtime context, even
//! though no actual network connection is established.

#[cfg(test)]
mod tests {
    use crate::grpc::channel_pool::{ChannelPool, MAX_CHANNEL_POOL_CAPACITY};
    use crate::grpc::types::{GrpcTauriTarget, GrpcTauriTlsMode};

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /// Create a plain (no TLS) target for the given address.
    fn target(addr: &str) -> GrpcTauriTarget {
        GrpcTauriTarget {
            address: addr.to_string(),
            tls_mode: GrpcTauriTlsMode::Disabled,
            tls_config: None,
        }
    }

    /// Create a TLS target (no client cert, no custom CA).
    fn tls_target(addr: &str) -> GrpcTauriTarget {
        GrpcTauriTarget {
            address: addr.to_string(),
            tls_mode: GrpcTauriTlsMode::Tls,
            tls_config: None,
        }
    }

    /// Create an mTLS target with valid test PEM material (lazy channel build only).
    fn mtls_target(addr: &str) -> GrpcTauriTarget {
        use crate::grpc::test_pem::{TEST_CLIENT_CERT_PEM, TEST_CLIENT_KEY_PEM};
        use crate::grpc::types::{GrpcTauriTlsConfig, GrpcTauriTlsMode};
        GrpcTauriTarget {
            address: addr.to_string(),
            tls_mode: GrpcTauriTlsMode::Mtls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: None,
                client_cert_pem: Some(TEST_CLIENT_CERT_PEM.to_string()),
                client_key_pem: Some(TEST_CLIENT_KEY_PEM.to_string()),
                server_name_override: None,
            }),
        }
    }

    /// Create a TLS target with an optional custom CA PEM.
    fn tls_target_with_ca(addr: &str, ca_pem: Option<&str>) -> GrpcTauriTarget {
        use crate::grpc::types::{GrpcTauriTlsConfig, GrpcTauriTlsMode};
        GrpcTauriTarget {
            address: addr.to_string(),
            tls_mode: GrpcTauriTlsMode::Tls,
            tls_config: ca_pem.map(|ca| GrpcTauriTlsConfig {
                server_ca_pem: Some(ca.to_string()),
                client_cert_pem: None,
                client_key_pem: None,
                server_name_override: None,
            }),
        }
    }

    /// Create N unique targets with addresses localhost:50000 through localhost:50000+n-1.
    fn make_n_targets(n: usize) -> Vec<GrpcTauriTarget> {
        (0..n)
            .map(|i| target(&format!("localhost:{}", 50_000 + i)))
            .collect()
    }

    // ─── Capacity constant (no Tokio runtime needed) ───────────────────────

    #[test]
    fn pool_capacity_limit_is_32() {
        assert_eq!(MAX_CHANNEL_POOL_CAPACITY, 32,
            "pool capacity constant must be 32");
    }

    #[test]
    fn channel_pool_default_is_empty() {
        let pool = ChannelPool::default();
        assert_eq!(pool.stats().size, 0);
        assert_eq!(pool.stats().capacity, MAX_CHANNEL_POOL_CAPACITY);
    }

    #[test]
    fn explicit_evict_absent_entry_returns_false() {
        let pool = ChannelPool::new();
        assert!(!pool.evict(&target("svc:50051")),
            "evict on absent entry must return false");
    }

    // ─── Basic reuse ──────────────────────────────────────────────────────────

    #[tokio::test]
    async fn reuse_on_identical_target_returns_same_pool_entry() {
        let pool = ChannelPool::new();
        let t = target("localhost:50051");

        pool.get_or_connect(&t).expect("first get_or_connect");
        pool.get_or_connect(&t).expect("second get_or_connect");

        // Both calls must share ONE pool entry, not create two
        assert_eq!(pool.stats().size, 1,
            "two calls with identical target must reuse one pool entry");
    }

    #[tokio::test]
    async fn different_addresses_create_distinct_entries() {
        let pool = ChannelPool::new();

        pool.get_or_connect(&target("svc-a:50051")).unwrap();
        pool.get_or_connect(&target("svc-b:50051")).unwrap();

        assert_eq!(pool.stats().size, 2,
            "distinct addresses must produce distinct pool entries");
    }

    #[tokio::test]
    async fn different_tls_modes_create_distinct_entries() {
        let pool = ChannelPool::new();

        pool.get_or_connect(&target("svc:443")).unwrap();       // disabled
        pool.get_or_connect(&tls_target("svc:443")).unwrap();   // tls

        assert_eq!(pool.stats().size, 2,
            "same address with different TLS mode must produce distinct entries");
    }

    #[tokio::test]
    async fn all_three_tls_modes_coexist_as_distinct_pool_entries() {
        // Disabled, Tls, and Mtls for the same address must each create a separate
        // pool entry — the critical non-cross-contamination guarantee from the plan.
        let pool = ChannelPool::new();

        let disabled = target("svc:50051");
        let tls_only = tls_target("svc:50051");
        let mtls = mtls_target("svc:50051");

        pool.get_or_connect(&disabled).unwrap();
        pool.get_or_connect(&tls_only).unwrap();
        pool.get_or_connect(&mtls).unwrap();

        assert_eq!(pool.stats().size, 3,
            "disabled + tls + mtls on same address must create 3 distinct pool entries");
        assert!(pool.contains(&disabled));
        assert!(pool.contains(&tls_only));
        assert!(pool.contains(&mtls));
    }

    // ─── Hit counter ─────────────────────────────────────────────────────────

    #[tokio::test]
    async fn hit_count_increments_on_reuse() {
        let pool = ChannelPool::new();
        let t = target("svc:50051");

        // First call is a miss (hit_count starts at 0 in entry)
        pool.get_or_connect(&t).unwrap();
        assert_eq!(pool.stats().hit_count_total, 0,
            "initial insertion has hit_count 0");

        // Second + third calls are hits
        pool.get_or_connect(&t).unwrap();
        assert_eq!(pool.stats().hit_count_total, 1);

        pool.get_or_connect(&t).unwrap();
        assert_eq!(pool.stats().hit_count_total, 2);
    }

    // ─── Capacity and LRU eviction ────────────────────────────────────────────

    #[tokio::test]
    async fn pool_fills_to_capacity_without_eviction() {
        let pool = ChannelPool::new();
        let targets = make_n_targets(MAX_CHANNEL_POOL_CAPACITY);

        for t in &targets {
            pool.get_or_connect(t).unwrap();
        }
        assert_eq!(pool.stats().size, MAX_CHANNEL_POOL_CAPACITY,
            "pool must hold exactly MAX_CHANNEL_POOL_CAPACITY entries");
    }

    #[tokio::test]
    async fn eviction_at_capacity_removes_lru_entry() {
        let pool = ChannelPool::new();
        // Fill pool to capacity with targets 0..31
        let targets = make_n_targets(MAX_CHANNEL_POOL_CAPACITY);
        for t in &targets {
            pool.get_or_connect(t).unwrap();
        }
        assert_eq!(pool.stats().size, MAX_CHANNEL_POOL_CAPACITY);

        // Insert one more — must evict the LRU (targets[0], oldest insertion)
        let extra = target("localhost:99999");
        pool.get_or_connect(&extra).unwrap();

        // Pool size must remain at capacity
        assert_eq!(pool.stats().size, MAX_CHANNEL_POOL_CAPACITY,
            "pool must not exceed capacity after eviction");

        // targets[0] (LRU) must have been evicted
        assert!(!pool.contains(&targets[0]),
            "oldest inserted entry (LRU) must be evicted");

        // targets[1] and later must still be present
        assert!(pool.contains(&targets[1]),
            "second-oldest entry must still be in pool after eviction of LRU");

        // The newly inserted entry must be present
        assert!(pool.contains(&extra),
            "newly inserted entry must be in pool");
    }

    #[tokio::test]
    async fn lru_order_updates_on_access() {
        // Fill pool to capacity 0..31.
        // Access entry 0 (becomes MRU).
        // Insert entry 32 → evicts LRU, which is now entry 1 (not entry 0).
        let pool = ChannelPool::new();
        let targets = make_n_targets(MAX_CHANNEL_POOL_CAPACITY);

        for t in &targets {
            pool.get_or_connect(t).unwrap();
        }

        // Re-access targets[0] — moves it from LRU to MRU position
        pool.get_or_connect(&targets[0]).unwrap();

        // Now insert a 33rd entry → must evict targets[1] (new LRU), not targets[0]
        let extra = target("localhost:88888");
        pool.get_or_connect(&extra).unwrap();

        // targets[0] accessed last — must survive
        assert!(pool.contains(&targets[0]),
            "accessed entry must not be evicted; it moved to MRU position");

        // targets[1] was the oldest-unaccessed — must be evicted
        assert!(!pool.contains(&targets[1]),
            "entry that was LRU after targets[0] was accessed must be evicted");

        // Pool must remain at capacity
        assert_eq!(pool.stats().size, MAX_CHANNEL_POOL_CAPACITY);
    }

    // ─── Explicit eviction ────────────────────────────────────────────────────

    #[tokio::test]
    async fn explicit_evict_removes_entry() {
        let pool = ChannelPool::new();
        let t = target("svc:50051");

        pool.get_or_connect(&t).unwrap();
        assert!(pool.contains(&t), "entry must be present before evict");

        let removed = pool.evict(&t);
        assert!(removed, "evict must return true when entry was present");
        assert!(!pool.contains(&t), "entry must be absent after evict");
        assert_eq!(pool.stats().size, 0);
    }

    #[tokio::test]
    async fn evict_all_clears_pool() {
        let pool = ChannelPool::new();
        for t in &make_n_targets(8) {
            pool.get_or_connect(t).unwrap();
        }
        assert_eq!(pool.stats().size, 8);

        pool.evict_all();
        assert_eq!(pool.stats().size, 0, "evict_all must clear the pool");

        // Pool must be usable after evict_all
        let t = target("localhost:50051");
        pool.get_or_connect(&t).unwrap();
        assert_eq!(pool.stats().size, 1,
            "pool must be usable after evict_all");
    }

    // ─── Stats ────────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn stats_report_correct_values() {
        let pool = ChannelPool::new();
        assert_eq!(pool.stats().size, 0);
        assert_eq!(pool.stats().capacity, MAX_CHANNEL_POOL_CAPACITY);
        assert_eq!(pool.stats().hit_count_total, 0);

        let t = target("svc:50051");
        pool.get_or_connect(&t).unwrap(); // miss → size 1
        pool.get_or_connect(&t).unwrap(); // hit
        pool.get_or_connect(&t).unwrap(); // hit

        let s = pool.stats();
        assert_eq!(s.size, 1);
        assert_eq!(s.capacity, MAX_CHANNEL_POOL_CAPACITY);
        assert_eq!(s.hit_count_total, 2, "two reuse hits must appear in total");
    }

    // ─── Address normalization ────────────────────────────────────────────────

    #[tokio::test]
    async fn addresses_with_scheme_prefix_share_pool_entry() {
        // Defensive normalization: http(s):// prefixes must not create duplicate channels.
        let pool = ChannelPool::new();

        let t_plain = target("localhost:50051");
        let t_http = target("http://localhost:50051");
        let t_https = target("https://localhost:50051");

        pool.get_or_connect(&t_plain).expect("plain address must work");
        pool.get_or_connect(&t_http).expect("http:// prefixed address must work");
        pool.get_or_connect(&t_https).expect("https:// prefixed address must work");

        assert_eq!(pool.stats().size, 1, "scheme variants must share one pool entry");
        assert_eq!(pool.stats().hit_count_total, 2, "second and third calls are reuse hits");
    }

    #[tokio::test]
    async fn different_ca_certs_create_distinct_pool_entries() {
        use crate::grpc::test_pem::{TEST_CA_PEM_B, TEST_CLIENT_CERT_PEM};

        let pool = ChannelPool::new();
        let ca_a = tls_target_with_ca("svc:443", Some(TEST_CLIENT_CERT_PEM));
        let ca_b = tls_target_with_ca("svc:443", Some(TEST_CA_PEM_B));

        pool.get_or_connect(&ca_a).unwrap();
        pool.get_or_connect(&ca_b).unwrap();

        assert_eq!(
            pool.stats().size,
            2,
            "different CA certs must produce distinct pool entries"
        );
    }

    #[tokio::test]
    async fn addresses_with_whitespace_share_pool_entry() {
        let pool = ChannelPool::new();
        let plain = target("localhost:50051");
        let spaced = target("  localhost:50051  ");

        pool.get_or_connect(&plain).unwrap();
        pool.get_or_connect(&spaced).unwrap();

        assert_eq!(pool.stats().size, 1, "whitespace variants must share one pool entry");
        assert_eq!(pool.stats().hit_count_total, 1);
    }

    #[tokio::test]
    async fn evict_and_contains_honor_address_normalization() {
        let pool = ChannelPool::new();
        let plain = target("localhost:50051");
        let prefixed = target("http://localhost:50051");

        pool.get_or_connect(&plain).unwrap();
        assert!(pool.contains(&prefixed), "contains must normalize address");

        let removed = pool.evict(&prefixed);
        assert!(removed, "evict must normalize address");
        assert!(!pool.contains(&plain));
    }

    #[tokio::test]
    async fn tls_config_build_failure_does_not_evict_at_capacity() {
        use crate::grpc::types::{GrpcTauriTlsConfig, GrpcTauriTlsMode};

        let pool = ChannelPool::new();
        let targets = make_n_targets(MAX_CHANNEL_POOL_CAPACITY);
        for t in &targets {
            pool.get_or_connect(t).unwrap();
        }

        // Incomplete mTLS (cert without key) fails in build_client_tls_config before eviction.
        let bad = GrpcTauriTarget {
            address: "localhost:99997".to_string(),
            tls_mode: GrpcTauriTlsMode::Mtls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: None,
                client_cert_pem: Some("-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----".to_string()),
                client_key_pem: None,
                server_name_override: None,
            }),
        };
        let result = pool.get_or_connect(&bad);
        assert!(result.is_err(), "incomplete mTLS config must fail before pool mutation");
        assert_eq!(pool.stats().size, MAX_CHANNEL_POOL_CAPACITY);
    }

    #[tokio::test]
    async fn disabled_with_spurious_tls_config_shares_pool_entry() {
        use crate::grpc::types::{GrpcTauriTlsConfig, GrpcTauriTlsMode};

        let pool = ChannelPool::new();
        let plain = target("localhost:50052");
        let with_spurious_tls = GrpcTauriTarget {
            address: "localhost:50052".to_string(),
            tls_mode: GrpcTauriTlsMode::Disabled,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: Some("-----CA-----".to_string()),
                client_cert_pem: Some("-----CERT-----".to_string()),
                client_key_pem: Some("-----KEY-----".to_string()),
                server_name_override: Some("ignored.example.com".to_string()),
            }),
        };

        pool.get_or_connect(&plain).unwrap();
        pool.get_or_connect(&with_spurious_tls).unwrap();

        assert_eq!(
            pool.stats().size,
            1,
            "disabled targets must share one pool entry regardless of spurious tlsConfig"
        );
    }

    #[tokio::test]
    async fn different_sni_overrides_create_distinct_pool_entries() {
        use crate::grpc::types::{GrpcTauriTlsConfig, GrpcTauriTlsMode};

        let pool = ChannelPool::new();
        let no_sni = tls_target("svc:443");
        let with_sni = GrpcTauriTarget {
            address: "svc:443".to_string(),
            tls_mode: GrpcTauriTlsMode::Tls,
            tls_config: Some(GrpcTauriTlsConfig {
                server_ca_pem: None,
                client_cert_pem: None,
                client_key_pem: None,
                server_name_override: Some("override.example.com".to_string()),
            }),
        };

        pool.get_or_connect(&no_sni).unwrap();
        pool.get_or_connect(&with_sni).unwrap();

        assert_eq!(
            pool.stats().size,
            2,
            "TLS targets with different SNI overrides must not share a channel"
        );
    }

    #[tokio::test]
    async fn concurrent_miss_on_new_target_converges_to_one_entry() {
        use std::sync::Arc;

        let pool = Arc::new(ChannelPool::new());
        let t = target("localhost:77777");
        let barrier = Arc::new(tokio::sync::Barrier::new(8));
        let mut tasks = tokio::task::JoinSet::new();

        for _ in 0..8 {
            let pool = Arc::clone(&pool);
            let t = t.clone();
            let barrier = Arc::clone(&barrier);
            tasks.spawn(async move {
                barrier.wait().await;
                pool.get_or_connect(&t).expect("concurrent miss must succeed");
            });
        }
        while tasks.join_next().await.is_some() {}

        assert_eq!(
            pool.stats().size,
            1,
            "concurrent misses on a new target must converge on one pool entry"
        );
    }

    #[tokio::test]
    async fn concurrent_get_or_connect_same_target_is_safe() {
        use std::sync::Arc;

        let pool = Arc::new(ChannelPool::new());
        let t = target("localhost:50051");
        let mut tasks = tokio::task::JoinSet::new();

        for _ in 0..16 {
            let pool = Arc::clone(&pool);
            let t = t.clone();
            tasks.spawn(async move { pool.get_or_connect(&t).unwrap() });
        }
        while tasks.join_next().await.is_some() {}

        assert_eq!(pool.stats().size, 1, "concurrent misses must converge on one entry");
        assert!(
            pool.stats().hit_count_total >= 15,
            "expected reuse hits from concurrent access"
        );
    }

    #[tokio::test]
    async fn invalid_endpoint_uri_does_not_evict_at_capacity() {
        let pool = ChannelPool::new();
        let targets = make_n_targets(MAX_CHANNEL_POOL_CAPACITY);
        for t in &targets {
            pool.get_or_connect(t).unwrap();
        }

        let bad = GrpcTauriTarget {
            address: "://not a valid grpc uri".to_string(),
            tls_mode: GrpcTauriTlsMode::Disabled,
            tls_config: None,
        };
        let result = pool.get_or_connect(&bad);
        assert!(result.is_err(), "invalid endpoint URI must fail channel build");
        assert_eq!(
            pool.stats().size,
            MAX_CHANNEL_POOL_CAPACITY,
            "invalid URI must not evict an existing entry"
        );
    }

    #[tokio::test]
    async fn build_failure_does_not_evict_lru_entry() {
        let pool = ChannelPool::new();
        let targets = make_n_targets(MAX_CHANNEL_POOL_CAPACITY);
        for t in &targets {
            pool.get_or_connect(t).unwrap();
        }
        assert_eq!(pool.stats().size, MAX_CHANNEL_POOL_CAPACITY);

        let bad = GrpcTauriTarget {
            address: "localhost:99998".to_string(),
            tls_mode: GrpcTauriTlsMode::Mtls,
            tls_config: None,
        };
        let result = pool.get_or_connect(&bad);
        assert!(result.is_err(), "invalid mTLS config must fail channel build");
        assert_eq!(
            pool.stats().size,
            MAX_CHANNEL_POOL_CAPACITY,
            "failed build must not evict an existing entry"
        );
        assert!(
            pool.contains(&targets[0]),
            "LRU entry must remain when a new channel build fails"
        );
    }
}
