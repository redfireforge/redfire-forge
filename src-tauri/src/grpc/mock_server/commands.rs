//! Native mock listener command handlers (Tauri desktop parity for Phase 11M).

use std::sync::Arc;
use std::time::Instant;

use serde_json::Value;
use tokio_util::sync::CancellationToken;

use crate::grpc::envelope::{error_envelope, now_iso, success_envelope};
use crate::grpc::mock_server_dispatch::{build_dispatch_catalog, NativeMockDispatchState};
use crate::grpc::mock_rules::{validate_grpc_mock_rule_set, GrpcMockRuleSet};
use crate::grpc::types::{
    GrpcTauriMockListenerCommitRequest, GrpcTauriMockListenerCommitResult,
    GrpcTauriMockListenerLogRequest, GrpcTauriMockListenerLogsResult,
    GrpcTauriMockListenerStartRequest, GrpcTauriMockListenerStartResult,
    GrpcTauriMockListenerTabRequest, GRPC_TAURI_INVALID_REQUEST,
};

use super::registry::*;

pub async fn execute_grpc_mock_listener_start(request: GrpcTauriMockListenerStartRequest) -> Value {
    let started = Instant::now();
    let op = "mock_listener_start";

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
    let connection_id = request.connection_id.trim();
    let descriptor_key = request.descriptor_key.trim();

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
    if connection_id.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "connectionId is required",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }
    if descriptor_key.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "descriptorKey is required",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    if !request.rule_set.is_object() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "ruleSet must be a JSON object",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    let rule_set = match serde_json::from_value::<GrpcMockRuleSet>(request.rule_set.clone()) {
        Ok(rule_set) => {
            if let Err(message) = validate_grpc_mock_rule_set(&rule_set) {
                return error_envelope(
                    op,
                    GRPC_TAURI_INVALID_REQUEST,
                    &format!("invalid mock ruleSet: {message}"),
                    Some(started.elapsed().as_millis() as u64),
                    Some(false),
                    None,
                    None,
                );
            }
            rule_set
        }
        Err(error) => {
            return error_envelope(
                op,
                GRPC_TAURI_INVALID_REQUEST,
                &format!("ruleSet deserialization failed: {error}"),
                Some(started.elapsed().as_millis() as u64),
                Some(false),
                None,
                None,
            );
        }
    };

    let existing_runtime = {
        let mut map = registry().lock().unwrap_or_else(|e| e.into_inner());
        map.remove(tab_id)
    };
    let recently_replaced_port = existing_runtime.as_ref().map(|runtime| runtime.port);
    if let Some(existing) = existing_runtime {
        stop_runtime(existing).await;
    }

    let port = match next_available_port(tab_id, request.port, recently_replaced_port) {
        Ok(port) => port,
        Err(message) => {
            return error_envelope(
                op,
                GRPC_TAURI_INVALID_REQUEST,
                &message,
                Some(started.elapsed().as_millis() as u64),
                Some(false),
                None,
                None,
            );
        }
    };

    if request.port == recently_replaced_port {
        // Same-tab explicit-port restart needs a short handoff window for prior tonic shutdown.
        wait_for_port_release(port, 40, 25);
    }

    let dispatch_catalog = match build_dispatch_catalog(
        request.protoset_base64.as_deref(),
        request.content_sha256.as_deref(),
    ) {
        Ok(catalog) => catalog,
        Err(message) => {
            return error_envelope(
                op,
                GRPC_TAURI_INVALID_REQUEST,
                &format!("invalid descriptor payload for native mock listener: {message}"),
                Some(started.elapsed().as_millis() as u64),
                Some(false),
                None,
                None,
            );
        }
    };

    let started_at = now_iso();
    let dispatch_state = Arc::new(NativeMockDispatchState::new(
        1,
        rule_set,
        request.latency_policy,
        dispatch_catalog,
        started_at.clone(),
    ));

    let stop_token = CancellationToken::new();
    let (abort_handle, server_task) = match start_tonic_listener(port, stop_token.clone(), dispatch_state.clone()) {
        Ok(value) => value,
        Err(message) => {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            &message,
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
        }
    };

    let runtime = MockRuntime {
        tab_id: tab_id.to_string(),
        connection_id: connection_id.to_string(),
        descriptor_key: descriptor_key.to_string(),
        started_at: started_at.clone(),
        port,
        listen_target: format!("127.0.0.1:{port}"),
        stop_token,
        abort_handle,
        server_task,
        dispatch_state,
    };

    let status = create_status_from_runtime(&runtime);
    let mut map = registry().lock().unwrap_or_else(|e| e.into_inner());
    map.insert(tab_id.to_string(), runtime);

    success_envelope(
        op,
        GrpcTauriMockListenerStartResult { status },
        Some(started.elapsed().as_millis() as u64),
    )
}

