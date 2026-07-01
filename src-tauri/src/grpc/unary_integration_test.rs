//! Docker echo server integration tests for native unary — Phase 7C.
//!
//! Skips automatically when localhost:50051 is unreachable.

use std::net::TcpStream;
use std::time::Duration;

use crate::grpc::state::GrpcState;
use crate::grpc::test_echo_protoset::echo_descriptor_payload;
use crate::grpc::types::{GrpcTauriTarget, GrpcTauriTlsMode, GrpcTauriUnaryRequest};
use crate::grpc::unary::execute_grpc_unary;

fn echo_reachable() -> bool {
    TcpStream::connect_timeout(
        &"127.0.0.1:50051".parse().expect("valid socket addr"),
        Duration::from_millis(800),
    )
    .is_ok()
}

#[tokio::test]
async fn grpc_unary_echo_round_trip_against_docker_server() {
    if !echo_reachable() {
        eprintln!("Skipping grpc unary integration test — localhost:50051 unreachable");
        return;
    }

    let state = GrpcState::new();
    let request = GrpcTauriUnaryRequest {
        schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
        request_id: format!("req-integration-{}", uuid::Uuid::new_v4()),
        tab_id: "tab-integration".to_string(),
        target: GrpcTauriTarget {
            address: "localhost:50051".to_string(),
            tls_mode: GrpcTauriTlsMode::Disabled,
            tls_config: None,
        },
        service: "echo.EchoService".to_string(),
        method: "Echo".to_string(),
        body: serde_json::json!({ "message": "hello native" }),
        metadata: None,
        auth: None,
        timeout_ms: Some(5_000),
        descriptor: echo_descriptor_payload(),
    };

    let envelope = execute_grpc_unary(&state, request).await;

    assert_eq!(envelope["ok"], true, "envelope: {envelope}");
    assert_eq!(envelope["data"]["status"], 0);
    assert_eq!(envelope["data"]["body"]["message"], "hello native");
    assert_eq!(envelope["data"]["transportUsed"], "tauri");
}
