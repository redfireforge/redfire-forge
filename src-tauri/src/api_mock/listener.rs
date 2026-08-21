//! Hyper listener: plaintext HTTP/1.1; HTTPS negotiates `h2` or HTTP/1.1 from ALPN.

use crate::api_mock::callbacks::{spawn_execute_callbacks, CallbackContext};
use crate::api_mock::engine::{handle_captured_request, EngineRuntime};
use crate::api_mock::journal::Journal;
pub(crate) use crate::api_mock::listener_http::{
    apply_cors, clip_utf8, has_anti_recursion, normalize, overwrite_tx_response,
};
use crate::api_mock::outbound::is_hop_by_hop;
use crate::api_mock::proxy::{
    build_upstream_url, execute_proxy, pick_allowlisted_origin, proxy_error_json,
};
use crate::api_mock::recording::{capture_from_proxy, push_recorded_draft, RecordedCapture};
use crate::api_mock::tls::{cert_fingerprint_sha256, cert_subject_cn};
use crate::api_mock::types::{
    CallbackSettings, CapturedRequest, CorsSettings, ProxySettings, ServerDefinition,
};
use bytes::Bytes;
use futures::stream::unfold;
use http::{HeaderMap, HeaderValue, Method, Request, Response, StatusCode};
use http_body_util::{combinators::BoxBody, BodyExt, Full, StreamBody};
use hyper::body::{Frame, Incoming};
use hyper::service::service_fn;
use hyper_util::rt::{TokioExecutor, TokioIo};
use rustls::ServerConfig;
use serde_json::json;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tokio::net::TcpListener;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

type BoxError = Box<dyn std::error::Error + Send + Sync>;
type MockBody = BoxBody<Bytes, std::io::Error>;

fn body_full(data: impl Into<Bytes>) -> MockBody {
    Full::new(data.into())
        .map_err(|never| match never {})
        .boxed()
}

fn body_dribble(chunks: Vec<(u64, String)>, guard: InFlightGuard) -> MockBody {
    let stream = unfold((chunks.into_iter(), guard), |(mut iter, guard)| async move {
        let (after_ms, part) = iter.next()?;
        if after_ms > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(after_ms)).await;
        }
        Some((Ok::<_, std::io::Error>(Frame::data(Bytes::from(part))), (iter, guard)))
    });
    StreamBody::new(stream).boxed()
}

pub struct ListenerDiagnostics {
    samples: Vec<f64>,
    outcomes: HashMap<String, u64>,
    template_errors: u64,
}

impl ListenerDiagnostics {
    pub fn new() -> Self {
        Self {
            samples: Vec::new(),
            outcomes: HashMap::new(),
            template_errors: 0,
        }
    }

    pub fn record(&mut self, duration_ms: f64, outcome: &str) {
        self.samples.push(duration_ms.max(0.0));
        if self.samples.len() > 100 {
            self.samples.remove(0);
        }
        *self.outcomes.entry(outcome.to_string()).or_insert(0) += 1;
    }

    pub fn snapshot(&self) -> serde_json::Value {
        let mut sorted = self.samples.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let p95 = if sorted.is_empty() {
            0.0
        } else {
            let idx = ((sorted.len() as f64 - 1.0) * 0.95).round() as usize;
            sorted[idx.min(sorted.len() - 1)]
        };
        json!({
            "lastMs": self.samples.last().copied().unwrap_or(0.0),
            "p95Ms": p95,
            "count": self.samples.len(),
        })
    }

    pub fn outcomes_json(&self) -> serde_json::Value {
        json!({
            "matched": self.outcomes.get("matched").copied().unwrap_or(0),
            "ambiguous": self.outcomes.get("ambiguous").copied().unwrap_or(0),
            "unmatched": self.outcomes.get("unmatched").copied().unwrap_or(0),
            "fault": self.outcomes.get("fault").copied().unwrap_or(0),
            "error": self.outcomes.get("error").copied().unwrap_or(0),
            "proxied": self.outcomes.get("proxied").copied().unwrap_or(0),
        })
    }

    pub fn template_errors(&self) -> u64 {
        self.template_errors
    }

    pub fn reset(&mut self) {
        self.samples.clear();
        self.outcomes.clear();
        self.template_errors = 0;
    }
}

