//! Native gRPC mock listener HTTP/2 dispatch runtime.

use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Mutex;

use bytes::Bytes;
use http::{HeaderMap, HeaderValue, Method, Request, Response, StatusCode};
use http_body_util::{BodyExt, StreamBody};
use hyper::body::{Frame, Incoming};
use hyper::service::service_fn;
use hyper_util::rt::{TokioExecutor, TokioIo};
use prost_reflect::MessageDescriptor;
use serde_json::{Map, Value};
use tokio::net::TcpListener;
use tokio::task::{AbortHandle, JoinHandle};
use tokio::time::{sleep, Duration};
use tokio_stream::wrappers::ReceiverStream;
use tokio_util::sync::CancellationToken;

use crate::grpc::descriptor::load_descriptor_pool;
use crate::grpc::dynamic_codec::{decode_message_json, encode_message_json};
use crate::grpc::mock_rules::{
    evaluate_grpc_mock_rule_set, GrpcMockEvaluationContext, GrpcMockRuleEvaluationResult, GrpcMockRuleResponse,
    GrpcMockRuleSet,
};
use crate::grpc::types::{GrpcTauriDescriptorPayload, GrpcTauriMockListenerLogEntry};

const MAX_LOG_ENTRIES: usize = 200;
const HEALTH_CHECK_PATH: &str = "/grpc.health.v1.Health/Check";

type RespBody = http_body_util::combinators::BoxBody<Bytes, Infallible>;

#[derive(Clone)]
#[derive(Debug)]
struct DispatchMethod {
    service: String,
    method: String,
    call_type: DispatchCallType,
    input: MessageDescriptor,
    output: MessageDescriptor,
}

#[derive(Clone, Copy)]
#[derive(Debug)]
enum DispatchCallType {
    Unary,
    ServerStreaming,
    ClientStreaming,
    BidiStreaming,
}

#[derive(Clone, Debug)]
pub struct MockDispatchCatalog {
    methods: HashMap<String, DispatchMethod>,
}

#[derive(Debug)]
struct DispatchStateInner {
    generation: u32,
    rule_set: GrpcMockRuleSet,
    latency_policy: Option<Value>,
    last_error: Option<String>,
    in_flight_count: u32,
    logs: Vec<GrpcTauriMockListenerLogEntry>,
    next_log_id: u64,
    catalog: Option<MockDispatchCatalog>,
}

#[derive(Debug)]
pub struct NativeMockDispatchState {
    inner: Mutex<DispatchStateInner>,
}

struct InFlightGuard<'a> {
    state: &'a NativeMockDispatchState,
}

impl<'a> InFlightGuard<'a> {
    fn new(state: &'a NativeMockDispatchState) -> Self {
        let mut inner = state.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.in_flight_count = inner.in_flight_count.saturating_add(1);
        drop(inner);
        Self { state }
    }
}

impl Drop for InFlightGuard<'_> {
    fn drop(&mut self) {
        let mut inner = self.state.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.in_flight_count = inner.in_flight_count.saturating_sub(1);
    }
}

impl NativeMockDispatchState {
    pub fn new(
        generation: u32,
        rule_set: GrpcMockRuleSet,
        latency_policy: Option<Value>,
        catalog: Option<MockDispatchCatalog>,
        started_at: String,
    ) -> Self {
        let detail = if catalog.is_some() {
            "Native tonic mock listener started with dynamic RPC dispatch".to_string()
        } else {
            "Native tonic mock listener started (descriptor unavailable; RPC dispatch disabled)"
                .to_string()
        };

        Self {
            inner: Mutex::new(DispatchStateInner {
                generation,
                rule_set,
                latency_policy,
                last_error: None,
                in_flight_count: 0,
                logs: vec![GrpcTauriMockListenerLogEntry {
                    id: 1,
                    ts: started_at,
                    event: "listener-start".to_string(),
                    service: None,
                    method: None,
                    rule_name: None,
                    status_code: None,
                    generation: Some(generation),
                    detail: Some(detail),
                }],
                next_log_id: 2,
                catalog,
            }),
        }
    }

