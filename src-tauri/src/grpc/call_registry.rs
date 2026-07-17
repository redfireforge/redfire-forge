//! In-flight unary call registry — Phase 7C.
//!
//! Mirrors `src-server/grpc/callRegistry.ts`: tracks active unary calls by
//! `requestId`, supports tab-scoped cancellation via `CancellationToken`.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CallRegistryStatus {
    Active,
    Completed,
    Cancelled,
}

pub struct CallRegistryEntry {
    pub request_id: String,
    pub tab_id: String,
    pub cancel_token: CancellationToken,
    pub status: CallRegistryStatus,
    /// Wall-clock start time — reserved for Phase 7C+ call timing diagnostics
    /// (e.g., `started_at_epoch_ms(entry.started_at)` for result timestamps).
    #[allow(dead_code)]
    pub started_at: Instant,
}

#[derive(Default, Clone)]
pub struct CallRegistry {
    inner: Arc<Mutex<HashMap<String, CallRegistryEntry>>>,
}

pub enum TryRegisterOutcome {
    Registered {
        cancel_token: CancellationToken,
    },
    DuplicateActive,
}

pub enum CancelOutcome {
    Cancelled,
    NotFound,
    AlreadyCompleted,
    TabMismatch,
}

#[derive(Debug, Clone, Copy)]
pub struct CallRegistryStats {
    pub total: usize,
    pub active: usize,
    pub completed: usize,
    pub cancelled: usize,
}

impl CallRegistry {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn try_register(
        &self,
        request_id: &str,
        tab_id: &str,
    ) -> TryRegisterOutcome {
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());

        if let Some(existing) = map.get(request_id) {
            if existing.status == CallRegistryStatus::Active {
                return TryRegisterOutcome::DuplicateActive;
            }
            map.remove(request_id);
        }

        let cancel_token = CancellationToken::new();
        map.insert(
            request_id.to_string(),
            CallRegistryEntry {
                request_id: request_id.to_string(),
                tab_id: tab_id.to_string(),
                cancel_token: cancel_token.clone(),
                status: CallRegistryStatus::Active,
                started_at: Instant::now(),
            },
        );

