use super::response::*;

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
