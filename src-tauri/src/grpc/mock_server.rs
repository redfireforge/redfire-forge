//! Native mock listener command handlers (Tauri desktop parity for Phase 11M).

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;

use serde_json::Value;
use tokio::task::{AbortHandle, JoinHandle};
use tokio_util::sync::CancellationToken;

use crate::grpc::envelope::{error_envelope, now_iso, success_envelope};
use crate::grpc::mock_server_dispatch::{
    build_dispatch_catalog, start_mock_dispatch_server, NativeMockDispatchState,
};
use crate::grpc::mock_rules::{validate_grpc_mock_rule_set, GrpcMockRuleSet};
use crate::grpc::types::{
    GrpcTauriMockListenerCommitRequest, GrpcTauriMockListenerCommitResult,
    GrpcTauriMockListenerLogRequest, GrpcTauriMockListenerLogsResult,
    GrpcTauriMockListenerStartRequest, GrpcTauriMockListenerStartResult, GrpcTauriMockListenerStatus,
    GrpcTauriMockListenerTabRequest, GRPC_TAURI_INTERNAL, GRPC_TAURI_INVALID_REQUEST,
};

const MOCK_PORT_MIN: u16 = 50061;
const MOCK_PORT_MAX: u16 = 50160;

#[derive(Debug)]
struct MockRuntime {
    tab_id: String,
    connection_id: String,
    descriptor_key: String,
    started_at: String,
    port: u16,
    listen_target: String,
    stop_token: CancellationToken,
    abort_handle: AbortHandle,
    server_task: JoinHandle<()>,
    dispatch_state: Arc<NativeMockDispatchState>,
}

static MOCK_REGISTRY: OnceLock<Arc<Mutex<HashMap<String, MockRuntime>>>> = OnceLock::new();

fn registry() -> &'static Arc<Mutex<HashMap<String, MockRuntime>>> {
    MOCK_REGISTRY.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

fn create_status_from_runtime(runtime: &MockRuntime) -> GrpcTauriMockListenerStatus {
    let (generation, in_flight_count, last_error) = runtime.dispatch_state.snapshot_status();
    GrpcTauriMockListenerStatus {
        running: true,
        tab_id: runtime.tab_id.clone(),
        listen_target: Some(runtime.listen_target.clone()),
        port: Some(runtime.port),
        generation,
        connection_id: Some(runtime.connection_id.clone()),
        descriptor_key: Some(runtime.descriptor_key.clone()),
        in_flight_count,
        last_error,
        started_at: Some(runtime.started_at.clone()),
    }
}

fn empty_status(tab_id: String) -> GrpcTauriMockListenerStatus {
    GrpcTauriMockListenerStatus {
        running: false,
        tab_id,
        listen_target: None,
        port: None,
        generation: 0,
        connection_id: None,
        descriptor_key: None,
        in_flight_count: 0,
        last_error: None,
        started_at: None,
    }
}

fn next_available_port(
    tab_id: &str,
    requested: Option<u16>,
    recently_replaced_port: Option<u16>,
) -> Result<u16, String> {
    let map = registry().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(port) = requested {
        if !(MOCK_PORT_MIN..=MOCK_PORT_MAX).contains(&port) {
            return Err(format!(
                "port {port} is out of allowed range {MOCK_PORT_MIN}-{MOCK_PORT_MAX}"
            ));
        }
        let used_by_other = map
            .iter()
            .any(|(id, runtime)| id != tab_id && runtime.port == port);
        if used_by_other {
            return Err(format!("port {port} is already allocated to another mock listener"));
        }
        let reusing_recent_same_tab_port = recently_replaced_port == Some(port);
        if !reusing_recent_same_tab_port && !is_port_available(port) {
            return Err(format!("port {port} is not currently available for binding"));
        }
        return Ok(port);
    }

    for candidate in MOCK_PORT_MIN..=MOCK_PORT_MAX {
        let used = map.values().any(|runtime| runtime.port == candidate);
        if !used && is_port_available(candidate) {
            return Ok(candidate);
        }
    }

    Err("no free gRPC mock listener ports available".to_string())
}

