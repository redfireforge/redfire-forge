use std::sync::Mutex;

use bytes::Bytes;
use http::{Method, Request, Response};
use http_body_util::BodyExt;
use hyper::body::Incoming;
use serde_json::{Map, Value};

use crate::grpc::dynamic_codec::encode_message_json;
use crate::grpc::mock_rules::{
    evaluate_grpc_mock_rule_set, GrpcMockEvaluationContext, GrpcMockRuleSet,
};
use crate::grpc::types::GrpcTauriMockListenerLogEntry;

use super::reflection::{
    build_reflection_response, decode_reflection_request, encode_reflection_response,
    is_reflection_path,
};
use super::response::*;
use super::types::*;

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

        // gRPC ServerReflection — answer service discovery from the loaded
        // descriptor pool so external tools (grpcurl) and Studio's Reflect
        // button work against the listener socket directly.
        if is_reflection_path(&path) {
            return self.handle_reflection(&path, &catalog, request, generation).await;
        }

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

    async fn handle_reflection(
        &self,
        path: &str,
        catalog: &MockDispatchCatalog,
        request: Request<Incoming>,
        generation: u32,
    ) -> Response<RespBody> {
        let _in_flight_guard = InFlightGuard::new(self);

        let body_bytes = match request.into_body().collect().await {
            Ok(collected) => collected.to_bytes(),
            Err(error) => {
                let detail = format!("Failed to read reflection body: {error}");
                self.record_error(Some(path.to_string()), None, &detail);
                return grpc_error_response(13, &detail);
            }
        };

        let frames = match decode_grpc_frames(&body_bytes) {
            Ok(frames) => frames,
            Err(message) => {
                self.record_error(Some(path.to_string()), None, &message);
                return grpc_error_response(3, &message);
            }
        };

        let mut response_frames: Vec<(Bytes, u64)> = Vec::new();
        for frame in &frames {
            let reflection_request = match decode_reflection_request(frame) {
                Ok(value) => value,
                Err(message) => {
                    self.record_error(Some(path.to_string()), None, &message);
                    return grpc_error_response(3, &message);
                }
            };
            let reflection_response = build_reflection_response(&catalog.pool, reflection_request);
            let encoded = encode_reflection_response(&reflection_response);
            response_frames.push((grpc_frame(&encoded), 0));
        }

        self.record_reflection_log(path, frames.len(), generation);
        grpc_success_response(response_frames)
    }

    fn record_reflection_log(&self, path: &str, request_count: usize, generation: u32) {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let id = inner.next_log_id;
        inner.logs.push(GrpcTauriMockListenerLogEntry {
            id,
            ts: crate::grpc::envelope::now_iso(),
            event: "rpc-reflection".to_string(),
            service: Some("grpc.reflection.ServerReflection".to_string()),
            method: Some("ServerReflectionInfo".to_string()),
            rule_name: None,
            status_code: Some(0),
            generation: Some(generation),
            detail: Some(format!("Served reflection ({request_count} request(s)) via {path}")),
        });
        inner.next_log_id = inner.next_log_id.saturating_add(1);
        if inner.logs.len() > MAX_LOG_ENTRIES {
            let keep_from = inner.logs.len() - MAX_LOG_ENTRIES;
            inner.logs = inner.logs.split_off(keep_from);
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
