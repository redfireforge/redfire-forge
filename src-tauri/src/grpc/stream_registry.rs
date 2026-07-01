//! Active gRPC stream registry — Phase 7D.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use bytes::Bytes;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::grpc::types::{GrpcTauriDescriptorPayload, GrpcTauriStreamingCallType};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamRegistryStatus {
    Active,
    Ended,
    Cancelled,
    Error,
}

pub enum StreamOutbound {
    Message(Bytes),
    EndWrites,
}

pub struct StreamRegistryEntry {
    pub stream_id: String,
    pub tab_id: String,
    pub request_id: String,
    pub call_type: GrpcTauriStreamingCallType,
    pub service_name: String,
    pub method_name: String,
    pub descriptor: GrpcTauriDescriptorPayload,
    pub status: StreamRegistryStatus,
    pub cancel_token: CancellationToken,
    pub outbound_tx: Option<mpsc::Sender<StreamOutbound>>,
    pub sequence: u64,
    pub terminal_emitted: bool,
    pub client_writes_ended: bool,
    pub last_activity_at: Instant,
    pub terminal_at: Option<Instant>,
}

#[derive(Clone)]
pub struct StreamRegistry {
    inner: Arc<Mutex<HashMap<String, Arc<Mutex<StreamRegistryEntry>>>>>,
    active_request_ids: Arc<Mutex<HashMap<String, String>>>,
}

pub enum TryRegisterStreamOutcome {
    Registered {
        cancel_token: CancellationToken,
        outbound_tx: Option<mpsc::Sender<StreamOutbound>>,
    },
    DuplicateActiveRequest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamControlOutcome {
    Acknowledged,
    AlreadyTerminal,
    NotFound,
    TabMismatch,
    ClientWritesEnded,
}

impl StreamRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn try_register(
        &self,
        stream_id: &str,
        request_id: &str,
        tab_id: &str,
        call_type: GrpcTauriStreamingCallType,
        service_name: String,
        method_name: String,
        descriptor: GrpcTauriDescriptorPayload,
        outbound_tx: Option<mpsc::Sender<StreamOutbound>>,
    ) -> TryRegisterStreamOutcome {
        let mut requests = self
            .active_request_ids
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if let Some(existing_stream_id) = requests.get(request_id) {
            if let Some(existing) = self.get_entry(existing_stream_id) {
                if existing.lock().unwrap().status == StreamRegistryStatus::Active {
                    return TryRegisterStreamOutcome::DuplicateActiveRequest;
                }
            }
            requests.remove(request_id);
        }

        let cancel_token = CancellationToken::new();
        let now = Instant::now();
        let entry = StreamRegistryEntry {
            stream_id: stream_id.to_string(),
            tab_id: tab_id.to_string(),
            request_id: request_id.to_string(),
            call_type,
            service_name,
            method_name,
            descriptor,
            status: StreamRegistryStatus::Active,
            cancel_token: cancel_token.clone(),
            outbound_tx: outbound_tx.clone(),
            sequence: 0,
            terminal_emitted: false,
            client_writes_ended: false,
            last_activity_at: now,
            terminal_at: None,
        };

        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        map.insert(
            stream_id.to_string(),
            Arc::new(Mutex::new(entry)),
        );
        requests.insert(request_id.to_string(), stream_id.to_string());

        TryRegisterStreamOutcome::Registered {
            cancel_token,
            outbound_tx,
        }
    }

    fn get_entry(&self, stream_id: &str) -> Option<Arc<Mutex<StreamRegistryEntry>>> {
        self.inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(stream_id)
            .cloned()
    }

    pub fn with_entry<F, R>(&self, stream_id: &str, tab_id: &str, f: F) -> Result<R, StreamControlOutcome>
    where
        F: FnOnce(&mut StreamRegistryEntry) -> Result<R, StreamControlOutcome>,
    {
        let Some(entry_arc) = self.get_entry(stream_id) else {
            return Err(StreamControlOutcome::NotFound);
        };
        let mut entry = entry_arc.lock().unwrap_or_else(|e| e.into_inner());
        if entry.tab_id != tab_id {
            return Err(StreamControlOutcome::TabMismatch);
        }
        f(&mut entry)
    }

