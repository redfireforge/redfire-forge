//! Native unary gRPC command handlers — Phase 7C.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use bytes::Bytes;
use http::uri::PathAndQuery;
use serde_json::Value;
use tauri::State;
use tonic::client::Grpc;
use tonic::metadata::MetadataMap;
use tonic::{Request, Status};

use crate::grpc::auth::{merge_auth_metadata, AuthResolveError};
use crate::grpc::bytes_codec::BytesCodec;
use crate::grpc::call_registry::{CallRegistryStatus, CancelOutcome, TryRegisterOutcome};
use crate::grpc::descriptor::{
    decode_response_json, descriptor_load_error_code, encode_request_json, load_descriptor_pool,
    metadata_map_to_tonic, resolve_unary_method, tonic_metadata_to_map,
};
use crate::grpc::envelope::{error_envelope, success_envelope};
use crate::grpc::state::GrpcState;
use crate::grpc::types::{
    GrpcTauriCallCancelRequest, GrpcTauriCancelResult, GrpcTauriUnaryRequest, GrpcTauriUnaryResult,
    GRPC_TAURI_CANCELLED, GRPC_TAURI_CHANNEL_BUILD,
    GRPC_TAURI_INVALID_REQUEST, GRPC_TAURI_REQUEST_NOT_FOUND,
};

/// Default unary timeout — parity with `GRPC_DEFAULT_CALL_TIMEOUT_MS` in TS contracts.
const DEFAULT_UNARY_TIMEOUT_MS: u64 = 30_000;

#[tauri::command]
pub async fn grpc_unary(
    state: State<'_, GrpcState>,
    request: GrpcTauriUnaryRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_unary(&state, request).await)
}

