use std::collections::HashMap;
use std::convert::Infallible;

use bytes::Bytes;
use http::{HeaderMap, HeaderValue, Response, StatusCode};
use http_body_util::{BodyExt, StreamBody};
use hyper::body::Frame;
use prost_reflect::MessageDescriptor;
use serde_json::{Map, Value};
use tokio::time::{sleep, Duration};
use tokio_stream::wrappers::ReceiverStream;

use crate::grpc::dynamic_codec::{decode_message_json, encode_message_json};
use crate::grpc::mock_rules::{GrpcMockRuleEvaluationResult, GrpcMockRuleResponse};

use super::types::RespBody;

pub(crate) async fn unary_like_response(
    evaluation: GrpcMockRuleEvaluationResult,
    output: &MessageDescriptor,
    default_latency_ms: u64,
) -> Response<RespBody> {
    let status = grpc_status_from_rule(evaluation.response.status_code);
    if status != 0 && evaluation.response.body.is_none() {
        return grpc_error_response(
            status,
            evaluation
                .response
                .message
                .as_deref()
                .unwrap_or("mock rule returned error without body"),
        );
    }

    let body = evaluation
        .response
        .body
        .clone()
        .unwrap_or_else(|| Value::Object(Map::new()));
    let encoded = match encode_message_json(output.clone(), &body) {
        Ok(bytes) => grpc_frame(&bytes),
        Err(error) => {
            return grpc_error_response(13, &format!("Failed to encode unary response: {error}"));
        }
    };

    let latency_ms = resolve_first_message_delay_ms(&evaluation.response, default_latency_ms);
    grpc_success_response(vec![(encoded, latency_ms)])
}

pub(crate) fn plan_stream_messages(
    response: &GrpcMockRuleResponse,
    default_latency_ms: u64,
) -> Vec<(Value, u64)> {
    let payloads: Vec<Value> = if let Some(messages) = &response.messages {
        if !messages.is_empty() {
            messages.clone()
        } else if let Some(body) = &response.body {
            vec![body.clone()]
        } else {
            Vec::new()
        }
    } else if let Some(body) = &response.body {
        vec![body.clone()]
    } else {
        Vec::new()
    };

    if payloads.is_empty() {
        return Vec::new();
    }

    let first_delay = resolve_first_message_delay_ms(response, default_latency_ms);
    let between_delay = response.inter_message_delay_ms.unwrap_or(default_latency_ms);

    payloads
        .into_iter()
        .enumerate()
        .map(|(index, body)| {
            if index == 0 {
                (body, first_delay)
            } else {
                (body, between_delay)
            }
        })
        .collect()
}

pub(crate) fn encode_stream_messages(
    output: &MessageDescriptor,
    messages: Vec<(Value, u64)>,
) -> Result<Vec<(Bytes, u64)>, String> {
    let mut encoded: Vec<(Bytes, u64)> = Vec::with_capacity(messages.len());
    for (body, delay_ms) in messages {
        let bytes = encode_message_json(output.clone(), &body)
            .map_err(|error| format!("Failed to encode stream message: {error}"))?;
        encoded.push((grpc_frame(&bytes), delay_ms));
    }
    Ok(encoded)
}

pub(crate) fn first_or_empty_json(input: &MessageDescriptor, frames: &[Vec<u8>]) -> Result<Value, String> {
    if let Some(frame) = frames.first() {
        decode_message_json(input.clone(), frame)
    } else {
        Ok(Value::Object(Map::new()))
    }
}

pub(crate) fn aggregate_stream_request_json(
    input: &MessageDescriptor,
    frames: &[Vec<u8>],
) -> Result<Value, String> {
    let decoded = decode_all_messages(input, frames)?;
    if decoded.len() <= 1 {
        Ok(decoded.into_iter().next().unwrap_or_else(|| Value::Object(Map::new())))
    } else {
        Ok(serde_json::json!({ "messages": decoded }))
    }
}

pub(crate) fn decode_all_messages(input: &MessageDescriptor, frames: &[Vec<u8>]) -> Result<Vec<Value>, String> {
    let mut values = Vec::with_capacity(frames.len());
    for frame in frames {
        values.push(decode_message_json(input.clone(), frame)?);
    }
    Ok(values)
}

pub(crate) fn grpc_success_response(frames: Vec<(Bytes, u64)>) -> Response<RespBody> {
    grpc_response_with_status(frames, 0, None)
}

pub(crate) fn grpc_error_response(status: i32, message: &str) -> Response<RespBody> {
    grpc_response_with_status(Vec::new(), status, Some(message.to_string()))
}

