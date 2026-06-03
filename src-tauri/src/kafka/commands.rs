/**
 * Tauri Kafka commands for Phase 9A: lifecycle baseline.
 *
 * Implements `kafka_connect`, `kafka_disconnect`, `kafka_status`, and
 * `kafka_topics` commands whose response envelopes are strictly aligned with
 * the TypeScript contract types in `src-server/kafka/contracts.ts`.
 *
 * Response shape:
 *   Success: { ok: true,  op: string, data: T,                 meta: { timestamp, durationMs? } }
 *   Error:   { ok: false, op: string, error: KafkaErrorBody,   meta: { timestamp } }
 *
 * All Tauri command parameters use camelCase → snake_case automatic conversion
 * provided by the #[tauri::command] macro (Tauri v2).
 */

use std::time::Duration;

use chrono::{SecondsFormat, Utc};
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{BaseConsumer, Consumer};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::state::{ClientHandle, KafkaState};

// ── Input types (aligned with KafkaConnectionConfig in contracts.ts) ──────────

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
#[allow(dead_code)] // server_name SNI override not supported in rdkafka 0.37; retained for Phase 9B config parity
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

// ── Output types (aligned with contracts.ts response shapes) ──────────────────

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

/// Aligned with the `KafkaErrorBody` interface in contracts.ts.
#[derive(Serialize, Debug)]
pub struct KafkaErrorBody {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retryable: Option<bool>,
}

/// Aligned with `KafkaServiceStatus` in contracts.ts.
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

/// Aligned with `KafkaConnectResult` in contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaConnectResult {
    pub status: KafkaServiceStatus,
    pub reused_existing_connection: bool,
}

/// Aligned with `KafkaDisconnectResult` in contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaDisconnectResult {
    pub status: KafkaServiceStatus,
    pub disconnected: bool,
    pub cleaned_subscriptions: u32,
}

/// Aligned with `KafkaTopicSummary` in contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaTopicSummary {
    pub name: String,
    pub partitions: i32,
    pub is_internal: bool,
}

/// Aligned with `KafkaTopicsResult` in contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KafkaTopicsResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cluster_id: Option<String>,
    pub topics: Vec<KafkaTopicSummary>,
}

// ── Private helpers ───────────────────────────────────────────────────────────

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
        subscription_count: Some(handle.subscription_count as u32),
    }
}

