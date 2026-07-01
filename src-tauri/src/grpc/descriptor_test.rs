//! Phase 7G descriptor + dynamic codec tests.

use prost::Message;

use crate::grpc::descriptor::{
    decode_response_json, descriptor_load_error_code, encode_request_json, load_descriptor_pool,
    resolve_stream_method, resolve_unary_method,
};
use crate::grpc::dynamic_codec::{decode_message_json, encode_message_json};
use crate::grpc::test_codec_protoset::codec_acceptance_descriptor_payload;
use crate::grpc::test_echo_protoset::echo_descriptor_payload;
use crate::grpc::types::{GrpcTauriStreamingCallType, GRPC_TAURI_DESCRIPTOR_INTEGRITY, GRPC_TAURI_INVALID_REQUEST};

fn acceptance_request_json() -> serde_json::Value {
    serde_json::json!({
        "name": "phase-7g",
        "tags": ["alpha", "beta"],
        "nested": { "label": "child", "count": 3 },
        "text": "oneof-text",
        "createdAt": { "seconds": 1700000000, "nanos": 0 },
    })
}

#[test]
fn load_pool_validates_sha256_format() {
    let mut payload = echo_descriptor_payload();
    payload.content_sha256 = "deadbeef".to_string();
    let err = load_descriptor_pool(&payload).expect_err("short sha");
    assert!(err.contains(GRPC_TAURI_DESCRIPTOR_INTEGRITY));
    assert!(err.contains("64-character hex digest"));
    assert_eq!(descriptor_load_error_code(&err), GRPC_TAURI_DESCRIPTOR_INTEGRITY);
}

#[test]
fn load_pool_validates_sha256_mismatch() {
    let mut payload = echo_descriptor_payload();
    payload.content_sha256 = "a".repeat(64);
    let err = load_descriptor_pool(&payload).expect_err("sha mismatch");
    assert!(err.contains(GRPC_TAURI_DESCRIPTOR_INTEGRITY));
    assert!(err.contains("SHA-256 mismatch"));
    assert_eq!(descriptor_load_error_code(&err), GRPC_TAURI_DESCRIPTOR_INTEGRITY);
}

#[test]
fn load_pool_rejects_empty_content_sha256() {
    let mut payload = echo_descriptor_payload();
    payload.content_sha256 = "   ".to_string();
    let err = load_descriptor_pool(&payload).expect_err("empty sha");
    assert!(err.contains(GRPC_TAURI_DESCRIPTOR_INTEGRITY));
    assert!(err.contains("contentSha256 is required"));
    assert_eq!(descriptor_load_error_code(&err), GRPC_TAURI_DESCRIPTOR_INTEGRITY);
}

#[test]
fn descriptor_load_error_code_maps_empty_buffer() {
    let message = "protosetBase64 decoded to an empty buffer";
    assert_eq!(descriptor_load_error_code(message), GRPC_TAURI_INVALID_REQUEST);
}

#[test]
fn load_pool_rejects_invalid_base64() {
    let mut payload = echo_descriptor_payload();
    payload.protoset_base64 = "!!!".to_string();
    payload.content_sha256 = "a".repeat(64);
    let err = load_descriptor_pool(&payload).expect_err("invalid base64");
    assert!(err.starts_with("Invalid protosetBase64:"));
    assert_eq!(descriptor_load_error_code(&err), GRPC_TAURI_INVALID_REQUEST);
}

#[test]
fn descriptor_load_error_code_maps_pool_decode_failures() {
    let message = "Failed to build descriptor pool: corrupt bytes";
    assert_eq!(descriptor_load_error_code(message), GRPC_TAURI_INVALID_REQUEST);
}

#[test]
fn descriptor_load_error_code_maps_invalid_base64() {
    let message = "Invalid protosetBase64: Invalid symbol";
    assert_eq!(descriptor_load_error_code(message), GRPC_TAURI_INVALID_REQUEST);
}

