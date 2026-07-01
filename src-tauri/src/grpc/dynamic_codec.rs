//! Dynamic protobuf JSON codec — Phase 7G.
//!
//! Uses `prost-reflect` canonical JSON mapping (serde feature) for nested messages,
//! repeated fields, oneof groups, maps, and well-known types.

use std::collections::HashMap;

use prost::Message;
use prost_reflect::{DynamicMessage, MessageDescriptor, MethodDescriptor};
use serde::Serialize;

pub fn encode_request_json(
    method: &MethodDescriptor,
    body: &serde_json::Value,
) -> Result<Vec<u8>, String> {
    let message = json_value_to_dynamic_message(method.input(), body)?;
    Ok(message.encode_to_vec())
}

pub fn decode_response_json(
    method: &MethodDescriptor,
    bytes: &[u8],
) -> Result<serde_json::Value, String> {
    let output = method.output();
    let message = DynamicMessage::decode(output, bytes)
        .map_err(|error| format!("Failed to decode response message: {error}"))?;
    dynamic_message_to_json_value(&message)
}

#[allow(dead_code)] // exercised by descriptor_test.rs
pub fn encode_message_json(
    descriptor: MessageDescriptor,
    body: &serde_json::Value,
) -> Result<Vec<u8>, String> {
    let message = json_value_to_dynamic_message(descriptor, body)?;
    Ok(message.encode_to_vec())
}

#[allow(dead_code)] // exercised by descriptor_test.rs
pub fn decode_message_json(
    descriptor: MessageDescriptor,
    bytes: &[u8],
) -> Result<serde_json::Value, String> {
    let message = DynamicMessage::decode(descriptor, bytes)
        .map_err(|error| format!("Failed to decode message: {error}"))?;
    dynamic_message_to_json_value(&message)
}

fn json_value_to_dynamic_message(
    descriptor: MessageDescriptor,
    value: &serde_json::Value,
) -> Result<DynamicMessage, String> {
    if !value.is_object() {
        return Err("Request body must be a JSON object".to_string());
    }
    let json = serde_json::to_string(value)
        .map_err(|error| format!("Failed to encode request JSON: {error}"))?;
    let mut deserializer = serde_json::Deserializer::from_str(&json);
    let message = DynamicMessage::deserialize(descriptor, &mut deserializer)
        .map_err(|error| format!("Failed to encode request JSON: {error}"))?;
    deserializer
        .end()
        .map_err(|error| format!("Failed to encode request JSON: {error}"))?;
    Ok(message)
}

fn dynamic_message_to_json_value(message: &DynamicMessage) -> Result<serde_json::Value, String> {
    let mut serializer = serde_json::Serializer::new(Vec::new());
    message
        .serialize(&mut serializer)
        .map_err(|error| format!("Failed to decode response to JSON: {error}"))?;
    let bytes = serializer.into_inner();
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Failed to parse response JSON: {error}"))
}

pub fn metadata_map_to_tonic(metadata: &HashMap<String, String>) -> tonic::metadata::MetadataMap {
    use tonic::metadata::{MetadataKey, MetadataValue};
    let mut map = tonic::metadata::MetadataMap::new();
    for (key, value) in metadata {
        let Ok(parsed_key) = MetadataKey::from_bytes(key.as_bytes()) else {
            continue;
        };
        if let Ok(parsed_value) = MetadataValue::try_from(value.as_str()) {
            map.insert(parsed_key, parsed_value);
        }
    }
    map
}

pub fn tonic_metadata_to_map(metadata: &tonic::metadata::MetadataMap) -> HashMap<String, String> {
    use tonic::metadata::KeyAndValueRef;
    metadata
        .iter()
        .filter_map(|entry| {
            let (key, value): (String, String) = match entry {
                KeyAndValueRef::Ascii(key, value) => {
                    (key.as_str().to_string(), value.to_str().ok()?.to_string())
                }
                KeyAndValueRef::Binary(key, value) => (
                    key.as_str().to_string(),
                    base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        value.as_ref(),
                    ),
                ),
            };
            Some((key, value))
        })
        .collect()
}