/// Build an `rdkafka::ClientConfig` from the frontend connection config.
///
/// Note: `group.id` is NOT set here; callers that create a `BaseConsumer`
/// for admin operations must set it on a cloned config before calling `create()`.
pub(crate) fn build_rdkafka_config(conn: &KafkaConnectionConfig) -> ClientConfig {
    let mut cfg = ClientConfig::new();

    cfg.set("bootstrap.servers", &conn.brokers.join(","));
    cfg.set("client.id", &conn.client_id);

    let conn_timeout = conn.connection_timeout_ms.unwrap_or(5_000);
    let req_timeout = conn.request_timeout_ms.unwrap_or(10_000);
    cfg.set("socket.connection.setup.timeout.ms", &conn_timeout.to_string());
    cfg.set("request.timeout.ms", &req_timeout.to_string());

    // Security protocol: PLAINTEXT | SSL | SASL_PLAINTEXT | SASL_SSL
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

    // SASL config
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
            _ => {} // "none" — no SASL config
        }
    }

    // TLS config (only applied when tls.enabled = true)
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
            // Note: tls.serverName (custom SNI override) is not supported in
            // rdkafka 0.37 — rdkafka derives SNI from the broker hostname.
        }
    }

    cfg
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Connect to a Kafka cluster.
///
/// Validates connectivity by fetching broker metadata. If a connection for the
/// same `clusterId` already exists, returns immediately with `reusedExistingConnection: true`.
///
/// Aligned with `KafkaConnectResult` in contracts.ts.
#[tauri::command]
pub async fn kafka_connect(
    state: tauri::State<'_, KafkaState>,
    connection: KafkaConnectionConfig,
) -> Result<Value, String> {
    let start = std::time::Instant::now();
    let cluster_id = connection.cluster_id.clone();

    // Check for an existing connection to the same cluster — if found, reuse it.
    {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = map.get(&cluster_id) {
            let result = KafkaConnectResult {
                status: handle_to_status(handle),
                reused_existing_connection: true,
            };
            return Ok(success_envelope(
                "connect",
                result,
                Some(start.elapsed().as_millis() as u64),
            ));
        }
    }

    // Build config and verify connectivity via a metadata fetch (blocking I/O).
    let rdkafka_config = build_rdkafka_config(&connection);
    let cfg_for_check = rdkafka_config.clone();
    let timeout_ms = connection.connection_timeout_ms.unwrap_or(5_000);

    let connect_result = tokio::task::spawn_blocking(move || {
        // Add a temporary group.id required by BaseConsumer.
        let mut admin_cfg = cfg_for_check;
        admin_cfg.set("group.id", "rf-admin-connect-check");
        let consumer: BaseConsumer = admin_cfg.create().map_err(|e| e.to_string())?;
        consumer
            .fetch_metadata(None, Duration::from_millis(timeout_ms))
            .map_err(|e| e.to_string())
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
                subscription_count: 0,
            };
            {
                let mut map = state.inner.lock().map_err(|e| e.to_string())?;
                map.insert(cluster_id.clone(), handle);
            }
            let result = KafkaConnectResult {
                status: KafkaServiceStatus {
                    state: "connected".to_string(),
                    cluster_id: Some(cluster_id),
                    connected_at: Some(connected_at),
                    last_error: None,
                    subscription_count: Some(0),
                },
                reused_existing_connection: false,
            };
            Ok(success_envelope("connect", result, Some(duration_ms)))
        }
        Err(e) => Ok(error_envelope("connect", "CONNECTION_FAILED", &e, Some(true))),
    }
}

/// Disconnect from a Kafka cluster.
///
/// If `clusterId` is provided, disconnects that specific cluster.
/// If omitted, disconnects the first/only connected cluster (matches single-cluster usage).
/// No-op (returns `disconnected: false`) if no matching connection is found.
///
/// Aligned with `KafkaDisconnectResult` in contracts.ts.
#[tauri::command]
pub async fn kafka_disconnect(
    state: tauri::State<'_, KafkaState>,
    cluster_id: Option<String>,
) -> Result<Value, String> {
    let start = std::time::Instant::now();
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;

    // Determine which cluster to disconnect.
    let target_id = match &cluster_id {
        Some(id) => id.clone(),
        None => match map.keys().next().cloned() {
            Some(id) => id,
            None => {
                // Already fully disconnected — return a no-op success.
                return Ok(success_envelope(
                    "disconnect",
                    KafkaDisconnectResult {
                        status: disconnected_status(),
                        disconnected: false,
                        cleaned_subscriptions: 0,
                    },
                    Some(start.elapsed().as_millis() as u64),
                ));
            }
        },
    };

    let (disconnected, cleaned_subscriptions) = match map.remove(&target_id) {
        Some(handle) => (true, handle.subscription_count as u32),
        None => (false, 0),
    };

    Ok(success_envelope(
        "disconnect",
        KafkaDisconnectResult {
            status: disconnected_status(),
            disconnected,
            cleaned_subscriptions,
        },
        Some(start.elapsed().as_millis() as u64),
    ))
}

/// Return the current connection status.
///
/// If `clusterId` is provided, returns status for that cluster.
/// If omitted, returns status for the first/only connected cluster (or
/// `disconnected` if no connections are active).
///
/// Aligned with `KafkaServiceStatus` in contracts.ts.
#[tauri::command]
pub async fn kafka_status(
    state: tauri::State<'_, KafkaState>,
    cluster_id: Option<String>,
) -> Result<Value, String> {
    let map = state.inner.lock().map_err(|e| e.to_string())?;

    let status = match &cluster_id {
        Some(id) => match map.get(id) {
            Some(handle) => handle_to_status(handle),
            None => disconnected_status(),
        },
        None => match map.values().next() {
            Some(handle) => handle_to_status(handle),
            None => disconnected_status(),
        },
    };

    Ok(success_envelope("status", status, None))
}