pub(crate) type ActivePortsFn = Arc<dyn Fn() -> Vec<u16> + Send + Sync>;

pub struct ListenerShared {
    pub def: ServerDefinition,
    pub runtime: EngineRuntime,
    pub journal: Journal,
    pub diagnostics: ListenerDiagnostics,
    pub generation: u64,
    pub in_flight: u32,
    pub connections: u32,
    pub running: bool,
    pub recorded_drafts: Vec<RecordedCapture>,
    active_ports: ActivePortsFn,
}

impl ListenerShared {
    #[allow(dead_code)]
    pub fn new(def: ServerDefinition) -> Self {
        Self::with_active_ports(def, Arc::new(|| Vec::new()))
    }

    pub(crate) fn with_active_ports(def: ServerDefinition, active_ports: ActivePortsFn) -> Self {
        let journal = Journal::for_server(&def.settings, &def.id);
        Self {
            def,
            runtime: EngineRuntime::default(),
            journal,
            diagnostics: ListenerDiagnostics::new(),
            generation: 1,
            in_flight: 0,
            connections: 0,
            running: true,
            recorded_drafts: Vec::new(),
            active_ports,
        }
    }
}

/// Decrements `in_flight` if the request future is cancelled mid-delay.
struct InFlightGuard(Arc<Mutex<ListenerShared>>);

impl Drop for InFlightGuard {
    fn drop(&mut self) {
        let mut g = self.0.lock().unwrap_or_else(|e| e.into_inner());
        g.in_flight = g.in_flight.saturating_sub(1);
    }
}

pub fn spawn_listener(
    shared: Arc<Mutex<ListenerShared>>,
    stop: CancellationToken,
    addr: SocketAddr,
    tls: Option<Arc<ServerConfig>>,
) -> Result<JoinHandle<()>, String> {
    let std_listener = std::net::TcpListener::bind(addr)
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::AddrInUse {
                format!("listen EADDRINUSE: address already in use {addr}")
            } else {
                format!("failed to bind mock listener on {addr}: {e}")
            }
        })?;
    std_listener
        .set_nonblocking(true)
        .map_err(|e| format!("failed to configure mock listener socket on {addr}: {e}"))?;
    let listener = TcpListener::from_std(std_listener)
        .map_err(|e| format!("failed to adopt mock listener socket on {addr}: {e}"))?;

    let task = tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = stop.cancelled() => break,
                accept = listener.accept() => {
                    let Ok((stream, peer)) = accept else { continue; };
                    let over_limit = {
                        let mut g = shared.lock().unwrap_or_else(|e| e.into_inner());
                        let max = g.def.settings.limits.max_concurrent_connections.max(1);
                        if g.connections >= max {
                            true
                        } else {
                            g.connections += 1;
                            false
                        }
                    };
                    if over_limit {
                        drop(stream);
                        continue;
                    }
                    let shared = shared.clone();
                    let tls = tls.clone();
                    let stop_conn = stop.clone();
                    tokio::spawn(async move {
                        let result = if let Some(config) = tls {
                            serve_tls(stream, peer, shared.clone(), config, stop_conn).await
                        } else {
                            serve_plain(stream, peer, None, None, shared.clone(), stop_conn).await
                        };
                        if let Err(err) = result {
                            log::debug!("api mock connection closed: {err}");
                        }
                        if let Ok(mut g) = shared.lock() {
                            g.connections = g.connections.saturating_sub(1);
                        }
                    });
                }
            }
        }
    });
    Ok(task)
}

async fn serve_plain(
    stream: tokio::net::TcpStream,
    peer: SocketAddr,
    client_subject: Option<String>,
    client_fp: Option<String>,
    shared: Arc<Mutex<ListenerShared>>,
    stop: CancellationToken,
) -> Result<(), BoxError> {
    let io = TokioIo::new(stream);
    let service = service_fn(move |req: Request<Incoming>| {
        let shared = shared.clone();
        let subject = client_subject.clone();
        let fp = client_fp.clone();
        async move { dispatch(req, peer, subject, fp, shared).await }
    });
    tokio::select! {
        _ = stop.cancelled() => Ok(()),
        result = hyper::server::conn::http1::Builder::new().serve_connection(io, service) => {
            result.map_err(|e| e.into())
        }
    }
}

