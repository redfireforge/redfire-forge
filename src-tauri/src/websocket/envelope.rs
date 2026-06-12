//! Envelope construction helpers for WebSocket Tauri commands.
//!
//! All Tauri command handlers return `Result<Value, String>`.  Application-level
//! errors (invalid URL, timeout, not connected) use `Ok(error_envelope(...))`
//! so the TypeScript transport always receives a resolved value and can branch
//! on `envelope.ok`.  Only Mutex-poison (a bug indicator) propagates as `Err(String)`.

use chrono::{SecondsFormat, Utc};
use serde::Serialize;
use serde_json::Value;

use super::state::ConnectionHandle;
use super::types::{
    WsEnvelopeMeta, WsErrorBody, WsErrorEnvelope, WsStatusResult, WsSuccessEnvelope,
};

// ─── Time helpers ─────────────────────────────────────────────────────────────

pub(super) fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub(super) fn epoch_ms_to_iso(epoch_ms: u64) -> String {
    let secs = (epoch_ms / 1000) as i64;
    let nanos = ((epoch_ms % 1000) * 1_000_000) as u32;
    chrono::DateTime::from_timestamp(secs, nanos)
        .map(|dt| dt.to_rfc3339_opts(SecondsFormat::Millis, true))
        .unwrap_or_else(now_iso)
}

// ─── Envelope constructors ────────────────────────────────────────────────────

pub(super) fn success_envelope<T: Serialize>(op: &str, data: T, duration_ms: Option<u64>) -> Value {
    serde_json::to_value(WsSuccessEnvelope {
        ok: true,
        op: op.to_string(),
        data,
        meta: WsEnvelopeMeta {
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

pub(super) fn error_envelope(
    op: &str,
    code: &str,
    message: &str,
    retryable: Option<bool>,
) -> Value {
    serde_json::to_value(WsErrorEnvelope {
        ok: false,
        op: op.to_string(),
        error: WsErrorBody {
            code: code.to_string(),
            message: message.to_string(),
            retryable,
        },
        meta: WsEnvelopeMeta {
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

// ─── Status helpers ───────────────────────────────────────────────────────────

pub(super) fn disconnected_status(connection_id: &str) -> WsStatusResult {
    WsStatusResult {
        connection_id: connection_id.to_string(),
        state: "disconnected".to_string(),
        url: String::new(),
        connected_at: None,
        closed_at: None,
        close_code: None,
        close_reason: None,
        last_error: None,
        protocol: None,
        extensions: None,
        sent_count: 0,
        received_count: 0,
        uptime_ms: None,
    }
}

pub(super) fn handle_to_status(connection_id: &str, handle: &ConnectionHandle) -> WsStatusResult {
    let uptime_ms = handle.connected_since.elapsed().as_millis() as u64;
    WsStatusResult {
        connection_id: connection_id.to_string(),
        state: "connected".to_string(),
        url: handle.url.clone(),
        connected_at: Some(handle.connected_at.clone()),
        closed_at: None,
        close_code: None,
        close_reason: None,
        last_error: None,
        protocol: handle.protocol.clone(),
        extensions: handle.extensions.clone(),
        sent_count: handle.messages_sent.load(std::sync::atomic::Ordering::Relaxed),
        received_count: handle.messages_received.load(std::sync::atomic::Ordering::Relaxed),
        uptime_ms: Some(uptime_ms),
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn success_envelope_shape() {
        let result = WsStatusResult {
            connection_id: "c1".to_string(),
            state: "connected".to_string(),
            url: "wss://example.com".to_string(),
            connected_at: Some("2026-01-01T00:00:00.000Z".to_string()),
            closed_at: None,
            close_code: None,
            close_reason: None,
            last_error: None,
            protocol: None,
            extensions: None,
            sent_count: 0,
            received_count: 0,
            uptime_ms: Some(1000),
        };
        let env = success_envelope("status", result, Some(42));
        assert_eq!(env["ok"], true);
        assert_eq!(env["op"], "status");
        assert_eq!(env["data"]["connectionId"], "c1");
        assert_eq!(env["meta"]["durationMs"], 42);
    }

    #[test]
    fn success_envelope_no_duration() {
        let env = success_envelope("status", serde_json::json!({"x": 1}), None);
        assert_eq!(env["ok"], true);
        assert!(env["meta"].get("durationMs").is_none());
    }

    #[test]
    fn error_envelope_shape() {
        let env = error_envelope("connect", "WS_CONNECT_FAILED", "connection refused", Some(true));
        assert_eq!(env["ok"], false);
        assert_eq!(env["error"]["code"], "WS_CONNECT_FAILED");
        assert_eq!(env["error"]["retryable"], true);
        assert!(env["meta"].get("durationMs").is_none());
    }

    #[test]
    fn error_envelope_without_retryable() {
        let env = error_envelope("send", "WS_NOT_FOUND", "connection not found", None);
        assert_eq!(env["ok"], false);
        assert!(env["error"].get("retryable").is_none());
    }

    #[test]
    fn disconnected_status_shape() {
        let status = disconnected_status("c1");
        let json = serde_json::to_value(&status).unwrap();
        assert_eq!(json["state"], "disconnected");
        assert_eq!(json["connectionId"], "c1");
        assert_eq!(json["sentCount"], 0);
    }

    #[test]
    fn now_iso_is_rfc3339_millis() {
        let s = now_iso();
        assert!(s.ends_with('Z'), "Expected ISO string to end with Z: {}", s);
        assert!(s.contains('.'), "Expected milliseconds separator in: {}", s);
    }

    #[test]
    fn success_envelope_has_timestamp() {
        let env = success_envelope("connect", serde_json::json!({}), None);
        let ts = env["meta"]["timestamp"].as_str().unwrap();
        assert!(ts.ends_with('Z'), "timestamp should end with Z: {}", ts);
    }

    #[test]
    fn error_envelope_has_timestamp() {
        let env = error_envelope("connect", "WS_INVALID_URL", "bad url", None);
        let ts = env["meta"]["timestamp"].as_str().unwrap();
        assert!(ts.ends_with('Z'), "timestamp should end with Z: {}", ts);
    }

    #[test]
    fn epoch_ms_to_iso_known_value() {
        let iso = epoch_ms_to_iso(1700000000000);
        assert_eq!(iso, "2023-11-14T22:13:20.000Z");
    }

    #[test]
    fn epoch_ms_to_iso_with_millis() {
        let iso = epoch_ms_to_iso(1700000000123);
        assert!(iso.contains(".123"), "Expected .123 millis in: {}", iso);
        assert!(iso.ends_with('Z'));
    }
}