/// Core unary handler — exposed for integration tests without Tauri mock app setup.
pub async fn execute_grpc_unary(state: &GrpcState, request: GrpcTauriUnaryRequest) -> Value {
    let started = Instant::now();
    let op = "unary";

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

    let request_id = request.request_id.trim();
    let tab_id = request.tab_id.trim();
    let service_name = request.service.trim();
    let method_name = request.method.trim();

    if request_id.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "requestId is required",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }
    if service_name.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "service is required",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }
    if method_name.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "method is required",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    let target_address = request.target.address.trim();
    if target_address.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "target.address is required",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    if !request.body.is_object() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "body must be a JSON object",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    let metadata = match merge_auth_metadata(request.metadata.as_ref(), request.auth.as_ref()) {
        Ok(metadata) => metadata,
        Err(AuthResolveError::Validation { field, message }) => {
            return error_envelope(
                op,
                GRPC_TAURI_INVALID_REQUEST,
                &format!("{field}: {message}"),
                Some(started.elapsed().as_millis() as u64),
                Some(false),
                None,
                None,
            );
        }
    };

    let pool = match load_descriptor_pool(&request.descriptor) {
        Ok(pool) => pool,
        Err(message) => {
            let code = descriptor_load_error_code(&message);
            return error_envelope(
                op,
                code,
                &message,
                Some(started.elapsed().as_millis() as u64),
                Some(false),
                None,
                None,
            );
        }
    };

    let method = match resolve_unary_method(&pool, service_name, method_name) {
        Ok(method) => method,
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

    let request_bytes = match encode_request_json(&method, &request.body) {
        Ok(bytes) => bytes,
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

    let TryRegisterOutcome::Registered { cancel_token } = state
        .call_registry
        .try_register(request_id, tab_id)
    else {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            &format!(
                "requestId {request_id} is already in use by an active call",
            ),
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    };

    let channel = match state.pool.get_or_connect(&request.target) {
        Ok(channel) => channel,
        Err(message) => {
            state.call_registry.remove(request_id);
            return error_envelope(
                op,
                GRPC_TAURI_CHANNEL_BUILD,
                &message,
                Some(started.elapsed().as_millis() as u64),
                Some(true),
                None,
                None,
            );
        }
    };

    let timeout_ms = request.timeout_ms.unwrap_or(DEFAULT_UNARY_TIMEOUT_MS);
    let grpc_path = format!("/{service_name}/{method_name}");
    let invoke_result = invoke_unary_bytes(
        channel,
        &grpc_path,
        Bytes::from(request_bytes),
        metadata_map_to_tonic(&metadata),
        Duration::from_millis(timeout_ms),
        cancel_token.clone(),
    )
    .await;

    if cancel_token.is_cancelled()
        || state.call_registry.status_of(request_id) == Some(CallRegistryStatus::Cancelled)
    {
        state.call_registry.mark_cancelled(request_id);
        state.call_registry.remove(request_id);
        return error_envelope(
            op,
            GRPC_TAURI_CANCELLED,
            "Unary call was cancelled by the client",
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    }

    let duration_ms = started.elapsed().as_millis() as u64;

    match invoke_result {
        Ok(success) => {
            state.call_registry.mark_completed(request_id);
            state.call_registry.remove(request_id);

            let status_message = success.grpc_status_message.clone();
            let body = match decode_response_json(&method, &success.response_bytes) {
                Ok(json) => Some(json),
                Err(message) => {
                    return error_envelope(
                        op,
                        GRPC_TAURI_INVALID_REQUEST,
                        &message,
                        Some(duration_ms),
                        Some(false),
                        None,
                        None,
                    );
                }
            };

            let data = GrpcTauriUnaryResult {
                call_type: "unary".to_string(),
                status: success.grpc_status,
                status_message: status_message.clone(),
                headers: success.headers,
                trailers: success.trailers,
                body,
                duration_ms,
                error_detail: if success.grpc_status == 0 {
                    None
                } else {
                    Some(status_message)
                },
                transport_used: "tauri".to_string(),
                request_id: request_id.to_string(),
            };

            success_envelope(op, data, Some(duration_ms))
        }
        Err(UnaryInvokeError::Cancelled) => {
            state.call_registry.mark_cancelled(request_id);
            state.call_registry.remove(request_id);
            error_envelope(
                op,
                GRPC_TAURI_CANCELLED,
                "Unary call was cancelled by the client",
                Some(duration_ms),
                Some(false),
                None,
                None,
            )
        }
        Err(UnaryInvokeError::Transport(status)) => {
            state.call_registry.mark_completed(request_id);
            state.call_registry.remove(request_id);

            if status.code() == tonic::Code::Cancelled {
                return error_envelope(
                    op,
                    GRPC_TAURI_CANCELLED,
                    "Unary call was cancelled by the client",
                    Some(duration_ms),
                    Some(false),
                    Some(status.code() as i32),
                    Some(tonic_metadata_to_map(status.metadata())),
                );
            }

            let data = GrpcTauriUnaryResult {
                call_type: "unary".to_string(),
                status: status.code() as i32,
                status_message: status.message().to_string(),
                headers: HashMap::new(),
                trailers: tonic_metadata_to_map(status.metadata()),
                body: None,
                duration_ms,
                error_detail: Some(status.message().to_string()),
                transport_used: "tauri".to_string(),
                request_id: request_id.to_string(),
            };

            success_envelope(op, data, Some(duration_ms))
        }
    }
}

#[tauri::command]
pub async fn grpc_call_cancel(
    state: State<'_, GrpcState>,
    request: GrpcTauriCallCancelRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_call_cancel(&state, request).await)
}

/// Core cancel handler — exposed for unit tests without Tauri mock app setup.
pub async fn execute_grpc_call_cancel(
    state: &GrpcState,
    request: GrpcTauriCallCancelRequest,
) -> Value {
    let op = "call_cancel";

    if let Err(code) = crate::grpc::types::validate_grpc_tauri_schema_version(request.schema_version)
    {
        return error_envelope(
            op,
            code,
            "Renderer and native gRPC protocol versions do not match",
            None,
            Some(false),
            None,
            None,
        );
    }

    let request_id = request.request_id.trim();
    let tab_id = request.tab_id.trim();
    if request_id.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_REQUEST_NOT_FOUND,
            "No in-flight call registered for requestId",
            None,
            Some(false),
            None,
            None,
        );
    }

    match state
        .call_registry
        .cancel(request_id, tab_id)
    {
        CancelOutcome::Cancelled => success_envelope(
            op,
            GrpcTauriCancelResult {
                request_id: request_id.to_string(),
                cancelled: true,
                already_completed: None,
            },
            None,
        ),
        CancelOutcome::AlreadyCompleted => success_envelope(
            op,
            GrpcTauriCancelResult {
                request_id: request_id.to_string(),
                cancelled: false,
                already_completed: Some(true),
            },
            None,
        ),
        CancelOutcome::NotFound => error_envelope(
            op,
            GRPC_TAURI_REQUEST_NOT_FOUND,
            "No in-flight call registered for requestId",
            None,
            Some(false),
            None,
            None,
        ),
        CancelOutcome::TabMismatch => error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "tabId does not match the registered call",
            None,
            Some(false),
            None,
            None,
        ),
    }
}