async fn serve_tls(
    stream: tokio::net::TcpStream,
    peer: SocketAddr,
    shared: Arc<Mutex<ListenerShared>>,
    config: Arc<ServerConfig>,
    stop: CancellationToken,
) -> Result<(), BoxError> {
    let acceptor = tokio_rustls::TlsAcceptor::from(config);
    let tls = tokio::select! {
        _ = stop.cancelled() => return Ok(()),
        result = acceptor.accept(stream) => result?,
    };
    let (subject, fp, use_h2) = {
        let (_, conn) = tls.get_ref();
        let use_h2 = conn.alpn_protocol().is_some_and(|p| p == b"h2");
        let (subject, fp) = match conn.peer_certificates().and_then(|c| c.first()) {
            Some(cert) => (
                cert_subject_cn(cert.as_ref()),
                Some(cert_fingerprint_sha256(cert.as_ref())),
            ),
            None => (None, None),
        };
        (subject, fp, use_h2)
    };
    let io = TokioIo::new(tls);
    let service = service_fn(move |req: Request<Incoming>| {
        let shared = shared.clone();
        let subject = subject.clone();
        let fp = fp.clone();
        async move { dispatch(req, peer, subject, fp, shared).await }
    });
    if use_h2 {
        tokio::select! {
            _ = stop.cancelled() => Ok(()),
            result = hyper::server::conn::http2::Builder::new(TokioExecutor::new())
                .serve_connection(io, service) => result.map_err(|e| e.into()),
        }
    } else {
        tokio::select! {
            _ = stop.cancelled() => Ok(()),
            result = hyper::server::conn::http1::Builder::new().serve_connection(io, service) => {
                result.map_err(|e| e.into())
            }
        }
    }
}

async fn dispatch(
    req: Request<Incoming>,
    peer: SocketAddr,
    client_subject: Option<String>,
    client_fp: Option<String>,
    shared: Arc<Mutex<ListenerShared>>,
) -> Result<Response<MockBody>, std::io::Error> {
    match handle_one(req, peer, client_subject, client_fp, shared).await {
        Ok(Some(res)) => Ok(res),
        Ok(None) => Err(std::io::Error::new(
            std::io::ErrorKind::ConnectionAborted,
            "native fault drop",
        )),
        Err(_) => Ok(Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(body_full(Bytes::new()))
            .unwrap_or_else(|_| Response::new(body_full(Bytes::new())))),
    }
}

