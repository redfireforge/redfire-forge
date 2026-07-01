use std::collections::HashMap;

use serde_json::Value;
use tauri::AppHandle;
use tokio::sync::mpsc;

use crate::grpc::envelope::now_iso;
use crate::grpc::events::emit_grpc_event;
use crate::grpc::state::GrpcState;
use crate::grpc::stream_registry::StreamRegistryStatus;
use crate::grpc::types::{GrpcTauriEvent, GrpcTauriEventType};

pub(crate) const DEFAULT_STREAM_TIMEOUT_MS: u64 = 30_000;
pub(crate) const OUTBOUND_CHANNEL_CAPACITY: usize = 32;

#[derive(Clone)]
pub enum StreamEventEmitter {
    App(AppHandle),
    /// Test harness variant — captures emitted events via an unbounded channel.
    /// Only constructed in `#[cfg(test)]` helpers.
    #[cfg_attr(not(test), allow(dead_code))]
    Test(mpsc::UnboundedSender<GrpcTauriEvent>),
}

impl StreamEventEmitter {
    fn emit(&self, tab_id: &str, event: GrpcTauriEvent) {
        match self {
            StreamEventEmitter::App(app) => {
                let _ = emit_grpc_event(app, tab_id, event);
            }
            StreamEventEmitter::Test(sender) => {
                let _ = sender.send(event);
            }
        }
    }
}

pub(crate) struct StreamContext {
    pub(crate) stream_id: String,
    pub(crate) request_id: String,
    pub(crate) tab_id: String,
    pub(crate) emitter: StreamEventEmitter,
}

impl StreamContext {
    pub(crate) fn emit_message(&self, state: &GrpcState, data: Value, direction: &str) {
        self.emit_event(
            state,
            GrpcTauriEventType::GrpcMessage,
            Some(data),
            Some(direction),
            None,
            None,
            None,
            None,
            None,
        );
    }

    pub(crate) fn emit_end(
        &self,
        state: &GrpcState,
        status: i32,
        status_message: String,
        headers: HashMap<String, String>,
        trailers: HashMap<String, String>,
        body: Option<Value>,
    ) {
        self.emit_terminal(state, |ctx, state| {
            state
                .stream_registry
                .mark_terminal(&ctx.stream_id, StreamRegistryStatus::Ended);
            ctx.emit_event(
                state,
                GrpcTauriEventType::GrpcEnd,
                body,
                None,
                Some(status),
                Some(status_message),
                Some(headers),
                Some(trailers),
                None,
            );
            state.stream_registry.remove(&ctx.stream_id);
        });
    }

    pub(crate) fn emit_error(&self, state: &GrpcState, message: String, status: Option<i32>) {
        self.emit_terminal(state, |ctx, state| {
            state
                .stream_registry
                .mark_terminal(&ctx.stream_id, StreamRegistryStatus::Error);
            ctx.emit_event(
                state,
                GrpcTauriEventType::GrpcError,
                None,
                None,
                status,
                Some(message.clone()),
                None,
                None,
                Some(message),
            );
            state.stream_registry.remove(&ctx.stream_id);
        });
    }

    pub(crate) fn emit_cancelled_end(&self, state: &GrpcState) {
        self.emit_terminal(state, |ctx, state| {
            state
                .stream_registry
                .mark_terminal(&ctx.stream_id, StreamRegistryStatus::Cancelled);
            ctx.emit_event(
                state,
                GrpcTauriEventType::GrpcEnd,
                None,
                None,
                Some(1),
                Some("Cancelled".to_string()),
                None,
                None,
                None,
            );
            state.stream_registry.remove(&ctx.stream_id);
        });
    }

    fn emit_event(
        &self,
        state: &GrpcState,
        event_type: GrpcTauriEventType,
        data: Option<Value>,
        direction: Option<&str>,
        grpc_status: Option<i32>,
        grpc_status_message: Option<String>,
        headers: Option<HashMap<String, String>>,
        trailers: Option<HashMap<String, String>>,
        error_detail: Option<String>,
    ) {
        let Some(sequence) = state.stream_registry.next_sequence(&self.stream_id) else {
            return;
        };
        state.stream_registry.touch_activity(&self.stream_id);
        self.emitter.emit(
            &self.tab_id,
            GrpcTauriEvent {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                event_type,
                stream_id: self.stream_id.clone(),
                request_id: self.request_id.clone(),
                tab_id: self.tab_id.clone(),
                sequence,
                timestamp: now_iso(),
                data,
                direction: direction.map(str::to_string),
                grpc_status,
                grpc_status_message,
                headers,
                trailers,
                error_detail,
                transport_used: Some("tauri".to_string()),
            },
        );
    }

    fn emit_terminal(
        &self,
        state: &GrpcState,
        emit: impl FnOnce(&Self, &GrpcState),
    ) {
        if !state.stream_registry.try_claim_terminal_emit(&self.stream_id) {
            if state.stream_registry.is_non_active(&self.stream_id) {
                state.stream_registry.remove(&self.stream_id);
            }
            return;
        }
        emit(self, state);
    }
}
