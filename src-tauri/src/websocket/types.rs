//! Contract types aligned with `src-server/websocket/contracts.ts`.
//! All input types use `#[serde(rename_all = "camelCase")]` to match the
//! camelCase JSON payloads coming from the frontend via `@tauri-apps/api/core`.
//! All output types use the same to produce camelCase JSON for the TypeScript
//! response parsers in Phase 6D.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

// ─── Input types ──────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsTlsConfig {
    pub reject_unauthorized: Option<bool>,
    pub ca_cert: Option<String>,
    pub client_cert: Option<String>,
    pub client_key: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsConnectRequest {
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub subprotocols: Option<Vec<String>>,
    pub timeout_ms: Option<u64>,
    pub tls: Option<WsTlsConfig>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsDisconnectRequest {
    pub connection_id: String,
    pub code: Option<u16>,
    pub reason: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsSendRequest {
    pub connection_id: String,
    pub data: String,
    /// Serde alias so frontend can send `"type": "binary"` (TS reserved word
    /// handled by alias, Rust field is `message_type`).
    #[serde(alias = "type")]
    pub message_type: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsPingRequest {
    pub connection_id: String,
    pub data: Option<String>,
}

/// Native-only: block until next message or timeout.
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsReceiveRequest {
    pub connection_id: String,
    pub timeout_ms: Option<u64>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsStatusRequest {
    pub connection_id: String,
}

// ─── Envelope types ───────────────────────────────────────────────────────────

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WsEnvelopeMeta {
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

#[derive(Serialize, Debug)]
pub struct WsSuccessEnvelope<T: Serialize> {
    pub ok: bool,
    pub op: String,
    pub data: T,
    pub meta: WsEnvelopeMeta,
}

#[derive(Serialize, Debug)]
pub struct WsErrorEnvelope {
    pub ok: bool,
    pub op: String,
    pub error: WsErrorBody,
    pub meta: WsEnvelopeMeta,
}

#[derive(Serialize, Debug)]
pub struct WsErrorBody {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retryable: Option<bool>,
}

// ─── Output types ─────────────────────────────────────────────────────────────

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WsConnectResult {
    pub connection_id: String,
    pub protocol: String,
    pub extensions: String,
    pub latency_ms: u64,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WsDisconnectResult {
    pub connection_id: String,
    pub disconnected: bool,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WsSendResult {
    pub connection_id: String,
    pub sent_at: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WsPingResult {
    pub connection_id: String,
    pub sent_at: String,
}

/// Native-only: result from `ws_receive_next`.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WsReceiveResult {
    pub connection_id: String,
    pub data: String,
    pub message_type: String,
    pub received_at: String,
    pub size: usize,
}

/// Aligned with `WsProxyStatusResult` in contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WsStatusResult {
    pub connection_id: String,
    pub state: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connected_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub closed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub close_code: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub close_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extensions: Option<String>,
    pub sent_count: u64,
    pub received_count: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime_ms: Option<u64>,
}

// ─── Event payload types ──────────────────────────────────────────────────────

/// Emitted as `"ws-message"` Tauri event when the read loop receives a frame.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsMessagePayload {
    pub connection_id: String,
    pub data: String,
    pub message_type: String,
    pub timestamp: u64,
}

/// Emitted as `"ws-connection-closed"` when the server closes the connection.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsConnectionClosedPayload {
    pub connection_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connect_request_deserializes_camel_case() {
        let json = r#"{
            "url": "wss://api.example.com/ws",
            "headers": { "Authorization": "Bearer token123" },
            "subprotocols": ["graphql-ws"],
            "timeoutMs": 5000,
            "tls": { "rejectUnauthorized": false, "caCert": "-----BEGIN CERT-----" }
        }"#;
        let req: WsConnectRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.url, "wss://api.example.com/ws");
        assert_eq!(req.timeout_ms, Some(5000));
        assert_eq!(req.subprotocols.as_ref().unwrap().len(), 1);
        let tls = req.tls.as_ref().unwrap();
        assert_eq!(tls.reject_unauthorized, Some(false));
        assert!(tls.ca_cert.is_some());
    }

    #[test]
    fn disconnect_request_deserializes() {
        let json = r#"{ "connectionId": "abc-123", "code": 1000, "reason": "done" }"#;
        let req: WsDisconnectRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.connection_id, "abc-123");
        assert_eq!(req.code, Some(1000));
    }

    #[test]
    fn send_request_type_alias() {
        let json = r#"{ "connectionId": "c1", "data": "aGVsbG8=", "type": "binary" }"#;
        let req: WsSendRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.data, "aGVsbG8=");
        assert_eq!(req.message_type, Some("binary".to_string()));
    }

    #[test]
    fn send_request_message_type_field() {
        let json = r#"{ "connectionId": "c1", "data": "hello", "messageType": "text" }"#;
        let req: WsSendRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.message_type, Some("text".to_string()));
    }

    #[test]
    fn receive_request_deserializes() {
        let json = r#"{ "connectionId": "c1", "timeoutMs": 10000 }"#;
        let req: WsReceiveRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.connection_id, "c1");
        assert_eq!(req.timeout_ms, Some(10000));
    }

    #[test]
    fn connect_result_serializes_camel_case() {
        let result = WsConnectResult {
            connection_id: "uuid-1".to_string(),
            protocol: "graphql-ws".to_string(),
            extensions: "".to_string(),
            latency_ms: 42,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["connectionId"], "uuid-1");
        assert_eq!(json["latencyMs"], 42);
        assert_eq!(json["protocol"], "graphql-ws");
    }

    #[test]
    fn disconnect_result_serializes() {
        let result = WsDisconnectResult {
            connection_id: "c1".to_string(),
            disconnected: true,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["connectionId"], "c1");
        assert_eq!(json["disconnected"], true);
    }

    #[test]
    fn status_result_omits_none_fields() {
        let result = WsStatusResult {
            connection_id: "c1".to_string(),
            state: "connected".to_string(),
            url: "wss://example.com".to_string(),
            connected_at: Some("2026-01-01T00:00:00.000Z".to_string()),
            closed_at: None,
            close_code: None,
            close_reason: None,
            last_error: None,
            protocol: Some("graphql-ws".to_string()),
            extensions: None,
            sent_count: 5,
            received_count: 10,
            uptime_ms: Some(60000),
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["connectionId"], "c1");
        assert_eq!(json["connectedAt"], "2026-01-01T00:00:00.000Z");
        assert_eq!(json["sentCount"], 5);
        assert_eq!(json["uptimeMs"], 60000);
        assert!(json.get("closedAt").is_none());
        assert!(json.get("closeCode").is_none());
        assert!(json.get("lastError").is_none());
    }

    #[test]
    fn send_result_serializes() {
        let result = WsSendResult {
            connection_id: "c1".to_string(),
            sent_at: "2026-01-01T00:00:00.000Z".to_string(),
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["connectionId"], "c1");
        assert_eq!(json["sentAt"], "2026-01-01T00:00:00.000Z");
    }

    #[test]
    fn receive_result_serializes() {
        let result = WsReceiveResult {
            connection_id: "c1".to_string(),
            data: "hello".to_string(),
            message_type: "text".to_string(),
            received_at: "2026-01-01T00:00:00.000Z".to_string(),
            size: 5,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["connectionId"], "c1");
        assert_eq!(json["messageType"], "text");
        assert_eq!(json["size"], 5);
    }

    #[test]
    fn message_payload_serializes() {
        let payload = WsMessagePayload {
            connection_id: "c1".to_string(),
            data: "hi".to_string(),
            message_type: "text".to_string(),
            timestamp: 1700000000000,
        };
        let json = serde_json::to_value(&payload).unwrap();
        assert_eq!(json["connectionId"], "c1");
        assert_eq!(json["messageType"], "text");
        assert_eq!(json["timestamp"], 1700000000000u64);
    }

    #[test]
    fn connection_closed_payload_serializes() {
        let payload = WsConnectionClosedPayload {
            connection_id: "c1".to_string(),
            code: Some(1000),
            reason: Some("Normal closure".to_string()),
        };
        let json = serde_json::to_value(&payload).unwrap();
        assert_eq!(json["connectionId"], "c1");
        assert_eq!(json["code"], 1000);
        assert_eq!(json["reason"], "Normal closure");
    }

    #[test]
    fn tls_config_all_fields_optional() {
        let json = r#"{ "rejectUnauthorized": true }"#;
        let tls: WsTlsConfig = serde_json::from_str(json).unwrap();
        assert_eq!(tls.reject_unauthorized, Some(true));
        assert!(tls.ca_cert.is_none());
        assert!(tls.client_cert.is_none());
        assert!(tls.client_key.is_none());
    }

    #[test]
    fn ping_request_deserializes() {
        let json = r#"{ "connectionId": "c1" }"#;
        let req: WsPingRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.connection_id, "c1");
        assert!(req.data.is_none());
    }

    #[test]
    fn ping_request_with_data() {
        let json = r#"{ "connectionId": "c1", "data": "keepalive" }"#;
        let req: WsPingRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.data, Some("keepalive".to_string()));
    }

    #[test]
    fn ping_result_serializes() {
        let result = WsPingResult {
            connection_id: "c1".to_string(),
            sent_at: "2026-01-01T00:00:00.000Z".to_string(),
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["connectionId"], "c1");
        assert_eq!(json["sentAt"], "2026-01-01T00:00:00.000Z");
    }

    #[test]
    fn status_request_deserializes() {
        let json = r#"{ "connectionId": "abc-123" }"#;
        let req: WsStatusRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.connection_id, "abc-123");
    }

    #[test]
    fn connect_request_minimal() {
        let json = r#"{ "url": "ws://localhost:8080" }"#;
        let req: WsConnectRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.url, "ws://localhost:8080");
        assert!(req.headers.is_none());
        assert!(req.subprotocols.is_none());
        assert!(req.timeout_ms.is_none());
        assert!(req.tls.is_none());
    }

    #[test]
    fn send_request_minimal() {
        let json = r#"{ "connectionId": "c1", "data": "hello" }"#;
        let req: WsSendRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.data, "hello");
        assert!(req.message_type.is_none());
    }

    #[test]
    fn connection_closed_payload_omits_none_fields() {
        let payload = WsConnectionClosedPayload {
            connection_id: "c1".to_string(),
            code: None,
            reason: None,
        };
        let json = serde_json::to_value(&payload).unwrap();
        assert_eq!(json["connectionId"], "c1");
        assert!(json.get("code").is_none());
        assert!(json.get("reason").is_none());
    }

    #[test]
    fn tls_config_all_fields_present() {
        let json = r#"{
            "rejectUnauthorized": false,
            "caCert": "-----BEGIN CERTIFICATE-----",
            "clientCert": "-----BEGIN CERTIFICATE-----",
            "clientKey": "-----BEGIN PRIVATE KEY-----"
        }"#;
        let tls: WsTlsConfig = serde_json::from_str(json).unwrap();
        assert_eq!(tls.reject_unauthorized, Some(false));
        assert!(tls.ca_cert.is_some());
        assert!(tls.client_cert.is_some());
        assert!(tls.client_key.is_some());
    }

    #[test]
    fn disconnect_request_minimal() {
        let json = r#"{ "connectionId": "c1" }"#;
        let req: WsDisconnectRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.connection_id, "c1");
        assert!(req.code.is_none());
        assert!(req.reason.is_none());
    }

    #[test]
    fn status_result_disconnected_shape() {
        let result = WsStatusResult {
            connection_id: "c1".to_string(),
            state: "disconnected".to_string(),
            url: "wss://example.com".to_string(),
            connected_at: None,
            closed_at: Some("2026-01-02T00:00:00.000Z".to_string()),
            close_code: Some(1000),
            close_reason: Some("Normal closure".to_string()),
            last_error: None,
            protocol: None,
            extensions: None,
            sent_count: 10,
            received_count: 20,
            uptime_ms: None,
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["state"], "disconnected");
        assert_eq!(json["closeCode"], 1000);
        assert_eq!(json["closeReason"], "Normal closure");
        assert_eq!(json["sentCount"], 10);
        assert_eq!(json["receivedCount"], 20);
        assert!(json.get("connectedAt").is_none());
        assert!(json.get("uptimeMs").is_none());
    }
}