pub(crate) fn grpc_response_with_status(
    frames: Vec<(Bytes, u64)>,
    grpc_status: i32,
    grpc_message: Option<String>,
) -> Response<RespBody> {
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Frame<Bytes>, Infallible>>(16);
    tokio::spawn(async move {
        for (payload, delay_ms) in frames {
            if delay_ms > 0 {
                sleep(Duration::from_millis(delay_ms)).await;
            }
            if tx.send(Ok(Frame::data(payload))).await.is_err() {
                return;
            }
        }

        let trailers = grpc_trailers(grpc_status, grpc_message.as_deref());
        let _ = tx.send(Ok(Frame::trailers(trailers))).await;
    });

    let body = StreamBody::new(ReceiverStream::new(rx)).boxed();
    let mut response = Response::new(body);
    *response.status_mut() = StatusCode::OK;
    response
        .headers_mut()
        .insert(http::header::CONTENT_TYPE, HeaderValue::from_static("application/grpc"));
    response
}

pub(crate) fn grpc_trailers(status: i32, message: Option<&str>) -> HeaderMap {
    let mut trailers = HeaderMap::new();
    let status_text = status.to_string();
    if let Ok(value) = HeaderValue::from_str(&status_text) {
        trailers.insert(http::header::HeaderName::from_static("grpc-status"), value);
    }

    if let Some(message) = message {
        if !message.is_empty() {
            let encoded = encode_grpc_message_header(message);
            if let Ok(value) = HeaderValue::from_str(&encoded) {
                trailers.insert(http::header::HeaderName::from_static("grpc-message"), value);
            }
        }
    }

    trailers
}

pub(crate) fn encode_grpc_message_header(message: &str) -> String {
    let mut encoded = String::with_capacity(message.len());
    for &byte in message.as_bytes() {
        let safe_visible_ascii = (0x20..=0x7e).contains(&byte) && byte != b'%';
        if safe_visible_ascii {
            encoded.push(byte as char);
        } else {
            encoded.push('%');
            encoded.push_str(&format!("{:02X}", byte));
        }
    }
    encoded
}

pub(crate) fn grpc_status_from_rule(status_code: Option<i32>) -> i32 {
    let code = status_code.unwrap_or(0);
    if (0..=16).contains(&code) {
        code
    } else {
        2
    }
}

pub(crate) fn default_latency_from_policy(policy: Option<&Value>) -> u64 {
    policy
        .and_then(|value| value.as_object())
        .and_then(|object| object.get("defaultLatencyMs"))
        .and_then(|value| value.as_u64())
        .unwrap_or(0)
}

pub(crate) fn resolve_first_message_delay_ms(response: &GrpcMockRuleResponse, default_latency_ms: u64) -> u64 {
    response.latency_ms.unwrap_or(default_latency_ms)
}

pub(crate) fn headers_to_metadata_map(headers: &HeaderMap) -> HashMap<String, String> {
    headers
        .iter()
        .filter_map(|(name, value)| {
            let key = name.as_str();
            if key.starts_with(':') {
                return None;
            }
            let value = match value.to_str() {
                Ok(text) => text.to_string(),
                Err(_) => return None,
            };
            Some((key.to_string(), value))
        })
        .collect()
}

pub(crate) fn decode_grpc_frames(body: &[u8]) -> Result<Vec<Vec<u8>>, String> {
    let mut offset = 0usize;
    let mut frames: Vec<Vec<u8>> = Vec::new();

    while offset < body.len() {
        if body.len() - offset < 5 {
            return Err("Invalid gRPC wire frame (truncated frame header)".to_string());
        }
        let compressed_flag = body[offset];
        if compressed_flag != 0 {
            return Err("Compressed gRPC frames are not supported by native mock listener".to_string());
        }
        let len = u32::from_be_bytes([
            body[offset + 1],
            body[offset + 2],
            body[offset + 3],
            body[offset + 4],
        ]) as usize;
        offset += 5;

        if body.len() - offset < len {
            return Err("Invalid gRPC wire frame (declared length exceeds payload)".to_string());
        }

        frames.push(body[offset..offset + len].to_vec());
        offset += len;
    }

    Ok(frames)
}

pub(crate) fn grpc_frame(payload: &[u8]) -> Bytes {
    let mut framed = Vec::with_capacity(payload.len() + 5);
    framed.push(0u8);
    framed.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    framed.extend_from_slice(payload);
    Bytes::from(framed)
}