fn is_port_available(port: u16) -> bool {
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    match std::net::TcpListener::bind(addr) {
        Ok(listener) => {
            drop(listener);
            true
        }
        Err(_) => false,
    }
}

fn wait_for_port_release(port: u16, attempts: usize, delay_ms: u64) {
    for _ in 0..attempts {
        if is_port_available(port) {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
    }
}

fn start_tonic_listener(
    port: u16,
    stop_token: CancellationToken,
    dispatch_state: Arc<NativeMockDispatchState>,
) -> Result<(AbortHandle, JoinHandle<()>), String> {
    start_mock_dispatch_server(port, stop_token, dispatch_state)
}

async fn stop_runtime(runtime: MockRuntime) {
    let port = runtime.port;
    runtime.stop_token.cancel();
    runtime.abort_handle.abort();
    let _ = runtime.server_task.await;
    wait_for_port_release(port, 40, 25);
}

#[tauri::command]
pub async fn grpc_mock_listener_start(
    request: GrpcTauriMockListenerStartRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_mock_listener_start(request).await)
}

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

#[tauri::command]
pub async fn grpc_mock_listener_stop(
    request: GrpcTauriMockListenerTabRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_mock_listener_stop(request).await)
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

#[tauri::command]
pub async fn grpc_mock_listener_status(
    request: GrpcTauriMockListenerTabRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_mock_listener_status(request).await)
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

#[tauri::command]
pub async fn grpc_mock_listener_commit(
    request: GrpcTauriMockListenerCommitRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_mock_listener_commit(request).await)
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

