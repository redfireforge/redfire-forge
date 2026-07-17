use std::sync::Arc;
use std::time::{Duration, Instant};

use bytes::Bytes;
use http::uri::PathAndQuery;
use serde_json::Value;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::grpc::auth::{merge_auth_metadata, AuthResolveError};
use crate::grpc::descriptor::{
    descriptor_load_error_code, encode_request_json, load_descriptor_pool, metadata_map_to_tonic,
    resolve_stream_method,
};
use crate::grpc::envelope::{error_envelope, success_envelope};
use crate::grpc::state::GrpcState;
use crate::grpc::stream_registry::{StreamOutbound, TryRegisterStreamOutcome};
use crate::grpc::types::{
    GrpcTauriStreamStartRequest, GrpcTauriStreamStartResult, GrpcTauriStreamingCallType,
    GRPC_TAURI_CHANNEL_BUILD, GRPC_TAURI_INVALID_REQUEST,
};

use super::context::{StreamContext, DEFAULT_STREAM_TIMEOUT_MS, OUTBOUND_CHANNEL_CAPACITY};
use super::context::StreamEventEmitter;
use super::helpers::has_non_empty_initial_body;
use super::runners::{run_bidi_stream, run_client_stream, run_server_stream};

pub async fn execute_grpc_stream_start(
    state: &GrpcState,
    request: GrpcTauriStreamStartRequest,
    emitter: StreamEventEmitter,
) -> Value {
    let started = Instant::now();
    let op = "stream_start";

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
    if request.target.address.trim().is_empty() {
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

    let method = match resolve_stream_method(&pool, service_name, method_name, &request.call_type) {
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

    let initial_request_bytes = match encode_request_json(&method, &request.body) {
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

    for (prior_stream_id, prior_request_id) in state.stream_registry.cancel_active_for_tab(tab_id) {
        let ctx = StreamContext {
            stream_id: prior_stream_id,
            request_id: prior_request_id,
            tab_id: tab_id.to_string(),
            emitter: emitter.clone(),
        };
        ctx.emit_cancelled_end(state);
    }

    let stream_id = format!("stream-{}", Uuid::new_v4());
    let (outbound_tx, outbound_rx) = if matches!(
        request.call_type,
        GrpcTauriStreamingCallType::ClientStreaming | GrpcTauriStreamingCallType::BidiStreaming
    ) {
        let (tx, rx) = mpsc::channel(OUTBOUND_CHANNEL_CAPACITY);
        (Some(tx), Some(rx))
    } else {
        (None, None)
    };

    let TryRegisterStreamOutcome::Registered {
        cancel_token,
        outbound_tx: registered_outbound,
    } = state.stream_registry.try_register(
        &stream_id,
        request_id,
        tab_id,
        request.call_type.clone(),
        service_name.to_string(),
        method_name.to_string(),
        request.descriptor.clone(),
        outbound_tx,
    )
    else {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            &format!("requestId {request_id} is already in use by an active stream"),
            Some(started.elapsed().as_millis() as u64),
            Some(false),
            None,
            None,
        );
    };

    let channel = match state.pool.get_or_connect(&request.target) {
        Ok(channel) => channel,
        Err(message) => {
            state.stream_registry.remove(&stream_id);
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

    let timeout_ms = request.timeout_ms.unwrap_or(DEFAULT_STREAM_TIMEOUT_MS);
    let grpc_path = format!("/{service_name}/{method_name}");
    let path = match PathAndQuery::from_maybe_shared(grpc_path.clone()) {
        Ok(path) => path,
        Err(message) => {
            state.stream_registry.remove(&stream_id);
            return error_envelope(
                op,
                GRPC_TAURI_INVALID_REQUEST,
                &format!("Invalid gRPC path: {message}"),
                Some(started.elapsed().as_millis() as u64),
                Some(false),
                None,
                None,
            );
        }
    };

    let ctx = StreamContext {
        stream_id: stream_id.clone(),
        request_id: request_id.to_string(),
        tab_id: tab_id.to_string(),
        emitter: emitter.clone(),
    };

    if matches!(
        request.call_type,
        GrpcTauriStreamingCallType::ClientStreaming | GrpcTauriStreamingCallType::BidiStreaming
    ) && has_non_empty_initial_body(&request.body)
    {
        if let Some(tx) = registered_outbound.as_ref() {
            let _ = tx.try_send(StreamOutbound::Message(Bytes::from(
                initial_request_bytes.clone(),
            )));
        }
        ctx.emit_message(state, request.body.clone(), "outbound");
    }

    let state_arc = Arc::new(state.clone());
    let tonic_metadata = metadata_map_to_tonic(&metadata);
    let timeout = Duration::from_millis(timeout_ms);
    let call_type = request.call_type.clone();
    let request_bytes = Bytes::from(initial_request_bytes);

    tokio::spawn(async move {
        match call_type {
            GrpcTauriStreamingCallType::ServerStreaming => {
                run_server_stream(
                    state_arc,
                    ctx,
                    channel,
                    path,
                    request_bytes,
                    tonic_metadata,
                    timeout,
                    cancel_token,
                    pool,
                    method,
                )
                .await;
            }
            GrpcTauriStreamingCallType::ClientStreaming => {
                run_client_stream(
                    state_arc,
                    ctx,
                    channel,
                    path,
                    outbound_rx.expect("client stream outbound channel"),
                    tonic_metadata,
                    timeout,
                    cancel_token,
                    pool,
                    method,
                )
                .await;
            }
            GrpcTauriStreamingCallType::BidiStreaming => {
                run_bidi_stream(
                    state_arc,
                    ctx,
                    channel,
                    path,
                    outbound_rx.expect("bidi stream outbound channel"),
                    tonic_metadata,
                    timeout,
                    cancel_token,
                    pool,
                    method,
                )
                .await;
            }
        }
    });

    success_envelope(
        op,
        GrpcTauriStreamStartResult {
            stream_id,
            request_id: request_id.to_string(),
            tab_id: tab_id.to_string(),
            transport_used: "tauri".to_string(),
        },
        Some(started.elapsed().as_millis() as u64),
    )
}
