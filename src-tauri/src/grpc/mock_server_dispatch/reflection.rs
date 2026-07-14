//! gRPC ServerReflection support for the native mock listener.
//!
//! External tools (`grpcurl`, the Express gRPC proxy that powers Studio's
//! **Reflect** button, other microservices, integration test runners) discover
//! a server's services by calling the standard `ServerReflection` service. The
//! native mock listener holds the full descriptor pool it was started with, so
//! it can answer those requests directly instead of returning `UNIMPLEMENTED`.
//!
//! Both `grpc.reflection.v1` and `grpc.reflection.v1alpha` share identical wire
//! formats, so a single implementation serves both paths.

use std::collections::HashSet;

use prost::Message;
use prost_reflect::{DescriptorPool, FileDescriptor};

pub(crate) const REFLECTION_V1_PATH: &str =
    "/grpc.reflection.v1.ServerReflection/ServerReflectionInfo";
pub(crate) const REFLECTION_V1ALPHA_PATH: &str =
    "/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo";

pub(crate) fn is_reflection_path(path: &str) -> bool {
    path == REFLECTION_V1_PATH || path == REFLECTION_V1ALPHA_PATH
}

// ---------------------------------------------------------------------------
// Wire types (subset of grpc/reflection/v1/reflection.proto). Both v1 and
// v1alpha are byte-compatible, so the same structs decode/encode either path.
// ---------------------------------------------------------------------------

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct ServerReflectionRequest {
    #[prost(string, tag = "1")]
    pub host: String,
    #[prost(oneof = "server_reflection_request::MessageRequest", tags = "3, 4, 5, 6, 7")]
    pub message_request: Option<server_reflection_request::MessageRequest>,
}

