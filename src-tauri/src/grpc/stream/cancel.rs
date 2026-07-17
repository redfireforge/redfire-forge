use serde_json::Value;

use crate::grpc::envelope::error_envelope;
use crate::grpc::state::GrpcState;
use crate::grpc::stream_registry::StreamControlOutcome;
use crate::grpc::types::{GrpcTauriStreamCancelRequest, GrpcTauriStreamControlOp, GRPC_TAURI_INVALID_REQUEST};

use super::context::{StreamContext, StreamEventEmitter};
use super::helpers::map_control_outcome_to_envelope;

pub async fn execute_grpc_stream_cancel(
    state: &GrpcState,
    request: GrpcTauriStreamCancelRequest,
    emitter: Option<StreamEventEmitter>,
) -> Value {
    let op = "stream_cancel";

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

    let outcome = state.stream_registry.cancel_control(stream_id, tab_id);
    let outcome = if outcome == StreamControlOutcome::NotFound {
        StreamControlOutcome::AlreadyTerminal
    } else {
        outcome
    };

    if outcome == StreamControlOutcome::Acknowledged {
        if let Some(emitter) = emitter {
            if let Some((stream_id, request_id, tab_id, _)) =
                state.stream_registry.snapshot(stream_id)
            {
                let ctx = StreamContext {
                    stream_id,
                    request_id,
                    tab_id,
                    emitter,
                };
                ctx.emit_cancelled_end(state);
            }
        }
    }

    map_control_outcome_to_envelope(
        op,
        GrpcTauriStreamControlOp::Cancel,
        stream_id,
        tab_id,
        outcome,
    )
}