async fn handle_one(
    req: Request<Incoming>,
    peer: SocketAddr,
    client_subject: Option<String>,
    client_fp: Option<String>,
    shared: Arc<Mutex<ListenerShared>>,
) -> Result<Option<Response<MockBody>>, BoxError> {
    let (parts, body) = req.into_parts();
    let collected = body.collect().await?;
    let raw = collected.to_bytes();
    let max_body = {
        let g = shared.lock().unwrap_or_else(|e| e.into_inner());
        g.def.settings.limits.max_inbound_body_bytes
    };
    let truncated = raw.len() > max_body;
    let body_str = if raw.is_empty() {
        None
    } else {
        let slice = if truncated { &raw[..max_body] } else { &raw[..] };
        Some(String::from_utf8_lossy(slice).into_owned())
    };

    let http2 = parts.version == http::Version::HTTP_2;
    let mut captured = normalize(
        &parts.method,
        parts.uri.path(),
        parts.uri.query(),
        &parts.headers,
        body_str,
        parts.uri.authority().map(|a| a.as_str()),
    );
    captured.remote_address = Some(peer.ip().to_string());
    captured.body_truncated = truncated;
    captured.client_cert_subject = client_subject;
    captured.client_cert_fingerprint = client_fp;

    let cors = {
        let g = shared.lock().unwrap_or_else(|e| e.into_inner());
        g.def.settings.cors.clone()
    };
    if cors.enabled && parts.method == Method::OPTIONS {
        return Ok(Some(cors_preflight(&cors, &parts.headers)));
    }
    if has_anti_recursion(&parts.headers) {
        return Ok(Some(loop_detected_response(&cors, &parts.headers)));
    }

    let started = Instant::now();
    let (
        delay_ms,
        drop_response,
        mut status,
        mut headers,
        mut body,
        mut tx,
        pending_transition,
        dribble_chunks,
        pending_callbacks,
        path_params,
        matched_route_id,
        needs_proxy,
        match_ms,
        max_body,
    ) = {
        let mut g = shared.lock().unwrap_or_else(|e| e.into_inner());
        g.in_flight = g.in_flight.saturating_add(1);
        let match_started = Instant::now();
        let def = g.def.clone();
        let result = handle_captured_request(&def, &captured, &mut g.runtime);
        let match_ms = match_started.elapsed().as_secs_f64() * 1000.0;
        if !result.needs_proxy {
            g.diagnostics.record(match_ms, &result.outcome);
        }
        let generation = g.generation;
        let max_body = g.def.settings.journal.max_captured_body_bytes;
        let mut resp_headers: HashMap<String, Vec<String>> = HashMap::new();
        for (k, v) in &result.headers {
            resp_headers.entry(k.clone()).or_default().push(v.clone());
        }
        let mut tx = json!({
            "serverId": g.def.id,
            "generation": generation,
            "receivedAt": captured.received_at,
            "completedAt": chrono::Utc::now().to_rfc3339(),
            "request": captured,
            "response": {
                "status": result.status,
                "headers": resp_headers,
                "cookies": [],
                "body": clip_utf8(&result.body, max_body),
                "bodyTruncated": result.body.len() > max_body,
                "durationMs": 0,
                "generationAtResponse": generation,
            },
            "outcome": result.outcome,
            "matchedRouteId": result.matched_route_id,
            "matchedResponseId": result.matched_response_id,
            "explanation": result.explanation,
            "durationMs": 0,
        });
        if let Some(id) = &result.transaction_id {
            tx["id"] = json!(id);
        }
        (
            result.delay_ms,
            result.drop_response,
            result.status,
            result.headers,
            result.body,
            tx,
            result.pending_transition,
            result.dribble_chunks,
            result.pending_callbacks,
            result.path_params,
            result.matched_route_id,
            result.needs_proxy,
            match_ms,
            max_body,
        )
    };
    let _in_flight = InFlightGuard(shared.clone());

    if delay_ms > 0 {
        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
    }

    let mut journal_outcome: Option<String> = None;
    let mut record_as_drafts = false;
    if needs_proxy {
        let (proxy, ports) = {
            let g = shared.lock().unwrap_or_else(|e| e.into_inner());
            let proxy = g.def.settings.proxy.clone().unwrap_or_default();
            let mut ports = (g.active_ports)();
            if !ports.contains(&g.def.port) {
                ports.push(g.def.port);
            }
            (proxy, ports)
        };
        record_as_drafts = proxy.record_as_drafts;
        let delivery = unmatched_proxy_delivery(&captured, &proxy, &ports).await;
        status = delivery.status;
        headers = delivery.headers;
        overwrite_tx_response(&mut tx, status, &headers, &delivery.body, &delivery.outcome, max_body);
        body = delivery.body;
        journal_outcome = Some(delivery.outcome);
    }

    let duration_ms = started.elapsed().as_millis() as u64;
    tx["durationMs"] = json!(duration_ms);
    tx["completedAt"] = json!(chrono::Utc::now().to_rfc3339());
    if let Some(resp) = tx.get_mut("response") {
        resp["durationMs"] = json!(duration_ms);
        if drop_response {
            resp["status"] = json!(0);
            resp["body"] = json!("");
        }
    }

    {
        let mut g = shared.lock().unwrap_or_else(|e| e.into_inner());
        if !needs_proxy {
            if let Some(t) = pending_transition.as_ref() {
                g.runtime.apply_pending_transition(t);
            }
        }
        if let Some(outcome) = journal_outcome.as_deref() {
            g.diagnostics.record(match_ms, outcome);
        }
        g.journal.append(tx);
        if journal_outcome.as_deref() == Some("proxied") && record_as_drafts {
            let capture = capture_from_proxy(
                &captured,
                status,
                &headers,
                &body,
                g.def.settings.redaction.clone(),
            );
            push_recorded_draft(&mut g.recorded_drafts, capture);
        }
    }

    if !needs_proxy && pending_callbacks.iter().any(|c| c.enabled) {
        let (cb_settings, block_private, def, scenario, ports) = {
            let g = shared.lock().unwrap_or_else(|e| e.into_inner());
            let cb_settings = g.def.settings.callbacks.clone().unwrap_or_else(CallbackSettings::default);
            let block_private = g
                .def
                .settings
                .proxy
                .as_ref()
                .map(|p| p.block_private_networks)
                .unwrap_or(true);
            let mut ports = (g.active_ports)();
            if !ports.contains(&g.def.port) {
                ports.push(g.def.port);
            }
            (
                cb_settings,
                block_private,
                g.def.clone(),
                g.runtime.scenario.clone(),
                ports,
            )
        };
        let seed = format!(
            "{}:{}",
            captured.received_at,
            matched_route_id.unwrap_or_default()
        );
        spawn_execute_callbacks(
            pending_callbacks,
            cb_settings,
            ports,
            Some(CallbackContext {
                request: captured,
                path_params,
                def,
                scenario,
                seed,
            }),
            block_private,
        );
    }

    if drop_response {
        return Ok(None);
    }

    let mut response = Response::builder()
        .status(StatusCode::from_u16(status).unwrap_or(StatusCode::OK));
    for (k, v) in &headers {
        if !dribble_chunks.is_empty() && k.eq_ignore_ascii_case("content-length") {
            continue;
        }
        if http2 && is_hop_by_hop(k) {
            continue;
        }
        if let (Ok(name), Ok(val)) = (
            http::header::HeaderName::try_from(k.as_str()),
            HeaderValue::from_str(v),
        ) {
            response = response.header(name, val);
        }
    }
    apply_cors(response.headers_mut(), &cors, &parts.headers);
    let reply = if dribble_chunks.is_empty() {
        body_full(body)
    } else {
        body_dribble(dribble_chunks, _in_flight)
    };
    Ok(Some(
        response
            .body(reply)
            .unwrap_or_else(|_| Response::new(body_full(Bytes::new()))),
    ))
}

