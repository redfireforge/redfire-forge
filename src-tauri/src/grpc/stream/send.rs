use bytes::Bytes;
use serde::Serialize;
use serde_json::Value;

use crate::grpc::descriptor::{
    descriptor_load_error_code, encode_request_json, load_descriptor_pool, resolve_stream_method,
};
use crate::grpc::envelope::{error_envelope, success_envelope};
use crate::grpc::state::GrpcState;
use crate::grpc::stream_registry::StreamControlOutcome;
use crate::grpc::types::{
    GrpcTauriStreamSendRequest, GrpcTauriStreamingCallType, GRPC_TAURI_INVALID_REQUEST,
    GRPC_TAURI_STREAM_NOT_FOUND, GRPC_TAURI_STREAM_OWNERSHIP,
};

use super::context::{StreamContext, StreamEventEmitter};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GrpcTauriStreamSendResult {
    stream_id: String,
    tab_id: String,
    sequence: u64,
}

pub async fn execute_grpc_stream_send(
    state: &GrpcState,
    request: GrpcTauriStreamSendRequest,
    emitter: StreamEventEmitter,
) -> Value {
    let op = "stream_send";

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

    let stream_id = request.stream_id.trim();
    let tab_id = request.tab_id.trim();
    if stream_id.is_empty() || tab_id.is_empty() {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "streamId and tabId are required",
            None,
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
            None,
            Some(false),
            None,
            None,
        );
    }

    let (service_name, method_name, call_type, descriptor) =
        match state.stream_registry.encode_context(stream_id, tab_id) {
            Ok(context) => context,
            Err(StreamControlOutcome::ClientWritesEnded) => {
                return error_envelope(
                    op,
                    GRPC_TAURI_INVALID_REQUEST,
                    "send is not valid after client stream EOF",
                    None,
                    Some(false),
                    None,
                    None,
                );
            }
            Err(StreamControlOutcome::AlreadyTerminal | StreamControlOutcome::NotFound) => {
                return error_envelope(
                    op,
                    GRPC_TAURI_STREAM_NOT_FOUND,
                    &format!("No active stream registered for streamId {stream_id}"),
                    None,
                    Some(false),
                    None,
                    None,
                );
            }
            Err(StreamControlOutcome::TabMismatch) => {
                return error_envelope(
                    op,
                    GRPC_TAURI_STREAM_OWNERSHIP,
                    &format!("tabId does not match the registered stream {stream_id}"),
                    None,
                    Some(false),
                    None,
                    None,
                );
            }
            Err(StreamControlOutcome::Acknowledged) => {
                unreachable!("encode_context never returns Acknowledged")
            }
        };

    if call_type == GrpcTauriStreamingCallType::ServerStreaming {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "send is not valid for server-streaming RPCs",
            None,
            Some(false),
            None,
            None,
        );
    }

    let pool = match load_descriptor_pool(&descriptor) {
        Ok(pool) => pool,
        Err(message) => {
            let code = descriptor_load_error_code(&message);
            return error_envelope(op, code, &message, None, Some(false), None, None);
        }
    };

    let method = match resolve_stream_method(&pool, &service_name, &method_name, &call_type) {
        Ok(method) => method,
        Err(message) => {
            return error_envelope(
                op,
                GRPC_TAURI_INVALID_REQUEST,
                &message,
                None,
                Some(false),
                None,
                None,
            );
        }
    };

    let encoded = match encode_request_json(&method, &request.body) {
        Ok(bytes) => bytes,
        Err(message) => {
            return error_envelope(
                op,
                GRPC_TAURI_INVALID_REQUEST,
                &message,
                None,
                Some(false),
                None,
                None,
            );
        }
    };

    if let Err(outcome) = state
        .stream_registry
        .send_outbound(stream_id, tab_id, Bytes::from(encoded))
    {
        return match outcome {
            StreamControlOutcome::ClientWritesEnded => error_envelope(
                op,
                GRPC_TAURI_INVALID_REQUEST,
                "send is not valid after client stream EOF",
                None,
                Some(false),
                None,
                None,
            ),
            StreamControlOutcome::AlreadyTerminal | StreamControlOutcome::NotFound => {
                error_envelope(
                    op,
                    GRPC_TAURI_STREAM_NOT_FOUND,
                    &format!("No active stream registered for streamId {stream_id}"),
                    None,
                    Some(false),
                    None,
                    None,
                )
            }
            StreamControlOutcome::TabMismatch => error_envelope(
                op,
                GRPC_TAURI_STREAM_OWNERSHIP,
                &format!("tabId does not match the registered stream {stream_id}"),
                None,
                Some(false),
                None,
                None,
            ),
            StreamControlOutcome::Acknowledged => unreachable!(),
        };
    }

    let request_id = state
        .stream_registry
        .snapshot(stream_id)
        .map(|(_, request_id, _, _)| request_id)
        .unwrap_or_default();

    let ctx = StreamContext {
        stream_id: stream_id.to_string(),
        request_id,
        tab_id: tab_id.to_string(),
        emitter,
    };
    ctx.emit_message(state, request.body.clone(), "outbound");

    let sequence = state
        .stream_registry
        .snapshot(stream_id)
        .map(|(_, _, _, sequence)| sequence)
        .unwrap_or(0);

    success_envelope(
        op,
        GrpcTauriStreamSendResult {
            stream_id: stream_id.to_string(),
            tab_id: tab_id.to_string(),
            sequence,
        },
        None,
    )
}