    pub fn snapshot_status(&self) -> (u32, u32, Option<String>) {
        let inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        (inner.generation, inner.in_flight_count, inner.last_error.clone())
    }

    pub fn commit_rule_set(
        &self,
        rule_set: GrpcMockRuleSet,
        latency_policy: Option<Value>,
        committed_at: String,
    ) -> u32 {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.generation = inner.generation.saturating_add(1);
        inner.rule_set = rule_set;
        inner.latency_policy = latency_policy;
        let generation = inner.generation;
        let log_id = inner.next_log_id;
        inner.logs.push(GrpcTauriMockListenerLogEntry {
            id: log_id,
            ts: committed_at,
            event: "listener-start".to_string(),
            service: None,
            method: None,
            rule_name: None,
            status_code: None,
            generation: Some(generation),
            detail: Some("Rule set committed to native tonic listener".to_string()),
        });
        inner.next_log_id = inner.next_log_id.saturating_add(1);
        if inner.logs.len() > MAX_LOG_ENTRIES {
            let keep_from = inner.logs.len() - MAX_LOG_ENTRIES;
            inner.logs = inner.logs.split_off(keep_from);
        }
        generation
    }

    pub fn logs_since(&self, since: i64) -> (Vec<GrpcTauriMockListenerLogEntry>, u64) {
        let inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let entries = inner
            .logs
            .iter()
            .filter(|entry| (entry.id as i64) > since)
            .cloned()
            .collect::<Vec<_>>();
        (entries, inner.next_log_id)
    }

