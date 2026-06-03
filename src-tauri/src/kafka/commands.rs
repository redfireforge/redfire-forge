/**
 * Tauri Kafka commands — Phase 9A (lifecycle) + Phase 9B (operations).
 *
 * Phase 9A: kafka_connect, kafka_disconnect, kafka_status, kafka_topics
 * Phase 9B: kafka_produce, kafka_consume_once, kafka_subscribe, kafka_unsubscribe,
 *           kafka_subscriptions
 *
 * All response envelopes are strictly aligned with the TypeScript contract types
 * in `src-server/kafka/contracts.ts`. camelCase JSON serialization is enforced
 * via `#[serde(rename_all = "camelCase")]` on every output type.
 *
 * Response shape:
 *   Success: { ok: true,  op, data: T,           meta: { timestamp, durationMs? } }
 *   Error:   { ok: false, op, error: KafkaErrorBody, meta: { timestamp } }
 *
 * Application-level errors use `Ok(error_envelope)` so Phase 9C transport always
 * receives a resolved value and can inspect `envelope.ok`. Only Rust-level fatal
 * failures (mutex poison) use `Err(String)`.
 */

use std::collections::HashMap;
use std::time::{Duration, Instant};

use chrono::{SecondsFormat, Utc};
use futures::StreamExt;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{BaseConsumer, Consumer, StreamConsumer};
use rdkafka::message::{Headers, OwnedHeaders};
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::Timestamp;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Emitter;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use super::state::{ClientHandle, KafkaState, SubscriptionHandle};