    /// Returns true only for the first terminal emitter for this stream (prevents duplicate grpc-end/grpc-error).
    pub fn try_claim_terminal_emit(&self, stream_id: &str) -> bool {
        let Some(entry_arc) = self.get_entry(stream_id) else {
            return false;
        };
        let mut entry = entry_arc.lock().unwrap();
        if entry.terminal_emitted {
            return false;
        }
        entry.terminal_emitted = true;
        true
    }

    pub fn is_non_active(&self, stream_id: &str) -> bool {
        self.get_entry(stream_id)
            .map(|entry| entry.lock().unwrap().status != StreamRegistryStatus::Active)
            .unwrap_or(false)
    }

    pub fn next_sequence(&self, stream_id: &str) -> Option<u64> {
        let entry_arc = self.get_entry(stream_id)?;
        let mut entry = entry_arc.lock().unwrap();
        entry.sequence += 1;
        Some(entry.sequence)
    }

    pub fn snapshot(&self, stream_id: &str) -> Option<(String, String, String, u64)> {
        let entry_arc = self.get_entry(stream_id)?;
        let entry = entry_arc.lock().unwrap();
        Some((
            entry.stream_id.clone(),
            entry.request_id.clone(),
            entry.tab_id.clone(),
            entry.sequence,
        ))
    }

    pub fn mark_terminal(&self, stream_id: &str, status: StreamRegistryStatus) {
        if let Some(entry_arc) = self.get_entry(stream_id) {
            let mut entry = entry_arc.lock().unwrap();
            if entry.status == StreamRegistryStatus::Active {
                entry.status = status;
                entry.terminal_at = Some(Instant::now());
            }
            entry.outbound_tx = None;
            entry.last_activity_at = Instant::now();
        }
    }

    pub fn remove(&self, stream_id: &str) {
        let request_id = {
            let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            map.get(stream_id)
                .map(|entry| entry.lock().unwrap().request_id.clone())
        };
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        map.remove(stream_id);
        if let Some(request_id) = request_id {
            let mut requests = self
                .active_request_ids
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            if requests.get(&request_id).is_some_and(|id| id == stream_id) {
                requests.remove(&request_id);
            }
        }
    }

    pub fn cancel_active_for_tab(&self, tab_id: &str) -> Vec<(String, String)> {
        let stream_ids: Vec<(String, String)> = self
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .values()
            .filter_map(|entry| {
                let entry = entry.lock().unwrap();
                if entry.tab_id == tab_id && entry.status == StreamRegistryStatus::Active {
                    Some((entry.stream_id.clone(), entry.request_id.clone()))
                } else {
                    None
                }
            })
            .collect();

        for (stream_id, _) in &stream_ids {
            if let Some(entry_arc) = self.get_entry(stream_id) {
                let mut entry = entry_arc.lock().unwrap();
                if entry.status == StreamRegistryStatus::Active {
                    entry.status = StreamRegistryStatus::Cancelled;
                    entry.terminal_at = Some(Instant::now());
                    entry.cancel_token.cancel();
                    entry.outbound_tx = None;
                    entry.last_activity_at = Instant::now();
                }
            }
        }
        stream_ids
    }

    pub fn remove_all_for_tab(&self, tab_id: &str) -> u32 {
        let stream_ids: Vec<String> = self
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .values()
            .filter_map(|entry| {
                let entry = entry.lock().unwrap();
                if entry.tab_id == tab_id {
                    Some(entry.stream_id.clone())
                } else {
                    None
                }
            })
            .collect();

        let mut removed = 0u32;
        for stream_id in stream_ids {
            self.remove(&stream_id);
            removed += 1;
        }
        removed
    }

    /// Number of currently active streams — used in lifecycle tests and supervisor.
    #[allow(dead_code)]
    pub fn active_count(&self) -> usize {
        self.inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .values()
            .filter(|entry| entry.lock().unwrap().status == StreamRegistryStatus::Active)
            .count()
    }

