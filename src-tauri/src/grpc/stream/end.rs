use serde_json::Value;

use crate::grpc::envelope::error_envelope;
use crate::grpc::state::GrpcState;
use crate::grpc::stream_registry::StreamControlOutcome;
use crate::grpc::types::{
    GrpcTauriStreamControlOp, GrpcTauriStreamEndRequest, GrpcTauriStreamingCallType,
    GRPC_TAURI_INVALID_REQUEST, GRPC_TAURI_STREAM_OWNERSHIP,
};

use super::helpers::map_control_outcome_to_envelope;

pub async fn execute_grpc_stream_end(
    state: &GrpcState,
    request: GrpcTauriStreamEndRequest,
) -> Value {
    let op = "stream_end";

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

    let call_type = match state.stream_registry.encode_context(stream_id, tab_id) {
        Ok((_, _, call_type, _)) => Some(call_type),
        Err(StreamControlOutcome::AlreadyTerminal) => None,
        Err(StreamControlOutcome::ClientWritesEnded) => {
            return map_control_outcome_to_envelope(
                op,
                GrpcTauriStreamControlOp::End,
                stream_id,
                tab_id,
                StreamControlOutcome::AlreadyTerminal,
            );
        }
        Err(StreamControlOutcome::NotFound) => {
            return map_control_outcome_to_envelope(
                op,
                GrpcTauriStreamControlOp::End,
                stream_id,
                tab_id,
                StreamControlOutcome::AlreadyTerminal,
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
        Err(StreamControlOutcome::Acknowledged) => unreachable!(),
    };

    if call_type == Some(GrpcTauriStreamingCallType::ServerStreaming) {
        return error_envelope(
            op,
            GRPC_TAURI_INVALID_REQUEST,
            "end is not valid for server-streaming RPCs",
            None,
            Some(false),
            None,
            None,
        );
    }

    if call_type.is_none() {
        return map_control_outcome_to_envelope(
            op,
            GrpcTauriStreamControlOp::End,
            stream_id,
            tab_id,
            StreamControlOutcome::AlreadyTerminal,
        );
    }

    map_control_outcome_to_envelope(
        op,
        GrpcTauriStreamControlOp::End,
        stream_id,
        tab_id,
        state.stream_registry.end_control(stream_id, tab_id),
    )
}