    pub async fn handle_http_request(&self, request: Request<Incoming>) -> Response<RespBody> {
        if request.method() != Method::POST {
            return grpc_error_response(12, "Only POST is supported");
        }

        let path = request.uri().path().to_string();
        if path == HEALTH_CHECK_PATH {
            // grpc.health.v1.HealthCheckResponse { status: SERVING(1) }
            return grpc_success_response(vec![(grpc_frame(&[0x08, 0x01]), 0)]);
        }

        let (catalog, generation, default_latency_ms, rule_set) = {
            let inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            (
                inner.catalog.clone(),
                inner.generation,
                default_latency_from_policy(inner.latency_policy.as_ref()),
                inner.rule_set.clone(),
            )
        };

        let Some(catalog) = catalog else {
            self.record_error(Some(path.clone()), None, "descriptor is unavailable for native mock dispatch");
            return grpc_error_response(12, "Descriptor payload is required for native mock dispatch");
        };

        let Some(dispatch_method) = catalog.methods.get(&path).cloned() else {
            self.record_error(Some(path.clone()), None, "unknown service/method path");
            return grpc_error_response(12, "No matching RPC method in active descriptor");
        };

        let metadata = headers_to_metadata_map(request.headers());
        let _in_flight_guard = InFlightGuard::new(self);

        let body_bytes = match request.into_body().collect().await {
            Ok(collected) => collected.to_bytes(),
            Err(error) => {
                let detail = format!("Failed to read RPC body: {error}");
                self.record_error(Some(dispatch_method.service.clone()), Some(dispatch_method.method.clone()), &detail);
                return grpc_error_response(13, &detail);
            }
        };

        let frames = match decode_grpc_frames(&body_bytes) {
            Ok(frames) => frames,
            Err(message) => {
                self.record_error(Some(dispatch_method.service.clone()), Some(dispatch_method.method.clone()), &message);
                return grpc_error_response(3, &message);
            }
        };

        match dispatch_method.call_type {
            DispatchCallType::Unary => {
                let request_json = match first_or_empty_json(&dispatch_method.input, &frames) {
                    Ok(value) => value,
                    Err(message) => {
                        self.record_error(Some(dispatch_method.service.clone()), Some(dispatch_method.method.clone()), &message);
                        return grpc_error_response(3, &message);
                    }
                };

                let evaluation = evaluate_grpc_mock_rule_set(
                    &rule_set,
                    &GrpcMockEvaluationContext {
                        service: dispatch_method.service.clone(),
                        method: dispatch_method.method.clone(),
                        metadata,
                        request_body: request_json,
                    },
                );

                self.record_rpc_log(
                    "rpc-unary",
                    &dispatch_method,
                    evaluation.rule_name.clone(),
                    evaluation.response.status_code,
                    generation,
                    None,
                );

                unary_like_response(evaluation, &dispatch_method.output, default_latency_ms).await
            }
            DispatchCallType::ClientStreaming => {
                let request_json = match aggregate_stream_request_json(&dispatch_method.input, &frames) {
                    Ok(value) => value,
                    Err(message) => {
                        self.record_error(Some(dispatch_method.service.clone()), Some(dispatch_method.method.clone()), &message);
                        return grpc_error_response(3, &message);
                    }
                };

                let evaluation = evaluate_grpc_mock_rule_set(
                    &rule_set,
                    &GrpcMockEvaluationContext {
                        service: dispatch_method.service.clone(),
                        method: dispatch_method.method.clone(),
                        metadata,
                        request_body: request_json,
                    },
                );

                self.record_rpc_log(
                    "rpc-client-stream",
                    &dispatch_method,
                    evaluation.rule_name.clone(),
                    evaluation.response.status_code,
                    generation,
                    None,
                );

                unary_like_response(evaluation, &dispatch_method.output, default_latency_ms).await
            }
            DispatchCallType::ServerStreaming => {
                let request_json = match first_or_empty_json(&dispatch_method.input, &frames) {
                    Ok(value) => value,
                    Err(message) => {
                        self.record_error(Some(dispatch_method.service.clone()), Some(dispatch_method.method.clone()), &message);
                        return grpc_error_response(3, &message);
                    }
                };

                let evaluation = evaluate_grpc_mock_rule_set(
                    &rule_set,
                    &GrpcMockEvaluationContext {
                        service: dispatch_method.service.clone(),
                        method: dispatch_method.method.clone(),
                        metadata,
                        request_body: request_json,
                    },
                );

                let message_plan = plan_stream_messages(&evaluation.response, default_latency_ms);

                self.record_rpc_log(
                    "rpc-server-stream",
                    &dispatch_method,
                    evaluation.rule_name.clone(),
                    evaluation.response.status_code,
                    generation,
                    Some(format!("{} message(s)", message_plan.len())),
                );

                if grpc_status_from_rule(evaluation.response.status_code) != 0 && message_plan.is_empty() {
                    return grpc_error_response(
                        grpc_status_from_rule(evaluation.response.status_code),
                        evaluation
                            .response
                            .message
                            .as_deref()
                            .unwrap_or("mock rule returned error without stream payload"),
                    );
                }

                match encode_stream_messages(&dispatch_method.output, message_plan) {
                    Ok(frames_with_delay) => grpc_success_response(frames_with_delay),
                    Err(message) => {
                        self.record_error(Some(dispatch_method.service.clone()), Some(dispatch_method.method.clone()), &message);
                        grpc_error_response(13, &message)
                    }
                }
            }
            DispatchCallType::BidiStreaming => {
                let request_messages = match decode_all_messages(&dispatch_method.input, &frames) {
                    Ok(messages) => messages,
                    Err(message) => {
                        self.record_error(Some(dispatch_method.service.clone()), Some(dispatch_method.method.clone()), &message);
                        return grpc_error_response(3, &message);
                    }
                };

                let mut response_frames: Vec<(Bytes, u64)> = Vec::new();
                let mut terminal_error: Option<(i32, String)> = None;

                for request_body in request_messages {
                    let evaluation = evaluate_grpc_mock_rule_set(
                        &rule_set,
                        &GrpcMockEvaluationContext {
                            service: dispatch_method.service.clone(),
                            method: dispatch_method.method.clone(),
                            metadata: metadata.clone(),
                            request_body,
                        },
                    );

                    self.record_rpc_log(
                        "rpc-bidi-stream",
                        &dispatch_method,
                        evaluation.rule_name.clone(),
                        evaluation.response.status_code,
                        generation,
                        None,
                    );

                    let status = grpc_status_from_rule(evaluation.response.status_code);
                    if status != 0 && evaluation.response.body.is_none() {
                        terminal_error = Some((
                            status,
                            evaluation
                                .response
                                .message
                                .clone()
                                .unwrap_or_else(|| "mock rule returned stream error".to_string()),
                        ));
                        break;
                    }

                    let body = evaluation
                        .response
                        .body
                        .clone()
                        .unwrap_or_else(|| Value::Object(Map::new()));
                    let encoded = match encode_message_json(dispatch_method.output.clone(), &body) {
                        Ok(bytes) => grpc_frame(&bytes),
                        Err(error) => {
                            let detail = format!("Failed to encode bidi stream response: {error}");
                            self.record_error(Some(dispatch_method.service.clone()), Some(dispatch_method.method.clone()), &detail);
                            return grpc_error_response(13, &detail);
                        }
                    };
                    response_frames.push((encoded, resolve_first_message_delay_ms(&evaluation.response, default_latency_ms)));
                }

                if let Some((status, message)) = terminal_error {
                    if response_frames.is_empty() {
                        return grpc_error_response(status, &message);
                    }
                    return grpc_response_with_status(response_frames, status, Some(message));
                }

                grpc_success_response(response_frames)
            }
        }
    }

