use super::*;
use super::registry::{is_port_available, MOCK_PORT_MAX, MOCK_PORT_MIN};
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