struct UnarySuccess {
    response_bytes: Bytes,
    headers: std::collections::HashMap<String, String>,
    trailers: std::collections::HashMap<String, String>,
    grpc_status: i32,
    grpc_status_message: String,
}

enum UnaryInvokeError {
    Cancelled,
    Transport(Status),
}

async fn invoke_unary_bytes(
    channel: tonic::transport::Channel,
    path: &str,
    body: Bytes,
    metadata: MetadataMap,
    timeout: Duration,
    cancel_token: tokio_util::sync::CancellationToken,
) -> Result<UnarySuccess, UnaryInvokeError> {
    let path = PathAndQuery::from_maybe_shared(path.to_string())
        .map_err(|e| UnaryInvokeError::Transport(Status::internal(e.to_string())))?;

    let mut request = Request::new(body);
    *request.metadata_mut() = metadata;
    request.set_timeout(timeout);

    let mut grpc = Grpc::new(channel);
    let call = grpc.unary(request, path, BytesCodec);

    let response = tokio::select! {
        result = call => result,
        _ = cancel_token.cancelled() => return Err(UnaryInvokeError::Cancelled),
    };

    let response: tonic::Response<Bytes> = match response {
        Ok(response) => response,
        Err(status) => return Err(UnaryInvokeError::Transport(status)),
    };

    let (metadata, body, _extensions) = response.into_parts();
    let headers = tonic_metadata_to_map(&metadata);
    let trailers = HashMap::new();

    Ok(UnarySuccess {
        response_bytes: body,
        headers,
        trailers,
        grpc_status: 0,
        grpc_status_message: "OK".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grpc::state::GrpcState;
    use crate::grpc::types::GrpcTauriCallCancelRequest;

    #[test]
    fn default_timeout_is_30_seconds() {
        assert_eq!(DEFAULT_UNARY_TIMEOUT_MS, 30_000);
    }

    #[test]
    fn schema_mismatch_constant() {
        use crate::grpc::types::GRPC_TAURI_SCHEMA_MISMATCH;
        assert_eq!(GRPC_TAURI_SCHEMA_MISMATCH, "GRPC_TAURI_SCHEMA_MISMATCH");
    }

    #[tokio::test]
    async fn cancel_blank_request_id_returns_not_found_error() {
        let state = GrpcState::new();
        let envelope = execute_grpc_call_cancel(
            &state,
            GrpcTauriCallCancelRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                request_id: "   ".to_string(),
                tab_id: "tab-a".to_string(),
            },
        )
        .await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_REQUEST_NOT_FOUND);
    }

    #[tokio::test]
    async fn cancel_unknown_request_returns_not_found_error() {
        let state = GrpcState::new();
        let envelope = execute_grpc_call_cancel(
            &state,
            GrpcTauriCallCancelRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                request_id: "missing".to_string(),
                tab_id: "tab-a".to_string(),
            },
        )
        .await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_REQUEST_NOT_FOUND);
    }

    #[tokio::test]
    async fn cancel_wrong_tab_returns_invalid_request_error() {
        let state = GrpcState::new();
        state.call_registry.try_register("req-1", "tab-owner");

        let envelope = execute_grpc_call_cancel(
            &state,
            GrpcTauriCallCancelRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                request_id: "req-1".to_string(),
                tab_id: "other-tab".to_string(),
            },
        )
        .await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_INVALID_REQUEST);
    }

    #[tokio::test]
    async fn cancel_active_call_returns_success() {
        let state = GrpcState::new();
        state.call_registry.try_register("req-1", "tab-a");

        let envelope = execute_grpc_call_cancel(
            &state,
            GrpcTauriCallCancelRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                request_id: "req-1".to_string(),
                tab_id: "tab-a".to_string(),
            },
        )
        .await;

        assert_eq!(envelope["ok"], true);
        assert_eq!(envelope["data"]["cancelled"], true);
    }

    #[tokio::test]
    async fn cancel_without_tab_id_on_tab_owned_call_returns_invalid_request() {
        let state = GrpcState::new();
        state.call_registry.try_register("req-owned", "tab-owner");

        let envelope = execute_grpc_call_cancel(
            &state,
            GrpcTauriCallCancelRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                request_id: "req-owned".to_string(),
                tab_id: String::new(),
            },
        )
        .await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_INVALID_REQUEST);
    }

    fn minimal_unary_request() -> GrpcTauriUnaryRequest {
        use crate::grpc::test_echo_protoset::echo_descriptor_payload;
        use crate::grpc::types::{GrpcTauriTarget, GrpcTauriTlsMode};

        GrpcTauriUnaryRequest {
            schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
            request_id: "req-1".to_string(),
            tab_id: "tab-a".to_string(),
            target: GrpcTauriTarget {
                address: "localhost:50051".to_string(),
                tls_mode: GrpcTauriTlsMode::Disabled,
                tls_config: None,
            },
            service: "echo.EchoService".to_string(),
            method: "Echo".to_string(),
            body: serde_json::json!({ "message": "hello" }),
            metadata: None,
            auth: None,
            timeout_ms: Some(1_000),
            descriptor: echo_descriptor_payload(),
        }
    }

    #[tokio::test]
    async fn unary_blank_request_id_returns_invalid_request() {
        let state = GrpcState::new();
        let mut request = minimal_unary_request();
        request.request_id = "   ".to_string();

        let envelope = execute_grpc_unary(&state, request).await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_INVALID_REQUEST);
        assert!(envelope["error"]["message"]
            .as_str()
            .unwrap()
            .contains("requestId is required"));
    }

    #[tokio::test]
    async fn unary_blank_service_returns_invalid_request() {
        let state = GrpcState::new();
        let mut request = minimal_unary_request();
        request.service = "  ".to_string();

        let envelope = execute_grpc_unary(&state, request).await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_INVALID_REQUEST);
        assert!(envelope["error"]["message"]
            .as_str()
            .unwrap()
            .contains("service is required"));
    }

    #[tokio::test]
    async fn unary_blank_method_returns_invalid_request() {
        let state = GrpcState::new();
        let mut request = minimal_unary_request();
        request.method = "  ".to_string();

        let envelope = execute_grpc_unary(&state, request).await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_INVALID_REQUEST);
        assert!(envelope["error"]["message"]
            .as_str()
            .unwrap()
            .contains("method is required"));
    }

    #[tokio::test]
    async fn unary_blank_target_address_returns_invalid_request() {
        let state = GrpcState::new();
        let mut request = minimal_unary_request();
        request.target.address = "   ".to_string();

        let envelope = execute_grpc_unary(&state, request).await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_INVALID_REQUEST);
        assert!(envelope["error"]["message"]
            .as_str()
            .unwrap()
            .contains("target.address is required"));
    }

    #[tokio::test]
    async fn unary_non_object_body_returns_invalid_request() {
        let state = GrpcState::new();
        let mut request = minimal_unary_request();
        request.body = serde_json::json!(["not", "an", "object"]);

        let envelope = execute_grpc_unary(&state, request).await;

        assert_eq!(envelope["ok"], false);
        assert_eq!(envelope["error"]["code"], GRPC_TAURI_INVALID_REQUEST);
        assert!(envelope["error"]["message"]
            .as_str()
            .unwrap()
            .contains("body must be a JSON object"));
    }
}