// ─── Input types (aligned with contracts.ts request shapes) ──────────────────

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaAuthConfig {
    pub mode: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaTlsConfig {
    pub enabled: bool,
    pub reject_unauthorized: Option<bool>,
    /// SNI override — not supported in rdkafka 0.37; accepted for API parity.
    #[allow(dead_code)]
    pub server_name: Option<String>,
    pub ca_pem: Option<String>,
    pub cert_pem: Option<String>,
    pub key_pem: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaConnectionConfig {
    pub cluster_id: String,
    pub client_id: String,
    pub brokers: Vec<String>,
    pub connection_timeout_ms: Option<u64>,
    pub request_timeout_ms: Option<u64>,
    pub auth: Option<KafkaAuthConfig>,
    pub tls: Option<KafkaTlsConfig>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaProduceMessage {
    pub key: Option<String>,
    pub value: String,
    pub headers: Option<HashMap<String, String>>,
    pub partition: Option<i32>,
    pub timestamp: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaProduceRequest {
    pub cluster_id: Option<String>,
    pub topic: String,
    pub messages: Vec<KafkaProduceMessage>,
    pub acks: Option<i32>,
    pub timeout_ms: Option<u64>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaMessageFilter {
    pub key_equals: Option<String>,
    pub headers_match: Option<HashMap<String, String>>,
    pub json_path: Option<String>,
    pub json_equals: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaConsumeOnceRequest {
    pub cluster_id: Option<String>,
    pub topic: String,
    pub group_id: Option<String>,
    pub from_beginning: Option<bool>,
    pub timeout_ms: Option<u64>,
    pub max_messages: Option<usize>,
    pub filter: Option<KafkaMessageFilter>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaSubscribeRequest {
    pub cluster_id: Option<String>,
    pub topic: String,
    pub group_id: Option<String>,
    pub from_beginning: Option<bool>,
    pub filter: Option<KafkaMessageFilter>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaUnsubscribeRequest {
    pub cluster_id: Option<String>,
    pub subscription_id: String,
}

// ─── Output types (aligned with contracts.ts response shapes) ─────────────────

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaEnvelopeMeta {
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

#[derive(Serialize, Debug)]
pub struct KafkaSuccessEnvelope<T: Serialize> {
    pub ok: bool,
    pub op: String,
    pub data: T,
    pub meta: KafkaEnvelopeMeta,
}

#[derive(Serialize, Debug)]
pub struct KafkaErrorEnvelope {
    pub ok: bool,
    pub op: String,
    pub error: KafkaErrorBody,
    pub meta: KafkaEnvelopeMeta,
}

#[derive(Serialize, Debug)]
pub struct KafkaErrorBody {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retryable: Option<bool>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaServiceStatus {
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cluster_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connected_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_count: Option<u32>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaConnectResult {
    pub status: KafkaServiceStatus,
    pub reused_existing_connection: bool,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaDisconnectResult {
    pub status: KafkaServiceStatus,
    pub disconnected: bool,
    pub cleaned_subscriptions: u32,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaTopicSummary {
    pub name: String,
    pub partitions: i32,
    pub is_internal: bool,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaTopicsResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cluster_id: Option<String>,
    pub topics: Vec<KafkaTopicSummary>,
}

/// Aligned with `KafkaProduceRecordResult` in contracts.ts.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaProduceRecordResult {
    pub partition: i32,
    pub offset: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

/// Aligned with `KafkaProduceResult` in contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaProduceResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cluster_id: Option<String>,
    pub topic: String,
    pub sent_count: usize,
    pub records: Vec<KafkaProduceRecordResult>,
}

/// Aligned with `KafkaConsumeRecord` in contracts.ts.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaConsumeRecord {
    pub topic: String,
    pub partition: i32,
    pub offset: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
}

/// Aligned with `KafkaConsumeResult` in contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaConsumeResult {
    pub message_count: usize,
    pub messages: Vec<KafkaConsumeRecord>,
    pub timed_out: bool,
}

/// Aligned with `KafkaSubscribeInfo` in contracts.ts.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaSubscribeInfo {
    pub subscription_id: String,
    pub topic: String,
    pub group_id: String,
    pub created_at: String,
}

/// Aligned with `KafkaSubscribeResult` in contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaSubscribeResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cluster_id: Option<String>,
    pub subscription: KafkaSubscribeInfo,
}

/// Aligned with `KafkaSubscriptionsResult` in contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaSubscriptionsResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cluster_id: Option<String>,
    pub subscriptions: Vec<KafkaSubscribeInfo>,
}

/// Aligned with `KafkaUnsubscribeResult` in contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaUnsubscribeResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cluster_id: Option<String>,
    pub subscription_id: String,
    pub unsubscribed: bool,
}

/// Payload emitted for each streaming message via `"kafka-subscription-message"` Tauri event.
/// Shape: `{ subscriptionId: string, record: KafkaConsumeRecord }`
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KafkaSubscriptionEventPayload {
    pub subscription_id: String,
    pub record: KafkaConsumeRecord,
}

// ─── Private helpers ──────────────────────────────────────────────────────────

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn success_envelope<T: Serialize>(op: &str, data: T, duration_ms: Option<u64>) -> Value {
    serde_json::to_value(KafkaSuccessEnvelope {
        ok: true,
        op: op.to_string(),
        data,
        meta: KafkaEnvelopeMeta {
            timestamp: now_iso(),
            duration_ms,
        },
    })
    .unwrap_or_else(|e| {
        serde_json::json!({
            "ok": false,
            "op": op,
            "error": { "code": "SERIALIZATION_ERROR", "message": e.to_string() },
            "meta": { "timestamp": now_iso() }
        })
    })
}

fn error_envelope(op: &str, code: &str, message: &str, retryable: Option<bool>) -> Value {
    serde_json::to_value(KafkaErrorEnvelope {
        ok: false,
        op: op.to_string(),
        error: KafkaErrorBody {
            code: code.to_string(),
            message: message.to_string(),
            retryable,
        },
        meta: KafkaEnvelopeMeta {
            timestamp: now_iso(),
            duration_ms: None,
        },
    })
    .unwrap_or_else(|_| {
        serde_json::json!({
            "ok": false, "op": op,
            "error": { "code": code, "message": message },
            "meta": { "timestamp": now_iso() }
        })
    })
}

/// Classify a connect error as timeout vs. general failure — mirrors server-side `isTimeoutError` heuristic.
fn connect_error_code(err_msg: &str) -> &'static str {
    let msg = err_msg.to_lowercase();
    if msg.contains("timed out") || msg.contains("timeout") || msg.contains("connection timed") {
        "KAFKA_CONNECT_TIMEOUT"
    } else {
        "KAFKA_CONNECT_FAILED"
    }
}

fn disconnected_status() -> KafkaServiceStatus {
    KafkaServiceStatus {
        state: "disconnected".to_string(),
        cluster_id: None,
        connected_at: None,
        last_error: None,
        subscription_count: None,
    }
}

fn handle_to_status(handle: &ClientHandle) -> KafkaServiceStatus {
    KafkaServiceStatus {
        state: "connected".to_string(),
        cluster_id: Some(handle.cluster_id.clone()),
        connected_at: Some(handle.connected_at.clone()),
        last_error: None,
        subscription_count: Some(handle.subscription_count()),
    }
}

/// Build an `rdkafka::ClientConfig` from the frontend connection config.
pub(crate) fn build_rdkafka_config(conn: &KafkaConnectionConfig) -> ClientConfig {
    let mut cfg = ClientConfig::new();
    cfg.set("bootstrap.servers", &conn.brokers.join(","));
    cfg.set("client.id", &conn.client_id);

    let conn_timeout = conn.connection_timeout_ms.unwrap_or(5_000);
    let req_timeout = conn.request_timeout_ms.unwrap_or(10_000);
    cfg.set("socket.connection.setup.timeout.ms", &conn_timeout.to_string());
    cfg.set("request.timeout.ms", &req_timeout.to_string());

    let has_tls = conn.tls.as_ref().map(|t| t.enabled).unwrap_or(false);
    let auth_mode = conn.auth.as_ref().map(|a| a.mode.as_str()).unwrap_or("none");
    let has_sasl = auth_mode != "none";

    let security_protocol = match (has_tls, has_sasl) {
        (false, false) => "PLAINTEXT",
        (true, false) => "SSL",
        (false, true) => "SASL_PLAINTEXT",
        (true, true) => "SASL_SSL",
    };
    cfg.set("security.protocol", security_protocol);

    if let Some(auth) = &conn.auth {
        match auth.mode.as_str() {
            "plain" => {
                cfg.set("sasl.mechanism", "PLAIN");
                cfg.set("sasl.username", auth.username.as_deref().unwrap_or(""));
                cfg.set("sasl.password", auth.password.as_deref().unwrap_or(""));
            }
            "scram-sha-256" => {
                cfg.set("sasl.mechanism", "SCRAM-SHA-256");
                cfg.set("sasl.username", auth.username.as_deref().unwrap_or(""));
                cfg.set("sasl.password", auth.password.as_deref().unwrap_or(""));
            }
            "scram-sha-512" => {
                cfg.set("sasl.mechanism", "SCRAM-SHA-512");
                cfg.set("sasl.username", auth.username.as_deref().unwrap_or(""));
                cfg.set("sasl.password", auth.password.as_deref().unwrap_or(""));
            }
            _ => {}
        }
    }

    if let Some(tls) = &conn.tls {
        if tls.enabled {
            let reject = tls.reject_unauthorized.unwrap_or(true);
            if !reject {
                cfg.set("enable.ssl.certificate.verification", "false");
            }
            if let Some(ca_pem) = &tls.ca_pem {
                cfg.set("ssl.ca.pem", ca_pem);
            }
            if let Some(cert_pem) = &tls.cert_pem {
                cfg.set("ssl.certificate.pem", cert_pem);
            }
            if let Some(key_pem) = &tls.key_pem {
                cfg.set("ssl.key.pem", key_pem);
            }
            if let Some(passphrase) = &tls.passphrase {
                cfg.set("ssl.key.password", passphrase);
            }
        }
    }

    cfg
}

/// Resolve the target cluster's stored rdkafka config + cluster_id from state.
/// Returns None if no matching cluster is connected.
fn resolve_cluster(
    map: &HashMap<String, ClientHandle>,
    cluster_id: Option<&str>,
) -> Option<(ClientConfig, String)> {
    let handle = match cluster_id {
        Some(id) => map.get(id),
        None => map.values().next(),
    };
    handle.map(|h| (h.rdkafka_config.clone(), h.cluster_id.clone()))
}

// ─── Message helpers ──────────────────────────────────────────────────────────

fn extract_headers<H: Headers>(headers: &H) -> Option<HashMap<String, String>> {
    let mut map = HashMap::new();
    for header in headers.iter() {
        let value = header
            .value
            .and_then(|v| std::str::from_utf8(v).ok())
            .unwrap_or("")
            .to_string();
        map.insert(header.key.to_string(), value);
    }
    if map.is_empty() { None } else { Some(map) }
}

fn kafka_timestamp_to_iso(ts: Timestamp) -> Option<String> {
    let ms = match ts {
        Timestamp::CreateTime(ms) => ms,
        Timestamp::LogAppendTime(ms) => ms,
        _ => return None,
    };
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(ms)
        .map(|dt| dt.to_rfc3339_opts(SecondsFormat::Millis, true))
}

fn consume_record_from_message(msg: &rdkafka::message::BorrowedMessage<'_>) -> KafkaConsumeRecord {
    use rdkafka::Message;
    KafkaConsumeRecord {
        topic: msg.topic().to_string(),
        partition: msg.partition(),
        offset: msg.offset().to_string(),
        timestamp: kafka_timestamp_to_iso(msg.timestamp()),
        key: msg.key().and_then(|k| std::str::from_utf8(k).ok().map(|s| s.to_string())),
        value: msg.payload().and_then(|p| std::str::from_utf8(p).ok()).unwrap_or("").to_string(),
        headers: msg.headers().and_then(|h| extract_headers(h)),
    }
}

// ─── Message filter (mirrors matchesKafkaConsumeFilter in kafka-service-utils.ts) ───

/// Read a dot-path value from a JSON string using simple `$.key.subkey[0]` notation.
fn read_json_path(json_text: &str, path: &str) -> Option<String> {
    let parsed: serde_json::Value = serde_json::from_str(json_text).ok()?;
    let trimmed = path.trim();
    if !trimmed.starts_with("$.") {
        return None;
    }
    let normalized = trimmed[2..].replace('[', ".").replace(']', "");
    let tokens: Vec<&str> = normalized.split('.').filter(|t| !t.is_empty()).collect();

    let mut current = &parsed;
    let mut owned: serde_json::Value;
    for token in &tokens {
        match current {
            serde_json::Value::Object(map) => match map.get(*token) {
                Some(v) => { owned = v.clone(); current = &owned; }
                None => return None,
            },
            serde_json::Value::Array(arr) => {
                let idx: usize = token.parse().ok()?;
                match arr.get(idx) {
                    Some(v) => { owned = v.clone(); current = &owned; }
                    None => return None,
                }
            }
            _ => return None,
        }
    }
    Some(match current {
        serde_json::Value::String(s) => s.clone(),
        other => other.to_string(),
    })
}

fn matches_filter(record: &KafkaConsumeRecord, filter: Option<&KafkaMessageFilter>) -> bool {
    let filter = match filter {
        Some(f) => f,
        None => return true,
    };
    if let Some(key_eq) = &filter.key_equals {
        if record.key.as_deref() != Some(key_eq.as_str()) {
            return false;
        }
    }
    if let Some(headers_match) = &filter.headers_match {
        let record_headers = record.headers.as_ref();
        for (k, v) in headers_match {
            let actual = record_headers.and_then(|h| h.get(k)).map(|s| s.as_str());
            if actual != Some(v.as_str()) {
                return false;
            }
        }
    }
    if let Some(json_path) = &filter.json_path {
        let actual = read_json_path(&record.value, json_path);
        if let Some(expected) = &filter.json_equals {
            if actual.as_deref() != Some(expected.as_str()) {
                return false;
            }
        } else if actual.is_none() {
            return false;
        }
    }
    true
}

// ─── Phase 9A commands ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn kafka_connect(
    state: tauri::State<'_, KafkaState>,
    connection: KafkaConnectionConfig,
) -> Result<Value, String> {
    let start = Instant::now();
    let cluster_id = connection.cluster_id.clone();

    {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = map.get(&cluster_id) {
            let result = KafkaConnectResult {
                status: handle_to_status(handle),
                reused_existing_connection: true,
            };
            return Ok(success_envelope("connect", result, Some(start.elapsed().as_millis() as u64)));
        }
    }

    let rdkafka_config = build_rdkafka_config(&connection);
    let cfg_for_check = rdkafka_config.clone();
    let timeout_ms = connection.connection_timeout_ms.unwrap_or(5_000);

    let connect_result = tokio::task::spawn_blocking(move || {
        let mut admin_cfg = cfg_for_check;
        admin_cfg.set("group.id", "rf-admin-connect-check");
        let consumer: BaseConsumer = admin_cfg.create().map_err(|e| e.to_string())?;
        consumer.fetch_metadata(None, Duration::from_millis(timeout_ms)).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?;

    let duration_ms = start.elapsed().as_millis() as u64;

    match connect_result {
        Ok(_) => {
            let connected_at = now_iso();
            let handle = ClientHandle {
                cluster_id: cluster_id.clone(),
                client_id: connection.client_id.clone(),
                brokers: connection.brokers.clone(),
                connected_at: connected_at.clone(),
                rdkafka_config,
                subscriptions: HashMap::new(),
            };
            {
                let mut map = state.inner.lock().map_err(|e| e.to_string())?;
                map.insert(cluster_id.clone(), handle);
            }
            Ok(success_envelope("connect", KafkaConnectResult {
                status: KafkaServiceStatus {
                    state: "connected".to_string(),
                    cluster_id: Some(cluster_id),
                    connected_at: Some(connected_at),
                    last_error: None,
                    subscription_count: Some(0),
                },
                reused_existing_connection: false,
            }, Some(duration_ms)))
        }
        Err(e) => Ok(error_envelope("connect", connect_error_code(&e), &e, Some(true))),
    }
}

#[tauri::command]
pub async fn kafka_disconnect(
    state: tauri::State<'_, KafkaState>,
    cluster_id: Option<String>,
) -> Result<Value, String> {
    let start = Instant::now();
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;

    let target_id = match &cluster_id {
        Some(id) => id.clone(),
        None => match map.keys().next().cloned() {
            Some(id) => id,
            None => {
                return Ok(success_envelope("disconnect", KafkaDisconnectResult {
                    status: disconnected_status(),
                    disconnected: false,
                    cleaned_subscriptions: 0,
                }, Some(start.elapsed().as_millis() as u64)));
            }
        },
    };

    let (disconnected, cleaned_subscriptions) = match map.remove(&target_id) {
        Some(handle) => {
            for sub in handle.subscriptions.values() {
                sub.cancel_token.cancel();
            }
            (true, handle.subscriptions.len() as u32)
        }
        None => (false, 0),
    };

    Ok(success_envelope("disconnect", KafkaDisconnectResult {
        status: disconnected_status(),
        disconnected,
        cleaned_subscriptions,
    }, Some(start.elapsed().as_millis() as u64)))
}

#[tauri::command]
pub async fn kafka_status(
    state: tauri::State<'_, KafkaState>,
    cluster_id: Option<String>,
) -> Result<Value, String> {
    let map = state.inner.lock().map_err(|e| e.to_string())?;
    let status = match &cluster_id {
        Some(id) => match map.get(id) {
            Some(h) => handle_to_status(h),
            None => disconnected_status(),
        },
        None => match map.values().next() {
            Some(h) => handle_to_status(h),
            None => disconnected_status(),
        },
    };
    Ok(success_envelope("status", status, None))
}

#[tauri::command]
pub async fn kafka_topics(
    state: tauri::State<'_, KafkaState>,
    cluster_id: Option<String>,
    include_internal: Option<bool>,
) -> Result<Value, String> {
    let start = Instant::now();
    let include_internal = include_internal.unwrap_or(false);

    let (rdkafka_config, resolved_cluster_id) = {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        match resolve_cluster(&map, cluster_id.as_deref()) {
            Some(pair) => pair,
            None => return Ok(error_envelope("topics", "KAFKA_NOT_CONNECTED",
                "No Kafka cluster is connected. Call kafka_connect first.", Some(false))),
        }
    };

    let metadata_result = tokio::task::spawn_blocking(move || {
        let mut admin_cfg = rdkafka_config;
        admin_cfg.set("group.id", "rf-admin-topics-fetch");
        let consumer: BaseConsumer = admin_cfg.create().map_err(|e| e.to_string())?;
        consumer.fetch_metadata(None, Duration::from_millis(10_000)).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?;

    let duration_ms = start.elapsed().as_millis() as u64;

    match metadata_result {
        Ok(metadata) => {
            let topics: Vec<KafkaTopicSummary> = metadata.topics().iter().filter_map(|t| {
                let name = t.name().to_string();
                let is_internal = name.starts_with("__");
                if !include_internal && is_internal { return None; }
                Some(KafkaTopicSummary { name, partitions: t.partitions().len() as i32, is_internal })
            }).collect();
            Ok(success_envelope("topics", KafkaTopicsResult {
                cluster_id: Some(resolved_cluster_id), topics,
            }, Some(duration_ms)))
        }
        Err(e) => Ok(error_envelope("topics", "KAFKA_TOPICS_FAILED", &e, Some(true))),
    }
}

// ─── Phase 9B commands ────────────────────────────────────────────────────────

/// Produce one or more messages to a Kafka topic.
/// Creates a short-lived `FutureProducer`, sends all messages, then drops it.
#[tauri::command]
pub async fn kafka_produce(
    state: tauri::State<'_, KafkaState>,
    request: KafkaProduceRequest,
) -> Result<Value, String> {
    let start = Instant::now();

    if request.topic.trim().is_empty() {
        return Ok(error_envelope("produce", "KAFKA_INVALID_PRODUCE", "topic is required", Some(false)));
    }
    if request.messages.is_empty() {
        return Ok(error_envelope("produce", "KAFKA_INVALID_PRODUCE", "messages array must not be empty", Some(false)));
    }

    let (rdkafka_config, cluster_id) = {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        match resolve_cluster(&map, request.cluster_id.as_deref()) {
            Some(pair) => pair,
            None => return Ok(error_envelope("produce", "KAFKA_NOT_CONNECTED",
                "No Kafka cluster is connected. Call kafka_connect first.", Some(false))),
        }
    };

    let topic = request.topic.clone();
    let messages = request.messages.clone();
    let timeout_ms = request.timeout_ms.unwrap_or(10_000);

    let produce_result: Result<Vec<KafkaProduceRecordResult>, String> = tokio::task::spawn_blocking(move || {
        let producer: FutureProducer = rdkafka_config.create().map_err(|e| e.to_string())?;
        let rt = tokio::runtime::Handle::current();
        let mut records = Vec::with_capacity(messages.len());

        for msg in &messages {
            let mut owned_headers = OwnedHeaders::new();
            if let Some(headers) = &msg.headers {
                for (k, v) in headers {
                    owned_headers = owned_headers.insert(rdkafka::message::Header {
                        key: k,
                        value: Some(v.as_bytes()),
                    });
                }
            }

            let mut record = FutureRecord::to(&topic)
                .payload(msg.value.as_bytes())
                .headers(owned_headers);

            if let Some(key) = &msg.key {
                record = record.key(key.as_str());
            }
            if let Some(partition) = msg.partition {
                record = record.partition(partition);
            }

            let delivery = rt
                .block_on(producer.send(record, Duration::from_millis(timeout_ms)))
                .map_err(|(err, _)| err.to_string())?;

            records.push(KafkaProduceRecordResult {
                partition: delivery.0,
                offset: delivery.1.to_string(),
                timestamp: None,
            });
        }
        Ok(records)
    })
    .await
    .map_err(|e| e.to_string())?;

    let duration_ms = start.elapsed().as_millis() as u64;
    match produce_result {
        Ok(records) => Ok(success_envelope("produce", KafkaProduceResult {
            cluster_id: Some(cluster_id),
            topic: request.topic,
            sent_count: records.len(),
            records,
        }, Some(duration_ms))),
        Err(e) => Ok(error_envelope("produce", "KAFKA_PRODUCE_FAILED", &e, Some(true))),
    }
}

/// Consume up to `maxMessages` messages from a topic, stopping at timeout.
#[tauri::command]
pub async fn kafka_consume_once(
    state: tauri::State<'_, KafkaState>,
    request: KafkaConsumeOnceRequest,
) -> Result<Value, String> {
    let start = Instant::now();

    if request.topic.trim().is_empty() {
        return Ok(error_envelope("consume-once", "KAFKA_INVALID_CONSUME_ONCE", "topic is required", Some(false)));
    }

    let (rdkafka_config, _cluster_id) = {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        match resolve_cluster(&map, request.cluster_id.as_deref()) {
            Some(pair) => pair,
            None => return Ok(error_envelope("consume-once", "KAFKA_NOT_CONNECTED",
                "No Kafka cluster is connected. Call kafka_connect first.", Some(false))),
        }
    };

    let max_messages = request.max_messages.unwrap_or(1).max(1);
    let timeout_ms = request.timeout_ms.unwrap_or(10_000);
    let group_id = request.group_id.clone()
        .unwrap_or_else(|| format!("rf-consume-once-{}", &Uuid::new_v4().to_string()[..8]));
    let topic = request.topic.clone();
    let from_beginning = request.from_beginning.unwrap_or(false);
    let filter = request.filter.clone();

    let consume_result: Result<KafkaConsumeResult, String> = async move {
        let mut consumer_cfg = rdkafka_config;
        consumer_cfg.set("group.id", &group_id);
        consumer_cfg.set("enable.auto.commit", "false");
        consumer_cfg.set("auto.offset.reset", if from_beginning { "earliest" } else { "latest" });

        let consumer: StreamConsumer = consumer_cfg.create().map_err(|e| e.to_string())?;
        consumer.subscribe(&[topic.as_str()]).map_err(|e| e.to_string())?;

        let deadline = Instant::now() + Duration::from_millis(timeout_ms);
        let mut messages: Vec<KafkaConsumeRecord> = Vec::with_capacity(max_messages);
        let stream = consumer.stream();
        tokio::pin!(stream);

        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() { break; }

            match tokio::time::timeout(remaining, stream.next()).await {
                Ok(Some(Ok(msg))) => {
                    let record = consume_record_from_message(&msg);
                    if matches_filter(&record, filter.as_ref()) {
                        messages.push(record);
                        if messages.len() >= max_messages { break; }
                    }
                }
                Ok(Some(Err(e))) => return Err(e.to_string()),
                Ok(None) | Err(_) => break,
            }
        }

        let timed_out = messages.len() < max_messages && Instant::now() >= deadline;
        let count = messages.len();
        Ok(KafkaConsumeResult { message_count: count, messages, timed_out })
    }.await;

    let duration_ms = start.elapsed().as_millis() as u64;
    match consume_result {
        Ok(result) => Ok(success_envelope("consume-once", result, Some(duration_ms))),
        Err(e) => Ok(error_envelope("consume-once", "KAFKA_CONSUME_ONCE_FAILED", &e, Some(true))),
    }
}

/// Start a long-lived streaming subscription. Returns `KafkaSubscribeResult` immediately.
/// Messages are emitted as `"kafka-subscription-message"` Tauri events.
#[tauri::command]
pub async fn kafka_subscribe(
    app: tauri::AppHandle,
    state: tauri::State<'_, KafkaState>,
    request: KafkaSubscribeRequest,
) -> Result<Value, String> {
    let start = Instant::now();

    if request.topic.trim().is_empty() {
        return Ok(error_envelope("subscribe", "KAFKA_INVALID_SUBSCRIBE", "topic is required", Some(false)));
    }

    let (rdkafka_config, cluster_id) = {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        match resolve_cluster(&map, request.cluster_id.as_deref()) {
            Some(pair) => pair,
            None => return Ok(error_envelope("subscribe", "KAFKA_NOT_CONNECTED",
                "No Kafka cluster is connected. Call kafka_connect first.", Some(false))),
        }
    };

    let subscription_id = Uuid::new_v4().to_string();
    let group_id = request.group_id.clone()
        .unwrap_or_else(|| format!("rf-subscribe-{}-{}", cluster_id, &subscription_id[..8]));
    let topic = request.topic.clone();
    let from_beginning = request.from_beginning.unwrap_or(false);
    let filter = request.filter.clone();
    let created_at = now_iso();

    let mut consumer_cfg = rdkafka_config;
    consumer_cfg.set("group.id", &group_id);
    consumer_cfg.set("enable.auto.commit", "true");
    consumer_cfg.set("auto.offset.reset", if from_beginning { "earliest" } else { "latest" });

    let consumer: StreamConsumer = match consumer_cfg.create() {
        Ok(c) => c,
        Err(e) => return Ok(error_envelope("subscribe", "KAFKA_SUBSCRIBE_FAILED", &e.to_string(), Some(true))),
    };
    if let Err(e) = consumer.subscribe(&[topic.as_str()]) {
        return Ok(error_envelope("subscribe", "KAFKA_SUBSCRIBE_FAILED", &e.to_string(), Some(true)));
    }

    let cancel_token = CancellationToken::new();
    let cancel_token_bg = cancel_token.clone();
    let sub_id_bg = subscription_id.clone();
    let app_bg = app.clone();

    tokio::spawn(async move {
        let stream = consumer.stream();
        tokio::pin!(stream);
        loop {
            tokio::select! {
                biased;
                _ = cancel_token_bg.cancelled() => break,
                msg_opt = stream.next() => {
                    match msg_opt {
                        Some(Ok(msg)) => {
                            let record = consume_record_from_message(&msg);
                            if matches_filter(&record, filter.as_ref()) {
                                let payload = KafkaSubscriptionEventPayload {
                                    subscription_id: sub_id_bg.clone(),
                                    record,
                                };
                                let _ = app_bg.emit("kafka-subscription-message", payload);
                            }
                        }
                        Some(Err(_)) | None => break,
                    }
                }
            }
        }
    });

    {
        let mut map = state.inner.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = map.values_mut().find(|h| h.cluster_id == cluster_id) {
            handle.subscriptions.insert(
                subscription_id.clone(),
                SubscriptionHandle {
                    subscription_id: subscription_id.clone(),
                    topic: topic.clone(),
                    group_id: group_id.clone(),
                    created_at: created_at.clone(),
                    cancel_token,
                },
            );
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;
    Ok(success_envelope("subscribe", KafkaSubscribeResult {
        cluster_id: Some(cluster_id),
        subscription: KafkaSubscribeInfo {
            subscription_id,
            topic,
            group_id,
            created_at,
        },
    }, Some(duration_ms)))
}

/// Cancel a streaming subscription by ID and clean up its background task.
#[tauri::command]
pub async fn kafka_unsubscribe(
    state: tauri::State<'_, KafkaState>,
    request: KafkaUnsubscribeRequest,
) -> Result<Value, String> {
    let start = Instant::now();
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;

    let mut found_cluster_id: Option<String> = None;
    for handle in map.values_mut() {
        if let Some(sub) = handle.subscriptions.remove(&request.subscription_id) {
            sub.cancel_token.cancel();
            found_cluster_id = Some(handle.cluster_id.clone());
            break;
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;
    match found_cluster_id {
        Some(cluster_id) => Ok(success_envelope("unsubscribe", KafkaUnsubscribeResult {
            cluster_id: Some(cluster_id),
            subscription_id: request.subscription_id,
            unsubscribed: true,
        }, Some(duration_ms))),
        None => Ok(error_envelope("unsubscribe", "KAFKA_SUBSCRIPTION_NOT_FOUND",
            &format!("Subscription '{}' does not exist", request.subscription_id), Some(false))),
    }
}

/// List all active streaming subscriptions for a cluster.
#[tauri::command]
pub async fn kafka_subscriptions(
    state: tauri::State<'_, KafkaState>,
    cluster_id: Option<String>,
) -> Result<Value, String> {
    let map = state.inner.lock().map_err(|e| e.to_string())?;
    let handle = match &cluster_id {
        Some(id) => map.get(id),
        None => map.values().next(),
    };
    match handle {
        Some(h) => {
            let subscriptions: Vec<KafkaSubscribeInfo> = h.subscriptions.values().map(|sub| KafkaSubscribeInfo {
                subscription_id: sub.subscription_id.clone(),
                topic: sub.topic.clone(),
                group_id: sub.group_id.clone(),
                created_at: sub.created_at.clone(),
            }).collect();
            Ok(success_envelope("subscriptions", KafkaSubscriptionsResult {
                cluster_id: Some(h.cluster_id.clone()),
                subscriptions,
            }, None))
        }
        None => Ok(success_envelope("subscriptions", KafkaSubscriptionsResult {
            cluster_id: None,
            subscriptions: vec![],
        }, None)),
    }
}

// ─── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kafka::state::{ClientHandle, KafkaState, SubscriptionHandle};

    fn make_client_handle(cluster_id: &str) -> ClientHandle {
        ClientHandle {
            cluster_id: cluster_id.to_string(),
            client_id: "test-client".to_string(),
            brokers: vec!["localhost:9092".to_string()],
            connected_at: "2026-01-01T00:00:00.000Z".to_string(),
            rdkafka_config: ClientConfig::new(),
            subscriptions: HashMap::new(),
        }
    }

    fn make_subscription_handle(sub_id: &str, topic: &str) -> SubscriptionHandle {
        SubscriptionHandle {
            subscription_id: sub_id.to_string(),
            topic: topic.to_string(),
            group_id: format!("rf-subscribe-test-{}", &sub_id[..8]),
            created_at: "2026-01-01T00:00:00.000Z".to_string(),
            cancel_token: CancellationToken::new(),
        }
    }

    #[test]
    fn kafka_state_new_is_empty() {
        let state = KafkaState::new();
        assert!(state.inner.lock().unwrap().is_empty());
    }

    #[test]
    fn state_insert_and_remove() {
        let state = KafkaState::new();
        state.inner.lock().unwrap().insert("c1".to_string(), make_client_handle("c1"));
        assert_eq!(state.inner.lock().unwrap().len(), 1);
        state.inner.lock().unwrap().remove("c1");
        assert!(state.inner.lock().unwrap().is_empty());
    }

    #[test]
    fn state_multiple_clusters() {
        let state = KafkaState::new();
        let mut map = state.inner.lock().unwrap();
        map.insert("c1".to_string(), make_client_handle("c1"));
        map.insert("c2".to_string(), make_client_handle("c2"));
        assert_eq!(map.len(), 2);
    }

    #[test]
    fn subscription_count_computed_from_subscriptions_map() {
        let mut handle = make_client_handle("c1");
        assert_eq!(handle.subscription_count(), 0);
        handle.subscriptions.insert("s1".to_string(), make_subscription_handle("s1aaaaaa", "orders"));
        assert_eq!(handle.subscription_count(), 1);
        handle.subscriptions.insert("s2".to_string(), make_subscription_handle("s2aaaaaa", "payments"));
        assert_eq!(handle.subscription_count(), 2);
        handle.subscriptions.remove("s1");
        assert_eq!(handle.subscription_count(), 1);
    }

    #[test]
    fn success_envelope_shape() {
        let status = KafkaServiceStatus {
            state: "connected".to_string(), cluster_id: Some("c1".to_string()),
            connected_at: Some("2026-01-01T00:00:00.000Z".to_string()),
            last_error: None, subscription_count: Some(0),
        };
        let env = success_envelope("status", status, Some(42));
        assert_eq!(env["ok"], true);
        assert_eq!(env["op"], "status");
        assert_eq!(env["data"]["clusterId"], "c1");
        assert_eq!(env["meta"]["durationMs"], 42);
    }

    #[test]
    fn error_envelope_shape() {
        let env = error_envelope("connect", "KAFKA_CONNECT_FAILED", "broker unreachable", Some(true));
        assert_eq!(env["ok"], false);
        assert_eq!(env["error"]["code"], "KAFKA_CONNECT_FAILED");
        assert_eq!(env["error"]["retryable"], true);
        assert!(env["meta"].get("durationMs").is_none());
    }

    #[test]
    fn connect_error_code_timeout_variants() {
        assert_eq!(connect_error_code("Connection timed out after 5000ms"), "KAFKA_CONNECT_TIMEOUT");
        assert_eq!(connect_error_code("broker timeout"), "KAFKA_CONNECT_TIMEOUT");
        assert_eq!(connect_error_code("timed out connecting to broker"), "KAFKA_CONNECT_TIMEOUT");
    }

    #[test]
    fn connect_error_code_non_timeout_variants() {
        assert_eq!(connect_error_code("SASL authentication failed"), "KAFKA_CONNECT_FAILED");
        assert_eq!(connect_error_code("SSL handshake failed"), "KAFKA_CONNECT_FAILED");
        assert_eq!(connect_error_code("Connection refused"), "KAFKA_CONNECT_FAILED");
    }

    #[test]
    fn error_envelope_without_retryable() {
        let env = error_envelope("topics", "KAFKA_NOT_CONNECTED", "not connected", None);
        assert!(env["error"].get("retryable").is_none());
    }

    #[test]
    fn disconnected_status_shape() {
        let json = serde_json::to_value(disconnected_status()).unwrap();
        assert_eq!(json["state"], "disconnected");
        assert!(json.get("clusterId").is_none());
    }

    #[test]
    fn kafka_topics_result_shape() {
        let result = KafkaTopicsResult {
            cluster_id: Some("c1".to_string()),
            topics: vec![
                KafkaTopicSummary { name: "orders".to_string(), partitions: 3, is_internal: false },
                KafkaTopicSummary { name: "__consumer_offsets".to_string(), partitions: 50, is_internal: true },
            ],
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["topics"][0]["isInternal"], false);
        assert_eq!(json["topics"][1]["isInternal"], true);
    }

    #[test]
    fn kafka_connect_result_camel_case() {
        let result = KafkaConnectResult {
            status: KafkaServiceStatus {
                state: "connected".to_string(), cluster_id: Some("c1".to_string()),
                connected_at: Some("2026-01-01T00:00:00.000Z".to_string()),
                last_error: None, subscription_count: Some(0),
            },
            reused_existing_connection: true,
        };
        assert_eq!(serde_json::to_value(&result).unwrap()["reusedExistingConnection"], true);
    }

    #[test]
    fn kafka_disconnect_result_camel_case() {
        let result = KafkaDisconnectResult {
            status: disconnected_status(), disconnected: true, cleaned_subscriptions: 2,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["disconnected"], true);
        assert_eq!(json["cleanedSubscriptions"], 2);
    }

    // ── Phase 9B: produce ─────────────────────────────────────────────────────

    #[test]
    fn kafka_produce_result_shape() {
        let result = KafkaProduceResult {
            cluster_id: Some("c1".to_string()),
            topic: "orders".to_string(),
            sent_count: 2,
            records: vec![
                KafkaProduceRecordResult { partition: 0, offset: "42".to_string(), timestamp: None },
                KafkaProduceRecordResult { partition: 1, offset: "7".to_string(), timestamp: Some("2026-01-01T00:00:00.000Z".to_string()) },
            ],
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["sentCount"], 2);
        assert_eq!(json["records"][0]["offset"], "42");
        assert!(json["records"][0].get("timestamp").is_none());
        assert_eq!(json["records"][1]["timestamp"], "2026-01-01T00:00:00.000Z");
    }

    // ── Phase 9B: consume record ──────────────────────────────────────────────

    #[test]
    fn kafka_consume_record_shape() {
        let record = KafkaConsumeRecord {
            topic: "orders".to_string(), partition: 0, offset: "100".to_string(),
            timestamp: Some("2026-01-01T00:00:00.000Z".to_string()),
            key: Some("order-1".to_string()), value: r#"{"id":1}"#.to_string(),
            headers: Some({ let mut m = HashMap::new(); m.insert("x-trace".to_string(), "abc".to_string()); m }),
        };
        let json = serde_json::to_value(&record).unwrap();
        assert_eq!(json["topic"], "orders");
        assert_eq!(json["key"], "order-1");
        assert_eq!(json["headers"]["x-trace"], "abc");
    }

    #[test]
    fn kafka_consume_record_optional_fields_omitted() {
        let record = KafkaConsumeRecord {
            topic: "t".to_string(), partition: 0, offset: "0".to_string(),
            timestamp: None, key: None, value: "hello".to_string(), headers: None,
        };
        let json = serde_json::to_value(&record).unwrap();
        assert!(json.get("timestamp").is_none());
        assert!(json.get("key").is_none());
        assert!(json.get("headers").is_none());
    }

    #[test]
    fn kafka_consume_result_shape() {
        let result = KafkaConsumeResult {
            message_count: 1,
            messages: vec![KafkaConsumeRecord {
                topic: "t".to_string(), partition: 0, offset: "5".to_string(),
                timestamp: None, key: None, value: "v".to_string(), headers: None,
            }],
            timed_out: false,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["messageCount"], 1);
        assert_eq!(json["timedOut"], false);
    }

    // ── Phase 9B: subscribe ───────────────────────────────────────────────────

    #[test]
    fn kafka_subscribe_result_shape() {
        let result = KafkaSubscribeResult {
            cluster_id: Some("c1".to_string()),
            subscription: KafkaSubscribeInfo {
                subscription_id: "sub-uuid".to_string(), topic: "orders".to_string(),
                group_id: "rf-subscribe-c1-sub-uuid".to_string(),
                created_at: "2026-01-01T00:00:00.000Z".to_string(),
            },
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["subscription"]["subscriptionId"], "sub-uuid");
        assert_eq!(json["subscription"]["groupId"], "rf-subscribe-c1-sub-uuid");
    }

    #[test]
    fn kafka_subscriptions_result_shape() {
        let result = KafkaSubscriptionsResult {
            cluster_id: Some("c1".to_string()),
            subscriptions: vec![
                KafkaSubscribeInfo { subscription_id: "s1".to_string(), topic: "orders".to_string(), group_id: "g1".to_string(), created_at: "2026-01-01T00:00:00.000Z".to_string() },
                KafkaSubscribeInfo { subscription_id: "s2".to_string(), topic: "payments".to_string(), group_id: "g2".to_string(), created_at: "2026-01-01T00:00:01.000Z".to_string() },
            ],
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["subscriptions"].as_array().unwrap().len(), 2);
        assert_eq!(json["subscriptions"][1]["topic"], "payments");
    }

    #[test]
    fn kafka_unsubscribe_result_shape() {
        let result = KafkaUnsubscribeResult {
            cluster_id: Some("c1".to_string()),
            subscription_id: "sub-uuid".to_string(),
            unsubscribed: true,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["subscriptionId"], "sub-uuid");
        assert_eq!(json["unsubscribed"], true);
    }

    #[test]
    fn subscription_event_payload_shape() {
        let payload = KafkaSubscriptionEventPayload {
            subscription_id: "sub-uuid".to_string(),
            record: KafkaConsumeRecord {
                topic: "orders".to_string(), partition: 0, offset: "10".to_string(),
                timestamp: None, key: None, value: "msg".to_string(), headers: None,
            },
        };
        let json = serde_json::to_value(&payload).unwrap();
        assert_eq!(json["subscriptionId"], "sub-uuid");
        assert_eq!(json["record"]["topic"], "orders");
    }

    // ── Phase 9B: message filter ──────────────────────────────────────────────

    #[test]
    fn filter_none_matches_everything() {
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: None, value: "any".to_string(), headers: None };
        assert!(matches_filter(&record, None));
    }

    #[test]
    fn filter_key_equals_match() {
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: Some("order-1".to_string()), value: "v".to_string(), headers: None };
        let filter = KafkaMessageFilter { key_equals: Some("order-1".to_string()), headers_match: None, json_path: None, json_equals: None };
        assert!(matches_filter(&record, Some(&filter)));
    }

    #[test]
    fn filter_key_equals_no_match() {
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: Some("order-2".to_string()), value: "v".to_string(), headers: None };
        let filter = KafkaMessageFilter { key_equals: Some("order-1".to_string()), headers_match: None, json_path: None, json_equals: None };
        assert!(!matches_filter(&record, Some(&filter)));
    }

    #[test]
    fn filter_key_equals_no_key_no_match() {
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: None, value: "v".to_string(), headers: None };
        let filter = KafkaMessageFilter { key_equals: Some("order-1".to_string()), headers_match: None, json_path: None, json_equals: None };
        assert!(!matches_filter(&record, Some(&filter)));
    }

    #[test]
    fn filter_headers_match() {
        let mut headers = HashMap::new();
        headers.insert("x-trace".to_string(), "abc".to_string());
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: None, value: "v".to_string(), headers: Some(headers) };
        let mut mh = HashMap::new();
        mh.insert("x-trace".to_string(), "abc".to_string());
        let filter = KafkaMessageFilter { key_equals: None, headers_match: Some(mh), json_path: None, json_equals: None };
        assert!(matches_filter(&record, Some(&filter)));
    }

    #[test]
    fn filter_headers_no_match() {
        let mut headers = HashMap::new();
        headers.insert("x-trace".to_string(), "xyz".to_string());
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: None, value: "v".to_string(), headers: Some(headers) };
        let mut mh = HashMap::new();
        mh.insert("x-trace".to_string(), "abc".to_string());
        let filter = KafkaMessageFilter { key_equals: None, headers_match: Some(mh), json_path: None, json_equals: None };
        assert!(!matches_filter(&record, Some(&filter)));
    }

    #[test]
    fn filter_headers_missing_key_no_match() {
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: None, value: "v".to_string(), headers: None };
        let mut mh = HashMap::new();
        mh.insert("x-trace".to_string(), "abc".to_string());
        let filter = KafkaMessageFilter { key_equals: None, headers_match: Some(mh), json_path: None, json_equals: None };
        assert!(!matches_filter(&record, Some(&filter)));
    }

    #[test]
    fn read_json_path_simple_field() {
        assert_eq!(read_json_path(r#"{"id":1,"name":"Alice"}"#, "$.name"), Some("Alice".to_string()));
    }

    #[test]
    fn read_json_path_nested_field() {
        assert_eq!(read_json_path(r#"{"user":{"id":42,"role":"admin"}}"#, "$.user.role"), Some("admin".to_string()));
    }

    #[test]
    fn read_json_path_array_index() {
        assert_eq!(read_json_path(r#"{"items":["a","b","c"]}"#, "$.items[1]"), Some("b".to_string()));
    }

    #[test]
    fn read_json_path_missing_field() {
        assert_eq!(read_json_path(r#"{"id":1}"#, "$.name"), None);
    }

    #[test]
    fn read_json_path_invalid_json() {
        assert_eq!(read_json_path("not-json", "$.name"), None);
    }

    #[test]
    fn read_json_path_invalid_prefix() {
        assert_eq!(read_json_path(r#"{"name":"test"}"#, "name"), None);
    }

    #[test]
    fn filter_json_path_match() {
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: None, value: r#"{"status":"paid"}"#.to_string(), headers: None };
        let filter = KafkaMessageFilter { key_equals: None, headers_match: None, json_path: Some("$.status".to_string()), json_equals: Some("paid".to_string()) };
        assert!(matches_filter(&record, Some(&filter)));
    }

    #[test]
    fn filter_json_path_no_match() {
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: None, value: r#"{"status":"pending"}"#.to_string(), headers: None };
        let filter = KafkaMessageFilter { key_equals: None, headers_match: None, json_path: Some("$.status".to_string()), json_equals: Some("paid".to_string()) };
        assert!(!matches_filter(&record, Some(&filter)));
    }

    #[test]
    fn filter_json_path_exists_no_equals() {
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: None, value: r#"{"status":"anything"}"#.to_string(), headers: None };
        let filter = KafkaMessageFilter { key_equals: None, headers_match: None, json_path: Some("$.status".to_string()), json_equals: None };
        assert!(matches_filter(&record, Some(&filter)));
    }

    #[test]
    fn filter_json_path_not_exists_no_equals() {
        let record = KafkaConsumeRecord { topic: "t".to_string(), partition: 0, offset: "0".to_string(), timestamp: None, key: None, value: r#"{"other":"x"}"#.to_string(), headers: None };
        let filter = KafkaMessageFilter { key_equals: None, headers_match: None, json_path: Some("$.status".to_string()), json_equals: None };
        assert!(!matches_filter(&record, Some(&filter)));
    }

    #[test]
    fn double_underscore_prefix_is_internal() {
        for name in &["__consumer_offsets", "__transaction_state"] {
            assert!(name.starts_with("__"));
        }
    }

    #[test]
    fn user_topics_are_not_internal() {
        for name in &["orders.created", "payments", "_single_underscore"] {
            assert!(!name.starts_with("__"));
        }
    }

    #[test]
    fn build_rdkafka_config_plaintext_no_auth() {
        let _cfg = build_rdkafka_config(&KafkaConnectionConfig {
            cluster_id: "c1".to_string(), client_id: "rf-test".to_string(),
            brokers: vec!["b1:9092".to_string()],
            connection_timeout_ms: None, request_timeout_ms: None, auth: None, tls: None,
        });
    }

    #[test]
    fn build_rdkafka_config_sasl_plain_no_tls() {
        let _cfg = build_rdkafka_config(&KafkaConnectionConfig {
            cluster_id: "c1".to_string(), client_id: "rf-test".to_string(),
            brokers: vec!["b1:9092".to_string()],
            connection_timeout_ms: Some(3_000), request_timeout_ms: Some(8_000),
            auth: Some(KafkaAuthConfig { mode: "plain".to_string(), username: Some("alice".to_string()), password: Some("secret".to_string()) }),
            tls: None,
        });
    }

    #[test]
    fn build_rdkafka_config_sasl_scram512_with_tls() {
        let _cfg = build_rdkafka_config(&KafkaConnectionConfig {
            cluster_id: "c1".to_string(), client_id: "rf-test".to_string(),
            brokers: vec!["b1:9093".to_string()],
            connection_timeout_ms: None, request_timeout_ms: None,
            auth: Some(KafkaAuthConfig { mode: "scram-sha-512".to_string(), username: Some("svc".to_string()), password: Some("pw".to_string()) }),
            tls: Some(KafkaTlsConfig {
                enabled: true, reject_unauthorized: Some(false),
                server_name: None, ca_pem: Some("-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----".to_string()),
                cert_pem: None, key_pem: None, passphrase: None,
            }),
        });
    }

    #[test]
    fn build_rdkafka_config_tls_only_no_sasl() {
        let _cfg = build_rdkafka_config(&KafkaConnectionConfig {
            cluster_id: "c1".to_string(), client_id: "rf-test".to_string(),
            brokers: vec!["b1:9093".to_string()],
            connection_timeout_ms: None, request_timeout_ms: None,
            auth: None,
            tls: Some(KafkaTlsConfig {
                enabled: true, reject_unauthorized: Some(true),
                server_name: None, ca_pem: None, cert_pem: None, key_pem: None, passphrase: None,
            }),
        });
    }
}
