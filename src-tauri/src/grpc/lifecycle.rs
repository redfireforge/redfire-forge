//! gRPC native lifecycle — Phase 7H.
//!
//! Tab cleanup, event-listener tracking, orphan supervisor, and shutdown hooks.

use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use tauri::State;

use crate::grpc::envelope::{error_envelope, success_envelope};
use crate::grpc::state::GrpcState;
use crate::grpc::types::{
    GrpcTauriTabCleanupRequest, GrpcTauriTabCleanupResult, GRPC_TAURI_INVALID_REQUEST,
};

/// Default orphan grace — parity with `GRPC_STREAM_SSE_DISCONNECT_GRACE_MS` in TS.
pub const DEFAULT_ORPHAN_STREAM_TIMEOUT_MS: u64 = 60_000;
/// Grace before purging terminal registry rows.
pub const TERMINAL_STREAM_GRACE_MS: u64 = 5_000;
/// Background supervisor sweep interval.
pub const ORPHAN_SWEEP_INTERVAL_MS: u64 = 5_000;

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriTabEventsAck {
    pub tab_id: String,
    pub listener_count: u32,
}

/// Cancel all native unary + stream resources owned by a tab.
pub fn cleanup_tab_resources(state: &GrpcState, tab_id: &str) -> GrpcTauriTabCleanupResult {
    let cancelled_streams = state.stream_registry.cancel_active_for_tab(tab_id).len() as u32;
    state.call_registry.cancel_all_for_tab(tab_id);
    state.stream_registry.remove_all_for_tab(tab_id);
    state.call_registry.purge_for_tab(tab_id);
    state.clear_tab_listener_tracking(tab_id);

    GrpcTauriTabCleanupResult {
        tab_id: tab_id.to_string(),
        cancelled_streams,
        released_channels: 0,
    }
}

pub fn execute_grpc_tab_cleanup(state: &GrpcState, request: GrpcTauriTabCleanupRequest) -> Value {
    let started = Instant::now();
    let op = "tab_cleanup";

    if let Err(code) = crate::grpc::types::validate_grpc_tauri_schema_version(request.schema_version)
    {
        return error_envelope(
            op,
            code,
            "Renderer and native gRPC protocol versions do not match",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    let tab_id = request.tab_id.trim();
    if tab_id.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "tabId is required",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    let result = cleanup_tab_resources(state, tab_id);
    success_envelope(
        op,
        result,
        Some(started.elapsed().as_millis() as u64),
    )
}

pub fn execute_grpc_tab_events_attach(
    state: &GrpcState,
    request: GrpcTauriTabCleanupRequest,
) -> Value {
    let started = Instant::now();
    let op = "tab_events_attach";

    if let Err(code) = crate::grpc::types::validate_grpc_tauri_schema_version(request.schema_version)
    {
        return error_envelope(
            op,
            code,
            "Renderer and native gRPC protocol versions do not match",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    let tab_id = request.tab_id.trim();
    if tab_id.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "tabId is required",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    state.record_tab_event_listener_attached(tab_id);
    success_envelope(
        op,
        GrpcTauriTabEventsAck {
            tab_id: tab_id.to_string(),
            listener_count: state.tab_event_listener_count(tab_id),
        },
        Some(started.elapsed().as_millis() as u64),
    )
}

pub fn execute_grpc_tab_events_detach(
    state: &GrpcState,
    request: GrpcTauriTabCleanupRequest,
) -> Value {
    let started = Instant::now();
    let op = "tab_events_detach";

    if let Err(code) = crate::grpc::types::validate_grpc_tauri_schema_version(request.schema_version)
    {
        return error_envelope(
            op,
            code,
            "Renderer and native gRPC protocol versions do not match",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    let tab_id = request.tab_id.trim();
    if tab_id.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "tabId is required",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    state.record_tab_event_listener_detached(tab_id);
    success_envelope(
        op,
        GrpcTauriTabEventsAck {
            tab_id: tab_id.to_string(),
            listener_count: state.tab_event_listener_count(tab_id),
        },
        Some(started.elapsed().as_millis() as u64),
    )
}

pub fn sweep_orphans(state: &GrpcState) -> (u32, u32) {
    let detached = state.detached_tabs_snapshot();
    let (cancelled, purged) = state.stream_registry.sweep_orphans(
        &detached,
        Duration::from_millis(DEFAULT_ORPHAN_STREAM_TIMEOUT_MS),
        Duration::from_millis(TERMINAL_STREAM_GRACE_MS),
    );
    let _ = state.call_registry.purge_inactive();

    let cleared_detached: Vec<String> = detached
        .into_iter()
        .map(|(tab_id, _)| tab_id)
        .filter(|tab_id| !state.tab_has_active_streams(tab_id))
        .collect();
    state.clear_detached_tab_markers(&cleared_detached);

    (cancelled, purged)
}

/// Evict all pooled channels and purge registries — used on app/window shutdown.
pub fn shutdown_all(state: &GrpcState) -> u32 {
    state.supervisor_shutdown_token().cancel();
    state.stream_registry.cancel_all_active();
    state.call_registry.purge_all();
    let released = state.pool.stats().size as u32;
    state.pool.evict_all();
    state.stream_registry.remove_all();
    state.clear_all_listener_tracking();
    released
}

pub fn start_orphan_supervisor(state: GrpcState) {
    let shutdown = state.supervisor_shutdown_token();
    tauri::async_runtime::spawn(async move {
        let mut interval =
            tokio::time::interval(Duration::from_millis(ORPHAN_SWEEP_INTERVAL_MS));
        loop {
            tokio::select! {
                _ = shutdown.cancelled() => break,
                _ = interval.tick() => {
                    let _ = sweep_orphans(&state);
                }
            }
        }
    });
}

#[tauri::command]
pub async fn grpc_tab_cleanup(
    state: State<'_, GrpcState>,
    request: GrpcTauriTabCleanupRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_tab_cleanup(&state, request))
}

#[tauri::command]
pub async fn grpc_tab_events_attach(
    state: State<'_, GrpcState>,
    request: GrpcTauriTabCleanupRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_tab_events_attach(&state, request))
}

#[tauri::command]
pub async fn grpc_tab_events_detach(
    state: State<'_, GrpcState>,
    request: GrpcTauriTabCleanupRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_tab_events_detach(&state, request))
}