pub async fn execute_grpc_mock_listener_stop(request: GrpcTauriMockListenerTabRequest) -> Value {
    let started = Instant::now();
    let op = "mock_listener_stop";

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

    let removed_runtime = {
        let mut map = registry().lock().unwrap_or_else(|e| e.into_inner());
        map.remove(tab_id)
    };
    if let Some(runtime) = removed_runtime {
        stop_runtime(runtime).await;
    }

    success_envelope(
        op,
        empty_status(tab_id.to_string()),
        Some(started.elapsed().as_millis() as u64),
    )
}

pub async fn execute_grpc_mock_listener_status(request: GrpcTauriMockListenerTabRequest) -> Value {
    let started = Instant::now();
    let op = "mock_listener_status";

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

    let map = registry().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(runtime) = map.get(tab_id) {
        return success_envelope(
            op,
            create_status_from_runtime(runtime),
            Some(started.elapsed().as_millis() as u64),
        );
    }

    success_envelope(
        op,
        empty_status(tab_id.to_string()),
        Some(started.elapsed().as_millis() as u64),
    )
}

pub async fn execute_grpc_mock_listener_commit(
    request: GrpcTauriMockListenerCommitRequest,
) -> Value {
    let started = Instant::now();
    let op = "mock_listener_commit";

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

    if !request.rule_set.is_object() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "ruleSet must be a JSON object",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    let rule_set = match serde_json::from_value::<GrpcMockRuleSet>(request.rule_set.clone()) {
        Ok(rule_set) => {
            if let Err(message) = validate_grpc_mock_rule_set(&rule_set) {
                return error_envelope(
                    op,
                    GRPC_TAURI_INVALID_REQUEST,
                    &format!("invalid mock ruleSet: {message}"),
                    Some(started.elapsed().as_millis() as u64),
                    Some(false),
                    None,
                    None,
                );
            }
            rule_set
        }
        Err(error) => {
            return error_envelope(
                op,
                GRPC_TAURI_INVALID_REQUEST,
                &format!("ruleSet deserialization failed: {error}"),
                Some(started.elapsed().as_millis() as u64),
                Some(false),
                None,
                None,
            );
        }
    };

    let mut map = registry().lock().unwrap_or_else(|e| e.into_inner());
    let Some(runtime) = map.get_mut(tab_id) else {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "mock listener is not running for this tab",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    };

    let committed_at = now_iso();
    let generation = runtime
        .dispatch_state
        .commit_rule_set(rule_set, request.latency_policy, committed_at.clone());

    success_envelope(
        op,
        GrpcTauriMockListenerCommitResult {
            generation,
            committed_at,
        },
        Some(started.elapsed().as_millis() as u64),
    )
}

pub async fn execute_grpc_mock_listener_log(request: GrpcTauriMockListenerLogRequest) -> Value {
    let started = Instant::now();
    let op = "mock_listener_log";

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

    let map = registry().lock().unwrap_or_else(|e| e.into_inner());
    let Some(runtime) = map.get(tab_id) else {
        return success_envelope(
            op,
            GrpcTauriMockListenerLogsResult {
                entries: Vec::new(),
                next_cursor: 0,
            },
            Some(started.elapsed().as_millis() as u64),
        );
    };

    let (entries, next_cursor) = runtime.dispatch_state.logs_since(request.since);

    success_envelope(
        op,
        GrpcTauriMockListenerLogsResult {
            entries,
            next_cursor,
        },
        Some(started.elapsed().as_millis() as u64),
    )
}