#[tauri::command]
pub async fn grpc_mock_listener_log(
    request: GrpcTauriMockListenerLogRequest,
) -> Result<Value, String> {
    Ok(execute_grpc_mock_listener_log(request).await)
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

pub fn shutdown_all_mock_listeners() -> Result<(), String> {
    let mut map = registry()
        .lock()
        .map_err(|_| format!("{GRPC_TAURI_INTERNAL}: failed to lock mock listener registry"))?;
    let mut ports: Vec<u16> = Vec::new();
    for runtime in map.values() {
        ports.push(runtime.port);
        runtime.stop_token.cancel();
        runtime.abort_handle.abort();
    }
    map.clear();
    drop(map);
    for port in ports {
        wait_for_port_release(port, 40, 25);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::Bytes;
    use http::uri::PathAndQuery;
    use std::sync::{Mutex, OnceLock};
    use tonic::Request;
    use tonic::client::Grpc;
    use tonic::transport::Endpoint;
    use tokio_stream::iter;
    use crate::grpc::bytes_codec::BytesCodec;
    use crate::grpc::descriptor::{
        decode_response_json, encode_request_json, load_descriptor_pool, resolve_stream_method,
        resolve_unary_method,
    };
    use crate::grpc::test_echo_protoset::{ECHO_PROTOSET_BASE64, ECHO_PROTOSET_SHA256};
    use crate::grpc::types::{
        GrpcTauriMockListenerStartRequest, GrpcTauriMockListenerTabRequest, GRPC_TAURI_SCHEMA_VERSION,
    };

    fn test_mutex() -> &'static Mutex<()> {
        static TEST_MUTEX: OnceLock<Mutex<()>> = OnceLock::new();
        TEST_MUTEX.get_or_init(|| Mutex::new(()))
    }

    fn pick_available_test_port() -> Option<u16> {
        for port in MOCK_PORT_MIN..=MOCK_PORT_MAX {
            if is_port_available(port) {
                return Some(port);
            }
        }
        None
    }

    fn base_start_request(tab_id: &str) -> GrpcTauriMockListenerStartRequest {
        GrpcTauriMockListenerStartRequest {
            schema_version: GRPC_TAURI_SCHEMA_VERSION,
            tab_id: tab_id.to_string(),
            connection_id: "conn-1".to_string(),
            descriptor_key: "descriptor-1".to_string(),
            protoset_base64: Some(ECHO_PROTOSET_BASE64.to_string()),
            content_sha256: Some(ECHO_PROTOSET_SHA256.to_string()),
            rule_set: serde_json::json!({ "rules": [] }),
            latency_policy: None,
            port: None,
        }
    }

    async fn invoke_unary_echo(port: u16, body: serde_json::Value) -> serde_json::Value {
        let payload = crate::grpc::test_echo_protoset::echo_descriptor_payload();
        let pool = load_descriptor_pool(&payload).expect("load echo descriptor pool");
        let method = resolve_unary_method(&pool, "echo.EchoService", "Echo")
            .expect("resolve unary method");
        let request_bytes = encode_request_json(&method, &body).expect("encode unary request");

        let endpoint = Endpoint::from_shared(format!("http://127.0.0.1:{port}"))
            .expect("build endpoint");
        let channel = endpoint.connect().await.expect("connect channel");
        let mut grpc = Grpc::new(channel);
        grpc.ready().await.expect("grpc client ready");
        let path: PathAndQuery = "/echo.EchoService/Echo".parse().expect("valid path");
        let response = grpc
            .unary(Request::new(Bytes::from(request_bytes)), path, BytesCodec)
            .await
            .expect("invoke unary");

        decode_response_json(&method, response.get_ref().as_ref()).expect("decode unary response")
    }

    async fn invoke_client_stream_echo(
        port: u16,
        bodies: Vec<serde_json::Value>,
    ) -> serde_json::Value {
        let payload = crate::grpc::test_echo_protoset::echo_descriptor_payload();
        let pool = load_descriptor_pool(&payload).expect("load echo descriptor pool");
        let method = resolve_stream_method(
            &pool,
            "echo.EchoService",
            "ClientStream",
            &crate::grpc::types::GrpcTauriStreamingCallType::ClientStreaming,
        )
        .expect("resolve client stream method");

        let request_frames: Vec<Bytes> = bodies
            .into_iter()
            .map(|body| {
                let encoded = encode_request_json(&method, &body).expect("encode client stream frame");
                Bytes::from(encoded)
            })
            .collect();

        let endpoint = Endpoint::from_shared(format!("http://127.0.0.1:{port}"))
            .expect("build endpoint");
        let channel = endpoint.connect().await.expect("connect channel");
        let mut grpc = Grpc::new(channel);
        grpc.ready().await.expect("grpc client ready");
        let path: PathAndQuery = "/echo.EchoService/ClientStream".parse().expect("valid path");
        let response = grpc
            .client_streaming(Request::new(iter(request_frames)), path, BytesCodec)
            .await
            .expect("invoke client stream");

        decode_response_json(&method, response.get_ref().as_ref()).expect("decode client stream response")
    }

    async fn invoke_bidi_echo(
        port: u16,
        bodies: Vec<serde_json::Value>,
    ) -> Vec<serde_json::Value> {
        let payload = crate::grpc::test_echo_protoset::echo_descriptor_payload();
        let pool = load_descriptor_pool(&payload).expect("load echo descriptor pool");
        let method = resolve_stream_method(
            &pool,
            "echo.EchoService",
            "BidiStream",
            &crate::grpc::types::GrpcTauriStreamingCallType::BidiStreaming,
        )
        .expect("resolve bidi stream method");

        let request_frames: Vec<Bytes> = bodies
            .into_iter()
            .map(|body| {
                let encoded = encode_request_json(&method, &body).expect("encode bidi frame");
                Bytes::from(encoded)
            })
            .collect();

        let endpoint = Endpoint::from_shared(format!("http://127.0.0.1:{port}"))
            .expect("build endpoint");
        let channel = endpoint.connect().await.expect("connect channel");
        let mut grpc = Grpc::new(channel);
        grpc.ready().await.expect("grpc client ready");
        let path: PathAndQuery = "/echo.EchoService/BidiStream".parse().expect("valid path");
        let response = grpc
            .streaming(Request::new(iter(request_frames)), path, BytesCodec)
            .await
            .expect("invoke bidi stream");

        let mut stream = response.into_inner();
        let mut messages: Vec<serde_json::Value> = Vec::new();
        while let Some(chunk) = stream.message().await.expect("bidi stream message") {
            messages.push(decode_response_json(&method, chunk.as_ref()).expect("decode bidi response"));
        }
        messages
    }

    async fn invoke_bidi_echo_and_cancel_after_first(
        port: u16,
        bodies: Vec<serde_json::Value>,
    ) -> serde_json::Value {
        let payload = crate::grpc::test_echo_protoset::echo_descriptor_payload();
        let pool = load_descriptor_pool(&payload).expect("load echo descriptor pool");
        let method = resolve_stream_method(
            &pool,
            "echo.EchoService",
            "BidiStream",
            &crate::grpc::types::GrpcTauriStreamingCallType::BidiStreaming,
        )
        .expect("resolve bidi stream method");

        let request_frames: Vec<Bytes> = bodies
            .into_iter()
            .map(|body| {
                let encoded = encode_request_json(&method, &body).expect("encode bidi frame");
                Bytes::from(encoded)
            })
            .collect();

        let endpoint = Endpoint::from_shared(format!("http://127.0.0.1:{port}"))
            .expect("build endpoint");
        let channel = endpoint.connect().await.expect("connect channel");
        let mut grpc = Grpc::new(channel);
        grpc.ready().await.expect("grpc client ready");
        let path: PathAndQuery = "/echo.EchoService/BidiStream".parse().expect("valid path");
        let response = grpc
            .streaming(Request::new(iter(request_frames)), path, BytesCodec)
            .await
            .expect("invoke bidi stream");

        let mut stream = response.into_inner();
        let first_chunk = stream
            .message()
            .await
            .expect("bidi stream first message")
            .expect("first bidi frame should exist");
        drop(stream);

        decode_response_json(&method, first_chunk.as_ref()).expect("decode first bidi response")
    }

    #[tokio::test]
    async fn start_returns_host_port_listen_target() {
        let _guard = test_mutex().lock().unwrap_or_else(|e| e.into_inner());
        let _ = shutdown_all_mock_listeners();

        let Some(port) = pick_available_test_port() else {
            // Local machine has no currently free port in configured mock range.
            return;
        };

        let mut request = base_start_request("tab-listen-target");
        request.port = Some(port);

        let response = execute_grpc_mock_listener_start(request).await;
        assert_eq!(response["ok"], true);

        let listen_target = response["data"]["status"]["listenTarget"]
            .as_str()
            .expect("listenTarget should be a string");

        assert!(listen_target.starts_with("127.0.0.1:"));
        assert!(!listen_target.starts_with("http://"));

        let _ = shutdown_all_mock_listeners();
    }

    #[tokio::test]
    async fn start_replaces_existing_runtime_for_same_tab() {
        let _guard = test_mutex().lock().unwrap_or_else(|e| e.into_inner());
        let _ = shutdown_all_mock_listeners();

        let first = execute_grpc_mock_listener_start(base_start_request("tab-restart")).await;
        assert_eq!(first["ok"], true);

        let mut second_request = base_start_request("tab-restart");
        second_request.connection_id = "conn-2".to_string();
        let second = execute_grpc_mock_listener_start(second_request).await;

        assert_eq!(second["ok"], true);
        assert_eq!(second["data"]["status"]["connectionId"], "conn-2");

        let _ = shutdown_all_mock_listeners();
    }

    #[tokio::test]
    async fn start_reuses_requested_port_for_same_tab_restart() {
        let _guard = test_mutex().lock().unwrap_or_else(|e| e.into_inner());
        let _ = shutdown_all_mock_listeners();

        let Some(port) = pick_available_test_port() else {
            // Local machine has no currently free port in configured mock range.
            return;
        };

        let mut first_request = base_start_request("tab-requested-port");
        first_request.port = Some(port);
        let first = execute_grpc_mock_listener_start(first_request).await;
        assert_eq!(first["ok"], true);
        assert_eq!(first["data"]["status"]["port"], port);

        let mut second_request = base_start_request("tab-requested-port");
        second_request.connection_id = "conn-2".to_string();
        second_request.port = Some(port);
        let second = execute_grpc_mock_listener_start(second_request).await;

        assert_eq!(second["ok"], true, "second start failed: {second}");
        assert_eq!(second["data"]["status"]["connectionId"], "conn-2");
        assert_eq!(second["data"]["status"]["port"], port);

        let _ = shutdown_all_mock_listeners();
    }

    #[tokio::test]
    async fn listener_dispatches_unary_rule_response() {
        let _guard = test_mutex().lock().unwrap_or_else(|e| e.into_inner());
        let _ = shutdown_all_mock_listeners();

        let Some(port) = pick_available_test_port() else {
            return;
        };

        let mut request = base_start_request("tab-dispatch-unary");
        request.port = Some(port);
        request.rule_set = serde_json::json!({
            "rules": [
                {
                    "id": "unary-rule",
                    "name": "Unary Rule",
                    "enabled": true,
                    "priority": 1,
                    "predicate": {
                        "kind": "and",
                        "predicates": [
                            { "kind": "service_equals", "service": "echo.EchoService" },
                            { "kind": "method_equals", "method": "Echo" }
                        ]
                    },
                    "response": {
                        "statusCode": 0,
                        "body": { "message": "native-mock-echo" }
                    }
                }
            ]
        });

        let started = execute_grpc_mock_listener_start(request).await;
        assert_eq!(started["ok"], true, "failed to start listener: {started}");

        let response = invoke_unary_echo(port, serde_json::json!({ "message": "ignored" })).await;
        assert_eq!(response["message"], "native-mock-echo");

        let _ = shutdown_all_mock_listeners();
    }

    #[tokio::test]
    async fn listener_dispatches_server_streaming_rule_messages() {
        let _guard = test_mutex().lock().unwrap_or_else(|e| e.into_inner());
        let _ = shutdown_all_mock_listeners();

        let Some(port) = pick_available_test_port() else {
            return;
        };

        let mut request = base_start_request("tab-dispatch-stream");
        request.port = Some(port);
        request.rule_set = serde_json::json!({
            "rules": [
                {
                    "id": "stream-rule",
                    "name": "Server Stream Rule",
                    "enabled": true,
                    "priority": 1,
                    "predicate": {
                        "kind": "and",
                        "predicates": [
                            { "kind": "service_equals", "service": "echo.EchoService" },
                            { "kind": "method_equals", "method": "ServerStream" }
                        ]
                    },
                    "response": {
                        "statusCode": 0,
                        "messages": [
                            { "message": "s1" },
                            { "message": "s2" }
                        ]
                    }
                }
            ]
        });

        let started = execute_grpc_mock_listener_start(request).await;
        assert_eq!(started["ok"], true, "failed to start listener: {started}");

        let payload = crate::grpc::test_echo_protoset::echo_descriptor_payload();
        let pool = load_descriptor_pool(&payload).expect("load echo descriptor pool");
        let method = resolve_stream_method(
            &pool,
            "echo.EchoService",
            "ServerStream",
            &crate::grpc::types::GrpcTauriStreamingCallType::ServerStreaming,
        )
        .expect("resolve stream method");
        let request_bytes = encode_request_json(&method, &serde_json::json!({ "message": "m", "repeatCount": 1, "intervalMs": 0 }))
            .expect("encode stream request");

        let endpoint = Endpoint::from_shared(format!("http://127.0.0.1:{port}"))
            .expect("build endpoint");
        let channel = endpoint.connect().await.expect("connect channel");
        let mut grpc = Grpc::new(channel);
        grpc.ready().await.expect("grpc client ready");
        let path: PathAndQuery = "/echo.EchoService/ServerStream".parse().expect("valid path");
        let response = grpc
            .server_streaming(Request::new(Bytes::from(request_bytes)), path, BytesCodec)
            .await
            .expect("invoke server stream");

        let mut stream = response.into_inner();
        let mut messages: Vec<serde_json::Value> = Vec::new();
        while let Some(chunk) = stream.message().await.expect("stream message") {
            let decoded = decode_response_json(&method, chunk.as_ref()).expect("decode stream message");
            messages.push(decoded);
        }

        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0]["message"], "s1");
        assert_eq!(messages[1]["message"], "s2");

        let _ = shutdown_all_mock_listeners();
    }

    #[tokio::test]
    async fn listener_dispatches_client_streaming_rule_response() {
        let _guard = test_mutex().lock().unwrap_or_else(|e| e.into_inner());
        let _ = shutdown_all_mock_listeners();

        let Some(port) = pick_available_test_port() else {
            return;
        };

        let mut request = base_start_request("tab-dispatch-client-stream");
        request.port = Some(port);
        request.rule_set = serde_json::json!({
            "rules": [
                {
                    "id": "client-stream-rule",
                    "name": "Client Stream Rule",
                    "enabled": true,
                    "priority": 1,
                    "predicate": {
                        "kind": "and",
                        "predicates": [
                            { "kind": "service_equals", "service": "echo.EchoService" },
                            { "kind": "method_equals", "method": "ClientStream" }
                        ]
                    },
                    "response": {
                        "statusCode": 0,
                        "body": { "message": "client-stream-mock" }
                    }
                }
            ]
        });

        let started = execute_grpc_mock_listener_start(request).await;
        assert_eq!(started["ok"], true, "failed to start listener: {started}");

        let response = invoke_client_stream_echo(
            port,
            vec![
                serde_json::json!({ "message": "a" }),
                serde_json::json!({ "message": "b" }),
            ],
        )
        .await;
        assert_eq!(response["message"], "client-stream-mock");

        let _ = shutdown_all_mock_listeners();
    }

    #[tokio::test]
    async fn listener_dispatches_bidi_streaming_messages_per_input_frame() {
        let _guard = test_mutex().lock().unwrap_or_else(|e| e.into_inner());
        let _ = shutdown_all_mock_listeners();

        let Some(port) = pick_available_test_port() else {
            return;
        };

        let mut request = base_start_request("tab-dispatch-bidi");
        request.port = Some(port);
        request.rule_set = serde_json::json!({
            "rules": [
                {
                    "id": "bidi-rule",
                    "name": "Bidi Rule",
                    "enabled": true,
                    "priority": 1,
                    "predicate": {
                        "kind": "and",
                        "predicates": [
                            { "kind": "service_equals", "service": "echo.EchoService" },
                            { "kind": "method_equals", "method": "BidiStream" }
                        ]
                    },
                    "response": {
                        "statusCode": 0,
                        "body": { "message": "bidi-mock" }
                    }
                }
            ]
        });

        let started = execute_grpc_mock_listener_start(request).await;
        assert_eq!(started["ok"], true, "failed to start listener: {started}");

        let responses = invoke_bidi_echo(
            port,
            vec![
                serde_json::json!({ "message": "1" }),
                serde_json::json!({ "message": "2" }),
            ],
        )
        .await;

        assert_eq!(responses.len(), 2);
        assert_eq!(responses[0]["message"], "bidi-mock");
        assert_eq!(responses[1]["message"], "bidi-mock");

        let _ = shutdown_all_mock_listeners();
    }

    #[tokio::test]
    async fn listener_commit_swaps_active_rule_generation_for_subsequent_calls() {
        let _guard = test_mutex().lock().unwrap_or_else(|e| e.into_inner());
        let _ = shutdown_all_mock_listeners();

        let Some(port) = pick_available_test_port() else {
            return;
        };

        let tab_id = "tab-dispatch-commit";
        let mut request = base_start_request(tab_id);
        request.port = Some(port);
        request.rule_set = serde_json::json!({
            "rules": [
                {
                    "id": "before-commit",
                    "name": "Before Commit",
                    "enabled": true,
                    "priority": 1,
                    "predicate": {
                        "kind": "and",
                        "predicates": [
                            { "kind": "service_equals", "service": "echo.EchoService" },
                            { "kind": "method_equals", "method": "Echo" }
                        ]
                    },
                    "response": {
                        "statusCode": 0,
                        "body": { "message": "before" }
                    }
                }
            ]
        });

        let started = execute_grpc_mock_listener_start(request).await;
        assert_eq!(started["ok"], true, "failed to start listener: {started}");

        let before = invoke_unary_echo(port, serde_json::json!({ "message": "x" })).await;
        assert_eq!(before["message"], "before");

        let commit = execute_grpc_mock_listener_commit(
            crate::grpc::types::GrpcTauriMockListenerCommitRequest {
                schema_version: GRPC_TAURI_SCHEMA_VERSION,
                tab_id: tab_id.to_string(),
                rule_set: serde_json::json!({
                    "rules": [
                        {
                            "id": "after-commit",
                            "name": "After Commit",
                            "enabled": true,
                            "priority": 1,
                            "predicate": {
                                "kind": "and",
                                "predicates": [
                                    { "kind": "service_equals", "service": "echo.EchoService" },
                                    { "kind": "method_equals", "method": "Echo" }
                                ]
                            },
                            "response": {
                                "statusCode": 0,
                                "body": { "message": "after" }
                            }
                        }
                    ]
                }),
                latency_policy: None,
            },
        )
        .await;
        assert_eq!(commit["ok"], true, "commit failed: {commit}");

        let after = invoke_unary_echo(port, serde_json::json!({ "message": "x" })).await;
        assert_eq!(after["message"], "after");

        let _ = shutdown_all_mock_listeners();
    }

    #[tokio::test]
    async fn listener_bidi_cancelled_stream_does_not_break_follow_up_calls() {
        let _guard = test_mutex().lock().unwrap_or_else(|e| e.into_inner());
        let _ = shutdown_all_mock_listeners();

        let Some(port) = pick_available_test_port() else {
            return;
        };

        let tab_id = "tab-dispatch-bidi-cancel";
        let mut request = base_start_request(tab_id);
        request.port = Some(port);
        request.rule_set = serde_json::json!({
            "rules": [
                {
                    "id": "bidi-rule",
                    "name": "Bidi Rule",
                    "enabled": true,
                    "priority": 1,
                    "predicate": {
                        "kind": "and",
                        "predicates": [
                            { "kind": "service_equals", "service": "echo.EchoService" },
                            { "kind": "method_equals", "method": "BidiStream" }
                        ]
                    },
                    "response": {
                        "statusCode": 0,
                        "body": { "message": "bidi-cancel-ok" }
                    }
                },
                {
                    "id": "unary-rule",
                    "name": "Unary Rule",
                    "enabled": true,
                    "priority": 2,
                    "predicate": {
                        "kind": "and",
                        "predicates": [
                            { "kind": "service_equals", "service": "echo.EchoService" },
                            { "kind": "method_equals", "method": "Echo" }
                        ]
                    },
                    "response": {
                        "statusCode": 0,
                        "body": { "message": "after-bidi-cancel" }
                    }
                }
            ]
        });

        let started = execute_grpc_mock_listener_start(request).await;
        assert_eq!(started["ok"], true, "failed to start listener: {started}");

        let bidi_bodies = (0..128)
            .map(|index| serde_json::json!({ "message": format!("m-{index}") }))
            .collect::<Vec<_>>();
        let first = invoke_bidi_echo_and_cancel_after_first(port, bidi_bodies).await;
        assert_eq!(first["message"], "bidi-cancel-ok");

        let unary_after_cancel = invoke_unary_echo(port, serde_json::json!({ "message": "probe" })).await;
        assert_eq!(unary_after_cancel["message"], "after-bidi-cancel");

        let status = execute_grpc_mock_listener_status(GrpcTauriMockListenerTabRequest {
            schema_version: GRPC_TAURI_SCHEMA_VERSION,
            tab_id: tab_id.to_string(),
        })
        .await;

        assert_eq!(status["ok"], true, "status call failed: {status}");
        assert_eq!(status["data"]["running"], true);
        assert_eq!(status["data"]["inFlightCount"], 0);
        assert!(status["data"]["lastError"].is_null());

        let _ = shutdown_all_mock_listeners();
    }
}
