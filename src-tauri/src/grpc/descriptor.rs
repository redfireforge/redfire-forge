//! Descriptor pool loading and method resolution — Phase 7C/7G.

use prost_reflect::{DescriptorPool, MethodDescriptor};
use sha2::{Digest, Sha256};

use crate::grpc::types::{
    GrpcTauriDescriptorPayload, GRPC_TAURI_DESCRIPTOR_INTEGRITY, GRPC_TAURI_INTERNAL,
    GRPC_TAURI_INVALID_REQUEST,
};

/// Maps descriptor pool load failures to structured native error codes.
pub fn descriptor_load_error_code(message: &str) -> &'static str {
    if message.contains(GRPC_TAURI_DESCRIPTOR_INTEGRITY) {
        GRPC_TAURI_DESCRIPTOR_INTEGRITY
    } else if message.starts_with("Invalid protosetBase64:")
        || message.contains("empty buffer")
        || message.contains("Failed to build descriptor pool")
    {
        GRPC_TAURI_INVALID_REQUEST
    } else {
        GRPC_TAURI_INTERNAL
    }
}

pub use crate::grpc::dynamic_codec::{
    decode_response_json, encode_request_json, metadata_map_to_tonic, tonic_metadata_to_map,
};

pub fn load_descriptor_pool(payload: &GrpcTauriDescriptorPayload) -> Result<DescriptorPool, String> {
    let bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        payload.protoset_base64.trim(),
    )
    .map_err(|error| format!("Invalid protosetBase64: {error}"))?;
    if bytes.is_empty() {
        return Err("protosetBase64 decoded to an empty buffer".to_string());
    }

    let digest = Sha256::digest(&bytes);
    let computed = hex::encode(digest);
    let expected = payload.content_sha256.trim().to_lowercase();
    if expected.is_empty() {
        return Err(format!(
            "{GRPC_TAURI_DESCRIPTOR_INTEGRITY}: contentSha256 is required"
        ));
    }
    if expected.len() != 64 || !expected.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err(format!(
            "{GRPC_TAURI_DESCRIPTOR_INTEGRITY}: contentSha256 must be a 64-character hex digest"
        ));
    }
    if computed != expected {
        return Err(format!(
            "{GRPC_TAURI_DESCRIPTOR_INTEGRITY}: protoset SHA-256 mismatch (expected {expected}, got {computed})"
        ));
    }

    DescriptorPool::decode(bytes.as_slice())
        .map_err(|error| format!("Failed to build descriptor pool: {error}"))
}

pub fn resolve_unary_method(
    pool: &DescriptorPool,
    service: &str,
    method_name: &str,
) -> Result<MethodDescriptor, String> {
    let method = pool
        .get_service_by_name(service)
        .ok_or_else(|| format!("Service not found in descriptor: {service}"))?
        .methods()
        .find(|entry| entry.name() == method_name)
        .ok_or_else(|| format!("Method {service}/{method_name} not found in descriptor"))?;

    if method.is_client_streaming() || method.is_server_streaming() {
        let call_type = if method.is_client_streaming() && method.is_server_streaming() {
            "bidi_streaming"
        } else if method.is_client_streaming() {
            "client_streaming"
        } else {
            "server_streaming"
        };
        return Err(format!(
            "Unary dispatch cannot invoke {call_type} method {service}/{method_name}"
        ));
    }

    Ok(method)
}

pub fn resolve_stream_method(
    pool: &DescriptorPool,
    service: &str,
    method_name: &str,
    expected: &crate::grpc::types::GrpcTauriStreamingCallType,
) -> Result<MethodDescriptor, String> {
    let method = pool
        .get_service_by_name(service)
        .ok_or_else(|| format!("Service not found in descriptor: {service}"))?
        .methods()
        .find(|entry| entry.name() == method_name)
        .ok_or_else(|| format!("Method {service}/{method_name} not found in descriptor"))?;

    let actual = if method.is_client_streaming() && method.is_server_streaming() {
        crate::grpc::types::GrpcTauriStreamingCallType::BidiStreaming
    } else if method.is_client_streaming() {
        crate::grpc::types::GrpcTauriStreamingCallType::ClientStreaming
    } else if method.is_server_streaming() {
        crate::grpc::types::GrpcTauriStreamingCallType::ServerStreaming
    } else {
        return Err(format!(
            "Method {service}/{method_name} is unary; streaming callType required"
        ));
    };

    if &actual != expected {
        return Err(format!(
            "callType {:?} does not match descriptor ({actual:?})",
            expected
        ));
    }

    Ok(method)
}
