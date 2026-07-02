//! Docker echo server integration tests for native streaming — Phase 7D.
//!
//! Skips automatically when localhost:50051 is unreachable.

use std::net::TcpStream;
use std::time::Duration;

use tokio::sync::mpsc;

use crate::grpc::state::GrpcState;
use crate::grpc::stream::{
    execute_grpc_stream_cancel, execute_grpc_stream_end, execute_grpc_stream_send,
    execute_grpc_stream_start, StreamEventEmitter,
};
use crate::grpc::test_echo_protoset::echo_descriptor_payload;
use crate::grpc::types::{
    GrpcTauriEventType, GrpcTauriStreamCancelRequest, GrpcTauriStreamEndRequest,
    GrpcTauriStreamSendRequest, GrpcTauriStreamStartRequest, GrpcTauriStreamingCallType,
    GrpcTauriTarget, GrpcTauriTlsMode,
};

fn echo_reachable() -> bool {
    TcpStream::connect_timeout(
        &"127.0.0.1:50051".parse().expect("valid socket addr"),
        Duration::from_millis(800),
    )
    .is_ok()
}

fn test_emitter() -> (StreamEventEmitter, mpsc::UnboundedReceiver<crate::grpc::types::GrpcTauriEvent>) {
    let (tx, rx) = mpsc::unbounded_channel();
    (StreamEventEmitter::Test(tx), rx)
}

