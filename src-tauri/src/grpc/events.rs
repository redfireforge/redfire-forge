//! Tauri event emission for native gRPC streams — Phase 7D.

use tauri::{AppHandle, Emitter};

use crate::grpc::types::GrpcTauriEvent;

pub fn grpc_event_channel(tab_id: &str) -> String {
    format!("grpc-event-{tab_id}")
}

pub fn emit_grpc_event(
    app: &AppHandle,
    tab_id: &str,
    event: GrpcTauriEvent,
) -> Result<(), String> {
    app.emit(&grpc_event_channel(tab_id), event)
        .map_err(|error| error.to_string())
}
