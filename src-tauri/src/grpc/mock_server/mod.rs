//! Native mock listener command handlers (Tauri desktop parity for Phase 11M).

mod commands;
mod registry;
mod shutdown;

#[cfg(test)]
mod tests;

pub use commands::{
    execute_grpc_mock_listener_commit, execute_grpc_mock_listener_log,
    execute_grpc_mock_listener_start, execute_grpc_mock_listener_status,
    execute_grpc_mock_listener_stop,
};
pub use shutdown::shutdown_all_mock_listeners;

use serde_json::Value;

use crate::grpc::types::{
    GrpcTauriMockListenerCommitRequest, GrpcTauriMockListenerLogRequest,
    GrpcTauriMockListenerStartRequest, GrpcTauriMockListenerTabRequest,
};

#[tauri::command]
pub async fn grpc_mock_listener_start(
    request: GrpcTauriMockListenerStartRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_mock_listener_start(request).await)
}

#[tauri::command]
pub async fn grpc_mock_listener_stop(
    request: GrpcTauriMockListenerTabRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_mock_listener_stop(request).await)
}

#[tauri::command]
pub async fn grpc_mock_listener_status(
    request: GrpcTauriMockListenerTabRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_mock_listener_status(request).await)
}

#[tauri::command]
pub async fn grpc_mock_listener_commit(
    request: GrpcTauriMockListenerCommitRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_mock_listener_commit(request).await)
}

#[tauri::command]
pub async fn grpc_mock_listener_log(
    request: GrpcTauriMockListenerLogRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_mock_listener_log(request).await)
}