    pub fn active_count_for_tab(&self, tab_id: &str) -> usize {
        self.inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .values()
            .filter(|entry| {
                let entry = entry.lock().unwrap();
                entry.tab_id == tab_id && entry.status == StreamRegistryStatus::Active
            })
            .count()
    }

    /// Total number of stream entries (active + terminal) — used in tests and diagnostics.
    #[allow(dead_code)]
    pub fn total_count(&self) -> usize {
        self.inner.lock().unwrap_or_else(|e| e.into_inner()).len()
    }

    pub fn list_stream_ids(&self) -> Vec<String> {
        self.inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .keys()
            .cloned()
            .collect()
    }

    pub fn remove_all(&self) -> u32 {
        let stream_ids = self.list_stream_ids();
        let mut removed = 0u32;
        for stream_id in stream_ids {
            self.remove(&stream_id);
            removed += 1;
        }
        removed
    }

    pub fn cancel_all_active(&self) -> u32 {
        use std::collections::HashSet;

        let tab_ids: HashSet<String> = self
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .values()
            .filter_map(|entry| {
                let entry = entry.lock().unwrap();
                if entry.status == StreamRegistryStatus::Active {
                    Some(entry.tab_id.clone())
                } else {
                    None
                }
            })
            .collect();

        let mut cancelled = 0u32;
        for tab_id in tab_ids {
            cancelled += self.cancel_active_for_tab(&tab_id).len() as u32;
        }
        cancelled
    }

    /// Cancel active streams on detached tabs past grace, and purge terminal entries past grace.
    pub fn sweep_orphans(
        &self,
        detached_tabs: &[(String, Instant)],
        orphan_grace: Duration,
        terminal_grace: Duration,
    ) -> (u32, u32) {
        let now = Instant::now();
        let mut cancelled = 0u32;
        let mut purged = 0u32;

        let detached_expired: Vec<String> = detached_tabs
            .iter()
            .filter(|(_, detached_at)| detached_at.elapsed() >= orphan_grace)
            .map(|(tab_id, _)| tab_id.clone())
            .collect();

        for tab_id in detached_expired {
            let active = self.cancel_active_for_tab(&tab_id);
            cancelled += active.len() as u32;
        }

        let stream_ids: Vec<String> = self
            .inner
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .keys()
            .cloned()
            .collect();

        for stream_id in stream_ids {
            let should_remove = {
                let Some(entry_arc) = self.get_entry(&stream_id) else {
                    continue;
                };
                let entry = entry_arc.lock().unwrap();
                if entry.status == StreamRegistryStatus::Active {
                    false
                } else if let Some(terminal_at) = entry.terminal_at {
                    now.duration_since(terminal_at) >= terminal_grace
                } else {
                    entry.last_activity_at.elapsed() >= terminal_grace
                }
            };
            if should_remove {
                self.remove(&stream_id);
                purged += 1;
            }
        }

        (cancelled, purged)
    }


    pub fn touch_activity(&self, stream_id: &str) {
        if let Some(entry_arc) = self.get_entry(stream_id) {
            let mut entry = entry_arc.lock().unwrap();
            entry.last_activity_at = Instant::now();
        }
    }

    #[cfg(test)]
    pub fn set_terminal_at_for_test(&self, stream_id: &str, terminal_at: Instant) {
        if let Some(entry_arc) = self.get_entry(stream_id) {
            let mut entry = entry_arc.lock().unwrap();
            entry.terminal_at = Some(terminal_at);
        }
    }

    pub fn end_control(&self, stream_id: &str, tab_id: &str) -> StreamControlOutcome {
        self.with_entry(stream_id, tab_id, |entry| {
            if entry.status != StreamRegistryStatus::Active {
                return Ok(StreamControlOutcome::AlreadyTerminal);
            }
            if entry.client_writes_ended {
                return Ok(StreamControlOutcome::AlreadyTerminal);
            }
            if let Some(tx) = entry.outbound_tx.as_ref() {
                let _ = tx.try_send(StreamOutbound::EndWrites);
            }
            entry.client_writes_ended = true;
            entry.last_activity_at = Instant::now();
            Ok(StreamControlOutcome::Acknowledged)
        })
        .unwrap_or_else(|outcome| outcome)
    }