        TryRegisterOutcome::Registered { cancel_token }
    }

    pub fn mark_completed(&self, request_id: &str) {
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(entry) = map.get_mut(request_id) {
            if entry.status == CallRegistryStatus::Active {
                entry.status = CallRegistryStatus::Completed;
            }
        }
    }

    pub fn mark_cancelled(&self, request_id: &str) {
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(entry) = map.get_mut(request_id) {
            if entry.status == CallRegistryStatus::Active {
                entry.status = CallRegistryStatus::Cancelled;
            }
        }
    }

    pub fn status_of(&self, request_id: &str) -> Option<CallRegistryStatus> {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        map.get(request_id).map(|entry| entry.status)
    }

    pub fn cancel(&self, request_id: &str, tab_id: &str) -> CancelOutcome {
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let Some(entry) = map.get_mut(request_id) else {
            return CancelOutcome::NotFound;
        };

        if entry.tab_id != tab_id {
            return CancelOutcome::TabMismatch;
        }

        if entry.status != CallRegistryStatus::Active {
            map.remove(request_id);
            return CancelOutcome::AlreadyCompleted;
        }

        entry.status = CallRegistryStatus::Cancelled;
        entry.cancel_token.cancel();
        CancelOutcome::Cancelled
    }

    pub fn remove(&self, request_id: &str) {
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        map.remove(request_id);
    }

    /// Number of active calls — used in lifecycle tests and diagnostic monitoring.
    #[allow(dead_code)]
    pub fn active_count(&self) -> usize {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        map.values()
            .filter(|entry| entry.status == CallRegistryStatus::Active)
            .count()
    }

    /// Aggregate status counters for native diagnostics snapshots.
    pub fn stats(&self) -> CallRegistryStats {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let mut active = 0usize;
        let mut completed = 0usize;
        let mut cancelled = 0usize;
        for entry in map.values() {
            match entry.status {
                CallRegistryStatus::Active => active += 1,
                CallRegistryStatus::Completed => completed += 1,
                CallRegistryStatus::Cancelled => cancelled += 1,
            }
        }
        CallRegistryStats {
            total: map.len(),
            active,
            completed,
            cancelled,
        }
    }

    pub fn cancel_all_for_tab(&self, tab_id: &str) -> u32 {
        let request_ids: Vec<String> = {
            let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            map.values()
                .filter(|entry| entry.tab_id == tab_id && entry.status == CallRegistryStatus::Active)
                .map(|entry| entry.request_id.clone())
                .collect()
        };

        let mut cancelled = 0u32;
        for request_id in request_ids {
            if matches!(self.cancel(&request_id, tab_id), CancelOutcome::Cancelled) {
                cancelled += 1;
            }
        }
        cancelled
    }

    pub fn purge_for_tab(&self, tab_id: &str) -> u32 {
        let request_ids: Vec<String> = {
            let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            map.values()
                .filter(|entry| entry.tab_id == tab_id)
                .map(|entry| entry.request_id.clone())
                .collect()
        };

        let mut removed = 0u32;
        for request_id in request_ids {
            self.remove(&request_id);
            removed += 1;
        }
        removed
    }

    pub fn purge_all(&self) -> u32 {
        let request_ids: Vec<String> = {
            let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            map.keys().cloned().collect()
        };

        let mut removed = 0u32;
        for request_id in request_ids {
            self.remove(&request_id);
            removed += 1;
        }
        removed
    }

    /// Remove completed/cancelled entries so long sessions do not grow the registry.
    pub fn purge_inactive(&self) -> u32 {
        let request_ids: Vec<String> = {
            let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            map.values()
                .filter(|entry| entry.status != CallRegistryStatus::Active)
                .map(|entry| entry.request_id.clone())
                .collect()
        };

        let mut removed = 0u32;
        for request_id in request_ids {
            self.remove(&request_id);
            removed += 1;
        }
        removed
    }
}

/// Convert an [`Instant`] start time to a Unix epoch millisecond timestamp.
/// Reserved for Phase 7C+ result timing (`startedAt` field in future result types).
#[allow(dead_code)]
pub fn started_at_epoch_ms(started: Instant) -> u64 {
    let elapsed = started.elapsed();
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|now| now.saturating_sub(elapsed).as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_active_request_is_rejected() {
        let registry = CallRegistry::new();
        assert!(matches!(
            registry.try_register("req-1", "tab-a"),
            TryRegisterOutcome::Registered { .. }
        ));
        assert!(matches!(
            registry.try_register("req-1", "tab-a"),
            TryRegisterOutcome::DuplicateActive
        ));
    }

    #[test]
    fn cancel_active_call_succeeds() {
        let registry = CallRegistry::new();
        let TryRegisterOutcome::Registered { cancel_token } =
            registry.try_register("req-1", "tab-a")
        else {
            panic!("expected registration");
        };

        assert!(matches!(
            registry.cancel("req-1", "tab-a"),
            CancelOutcome::Cancelled
        ));
        assert!(cancel_token.is_cancelled());
    }

    #[test]
    fn cancel_wrong_tab_is_tab_mismatch() {
        let registry = CallRegistry::new();
        registry.try_register("req-1", "tab-a");
        assert!(matches!(
            registry.cancel("req-1", "tab-b"),
            CancelOutcome::TabMismatch
        ));
    }

    #[test]
    fn cancel_completed_call_returns_already_completed() {
        let registry = CallRegistry::new();
        registry.try_register("req-1", "tab-a");
        registry.mark_completed("req-1");
        assert!(matches!(
            registry.cancel("req-1", "tab-a"),
            CancelOutcome::AlreadyCompleted
        ));
    }

    #[test]
    fn reregister_after_completed_is_allowed() {
        let registry = CallRegistry::new();
        registry.try_register("req-1", "tab-a");
        registry.mark_completed("req-1");
        assert!(matches!(
            registry.try_register("req-1", "tab-a"),
            TryRegisterOutcome::Registered { .. }
        ));
    }
}
