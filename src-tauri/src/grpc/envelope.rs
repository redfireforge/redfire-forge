//! Response envelope helpers for gRPC Tauri commands — Phase 7C.
//!
//! All command handlers return `Result<serde_json::Value, String>`. Application-level
//! errors use `Ok(error_envelope(...))` so the renderer always receives a JSON
//! envelope and can branch on `ok`. Only mutex-poison propagates as `Err(String)`.

use chrono::{SecondsFormat, Utc};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;

use crate::grpc::types::{
    GrpcTauriEnvelopeMeta, GrpcTauriErrorBody, GrpcTauriErrorEnvelope, GrpcTauriSuccessEnvelope,
    GRPC_TAURI_SCHEMA_VERSION,
};

pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn success_envelope<T: Serialize>(op: &str, data: T, duration_ms: Option<u64>) -> Value {
    serde_json::to_value(GrpcTauriSuccessEnvelope {
        ok: true,
        op: op.to_string(),
        data,
        meta: GrpcTauriEnvelopeMeta {
            timestamp: now_iso(),
            duration_ms,
            schema_version: GRPC_TAURI_SCHEMA_VERSION,
        },
    })
    .unwrap_or_else(|e| fallback_serialization_error(op, &e.to_string()))
}

pub fn error_envelope(
    op: &str,
    code: &str,
    message: &str,
    duration_ms: Option<u64>,
    retryable: Option<bool>,
    grpc_status: Option<i32>,
    trailers: Option<HashMap<String, String>>,
) -> Value {
    serde_json::to_value(GrpcTauriErrorEnvelope {
        ok: false,
        op: op.to_string(),
        error: GrpcTauriErrorBody {
            code: code.to_string(),
            message: message.to_string(),
            retryable,
            grpc_status,
            trailers,
        },
        meta: GrpcTauriEnvelopeMeta {
            timestamp: now_iso(),
            duration_ms,
            schema_version: GRPC_TAURI_SCHEMA_VERSION,
        },
    })
    .unwrap_or_else(|e| fallback_serialization_error(op, &e.to_string()))
}

fn fallback_serialization_error(op: &str, detail: &str) -> Value {
    serde_json::json!({
        "ok": false,
        "op": op,
        "error": {
            "code": crate::grpc::types::GRPC_TAURI_INTERNAL,
            "message": format!("Failed to serialize envelope: {detail}"),
        },
        "meta": {
            "timestamp": now_iso(),
            "schemaVersion": GRPC_TAURI_SCHEMA_VERSION,
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grpc::types::GrpcTauriCancelResult;

    #[test]
    fn success_envelope_shape() {
        let env = success_envelope(
            "unary",
            serde_json::json!({ "status": 0 }),
            Some(12),
        );
        assert_eq!(env["ok"], true);
        assert_eq!(env["op"], "unary");
        assert_eq!(env["meta"]["schemaVersion"], GRPC_TAURI_SCHEMA_VERSION);
        assert_eq!(env["meta"]["durationMs"], 12);
    }

    #[test]
    fn error_envelope_shape() {
        let env = error_envelope(
            "unary",
            crate::grpc::types::GRPC_TAURI_CHANNEL_BUILD,
            "channel build failed",
            Some(5),
            Some(true),
            None,
            None,
        );
        assert_eq!(env["ok"], false);
        assert_eq!(env["error"]["code"], crate::grpc::types::GRPC_TAURI_CHANNEL_BUILD);
        assert_eq!(env["error"]["retryable"], true);
    }

    #[test]
    fn cancel_result_success_envelope() {
        let env = success_envelope(
            "call_cancel",
            GrpcTauriCancelResult {
                request_id: "req-1".to_string(),
                cancelled: true,
                already_completed: None,
            },
            None,
        );
        assert_eq!(env["data"]["requestId"], "req-1");
        assert_eq!(env["data"]["cancelled"], true);
    }
}
