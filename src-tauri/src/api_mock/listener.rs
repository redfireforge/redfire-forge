//! Hyper HTTP/1.1 listener (optional rustls HTTPS). HTTP/2 is not served.

use crate::api_mock::engine::{handle_captured_request, EngineRuntime};
use crate::api_mock::journal::Journal;
use crate::api_mock::tls::{cert_fingerprint_sha256, cert_subject_cn};
use crate::api_mock::types::{CapturedRequest, CorsSettings, ServerDefinition};
use bytes::Bytes;
use http::{HeaderMap, HeaderValue, Method, Request, Response, StatusCode};
use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::service::service_fn;
use hyper_util::rt::TokioIo;
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
            "proxied": 0,
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

pub struct ListenerShared {
    pub def: ServerDefinition,
    pub runtime: EngineRuntime,
    pub journal: Journal,
    pub diagnostics: ListenerDiagnostics,
    pub generation: u64,
    pub in_flight: u32,
    pub connections: u32,
    pub running: bool,
}

impl ListenerShared {
    pub fn new(def: ServerDefinition) -> Self {
        let journal = Journal::new(&def.settings);
        Self {
            def,
            runtime: EngineRuntime::default(),
            journal,
            diagnostics: ListenerDiagnostics::new(),
            generation: 1,
            in_flight: 0,
            connections: 0,
            running: true,
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
    let (subject, fp) = {
        let (_, conn) = tls.get_ref();
        match conn.peer_certificates().and_then(|c| c.first()) {
            Some(cert) => (
                cert_subject_cn(cert.as_ref()),
                Some(cert_fingerprint_sha256(cert.as_ref())),
            ),
            None => (None, None),
        }
    };
    let io = TokioIo::new(tls);
    let service = service_fn(move |req: Request<Incoming>| {
        let shared = shared.clone();
        let subject = subject.clone();
        let fp = fp.clone();
        async move { dispatch(req, peer, subject, fp, shared).await }
    });
    tokio::select! {
        _ = stop.cancelled() => Ok(()),
        result = hyper::server::conn::http1::Builder::new().serve_connection(io, service) => {
            result.map_err(|e| e.into())
        }
    }
}

async fn dispatch(
    req: Request<Incoming>,
    peer: SocketAddr,
    client_subject: Option<String>,
    client_fp: Option<String>,
    shared: Arc<Mutex<ListenerShared>>,
) -> Result<Response<Full<Bytes>>, std::io::Error> {
    match handle_one(req, peer, client_subject, client_fp, shared).await {
        Ok(Some(res)) => Ok(res),
        Ok(None) => Err(std::io::Error::new(
            std::io::ErrorKind::ConnectionAborted,
            "native fault drop",
        )),
        Err(_) => Ok(Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Full::new(Bytes::new()))
            .unwrap_or_else(|_| Response::new(Full::new(Bytes::new())))),
    }
}

async fn handle_one(
    req: Request<Incoming>,
    peer: SocketAddr,
    client_subject: Option<String>,
    client_fp: Option<String>,
    shared: Arc<Mutex<ListenerShared>>,
) -> Result<Option<Response<Full<Bytes>>>, BoxError> {
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

    let mut captured = normalize(&parts.method, parts.uri.path(), parts.uri.query(), &parts.headers, body_str);
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

    let started = Instant::now();
    let (delay_ms, drop_response, status, headers, body, mut tx, pending_transition) = {
        let mut g = shared.lock().unwrap_or_else(|e| e.into_inner());
        g.in_flight = g.in_flight.saturating_add(1);
        let match_started = Instant::now();
        let def = g.def.clone();
        let result = handle_captured_request(&def, &captured, &mut g.runtime);
        let match_ms = match_started.elapsed().as_secs_f64() * 1000.0;
        g.diagnostics.record(match_ms, &result.outcome);
        let generation = g.generation;
        let max_body = g.def.settings.journal.max_captured_body_bytes;
        let mut resp_headers: HashMap<String, Vec<String>> = HashMap::new();
        for (k, v) in &result.headers {
            resp_headers.entry(k.clone()).or_default().push(v.clone());
        }
        let tx = json!({
            "serverId": g.def.id,
            "generation": generation,
            "receivedAt": captured.received_at,
            "completedAt": chrono::Utc::now().to_rfc3339(),
            "request": captured,
            "response": {
                "status": result.status,
                "headers": resp_headers,
                "cookies": [],
                "body": if result.body.len() > max_body { result.body[..max_body].to_string() } else { result.body.clone() },
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
        (
            result.delay_ms,
            result.drop_response,
            result.status,
            result.headers,
            result.body,
            tx,
            result.pending_transition,
        )
    };
    let _in_flight = InFlightGuard(shared.clone());

    if delay_ms > 0 {
        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
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
        if let Some(t) = pending_transition.as_ref() {
            g.runtime.apply_pending_transition(t);
        }
        g.journal.append(tx);
    }

    if drop_response {
        return Ok(None);
    }

    let mut response = Response::builder()
        .status(StatusCode::from_u16(status).unwrap_or(StatusCode::OK));
    for (k, v) in &headers {
        if let (Ok(name), Ok(val)) = (
            http::header::HeaderName::try_from(k.as_str()),
            HeaderValue::from_str(v),
        ) {
            response = response.header(name, val);
        }
    }
    apply_cors(response.headers_mut(), &cors, &parts.headers);
    Ok(Some(
        response
            .body(Full::new(Bytes::from(body)))
            .unwrap_or_else(|_| Response::new(Full::new(Bytes::new()))),
    ))
}

fn apply_cors(headers: Option<&mut HeaderMap>, cors: &CorsSettings, request_headers: &HeaderMap) {
    let Some(headers) = headers else { return };
    if !cors.enabled {
        return;
    }
    let origin = request_headers
        .get(http::header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("*");
    let allowed = cors.allow_origins.is_empty()
        || cors.allow_origins.iter().any(|o| o == "*" || o == origin);
    if allowed {
        let _ = headers.insert(
            http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            HeaderValue::from_str(if cors.allow_origins.iter().any(|o| o == "*") {
                "*"
            } else {
                origin
            })
            .unwrap_or_else(|_| HeaderValue::from_static("*")),
        );
    }
    let methods = if cors.allow_methods.is_empty() {
        "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS".into()
    } else {
        cors.allow_methods.join(",")
    };
    let _ = headers.insert(
        http::header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_str(&methods).unwrap_or_else(|_| HeaderValue::from_static("GET")),
    );
    let allow_headers = if cors.allow_headers.is_empty() {
        "Content-Type,Authorization,Accept".into()
    } else {
        cors.allow_headers.join(",")
    };
    let _ = headers.insert(
        http::header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_str(&allow_headers).unwrap_or_else(|_| HeaderValue::from_static("*")),
    );
}

fn cors_preflight(cors: &CorsSettings, request_headers: &HeaderMap) -> Response<Full<Bytes>> {
    let mut builder = Response::builder().status(StatusCode::NO_CONTENT);
    apply_cors(builder.headers_mut(), cors, request_headers);
    builder
        .header(
            http::header::ACCESS_CONTROL_MAX_AGE,
            HeaderValue::from_str(&cors.max_age.to_string()).unwrap_or_else(|_| HeaderValue::from_static("86400")),
        )
        .body(Full::new(Bytes::new()))
        .unwrap_or_else(|_| Response::new(Full::new(Bytes::new())))
}

fn normalize(
    method: &Method,
    path: &str,
    query: Option<&str>,
    headers: &HeaderMap,
    body: Option<String>,
) -> CapturedRequest {
    let mut header_map: HashMap<String, Vec<String>> = HashMap::new();
    for (k, v) in headers.iter() {
        let key = k.as_str().to_ascii_lowercase();
        header_map
            .entry(key)
            .or_default()
            .push(v.to_str().unwrap_or("").to_string());
    }
    let cookies = parse_cookies(header_map.get("cookie").map(|v| v.join("; ")).as_deref());
    let content_type = header_map.get("content-type").and_then(|v| v.first()).cloned();
    CapturedRequest {
        method: method.as_str().to_ascii_uppercase(),
        path: path.to_string(),
        raw_path: if let Some(q) = query {
            format!("{path}?{q}")
        } else {
            path.to_string()
        },
        query: parse_query(query),
        headers: header_map,
        cookies,
        body,
        body_truncated: false,
        content_type,
        remote_address: None,
        received_at: chrono::Utc::now().to_rfc3339(),
        client_cert_subject: None,
        client_cert_fingerprint: None,
    }
}

fn parse_query(query: Option<&str>) -> HashMap<String, Vec<String>> {
    let mut out = HashMap::new();
    let Some(q) = query else { return out };
    for pair in q.split('&') {
        if pair.is_empty() {
            continue;
        }
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        let key = urlencoding::decode_or_plain(k);
        let val = urlencoding::decode_or_plain(v);
        out.entry(key).or_default().push(val);
    }
    out
}

fn parse_cookies(header: Option<&str>) -> HashMap<String, String> {
    let mut out = HashMap::new();
    let Some(h) = header else { return out };
    for pair in h.split(';') {
        let Some((k, v)) = pair.split_once('=') else { continue };
        let name = k.trim();
        if !name.is_empty() {
            out.insert(name.to_string(), v.trim().to_string());
        }
    }
    out
}

mod urlencoding {
    pub fn decode_or_plain(s: &str) -> String {
        let bytes = s.as_bytes();
        let mut out = Vec::with_capacity(bytes.len());
        let mut i = 0;
        while i < bytes.len() {
            if bytes[i] == b'%' && i + 2 < bytes.len() {
                if let Ok(b) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16)
                {
                    out.push(b);
                    i += 3;
                    continue;
                }
            }
            if bytes[i] == b'+' {
                out.push(b' ');
            } else {
                out.push(bytes[i]);
            }
            i += 1;
        }
        String::from_utf8_lossy(&out).into_owned()
    }
}