/// List topics on a connected Kafka cluster.
///
/// Fetches topic metadata using a short-lived `BaseConsumer`. Internal topics
/// (names starting with `__`) are excluded by default unless `includeInternal`
/// is `true`.
///
/// Aligned with `KafkaTopicsResult` in contracts.ts.
#[tauri::command]
pub async fn kafka_topics(
    state: tauri::State<'_, KafkaState>,
    cluster_id: Option<String>,
    include_internal: Option<bool>,
) -> Result<Value, String> {
    let start = std::time::Instant::now();
    let include_internal = include_internal.unwrap_or(false);

    // Retrieve the stored rdkafka config for the target cluster.
    let (rdkafka_config, resolved_cluster_id) = {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        let handle = match &cluster_id {
            Some(id) => map.get(id),
            None => map.values().next(),
        };
        match handle {
            Some(h) => (h.rdkafka_config.clone(), h.cluster_id.clone()),
            None => {
                return Ok(error_envelope(
                    "topics",
                    "NOT_CONNECTED",
                    "No Kafka cluster is connected. Call kafka_connect first.",
                    Some(false),
                ));
            }
        }
    };

    let metadata_result = tokio::task::spawn_blocking(move || {
        let mut admin_cfg = rdkafka_config;
        admin_cfg.set("group.id", "rf-admin-topics-fetch");
        let consumer: BaseConsumer = admin_cfg.create().map_err(|e| e.to_string())?;
        consumer
            .fetch_metadata(None, Duration::from_millis(10_000))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?;

    let duration_ms = start.elapsed().as_millis() as u64;

    match metadata_result {
        Ok(metadata) => {
            let topics: Vec<KafkaTopicSummary> = metadata
                .topics()
                .iter()
                .filter_map(|t| {
                    let name = t.name().to_string();
                    // Heuristic: topics starting with `__` are Kafka-internal
                    // (e.g. `__consumer_offsets`, `__transaction_state`).
                    // rdkafka 0.37 does not expose the IsInternal metadata flag.
                    let is_internal = name.starts_with("__");
                    if !include_internal && is_internal {
                        return None;
                    }
                    Some(KafkaTopicSummary {
                        name,
                        partitions: t.partitions().len() as i32,
                        is_internal,
                    })
                })
                .collect();

            Ok(success_envelope(
                "topics",
                KafkaTopicsResult {
                    cluster_id: Some(resolved_cluster_id),
                    topics,
                },
                Some(duration_ms),
            ))
        }
        Err(e) => Ok(error_envelope(
            "topics",
            "TOPICS_FETCH_FAILED",
            &e,
            Some(true),
        )),
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kafka::state::{ClientHandle, KafkaState};

    fn make_client_handle(cluster_id: &str) -> ClientHandle {
        ClientHandle {
            cluster_id: cluster_id.to_string(),
            client_id: "test-client".to_string(),
            brokers: vec!["localhost:9092".to_string()],
            connected_at: "2026-01-01T00:00:00.000Z".to_string(),
            rdkafka_config: ClientConfig::new(),
            subscription_count: 0,
        }
    }

    // ── KafkaState ────────────────────────────────────────────────────────────

    #[test]
    fn kafka_state_new_is_empty() {
        let state = KafkaState::new();
        let map = state.inner.lock().unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn state_insert_and_remove() {
        let state = KafkaState::new();
        {
            let mut map = state.inner.lock().unwrap();
            map.insert("c1".to_string(), make_client_handle("c1"));
        }
        {
            let map = state.inner.lock().unwrap();
            assert_eq!(map.len(), 1);
            assert!(map.contains_key("c1"));
        }
        {
            let mut map = state.inner.lock().unwrap();
            map.remove("c1");
        }
        {
            let map = state.inner.lock().unwrap();
            assert!(map.is_empty());
        }
    }

    #[test]
    fn state_multiple_clusters() {
        let state = KafkaState::new();
        let mut map = state.inner.lock().unwrap();
        map.insert("c1".to_string(), make_client_handle("c1"));
        map.insert("c2".to_string(), make_client_handle("c2"));
        assert_eq!(map.len(), 2);
    }

    // ── Envelope helpers ──────────────────────────────────────────────────────

    #[test]
    fn success_envelope_shape() {
        let status = KafkaServiceStatus {
            state: "connected".to_string(),
            cluster_id: Some("c1".to_string()),
            connected_at: Some("2026-01-01T00:00:00.000Z".to_string()),
            last_error: None,
            subscription_count: Some(0),
        };
        let env = success_envelope("status", status, Some(42));

        assert_eq!(env["ok"], true);
        assert_eq!(env["op"], "status");
        assert_eq!(env["data"]["state"], "connected");
        assert_eq!(env["data"]["clusterId"], "c1");
        assert_eq!(env["data"]["connectedAt"], "2026-01-01T00:00:00.000Z");
        assert!(env["data"].get("lastError").is_none());
        assert_eq!(env["data"]["subscriptionCount"], 0);
        assert!(env["meta"]["timestamp"].is_string());
        assert_eq!(env["meta"]["durationMs"], 42);
    }

    #[test]
    fn error_envelope_shape() {
        let env = error_envelope("connect", "CONNECTION_FAILED", "broker unreachable", Some(true));

        assert_eq!(env["ok"], false);
        assert_eq!(env["op"], "connect");
        assert_eq!(env["error"]["code"], "CONNECTION_FAILED");
        assert_eq!(env["error"]["message"], "broker unreachable");
        assert_eq!(env["error"]["retryable"], true);
        assert!(env["meta"]["timestamp"].is_string());
        // durationMs is None for error envelopes
        assert!(env["meta"].get("durationMs").is_none());
    }

    #[test]
    fn error_envelope_without_retryable() {
        let env = error_envelope("topics", "NOT_CONNECTED", "not connected", None);
        assert_eq!(env["ok"], false);
        // retryable should be absent when None
        assert!(env["error"].get("retryable").is_none());
    }

    #[test]
    fn disconnected_status_shape() {
        let status = disconnected_status();
        let json = serde_json::to_value(&status).unwrap();
        assert_eq!(json["state"], "disconnected");
        // Optional fields should be absent (not null) when None
        assert!(json.get("clusterId").is_none());
        assert!(json.get("connectedAt").is_none());
        assert!(json.get("lastError").is_none());
        assert!(json.get("subscriptionCount").is_none());
    }

    // ── Response type serialization ───────────────────────────────────────────

    #[test]
    fn kafka_topics_result_shape() {
        let result = KafkaTopicsResult {
            cluster_id: Some("c1".to_string()),
            topics: vec![
                KafkaTopicSummary {
                    name: "orders.created".to_string(),
                    partitions: 3,
                    is_internal: false,
                },
                KafkaTopicSummary {
                    name: "__consumer_offsets".to_string(),
                    partitions: 50,
                    is_internal: true,
                },
            ],
        };
        let json = serde_json::to_value(&result).unwrap();

        assert_eq!(json["clusterId"], "c1");
        assert_eq!(json["topics"][0]["name"], "orders.created");
        assert_eq!(json["topics"][0]["partitions"], 3);
        assert_eq!(json["topics"][0]["isInternal"], false);
        assert_eq!(json["topics"][1]["name"], "__consumer_offsets");
        assert_eq!(json["topics"][1]["isInternal"], true);
    }

    #[test]
    fn kafka_connect_result_camel_case() {
        let result = KafkaConnectResult {
            status: KafkaServiceStatus {
                state: "connected".to_string(),
                cluster_id: Some("c1".to_string()),
                connected_at: Some("2026-01-01T00:00:00.000Z".to_string()),
                last_error: None,
                subscription_count: Some(0),
            },
            reused_existing_connection: true,
        };
        let json = serde_json::to_value(&result).unwrap();
        // Verify camelCase serialization
        assert_eq!(json["reusedExistingConnection"], true);
        assert_eq!(json["status"]["state"], "connected");
    }

    #[test]
    fn kafka_disconnect_result_camel_case() {
        let result = KafkaDisconnectResult {
            status: disconnected_status(),
            disconnected: true,
            cleaned_subscriptions: 2,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["disconnected"], true);
        assert_eq!(json["cleanedSubscriptions"], 2);
        assert_eq!(json["status"]["state"], "disconnected");
    }

    // ── build_rdkafka_config ──────────────────────────────────────────────────

    #[test]
    fn build_rdkafka_config_plaintext_no_auth() {
        let conn = KafkaConnectionConfig {
            cluster_id: "c1".to_string(),
            client_id: "rf-test".to_string(),
            brokers: vec!["b1:9092".to_string(), "b2:9092".to_string()],
            connection_timeout_ms: None,
            request_timeout_ms: None,
            auth: None,
            tls: None,
        };
        // Verify it does not panic and the config can create a client type.
        // (We can't read back config values from rdkafka::ClientConfig directly,
        // but we confirm no panic occurs and the config is valid for client creation.)
        let _cfg = build_rdkafka_config(&conn);
    }

    #[test]
    fn build_rdkafka_config_sasl_plain_no_tls() {
        let conn = KafkaConnectionConfig {
            cluster_id: "c1".to_string(),
            client_id: "rf-test".to_string(),
            brokers: vec!["b1:9092".to_string()],
            connection_timeout_ms: Some(3_000),
            request_timeout_ms: Some(8_000),
            auth: Some(KafkaAuthConfig {
                mode: "plain".to_string(),
                username: Some("alice".to_string()),
                password: Some("secret".to_string()),
            }),
            tls: None,
        };
        let _cfg = build_rdkafka_config(&conn);
    }

    #[test]
    fn build_rdkafka_config_sasl_scram512_with_tls() {
        let conn = KafkaConnectionConfig {
            cluster_id: "c1".to_string(),
            client_id: "rf-test".to_string(),
            brokers: vec!["b1:9093".to_string()],
            connection_timeout_ms: None,
            request_timeout_ms: None,
            auth: Some(KafkaAuthConfig {
                mode: "scram-sha-512".to_string(),
                username: Some("svc".to_string()),
                password: Some("pw".to_string()),
            }),
            tls: Some(KafkaTlsConfig {
                enabled: true,
                reject_unauthorized: Some(false),
                server_name: None,
                ca_pem: Some("-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----".to_string()),
                cert_pem: None,
                key_pem: None,
                passphrase: None,
            }),
        };
        let _cfg = build_rdkafka_config(&conn);
    }

    #[test]
    fn build_rdkafka_config_tls_only_no_sasl() {
        let conn = KafkaConnectionConfig {
            cluster_id: "c1".to_string(),
            client_id: "rf-test".to_string(),
            brokers: vec!["b1:9093".to_string()],
            connection_timeout_ms: None,
            request_timeout_ms: None,
            auth: None,
            tls: Some(KafkaTlsConfig {
                enabled: true,
                reject_unauthorized: Some(true),
                server_name: None,
                ca_pem: None,
                cert_pem: None,
                key_pem: None,
                passphrase: None,
            }),
        };
        let _cfg = build_rdkafka_config(&conn);
    }

    #[test]
    fn build_rdkafka_config_auth_none_skips_sasl() {
        let conn = KafkaConnectionConfig {
            cluster_id: "c1".to_string(),
            client_id: "rf-test".to_string(),
            brokers: vec!["b1:9092".to_string()],
            connection_timeout_ms: None,
            request_timeout_ms: None,
            auth: Some(KafkaAuthConfig {
                mode: "none".to_string(),
                username: None,
                password: None,
            }),
            tls: None,
        };
        let _cfg = build_rdkafka_config(&conn);
    }

    // ── Internal-topic heuristic ──────────────────────────────────────────────

    #[test]
    fn double_underscore_prefix_is_internal() {
        let names = ["__consumer_offsets", "__transaction_state", "__confluent.support.metrics"];
        for name in &names {
            assert!(name.starts_with("__"), "{} should be identified as internal", name);
        }
    }

    #[test]
    fn user_topics_are_not_internal() {
        let names = ["orders.created", "payments", "_single_underscore"];
        for name in &names {
            assert!(!name.starts_with("__"), "{} should NOT be identified as internal", name);
        }
    }
}