pub(crate) mod server_reflection_request {
    #[derive(Clone, PartialEq, ::prost::Oneof)]
    pub(crate) enum MessageRequest {
        #[prost(string, tag = "3")]
        FileByFilename(String),
        #[prost(string, tag = "4")]
        FileContainingSymbol(String),
        #[prost(message, tag = "5")]
        FileContainingExtension(super::ExtensionRequest),
        #[prost(string, tag = "6")]
        AllExtensionNumbersOfType(String),
        #[prost(string, tag = "7")]
        ListServices(String),
    }
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct ExtensionRequest {
    #[prost(string, tag = "1")]
    pub containing_type: String,
    #[prost(int32, tag = "2")]
    pub extension_number: i32,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct ServerReflectionResponse {
    #[prost(string, tag = "1")]
    pub valid_host: String,
    #[prost(message, optional, tag = "2")]
    pub original_request: Option<ServerReflectionRequest>,
    #[prost(oneof = "server_reflection_response::MessageResponse", tags = "4, 5, 6, 7")]
    pub message_response: Option<server_reflection_response::MessageResponse>,
}

pub(crate) mod server_reflection_response {
    #[derive(Clone, PartialEq, ::prost::Oneof)]
    pub(crate) enum MessageResponse {
        #[prost(message, tag = "4")]
        FileDescriptorResponse(super::FileDescriptorResponse),
        #[prost(message, tag = "5")]
        AllExtensionNumbersResponse(super::ExtensionNumberResponse),
        #[prost(message, tag = "6")]
        ListServicesResponse(super::ListServiceResponse),
        #[prost(message, tag = "7")]
        ErrorResponse(super::ErrorResponse),
    }
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct FileDescriptorResponse {
    #[prost(bytes = "vec", repeated, tag = "1")]
    pub file_descriptor_proto: Vec<Vec<u8>>,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct ExtensionNumberResponse {
    #[prost(string, tag = "1")]
    pub base_type_name: String,
    #[prost(int32, repeated, tag = "2")]
    pub extension_number: Vec<i32>,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct ListServiceResponse {
    #[prost(message, repeated, tag = "1")]
    pub service: Vec<ServiceResponse>,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct ServiceResponse {
    #[prost(string, tag = "1")]
    pub name: String,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub(crate) struct ErrorResponse {
    #[prost(int32, tag = "1")]
    pub error_code: i32,
    #[prost(string, tag = "2")]
    pub error_message: String,
}

// ---------------------------------------------------------------------------
// Response building
// ---------------------------------------------------------------------------

/// Build the `ServerReflectionResponse` for a single decoded request.
pub(crate) fn build_reflection_response(
    pool: &DescriptorPool,
    request: ServerReflectionRequest,
) -> ServerReflectionResponse {
    let message_response = match &request.message_request {
        Some(server_reflection_request::MessageRequest::ListServices(_)) => {
            server_reflection_response::MessageResponse::ListServicesResponse(ListServiceResponse {
                service: pool
                    .services()
                    .map(|service| ServiceResponse {
                        name: service.full_name().to_string(),
                    })
                    .collect(),
            })
        }
        Some(server_reflection_request::MessageRequest::FileContainingSymbol(symbol)) => {
            match file_for_symbol(pool, symbol) {
                Some(file) => file_descriptor_message_response(&file),
                None => not_found(&format!("Symbol not found: {symbol}")),
            }
        }
        Some(server_reflection_request::MessageRequest::FileByFilename(name)) => {
            match pool.files().find(|file| file.name() == name) {
                Some(file) => file_descriptor_message_response(&file),
                None => not_found(&format!("File not found: {name}")),
            }
        }
        Some(server_reflection_request::MessageRequest::AllExtensionNumbersOfType(type_name)) => {
            // The mock descriptor pool does not track extensions; return an empty set.
            server_reflection_response::MessageResponse::AllExtensionNumbersResponse(
                ExtensionNumberResponse {
                    base_type_name: type_name.clone(),
                    extension_number: Vec::new(),
                },
            )
        }
        Some(server_reflection_request::MessageRequest::FileContainingExtension(req)) => {
            not_found(&format!(
                "Extension not found for {} ({})",
                req.containing_type, req.extension_number
            ))
        }
        None => not_found("Empty reflection request"),
    };

    ServerReflectionResponse {
        valid_host: request.host.clone(),
        original_request: Some(request),
        message_response: Some(message_response),
    }
}

fn file_descriptor_message_response(
    file: &FileDescriptor,
) -> server_reflection_response::MessageResponse {
    let mut protos: Vec<Vec<u8>> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    collect_file_with_deps(file, &mut protos, &mut seen);
    server_reflection_response::MessageResponse::FileDescriptorResponse(FileDescriptorResponse {
        file_descriptor_proto: protos,
    })
}

/// Collect the file's `FileDescriptorProto` and every transitive dependency,
/// dependencies first, deduplicated by file name.
fn collect_file_with_deps(file: &FileDescriptor, out: &mut Vec<Vec<u8>>, seen: &mut HashSet<String>) {
    if !seen.insert(file.name().to_string()) {
        return;
    }
    for dependency in file.dependencies() {
        collect_file_with_deps(&dependency, out, seen);
    }
    out.push(file.file_descriptor_proto().encode_to_vec());
}

/// Resolve which file defines a symbol (service, message, enum, or method).
fn file_for_symbol(pool: &DescriptorPool, symbol: &str) -> Option<FileDescriptor> {
    if let Some(service) = pool.get_service_by_name(symbol) {
        return Some(service.parent_file());
    }
    if let Some(message) = pool.get_message_by_name(symbol) {
        return Some(message.parent_file());
    }
    if let Some(enum_desc) = pool.get_enum_by_name(symbol) {
        return Some(enum_desc.parent_file());
    }
    // Method symbols arrive as `package.Service.Method` — strip the method name
    // and resolve the owning service.
    if let Some(idx) = symbol.rfind('.') {
        let service_name = &symbol[..idx];
        if let Some(service) = pool.get_service_by_name(service_name) {
            return Some(service.parent_file());
        }
    }
    None
}

fn not_found(message: &str) -> server_reflection_response::MessageResponse {
    // gRPC status 5 = NOT_FOUND
    server_reflection_response::MessageResponse::ErrorResponse(ErrorResponse {
        error_code: 5,
        error_message: message.to_string(),
    })
}

/// Encode a response message into its protobuf byte payload.
pub(crate) fn encode_reflection_response(response: &ServerReflectionResponse) -> Vec<u8> {
    response.encode_to_vec()
}

/// Decode a single reflection request frame payload.
pub(crate) fn decode_reflection_request(frame: &[u8]) -> Result<ServerReflectionRequest, String> {
    ServerReflectionRequest::decode(frame)
        .map_err(|error| format!("Failed to decode ServerReflectionRequest: {error}"))
}