    fn record_rpc_log(
        &self,
        event: &str,
        dispatch_method: &DispatchMethod,
        rule_name: Option<String>,
        status_code: Option<i32>,
        generation: u32,
        detail: Option<String>,
    ) {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let id = inner.next_log_id;
        inner.logs.push(GrpcTauriMockListenerLogEntry {
            id,
            ts: crate::grpc::envelope::now_iso(),
            event: event.to_string(),
            service: Some(dispatch_method.service.clone()),
            method: Some(dispatch_method.method.clone()),
            rule_name,
            status_code,
            generation: Some(generation),
            detail,
        });
        inner.next_log_id = inner.next_log_id.saturating_add(1);
        if inner.logs.len() > MAX_LOG_ENTRIES {
            let keep_from = inner.logs.len() - MAX_LOG_ENTRIES;
            inner.logs = inner.logs.split_off(keep_from);
        }
    }

    fn record_error(&self, service: Option<String>, method: Option<String>, detail: &str) {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let generation = inner.generation;
        inner.last_error = Some(detail.to_string());
        let id = inner.next_log_id;
        inner.logs.push(GrpcTauriMockListenerLogEntry {
            id,
            ts: crate::grpc::envelope::now_iso(),
            event: "error".to_string(),
            service,
            method,
            rule_name: None,
            status_code: Some(13),
            generation: Some(generation),
            detail: Some(detail.to_string()),
        });
        inner.next_log_id = inner.next_log_id.saturating_add(1);
        if inner.logs.len() > MAX_LOG_ENTRIES {
            let keep_from = inner.logs.len() - MAX_LOG_ENTRIES;
            inner.logs = inner.logs.split_off(keep_from);
        }
    }
}

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