    pub fn cancel_control(&self, stream_id: &str, tab_id: &str) -> StreamControlOutcome {
        self.with_entry(stream_id, tab_id, |entry| {
            if entry.status != StreamRegistryStatus::Active {
                return Ok(StreamControlOutcome::AlreadyTerminal);
            }
            entry.status = StreamRegistryStatus::Cancelled;
            entry.terminal_at = Some(Instant::now());
            entry.cancel_token.cancel();
            entry.outbound_tx = None;
            entry.last_activity_at = Instant::now();
            Ok(StreamControlOutcome::Acknowledged)
        })
        .unwrap_or_else(|outcome| outcome)
    }

    pub fn send_outbound(
        &self,
        stream_id: &str,
        tab_id: &str,
        body: Bytes,
    ) -> Result<(), StreamControlOutcome> {
        self.with_entry(stream_id, tab_id, |entry| {
            if entry.client_writes_ended {
                return Err(StreamControlOutcome::ClientWritesEnded);
            }
            if entry.status != StreamRegistryStatus::Active {
                return Err(StreamControlOutcome::AlreadyTerminal);
            }
            let Some(tx) = entry.outbound_tx.as_ref() else {
                return Err(StreamControlOutcome::NotFound);
            };
            tx.try_send(StreamOutbound::Message(body))
                .map_err(|_| StreamControlOutcome::NotFound)?;
            entry.last_activity_at = Instant::now();
            Ok(())
        })
    }

    pub fn encode_context(
        &self,
        stream_id: &str,
        tab_id: &str,
    ) -> Result<(String, String, GrpcTauriStreamingCallType, GrpcTauriDescriptorPayload), StreamControlOutcome>
    {
        self.with_entry(stream_id, tab_id, |entry| {
            if entry.client_writes_ended {
                return Err(StreamControlOutcome::ClientWritesEnded);
            }
            if entry.status != StreamRegistryStatus::Active {
                return Err(StreamControlOutcome::AlreadyTerminal);
            }
            Ok((
                entry.service_name.clone(),
                entry.method_name.clone(),
                entry.call_type.clone(),
                entry.descriptor.clone(),
            ))
        })
    }
}

impl Default for StreamRegistry {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            active_request_ids: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grpc::test_echo_protoset::echo_descriptor_payload;

    fn echo_descriptor() -> GrpcTauriDescriptorPayload {
        echo_descriptor_payload()
    }

    fn register_stream(
        registry: &StreamRegistry,
        stream_id: &str,
        request_id: &str,
        tab_id: &str,
        call_type: GrpcTauriStreamingCallType,
        outbound_tx: Option<mpsc::Sender<StreamOutbound>>,
    ) {
        registry.try_register(
            stream_id,
            request_id,
            tab_id,
            call_type,
            "echo.EchoService".to_string(),
            "ServerStream".to_string(),
            echo_descriptor(),
            outbound_tx,
        );
    }

    #[test]
    fn duplicate_active_request_is_rejected() {
        let registry = StreamRegistry::new();
        assert!(matches!(
            registry.try_register(
                "s1",
                "req-1",
                "tab-a",
                GrpcTauriStreamingCallType::ServerStreaming,
                "echo.EchoService".to_string(),
                "ServerStream".to_string(),
                echo_descriptor(),
                None,
            ),
            TryRegisterStreamOutcome::Registered { .. }
        ));
        assert!(matches!(
            registry.try_register(
                "s2",
                "req-1",
                "tab-a",
                GrpcTauriStreamingCallType::ServerStreaming,
                "echo.EchoService".to_string(),
                "ServerStream".to_string(),
                echo_descriptor(),
                None,
            ),
            TryRegisterStreamOutcome::DuplicateActiveRequest
        ));
    }

