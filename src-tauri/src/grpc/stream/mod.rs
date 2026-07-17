//! Native gRPC streaming command handlers — Phase 7D.

mod cancel;
mod context;
mod end;
mod helpers;
mod runners;
mod send;
mod start;

use serde_json::Value;
use tauri::{AppHandle, State};

use crate::grpc::state::GrpcState;
use crate::grpc::types::{
    GrpcTauriStreamCancelRequest, GrpcTauriStreamEndRequest, GrpcTauriStreamSendRequest,
    GrpcTauriStreamStartRequest,
};

pub use cancel::execute_grpc_stream_cancel;
pub use context::StreamEventEmitter;
pub use end::execute_grpc_stream_end;
pub use send::execute_grpc_stream_send;
pub use start::execute_grpc_stream_start;

#[allow(unused_imports)]
pub(crate) use context::OUTBOUND_CHANNEL_CAPACITY;

#[tauri::command]
pub async fn grpc_stream_start(
    app: AppHandle,
    state: State<'_, GrpcState>,
    request: GrpcTauriStreamStartRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_stream_start(
        &state,
        request,
        StreamEventEmitter::App(app),
    )
    .await)
}

#[tauri::command]
pub async fn grpc_stream_send(
    app: AppHandle,
    state: State<'_, GrpcState>,
    request: GrpcTauriStreamSendRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_stream_send(
        &state,
        request,
        StreamEventEmitter::App(app),
    )
    .await)
}

#[tauri::command]
pub async fn grpc_stream_end(
    state: State<'_, GrpcState>,
    request: GrpcTauriStreamEndRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_stream_end(&state, request).await)
}

#[tauri::command]
pub async fn grpc_stream_cancel(
    app: AppHandle,
    state: State<'_, GrpcState>,
    request: GrpcTauriStreamCancelRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_stream_cancel(
        &state,
        request,
        Some(StreamEventEmitter::App(app)),
    )
    .await)
}