pub fn start_mock_dispatch_server(
    port: u16,
    stop_token: CancellationToken,
    dispatch_state: std::sync::Arc<NativeMockDispatchState>,
) -> Result<(AbortHandle, JoinHandle<()>), String> {
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    let mut last_error: Option<std::io::Error> = None;
    let mut std_listener: Option<std::net::TcpListener> = None;

    for _ in 0..6 {
        match std::net::TcpListener::bind(addr) {
            Ok(listener) => {
                std_listener = Some(listener);
                break;
            }
            Err(error) if error.kind() == std::io::ErrorKind::AddrInUse => {
                last_error = Some(error);
                std::thread::sleep(std::time::Duration::from_millis(40));
            }
            Err(error) => {
                return Err(format!("failed to bind mock listener on {addr}: {error}"));
            }
        }
    }

    let std_listener = match std_listener {
        Some(listener) => listener,
        None => {
            let detail = last_error
                .map(|error| error.to_string())
                .unwrap_or_else(|| "address in use".to_string());
            return Err(format!("failed to bind mock listener on {addr}: {detail}"));
        }
    };

    std_listener
        .set_nonblocking(true)
        .map_err(|error| format!("failed to configure mock listener socket on {addr}: {error}"))?;

    let listener = TcpListener::from_std(std_listener)
        .map_err(|error| format!("failed to adopt mock listener socket on {addr}: {error}"))?;

    let task = tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = stop_token.cancelled() => {
                    break;
                }
                accept = listener.accept() => {
                    let Ok((stream, _)) = accept else {
                        continue;
                    };
                    let io = TokioIo::new(stream);
                    let state = dispatch_state.clone();
                    let service = service_fn(move |req: Request<Incoming>| {
                        let state = state.clone();
                        async move {
                            Ok::<_, Infallible>(state.handle_http_request(req).await)
                        }
                    });

                    tokio::spawn(async move {
                        let builder = hyper::server::conn::http2::Builder::new(TokioExecutor::new());
                        if let Err(error) = builder.serve_connection(io, service).await {
                            log::debug!("grpc mock dispatch connection closed: {error}");
                        }
                    });
                }
            }
        }
    });

    let abort_handle = task.abort_handle();
    Ok((abort_handle, task))
}

async fn unary_like_response(
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

fn plan_stream_messages(response: &GrpcMockRuleResponse, default_latency_ms: u64) -> Vec<(Value, u64)> {
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

fn encode_stream_messages(
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

fn first_or_empty_json(input: &MessageDescriptor, frames: &[Vec<u8>]) -> Result<Value, String> {
    if let Some(frame) = frames.first() {
        decode_message_json(input.clone(), frame)
    } else {
        Ok(Value::Object(Map::new()))
    }
}

fn aggregate_stream_request_json(input: &MessageDescriptor, frames: &[Vec<u8>]) -> Result<Value, String> {
    let decoded = decode_all_messages(input, frames)?;
    if decoded.len() <= 1 {
        Ok(decoded.into_iter().next().unwrap_or_else(|| Value::Object(Map::new())))
    } else {
        Ok(serde_json::json!({ "messages": decoded }))
    }
}

fn decode_all_messages(input: &MessageDescriptor, frames: &[Vec<u8>]) -> Result<Vec<Value>, String> {
    let mut values = Vec::with_capacity(frames.len());
    for frame in frames {
        values.push(decode_message_json(input.clone(), frame)?);
    }
    Ok(values)
}

fn grpc_success_response(frames: Vec<(Bytes, u64)>) -> Response<RespBody> {
    grpc_response_with_status(frames, 0, None)
}

fn grpc_error_response(status: i32, message: &str) -> Response<RespBody> {
    grpc_response_with_status(Vec::new(), status, Some(message.to_string()))
}

fn grpc_response_with_status(
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

fn grpc_trailers(status: i32, message: Option<&str>) -> HeaderMap {
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

fn encode_grpc_message_header(message: &str) -> String {
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

fn grpc_status_from_rule(status_code: Option<i32>) -> i32 {
    let code = status_code.unwrap_or(0);
    if (0..=16).contains(&code) {
        code
    } else {
        2
    }
}

fn default_latency_from_policy(policy: Option<&Value>) -> u64 {
    policy
        .and_then(|value| value.as_object())
        .and_then(|object| object.get("defaultLatencyMs"))
        .and_then(|value| value.as_u64())
        .unwrap_or(0)
}

fn resolve_first_message_delay_ms(response: &GrpcMockRuleResponse, default_latency_ms: u64) -> u64 {
    response.latency_ms.unwrap_or(default_latency_ms)
}

fn headers_to_metadata_map(headers: &HeaderMap) -> HashMap<String, String> {
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

fn decode_grpc_frames(body: &[u8]) -> Result<Vec<Vec<u8>>, String> {
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

fn grpc_frame(payload: &[u8]) -> Bytes {
    let mut framed = Vec::with_capacity(payload.len() + 5);
    framed.push(0u8);
    framed.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    framed.extend_from_slice(payload);
    Bytes::from(framed)
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
