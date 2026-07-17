use super::catalog::build_dispatch_catalog;
use super::reflection::{
    build_reflection_response, server_reflection_request, server_reflection_response,
    ServerReflectionRequest,
};
use super::response::*;
use crate::grpc::test_echo_protoset::{ECHO_PROTOSET_BASE64, ECHO_PROTOSET_SHA256};

#[test]
fn encode_grpc_message_header_percent_encodes_unsafe_bytes() {
    let encoded = encode_grpc_message_header("bad value\nwith%chars");
    assert_eq!(encoded, "bad value%0Awith%25chars");
}

#[test]
fn grpc_trailers_includes_encoded_grpc_message_header() {
    let trailers = grpc_trailers(13, Some("internal error\nline2"));
    let status = trailers
        .get(http::header::HeaderName::from_static("grpc-status"))
        .and_then(|value| value.to_str().ok())
        .expect("grpc-status trailer");
    let message = trailers
        .get(http::header::HeaderName::from_static("grpc-message"))
        .and_then(|value| value.to_str().ok())
        .expect("grpc-message trailer");

    assert_eq!(status, "13");
    assert_eq!(message, "internal error%0Aline2");
}

#[test]
fn grpc_trailers_omits_grpc_message_when_message_is_empty() {
    let trailers = grpc_trailers(13, Some(""));
    let status = trailers
        .get(http::header::HeaderName::from_static("grpc-status"))
        .and_then(|value| value.to_str().ok())
        .expect("grpc-status trailer");

    assert_eq!(status, "13");
    assert!(!trailers.contains_key(http::header::HeaderName::from_static("grpc-message")));
}

#[test]
fn grpc_trailers_preserves_safe_ascii_message() {
    let trailers = grpc_trailers(7, Some("permission denied"));
    let message = trailers
        .get(http::header::HeaderName::from_static("grpc-message"))
        .and_then(|value| value.to_str().ok())
        .expect("grpc-message trailer");

    assert_eq!(message, "permission denied");
}

#[test]
fn encode_grpc_message_header_encodes_utf8_bytes() {
    let encoded = encode_grpc_message_header("caf\u{00E9}");
    assert_eq!(encoded, "caf%C3%A9");
}

#[test]
fn decode_grpc_frames_rejects_truncated_header() {
    let error = decode_grpc_frames(&[0, 0, 0]).expect_err("expected truncated header error");
    assert!(error.contains("truncated frame header"));
}

#[test]
fn decode_grpc_frames_rejects_declared_length_overflow() {
    let payload = [0u8, 0, 0, 0, 4, 1, 2];
    let error = decode_grpc_frames(&payload).expect_err("expected declared length overflow error");
    assert!(error.contains("declared length exceeds payload"));
}

#[test]
fn decode_grpc_frames_rejects_compressed_flag() {
    let payload = [1u8, 0, 0, 0, 0];
    let error = decode_grpc_frames(&payload).expect_err("expected compressed frame rejection");
    assert!(error.contains("Compressed gRPC frames are not supported"));
}

fn echo_catalog() -> super::types::MockDispatchCatalog {
    build_dispatch_catalog(Some(ECHO_PROTOSET_BASE64), Some(ECHO_PROTOSET_SHA256))
        .expect("catalog builds")
        .expect("catalog present")
}

#[test]
fn reflection_list_services_returns_echo_service() {
    let catalog = echo_catalog();
    let request = ServerReflectionRequest {
        host: String::new(),
        message_request: Some(server_reflection_request::MessageRequest::ListServices(
            String::new(),
        )),
    };

    let response = build_reflection_response(&catalog.pool, request);
    match response.message_response {
        Some(server_reflection_response::MessageResponse::ListServicesResponse(list)) => {
            let names: Vec<String> = list.service.into_iter().map(|entry| entry.name).collect();
            assert!(names.contains(&"echo.EchoService".to_string()), "got: {names:?}");
        }
        other => panic!("expected list services response, got {other:?}"),
    }
}

#[test]
fn reflection_file_containing_symbol_returns_descriptors() {
    let catalog = echo_catalog();
    let request = ServerReflectionRequest {
        host: String::new(),
        message_request: Some(
            server_reflection_request::MessageRequest::FileContainingSymbol(
                "echo.EchoService".to_string(),
            ),
        ),
    };

    let response = build_reflection_response(&catalog.pool, request);
    match response.message_response {
        Some(server_reflection_response::MessageResponse::FileDescriptorResponse(files)) => {
            assert!(
                !files.file_descriptor_proto.is_empty(),
                "expected at least one file descriptor proto"
            );
        }
        other => panic!("expected file descriptor response, got {other:?}"),
    }
}

#[test]
fn reflection_file_containing_symbol_resolves_method_symbol() {
    let catalog = echo_catalog();
    let request = ServerReflectionRequest {
        host: String::new(),
        message_request: Some(
            server_reflection_request::MessageRequest::FileContainingSymbol(
                "echo.EchoService.Echo".to_string(),
            ),
        ),
    };

    let response = build_reflection_response(&catalog.pool, request);
    assert!(matches!(
        response.message_response,
        Some(server_reflection_response::MessageResponse::FileDescriptorResponse(_))
    ));
}

#[test]
fn reflection_unknown_symbol_returns_not_found_error() {
    let catalog = echo_catalog();
    let request = ServerReflectionRequest {
        host: String::new(),
        message_request: Some(
            server_reflection_request::MessageRequest::FileContainingSymbol(
                "does.not.Exist".to_string(),
            ),
        ),
    };

    let response = build_reflection_response(&catalog.pool, request);
    match response.message_response {
        Some(server_reflection_response::MessageResponse::ErrorResponse(error)) => {
            assert_eq!(error.error_code, 5);
        }
        other => panic!("expected error response, got {other:?}"),
    }
}
