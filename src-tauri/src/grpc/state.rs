//! Tauri managed state for native gRPC transport — Phase 7C/7H.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tokio_util::sync::CancellationToken;

use crate::grpc::call_registry::CallRegistry;
use crate::grpc::channel_pool::ChannelPool;
use crate::grpc::stream_registry::StreamRegistry;

/// Shared native gRPC state registered via `.manage(GrpcState::new())`.
#[derive(Clone)]
pub struct GrpcState {
    pub pool: ChannelPool,
    pub call_registry: CallRegistry,
    pub stream_registry: StreamRegistry,
    tab_event_listeners: Arc<Mutex<HashMap<String, u32>>>,
    tab_listener_detached_at: Arc<Mutex<HashMap<String, Instant>>>,
    tab_last_heartbeat_at: Arc<Mutex<HashMap<String, Instant>>>,
    supervisor_shutdown: Arc<CancellationToken>,
}

impl GrpcState {
    pub fn new() -> Self {
        Self {
            pool: ChannelPool::new(),
            call_registry: CallRegistry::new(),
            stream_registry: StreamRegistry::new(),
            tab_event_listeners: Arc::new(Mutex::new(HashMap::new())),
            tab_listener_detached_at: Arc::new(Mutex::new(HashMap::new())),
            tab_last_heartbeat_at: Arc::new(Mutex::new(HashMap::new())),
            supervisor_shutdown: Arc::new(CancellationToken::new()),
        }
    }

    pub fn supervisor_shutdown_token(&self) -> CancellationToken {
        (*self.supervisor_shutdown).clone()
    }

    pub fn record_tab_event_listener_attached(&self, tab_id: &str) {
        let now = Instant::now();
        let mut counts = self
            .tab_event_listeners
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let count = counts.entry(tab_id.to_string()).or_insert(0);
        *count = count.saturating_add(1);

        let mut heartbeat = self
            .tab_last_heartbeat_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        heartbeat.insert(tab_id.to_string(), now);

        let mut detached = self
            .tab_listener_detached_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        detached.remove(tab_id);
    }

    pub fn record_tab_event_listener_heartbeat(&self, tab_id: &str) {
        let mut heartbeat = self
            .tab_last_heartbeat_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        heartbeat.insert(tab_id.to_string(), Instant::now());
    }

    pub fn record_tab_event_listener_detached(&self, tab_id: &str) {
        let already_detached = self
            .tab_listener_detached_at
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .contains_key(tab_id);

        let mut should_mark_detached = false;
        {
            let mut counts = self
                .tab_event_listeners
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            match counts.get_mut(tab_id) {
                Some(count) if *count > 0 => {
                    *count -= 1;
                    if *count == 0 {
                        counts.remove(tab_id);
                        should_mark_detached = !already_detached;
                    }
                }
                Some(_) => {
                    counts.remove(tab_id);
                    should_mark_detached = !already_detached;
                }
                None => {
                    // Detach without a matching attach — still start grace (Express SSE parity).
                    should_mark_detached = !already_detached;
                }
            }
        }
        if should_mark_detached {
            let mut detached = self
                .tab_listener_detached_at
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            detached.insert(tab_id.to_string(), Instant::now());
        }
    }

    pub fn clear_tab_listener_tracking(&self, tab_id: &str) {
        let mut counts = self
            .tab_event_listeners
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        counts.remove(tab_id);
        let mut detached = self
            .tab_listener_detached_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        detached.remove(tab_id);
        let mut heartbeat = self
            .tab_last_heartbeat_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        heartbeat.remove(tab_id);
    }

    pub fn clear_all_listener_tracking(&self) {
        self.tab_event_listeners
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
        self.tab_listener_detached_at
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
        self.tab_last_heartbeat_at
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
    }

    pub fn clear_detached_tab_markers(&self, tab_ids: &[String]) {
        if tab_ids.is_empty() {
            return;
        }
        let mut detached = self
            .tab_listener_detached_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        for tab_id in tab_ids {
            detached.remove(tab_id);
        }
    }

    pub fn clear_heartbeat_markers(&self, tab_ids: &[String]) {
        if tab_ids.is_empty() {
            return;
        }
        let mut heartbeat = self
            .tab_last_heartbeat_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        for tab_id in tab_ids {
            heartbeat.remove(tab_id);
        }
    }

    pub fn tab_has_active_streams(&self, tab_id: &str) -> bool {
        self.stream_registry.active_count_for_tab(tab_id) > 0
    }

    pub fn detached_tabs_snapshot(&self) -> Vec<(String, Instant)> {
        self.tab_listener_detached_at
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .map(|(tab_id, instant)| (tab_id.clone(), *instant))
            .collect()
    }

    pub fn stale_attached_tabs_snapshot(&self, stale_after: Duration) -> Vec<String> {
        let now = Instant::now();
        let counts = self
            .tab_event_listeners
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let heartbeat = self
            .tab_last_heartbeat_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());

        counts
            .iter()
            .filter_map(|(tab_id, listener_count)| {
                if *listener_count == 0 {
                    return None;
                }
                let is_stale = match heartbeat.get(tab_id) {
                    Some(last) => now.duration_since(*last) >= stale_after,
                    None => true,
                };
                if is_stale {
                    Some(tab_id.clone())
                } else {
                    None
                }
            })
            .collect()
    }

    pub fn tab_event_listener_count(&self, tab_id: &str) -> u32 {
        self.tab_event_listeners
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(tab_id)
            .copied()
            .unwrap_or(0)
    }

    pub fn attached_tab_count(&self) -> usize {
        self.tab_event_listeners
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .len()
    }

    pub fn detached_tab_count(&self) -> usize {
        self.tab_listener_detached_at
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .len()
    }

    pub fn total_listener_count(&self) -> u32 {
        self.tab_event_listeners
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .values()
            .copied()
            .sum()
    }

    #[cfg(test)]
    pub fn set_tab_detached_at_for_test(&self, tab_id: &str, detached_at: Instant) {
        let mut detached = self
            .tab_listener_detached_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        detached.insert(tab_id.to_string(), detached_at);
    }

    #[cfg(test)]
    pub fn set_tab_heartbeat_at_for_test(&self, tab_id: &str, heartbeat_at: Instant) {
        let mut heartbeat = self
            .tab_last_heartbeat_at
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        heartbeat.insert(tab_id.to_string(), heartbeat_at);
    }
}

impl Default for GrpcState {
    fn default() -> Self {
        Self::new()
    }
}