#[test]
fn echo_encode_and_decode_round_trip() {
    let payload = echo_descriptor_payload();
    let pool = load_descriptor_pool(&payload).expect("pool loads");
    let method = resolve_unary_method(&pool, "echo.EchoService", "Echo").expect("method");
    let request_bytes = encode_request_json(&method, &serde_json::json!({ "message": "hi" }))
        .expect("encode");
    assert!(!request_bytes.is_empty());

    let mut response = prost_reflect::DynamicMessage::new(method.output());
    response.set_field_by_name(
        "message",
        prost_reflect::Value::String("hi".to_string()),
    );
    let response_bytes = response.encode_to_vec();
    let json = decode_response_json(&method, &response_bytes).expect("decode");
    assert_eq!(json["message"], "hi");
}

#[test]
fn resolve_unary_method_rejects_streaming_methods() {
    let payload = echo_descriptor_payload();
    let pool = load_descriptor_pool(&payload).expect("pool loads");
    let err = resolve_unary_method(&pool, "echo.EchoService", "ServerStream")
        .expect_err("streaming method");
    assert!(err.contains("server_streaming"));
}

#[test]
fn acceptance_nested_repeated_oneof_wkt_round_trip() {
    let payload = codec_acceptance_descriptor_payload();
    let pool = load_descriptor_pool(&payload).expect("pool loads");
    let method =
        resolve_unary_method(&pool, "codec.CodecService", "RoundTrip").expect("method");

    let body = acceptance_request_json();
    let request_bytes = encode_request_json(&method, &body).expect("encode request");
    assert!(!request_bytes.is_empty());

    let input_descriptor = method.input();
    let mut response = prost_reflect::DynamicMessage::new(method.output());
    let request_message =
        prost_reflect::DynamicMessage::decode(input_descriptor, request_bytes.as_slice())
            .expect("decode request bytes");
    response.set_field_by_name(
        "echo",
        prost_reflect::Value::Message(request_message),
    );

    let response_bytes = response.encode_to_vec();
    let decoded = decode_response_json(&method, &response_bytes).expect("decode response");
    let echo = decoded.get("echo").expect("echo field");
    assert_eq!(echo["name"], "phase-7g");
    assert_eq!(echo["tags"], serde_json::json!(["alpha", "beta"]));
    assert_eq!(echo["nested"]["label"], "child");
    assert_eq!(echo["nested"]["count"], 3);
    assert_eq!(echo["text"], "oneof-text");
    assert!(echo.get("number").is_none());
    assert_eq!(echo["createdAt"]["seconds"], "1700000000");
}

#[test]
fn acceptance_oneof_number_branch_encodes() {
    let payload = codec_acceptance_descriptor_payload();
    let pool = load_descriptor_pool(&payload).expect("pool loads");
    let descriptor = pool
        .get_message_by_name("codec.ComplexRequest")
        .expect("descriptor");

    let body = serde_json::json!({
        "name": "numeric",
        "tags": [],
        "nested": { "label": "n", "count": 1 },
        "number": 42,
        "createdAt": { "seconds": 1, "nanos": 0 },
    });
    let bytes = encode_message_json(descriptor.clone(), &body).expect("encode");
    let decoded = decode_message_json(descriptor, &bytes).expect("decode");
    assert_eq!(decoded["number"], 42);
    assert!(decoded.get("text").is_none());
}

#[test]
fn resolve_stream_method_matches_call_type() {
    let payload = echo_descriptor_payload();
    let pool = load_descriptor_pool(&payload).expect("pool loads");
    let method = resolve_stream_method(
        &pool,
        "echo.EchoService",
        "ServerStream",
        &GrpcTauriStreamingCallType::ServerStreaming,
    )
    .expect("server stream method");
    assert!(method.is_server_streaming());
}

#[test]
fn resolve_stream_method_rejects_unary() {
    let payload = echo_descriptor_payload();
    let pool = load_descriptor_pool(&payload).expect("pool loads");
    let err = resolve_stream_method(
        &pool,
        "echo.EchoService",
        "Echo",
        &GrpcTauriStreamingCallType::ServerStreaming,
    )
    .expect_err("unary method");
    assert!(err.contains("unary"));
}

#[test]
fn encode_request_json_rejects_non_object_body() {
    let payload = echo_descriptor_payload();
    let pool = load_descriptor_pool(&payload).expect("pool loads");
    let method = resolve_unary_method(&pool, "echo.EchoService", "Echo").expect("method");
    let err = encode_request_json(&method, &serde_json::json!(["not", "object"]))
        .expect_err("non-object");
    assert!(err.contains("JSON object"));
}