#[tokio::test]
async fn grpc_server_stream_emits_messages_and_end_against_docker_server() {
    if !echo_reachable() {
        eprintln!("Skipping grpc server stream integration test — localhost:50051 unreachable");
        return;
    }

    let state = GrpcState::new();
    let (emitter, mut rx) = test_emitter();
    let request_id = format!("req-server-stream-{}", uuid::Uuid::new_v4());

    let envelope = execute_grpc_stream_start(
        &state,
        GrpcTauriStreamStartRequest {
            schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
            request_id: request_id.clone(),
            tab_id: "tab-integration".to_string(),
            call_type: GrpcTauriStreamingCallType::ServerStreaming,
            target: GrpcTauriTarget {
                address: "localhost:50051".to_string(),
                tls_mode: GrpcTauriTlsMode::Disabled,
                tls_config: None,
            },
            service: "echo.EchoService".to_string(),
            method: "ServerStream".to_string(),
            body: serde_json::json!({ "message": "stream", "repeat_count": 2 }),
            metadata: None,
            auth: None,
            timeout_ms: Some(5_000),
            descriptor: echo_descriptor_payload(),
        },
        emitter.clone(),
    )
    .await;

    assert_eq!(envelope["ok"], true, "envelope: {envelope}");
    let stream_id = envelope["data"]["streamId"].as_str().expect("streamId");

    let mut saw_message = false;
    let mut saw_inbound_direction = false;
    let mut saw_end = false;
    let deadline = tokio::time::Instant::now() + Duration::from_secs(8);

    while tokio::time::Instant::now() < deadline {
        if let Ok(event) = rx.try_recv() {
            assert_eq!(event.stream_id, stream_id);
            assert_eq!(event.request_id, request_id);
            match event.event_type {
                GrpcTauriEventType::GrpcMessage => {
                    saw_message = true;
                    if event.direction.as_deref() == Some("inbound") {
                        saw_inbound_direction = true;
                    }
                }
                GrpcTauriEventType::GrpcEnd => {
                    saw_end = true;
                    break;
                }
                GrpcTauriEventType::GrpcError => panic!("unexpected grpc-error: {event:?}"),
                _ => {}
            }
        } else {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    assert!(saw_message, "expected at least one grpc-message event");
    assert!(saw_inbound_direction, "expected inbound direction on server-stream message");
    assert!(saw_end, "expected grpc-end terminal event");

    let end_envelope = execute_grpc_stream_end(
        &state,
        GrpcTauriStreamEndRequest {
            schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
            stream_id: stream_id.to_string(),
            tab_id: "tab-integration".to_string(),
        },
    )
    .await;
    assert_eq!(end_envelope["data"]["alreadyTerminal"], true);
}

#[tokio::test]
async fn grpc_stream_cancel_emits_cancelled_end_against_docker_server() {
    if !echo_reachable() {
        eprintln!("Skipping grpc stream cancel integration test — localhost:50051 unreachable");
        return;
    }

    let state = GrpcState::new();
    let (emitter, mut rx) = test_emitter();
    let cancel_emitter = emitter.clone();

    let envelope = execute_grpc_stream_start(
        &state,
        GrpcTauriStreamStartRequest {
            schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
            request_id: format!("req-cancel-{}", uuid::Uuid::new_v4()),
            tab_id: "tab-integration".to_string(),
            call_type: GrpcTauriStreamingCallType::ServerStreaming,
            target: GrpcTauriTarget {
                address: "localhost:50051".to_string(),
                tls_mode: GrpcTauriTlsMode::Disabled,
                tls_config: None,
            },
            service: "echo.EchoService".to_string(),
            method: "ServerStream".to_string(),
            body: serde_json::json!({ "message": "cancel-me", "repeat_count": 100, "interval_ms": 500 }),
            metadata: None,
            auth: None,
            timeout_ms: Some(30_000),
            descriptor: echo_descriptor_payload(),
        },
        emitter.clone(),
    )
    .await;

    assert_eq!(envelope["ok"], true);
    let stream_id = envelope["data"]["streamId"].as_str().expect("streamId").to_string();

    let cancel_envelope = execute_grpc_stream_cancel(
        &state,
        GrpcTauriStreamCancelRequest {
            schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
            stream_id: stream_id.clone(),
            tab_id: "tab-integration".to_string(),
        },
        Some(cancel_emitter),
    )
    .await;
    assert_eq!(cancel_envelope["ok"], true);
    assert_eq!(cancel_envelope["data"]["acknowledged"], true);

    let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    let mut saw_cancelled_end = false;
    while tokio::time::Instant::now() < deadline {
        if let Ok(event) = rx.try_recv() {
            if event.event_type == GrpcTauriEventType::GrpcEnd
                && event.grpc_status == Some(1)
            {
                saw_cancelled_end = true;
                break;
            }
        } else {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    assert!(saw_cancelled_end, "expected cancelled grpc-end event");
}

#[tokio::test]
async fn grpc_client_stream_aggregates_messages_and_end_against_docker_server() {
    if !echo_reachable() {
        eprintln!("Skipping grpc client stream integration test — localhost:50051 unreachable");
        return;
    }

    let state = GrpcState::new();
    let (emitter, mut rx) = test_emitter();
    let request_id = format!("req-client-stream-{}", uuid::Uuid::new_v4());

    let envelope = execute_grpc_stream_start(
        &state,
        GrpcTauriStreamStartRequest {
            schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
            request_id: request_id.clone(),
            tab_id: "tab-integration".to_string(),
            call_type: GrpcTauriStreamingCallType::ClientStreaming,
            target: GrpcTauriTarget {
                address: "localhost:50051".to_string(),
                tls_mode: GrpcTauriTlsMode::Disabled,
                tls_config: None,
            },
            service: "echo.EchoService".to_string(),
            method: "ClientStream".to_string(),
            body: serde_json::json!({}),
            metadata: None,
            auth: None,
            timeout_ms: Some(5_000),
            descriptor: echo_descriptor_payload(),
        },
        emitter.clone(),
    )
    .await;

    assert_eq!(envelope["ok"], true, "envelope: {envelope}");
    let stream_id = envelope["data"]["streamId"].as_str().expect("streamId").to_string();

    for message in ["one", "two"] {
        let send_envelope = execute_grpc_stream_send(
            &state,
            GrpcTauriStreamSendRequest {
                schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
                stream_id: stream_id.clone(),
                tab_id: "tab-integration".to_string(),
                body: serde_json::json!({ "message": message }),
            },
            emitter.clone(),
        )
        .await;
        assert_eq!(send_envelope["ok"], true, "send envelope: {send_envelope}");
    }

    let mut saw_outbound = false;
    while let Ok(event) = rx.try_recv() {
        if event.event_type == GrpcTauriEventType::GrpcMessage
            && event.direction.as_deref() == Some("outbound")
        {
            saw_outbound = true;
        }
    }
    assert!(saw_outbound, "expected outbound direction on client-stream send events");

    let end_envelope = execute_grpc_stream_end(
        &state,
        GrpcTauriStreamEndRequest {
            schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
            stream_id: stream_id.clone(),
            tab_id: "tab-integration".to_string(),
        },
    )
    .await;
    assert_eq!(end_envelope["ok"], true);

    let deadline = tokio::time::Instant::now() + Duration::from_secs(8);
    let mut saw_aggregated_end = false;
    while tokio::time::Instant::now() < deadline {
        if let Ok(event) = rx.try_recv() {
            if event.event_type == GrpcTauriEventType::GrpcEnd {
                let message = event
                    .data
                    .as_ref()
                    .and_then(|value| value.get("message"))
                    .and_then(|value| value.as_str())
                    .unwrap_or_default();
                assert_eq!(message, "one,two");
                saw_aggregated_end = true;
                break;
            }
        } else {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    assert!(saw_aggregated_end, "expected grpc-end with aggregated client-stream response");
}

#[tokio::test]
async fn grpc_bidi_stream_echoes_messages_and_end_against_docker_server() {
    if !echo_reachable() {
        eprintln!("Skipping grpc bidi stream integration test — localhost:50051 unreachable");
        return;
    }

    let state = GrpcState::new();
    let (emitter, mut rx) = test_emitter();
    let request_id = format!("req-bidi-stream-{}", uuid::Uuid::new_v4());

    let envelope = execute_grpc_stream_start(
        &state,
        GrpcTauriStreamStartRequest {
            schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
            request_id: request_id.clone(),
            tab_id: "tab-integration".to_string(),
            call_type: GrpcTauriStreamingCallType::BidiStreaming,
            target: GrpcTauriTarget {
                address: "localhost:50051".to_string(),
                tls_mode: GrpcTauriTlsMode::Disabled,
                tls_config: None,
            },
            service: "echo.EchoService".to_string(),
            method: "BidiStream".to_string(),
            body: serde_json::json!({}),
            metadata: None,
            auth: None,
            timeout_ms: Some(5_000),
            descriptor: echo_descriptor_payload(),
        },
        emitter.clone(),
    )
    .await;

    assert_eq!(envelope["ok"], true, "envelope: {envelope}");
    let stream_id = envelope["data"]["streamId"].as_str().expect("streamId").to_string();

    let send_envelope = execute_grpc_stream_send(
        &state,
        GrpcTauriStreamSendRequest {
            schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
            stream_id: stream_id.clone(),
            tab_id: "tab-integration".to_string(),
            body: serde_json::json!({ "message": "ping" }),
        },
        emitter.clone(),
    )
    .await;
    assert_eq!(send_envelope["ok"], true);

    let deadline = tokio::time::Instant::now() + Duration::from_secs(8);
    let mut saw_echo = false;
    let mut saw_outbound = false;
    while tokio::time::Instant::now() < deadline && !saw_echo {
        if let Ok(event) = rx.try_recv() {
            if event.event_type == GrpcTauriEventType::GrpcMessage {
                if event.direction.as_deref() == Some("outbound") {
                    saw_outbound = true;
                }
                let message = event
                    .data
                    .as_ref()
                    .and_then(|value| value.get("message"))
                    .and_then(|value| value.as_str())
                    .unwrap_or_default();
                if message == "ping" {
                    saw_echo = true;
                }
            } else if event.event_type == GrpcTauriEventType::GrpcError {
                panic!("unexpected grpc-error: {event:?}");
            }
        } else {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    assert!(saw_echo, "expected grpc-message echo from bidi stream");
    assert!(saw_outbound, "expected outbound direction on bidi send event");

    let end_envelope = execute_grpc_stream_end(
        &state,
        GrpcTauriStreamEndRequest {
            schema_version: crate::grpc::types::GRPC_TAURI_SCHEMA_VERSION,
            stream_id: stream_id.clone(),
            tab_id: "tab-integration".to_string(),
        },
    )
    .await;
    assert_eq!(end_envelope["ok"], true);

    let end_deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    let mut saw_end = false;
    while tokio::time::Instant::now() < end_deadline {
        if let Ok(event) = rx.try_recv() {
            if event.event_type == GrpcTauriEventType::GrpcEnd {
                saw_end = true;
                break;
            }
        } else {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    assert!(saw_end, "expected grpc-end terminal event after bidi half-close");
}
