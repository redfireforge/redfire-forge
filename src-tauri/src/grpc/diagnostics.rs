//! Native gRPC diagnostics command surface — Post-GA P2-A.
//!
//! Returns a redacted runtime snapshot for desktop transport triage.

use std::time::Duration;

use serde_json::Value;
use tauri::State;

use crate::grpc::envelope::{error_envelope, success_envelope};
use crate::grpc::lifecycle::ATTACHED_HEARTBEAT_STALE_MS;
use crate::grpc::state::GrpcState;
use crate::grpc::types::{
    GrpcTauriCallRegistrySnapshot, GrpcTauriChannelPoolSnapshot, GrpcTauriDiagnosticsTaxonomy,
    GrpcTauriListenerSnapshot, GrpcTauriNativeDiagnosticsRequest, GrpcTauriNativeDiagnosticsResult,
    GrpcTauriStreamRegistrySnapshot, GRPC_TAURI_INVALID_REQUEST,
};

fn compute_taxonomy(calls: &GrpcTauriCallRegistrySnapshot, streams: &GrpcTauriStreamRegistrySnapshot) -> GrpcTauriDiagnosticsTaxonomy {
    let mut active_issue_codes: Vec<String> = Vec::new();

    if streams.error > 0 {
        active_issue_codes.push("STREAM_ERROR".to_string());
    }
    if calls.cancelled > 0 {
        active_issue_codes.push("CALL_CANCELLED".to_string());
    }
    if streams.cancelled > 0 {
        active_issue_codes.push("STREAM_CANCELLED".to_string());
    }

    let state = if streams.error > 0 {
        "degraded"
    } else {
        "healthy"
    };

    GrpcTauriDiagnosticsTaxonomy {
        state: state.to_string(),
        active_issue_codes,
    }
}

pub fn execute_grpc_native_diagnostics(
    state: &GrpcState,
    request: GrpcTauriNativeDiagnosticsRequest,
) -> Value {
    let started = std::time::Instant::now();
    let op = "native_diagnostics";

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

    let tab_id = match request.tab_id {
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return error_envelope(
                    op,
                    GRPC_TAURI_INVALID_REQUEST,
                    "tabId must not be empty when provided",
                    Some(started.elapsed().as_millis() as u64),
                    Some(false),
                    None,
                    None,
                );
            }
            Some(trimmed.to_string())
        }
        None => None,
    };

    let pool_stats = state.pool.stats();
    let call_stats = state.call_registry.stats();
    let stream_stats = state.stream_registry.stats();

    let listeners = GrpcTauriListenerSnapshot {
        attached_tabs: state.attached_tab_count(),
        detached_tabs: state.detached_tab_count(),
        stale_attached_tabs: state
            .stale_attached_tabs_snapshot(Duration::from_millis(ATTACHED_HEARTBEAT_STALE_MS))
            .len(),
        total_listener_count: state.total_listener_count(),
    };

    let calls = GrpcTauriCallRegistrySnapshot {
        total: call_stats.total,
        active: call_stats.active,
        completed: call_stats.completed,
        cancelled: call_stats.cancelled,
    };

    let streams = GrpcTauriStreamRegistrySnapshot {
        total: stream_stats.total,
        active: stream_stats.active,
        ended: stream_stats.ended,
        cancelled: stream_stats.cancelled,
        error: stream_stats.error,
    };

    let result = GrpcTauriNativeDiagnosticsResult {
        transport_used: "tauri".to_string(),
        tab_id,
        channel_pool: GrpcTauriChannelPoolSnapshot {
            size: pool_stats.size,
            capacity: pool_stats.capacity,
            hit_count_total: pool_stats.hit_count_total,
        },
        calls: calls.clone(),
        streams: streams.clone(),
        listeners,
        taxonomy: compute_taxonomy(&calls, &streams),
    };

    success_envelope(op, result, Some(started.elapsed().as_millis() as u64))
}

#[tauri::command]
pub async fn grpc_native_diagnostics(
    state: State<'_, GrpcState>,
    request: GrpcTauriNativeDiagnosticsRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_native_diagnostics(&state, request))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grpc::stream_registry::TryRegisterStreamOutcome;
    use crate::grpc::types::{
        GrpcTauriDescriptorPayload, GrpcTauriStreamingCallType, GRPC_TAURI_SCHEMA_MISMATCH,
    };

    #[test]
    fn returns_schema_mismatch_error() {
        let state = GrpcState::new();
        let envelope = execute_grpc_native_diagnostics(
            &state,
            GrpcTauriNativeDiagnosticsRequest {
                schema_version: 999,
                tab_id: None,
            },
        );

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_SCHEMA_MISMATCH);
    }

    #[test]
    fn reports_redacted_snapshot_without_transport_secrets() {
        let state = GrpcState::new();

        let _ = state.call_registry.try_register("req-1", "tab-a");
        state.call_registry.mark_cancelled("req-1");

        let descriptor = GrpcTauriDescriptorPayload {
            descriptor_key: "k".to_string(),
            protoset_base64: "ZmFrZQ==".to_string(),
            content_sha256: "abc".to_string(),
        };
        let reg = state.stream_registry.try_register(
            "stream-1",
            "req-2",
            "tab-a",
            GrpcTauriStreamingCallType::ServerStreaming,
            "echo.EchoService".to_string(),
            "Echo".to_string(),
            descriptor,
            None,
        );
        assert!(matches!(reg, TryRegisterStreamOutcome::Registered { .. }));
        state
            .stream_registry
            .mark_terminal("stream-1", crate::grpc::stream_registry::StreamRegistryStatus::Error);

        let envelope = execute_grpc_native_diagnostics(
            &state,
            GrpcTauriNativeDiagnosticsRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                tab_id: Some("tab-a".to_string()),
            },
        );

        assert_eq!(envelope["ok"], true);
        assert_eq!(envelope["data"]["transportUsed"], "tauri");
        assert_eq!(envelope["data"]["calls"]["cancelled"], 1);
        assert_eq!(envelope["data"]["streams"]["error"], 1);
        assert_eq!(envelope["data"]["taxonomy"]["state"], "degraded");

        let json = envelope.to_string();
        assert!(!json.contains("authorization"));
        assert!(!json.contains("bearer"));
        assert!(!json.contains("secret"));
    }
}