    #[test]
    fn cancel_control_is_idempotent_on_terminal_stream() {
        let registry = StreamRegistry::new();
        register_stream(
            &registry,
            "s1",
            "req-1",
            "tab-a",
            GrpcTauriStreamingCallType::ClientStreaming,
            None,
        );
        registry.mark_terminal("s1", StreamRegistryStatus::Ended);
        assert_eq!(
            registry.cancel_control("s1", "tab-a"),
            StreamControlOutcome::AlreadyTerminal
        );
    }

    #[test]
    fn end_control_is_idempotent_on_terminal_stream() {
        let registry = StreamRegistry::new();
        register_stream(
            &registry,
            "s1",
            "req-1",
            "tab-a",
            GrpcTauriStreamingCallType::BidiStreaming,
            None,
        );
        registry.mark_terminal("s1", StreamRegistryStatus::Cancelled);
        assert_eq!(
            registry.end_control("s1", "tab-a"),
            StreamControlOutcome::AlreadyTerminal
        );
    }

    #[test]
    fn wrong_tab_returns_tab_mismatch() {
        let registry = StreamRegistry::new();
        register_stream(
            &registry,
            "s1",
            "req-1",
            "tab-a",
            GrpcTauriStreamingCallType::ServerStreaming,
            None,
        );
        assert_eq!(
            registry.cancel_control("s1", "tab-b"),
            StreamControlOutcome::TabMismatch
        );
    }

    #[test]
    fn next_sequence_is_monotonic() {
        let registry = StreamRegistry::new();
        register_stream(
            &registry,
            "s1",
            "req-1",
            "tab-a",
            GrpcTauriStreamingCallType::ServerStreaming,
            None,
        );
        assert_eq!(registry.next_sequence("s1"), Some(1));
        assert_eq!(registry.next_sequence("s1"), Some(2));
    }

    #[test]
    fn terminal_emit_claim_is_idempotent() {
        let registry = StreamRegistry::new();
        register_stream(
            &registry,
            "s1",
            "req-1",
            "tab-a",
            GrpcTauriStreamingCallType::ServerStreaming,
            None,
        );
        assert!(registry.try_claim_terminal_emit("s1"));
        assert!(!registry.try_claim_terminal_emit("s1"));
    }

    #[test]
    fn send_outbound_rejects_after_client_writes_ended() {
        let registry = StreamRegistry::new();
        let (outbound_tx, _outbound_rx) = mpsc::channel(4);
        register_stream(
            &registry,
            "s1",
            "req-1",
            "tab-a",
            GrpcTauriStreamingCallType::ClientStreaming,
            Some(outbound_tx),
        );
        assert_eq!(
            registry.end_control("s1", "tab-a"),
            StreamControlOutcome::Acknowledged
        );
        assert!(matches!(
            registry.send_outbound("s1", "tab-a", Bytes::from_static(b"{}")),
            Err(StreamControlOutcome::ClientWritesEnded)
        ));
    }

    #[test]
    fn end_control_is_idempotent_after_client_writes_ended() {
        let registry = StreamRegistry::new();
        let (outbound_tx, _outbound_rx) = mpsc::channel(4);
        register_stream(
            &registry,
            "s1",
            "req-1",
            "tab-a",
            GrpcTauriStreamingCallType::ClientStreaming,
            Some(outbound_tx),
        );
        assert_eq!(
            registry.end_control("s1", "tab-a"),
            StreamControlOutcome::Acknowledged
        );
        assert_eq!(
            registry.end_control("s1", "tab-a"),
            StreamControlOutcome::AlreadyTerminal
        );
    }

    #[test]
    fn is_non_active_reflects_terminal_status() {
        let registry = StreamRegistry::new();
        register_stream(
            &registry,
            "s1",
            "req-1",
            "tab-a",
            GrpcTauriStreamingCallType::ServerStreaming,
            None,
        );
        assert!(!registry.is_non_active("s1"));
        registry.mark_terminal("s1", StreamRegistryStatus::Cancelled);
        assert!(registry.is_non_active("s1"));
    }
}
