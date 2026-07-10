use std::collections::HashMap;

use crate::grpc::descriptor::load_descriptor_pool;
use crate::grpc::types::GrpcTauriDescriptorPayload;

use super::types::{DispatchCallType, DispatchMethod, MockDispatchCatalog};

pub fn build_dispatch_catalog(
    protoset_base64: Option<&str>,
    content_sha256: Option<&str>,
) -> Result<Option<MockDispatchCatalog>, String> {
    let Some(protoset_base64) = protoset_base64.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };

    let content_sha256 = content_sha256
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "contentSha256 is required when protosetBase64 is provided".to_string())?;

    let pool = load_descriptor_pool(&GrpcTauriDescriptorPayload {
        descriptor_key: "native-mock-listener".to_string(),
        protoset_base64: protoset_base64.to_string(),
        content_sha256: content_sha256.to_string(),
    })?;

    let mut methods: HashMap<String, DispatchMethod> = HashMap::new();
    for service in pool.services() {
        for method in service.methods() {
            let call_type = if method.is_client_streaming() && method.is_server_streaming() {
                DispatchCallType::BidiStreaming
            } else if method.is_client_streaming() {
                DispatchCallType::ClientStreaming
            } else if method.is_server_streaming() {
                DispatchCallType::ServerStreaming
            } else {
                DispatchCallType::Unary
            };

            let path = format!("/{}/{}", service.full_name(), method.name());
            methods.insert(
                path,
                DispatchMethod {
                    service: service.full_name().to_string(),
                    method: method.name().to_string(),
                    call_type,
                    input: method.input(),
                    output: method.output(),
                },
            );
        }
    }

    Ok(Some(MockDispatchCatalog { methods }))
}
