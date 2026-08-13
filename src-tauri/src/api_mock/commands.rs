//! Tauri commands — companion-shaped `{ ok, data }` / `{ ok, error }` envelopes.

use crate::api_mock::registry::{ApiMockNativeState, NativeError};
use crate::api_mock::types::ServerDefinition;
use serde_json::{json, Value};

fn ok(data: Value) -> Value {
    json!({ "ok": true, "data": data })
}

fn err(error: NativeError) -> Value {
    json!({ "ok": false, "error": { "code": error.code, "message": error.message } })
}

fn parse_def(definition: Value) -> Result<ServerDefinition, NativeError> {
    serde_json::from_value(definition).map_err(|e| NativeError {
        code: "MOCK_VALIDATION_ERROR".into(),
        message: format!("Invalid definition: {e}"),
    })
}

#[tauri::command]
pub async fn api_mock_listener_start(
    state: tauri::State<'_, ApiMockNativeState>,
    definition: Value,
) -> Result<Value, String> {
    let def = match parse_def(definition) {
        Ok(d) => d,
        Err(e) => return Ok(err(e)),
    };
    Ok(match state.start(def).await {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_stop(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
) -> Result<Value, String> {
    Ok(match state.stop(&server_id).await {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_restart(
    state: tauri::State<'_, ApiMockNativeState>,
    definition: Value,
) -> Result<Value, String> {
    let def = match parse_def(definition) {
        Ok(d) => d,
        Err(e) => return Ok(err(e)),
    };
    Ok(match state.restart(def).await {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_commit(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
    definition: Value,
) -> Result<Value, String> {
    let def = match parse_def(definition) {
        Ok(d) => d,
        Err(e) => return Ok(err(e)),
    };
    Ok(match state.commit(&server_id, def) {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_status(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
) -> Result<Value, String> {
    Ok(match state.status(&server_id) {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_transactions_query(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
    limit: Option<usize>,
    after_cursor: Option<u64>,
) -> Result<Value, String> {
    Ok(match state.transactions(&server_id, limit, after_cursor) {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_transactions_clear(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
) -> Result<Value, String> {
    Ok(match state.clear_transactions(&server_id) {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_state(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
) -> Result<Value, String> {
    Ok(match state.scenario_state(&server_id) {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_reset_state(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
) -> Result<Value, String> {
    Ok(match state.reset_state(&server_id) {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_diagnostics(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
) -> Result<Value, String> {
    Ok(match state.diagnostics(&server_id) {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_recorded_drafts(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
) -> Result<Value, String> {
    Ok(match state.recorded_drafts(&server_id) {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_recorded_drafts_ack(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
    ids: Option<Vec<String>>,
) -> Result<Value, String> {
    let ids = ids.unwrap_or_default();
    Ok(match state.ack_recorded_drafts(&server_id, &ids) {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

#[tauri::command]
pub async fn api_mock_listener_recorded_drafts_clear(
    state: tauri::State<'_, ApiMockNativeState>,
    server_id: String,
) -> Result<Value, String> {
    Ok(match state.clear_recorded_drafts(&server_id) {
        Ok(data) => ok(data),
        Err(e) => err(e),
    })
}

/// Next free auto-port in 4600–4699, skipping exclude list and OS-bound ports.
#[tauri::command]
pub async fn api_mock_ports_next(exclude: Option<Vec<u16>>) -> Result<Value, String> {
    use crate::api_mock::registry::is_port_available;
    let excluded = exclude.unwrap_or_default();
    for port in 4600u16..=4699 {
        if excluded.contains(&port) {
            continue;
        }
        if is_port_available(port) {
            return Ok(ok(json!({ "port": port })));
        }
    }
    Ok(err(NativeError {
        code: "NO_PORT_AVAILABLE".into(),
        message: "No available port in 4600-4699".into(),
    }))
}

#[tauri::command]
pub async fn api_mock_ports_probe(port: u16) -> Result<Value, String> {
    use crate::api_mock::registry::is_port_available;
    if !(1024..=65535).contains(&port) {
        return Ok(err(NativeError {
            code: "INVALID_PORT".into(),
            message: "Port must be 1024-65535".into(),
        }));
    }
    Ok(ok(json!({ "port": port, "available": is_port_available(port) })))
}