struct ProxyDelivery {
    status: u16,
    headers: Vec<(String, String)>,
    body: String,
    outcome: String,
}

async fn unmatched_proxy_delivery(
    captured: &CapturedRequest,
    proxy: &ProxySettings,
    active_ports: &[u16],
) -> ProxyDelivery {
    let json_ct = vec![("Content-Type".into(), "application/json".into())];
    let Some(origin) = pick_allowlisted_origin(proxy, None) else {
        return ProxyDelivery {
            status: 502,
            headers: json_ct,
            body: proxy_error_json(
                "proxy_misconfigured",
                "Proxy enabled but allowlist is empty",
            ),
            outcome: "error".into(),
        };
    };
    let upstream = build_upstream_url(&origin, &captured.path, &captured.raw_path);
    let proxied = execute_proxy(captured, proxy, &upstream, active_ports).await;
    if !proxied.ok {
        return ProxyDelivery {
            status: 502,
            headers: json_ct,
            body: proxy_error_json(
                "proxy_failed",
                proxied.error.as_deref().unwrap_or("upstream error"),
            ),
            outcome: "error".into(),
        };
    }
    ProxyDelivery {
        status: proxied.status,
        headers: proxied.headers,
        body: proxied.body,
        outcome: "proxied".into(),
    }
}

fn loop_detected_response(cors: &CorsSettings, request_headers: &HeaderMap) -> Response<MockBody> {
    let body = Bytes::from(
        r#"{"error":"loop_detected","message":"X-RedfireForge-Mock recursion rejected"}"#,
    );
    let mut builder = Response::builder()
        .status(StatusCode::LOOP_DETECTED)
        .header(http::header::CONTENT_TYPE, "application/json");
    apply_cors(builder.headers_mut(), cors, request_headers);
    builder
        .body(body_full(body))
        .unwrap_or_else(|_| Response::new(body_full(Bytes::new())))
}

fn cors_preflight(cors: &CorsSettings, request_headers: &HeaderMap) -> Response<MockBody> {
    let mut builder = Response::builder().status(StatusCode::NO_CONTENT);
    apply_cors(builder.headers_mut(), cors, request_headers);
    builder
        .header(
            http::header::ACCESS_CONTROL_MAX_AGE,
            HeaderValue::from_str(&cors.max_age.to_string()).unwrap_or_else(|_| HeaderValue::from_static("86400")),
        )
        .body(body_full(Bytes::new()))
        .unwrap_or_else(|_| Response::new(body_full(Bytes::new())))
}
