//! gRPC native transport — Serde-mirror types (Phase 7A).
//!
//! These types are the Rust mirror of `src/shared/grpc/grpcTauriContracts.ts`.
//! All structs use `#[serde(rename_all = "camelCase")]` to match the
//! camelCase JSON that Tauri deserialises from the renderer.
//!
//! Versioning policy:
//! - Every command payload carries `schema_version`.
//! - Rust validates it against `GRPC_TAURI_SCHEMA_VERSION` and returns
//!   `GRPC_TAURI_SCHEMA_MISMATCH` (structured error string, no panic).
//!
//! Phase history:
//! - 7A: initial type freeze; no tonic I/O yet.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ─── Schema version ───────────────────────────────────────────────────────────

/// Immutable schema version; must equal `GRPC_TAURI_SCHEMA_VERSION` in TS contracts.
pub const GRPC_TAURI_SCHEMA_VERSION: u32 = 1;

/// Error code string returned on schema version mismatch.
pub const GRPC_TAURI_SCHEMA_MISMATCH: &str = "GRPC_TAURI_SCHEMA_MISMATCH";
/// Descriptor bytes failed SHA-256 integrity check.
pub const GRPC_TAURI_DESCRIPTOR_INTEGRITY: &str = "GRPC_TAURI_DESCRIPTOR_INTEGRITY";
/// Failed to build or acquire a tonic channel for the target.
pub const GRPC_TAURI_CHANNEL_BUILD: &str = "GRPC_TAURI_CHANNEL_BUILD";
/// The gRPC call returned a non-OK status (transport-level success).
/// Reserved: used by renderer error-mapping; emitted by native transport in
/// Phase 7C+ when a call fails at the tonic layer without a valid gRPC status.
#[allow(dead_code)]
pub const GRPC_TAURI_CALL_FAILED: &str = "GRPC_TAURI_CALL_FAILED";
/// In-flight call or stream was cancelled by the renderer.
pub const GRPC_TAURI_CANCELLED: &str = "GRPC_TAURI_CANCELLED";
/// In-flight unary requestId not found in the call registry.
pub const GRPC_TAURI_REQUEST_NOT_FOUND: &str = "GRPC_TAURI_REQUEST_NOT_FOUND";
/// Request payload or tab ownership validation failed.
pub const GRPC_TAURI_INVALID_REQUEST: &str = "GRPC_TAURI_INVALID_REQUEST";
/// Stream ID not found in the active stream registry.
pub const GRPC_TAURI_STREAM_NOT_FOUND: &str = "GRPC_TAURI_STREAM_NOT_FOUND";
/// Command issued from a tabId that does not own the stream.
pub const GRPC_TAURI_STREAM_OWNERSHIP: &str = "GRPC_TAURI_STREAM_OWNERSHIP";
/// Cleanup command failed to cancel all operations for the tab.
/// Reserved: returned by `grpc_tab_cleanup` if any stream cancellation fails.
#[allow(dead_code)]
pub const GRPC_TAURI_TAB_CLEANUP: &str = "GRPC_TAURI_TAB_CLEANUP";
/// Unexpected internal error in the native transport layer.
pub const GRPC_TAURI_INTERNAL: &str = "GRPC_TAURI_INTERNAL";

/// Validate incoming `schemaVersion` on renderer command/event payloads.
/// Returns `GRPC_TAURI_SCHEMA_MISMATCH` when versions differ (never panics).
pub fn validate_grpc_tauri_schema_version(incoming: u32) -> Result<(), &'static str> {
    if incoming != GRPC_TAURI_SCHEMA_VERSION {
        return Err(GRPC_TAURI_SCHEMA_MISMATCH);
    }
    Ok(())
}

// ─── TLS / Target / Auth ──────────────────────────────────────────────────────

/// Mirrors `GrpcTauriTlsConfig` in TS contracts.
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriTlsConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_ca_pem: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_cert_pem: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_key_pem: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_name_override: Option<String>,
}

/// Mirrors `GrpcTauriTlsMode` in TS contracts.
#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GrpcTauriTlsMode {
    Disabled,
    Tls,
    Mtls,
}

/// Mirrors `GrpcTauriTarget` in TS contracts.
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriTarget {
    pub address: String,
    pub tls_mode: GrpcTauriTlsMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tls_config: Option<GrpcTauriTlsConfig>,
}

/// Mirrors `GrpcTauriOAuth2Config` in TS contracts.
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriOAuth2Config {
    pub token_url: String,
    pub client_id: String,
    pub client_secret: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
}

/// Mirrors `GrpcTauriAuthType` in TS contracts.
#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GrpcTauriAuthType {
    None,
    Bearer,
    Basic,
    ApiKey,
    Oauth2,
}

/// Mirrors `GrpcTauriAuthConfig` in TS contracts.
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriAuthConfig {
    #[serde(rename = "type")]
    pub auth_type: GrpcTauriAuthType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bearer_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub basic_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub basic_password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oauth2: Option<GrpcTauriOAuth2Config>,
}

// ─── Descriptor payload ───────────────────────────────────────────────────────

/// Mirrors `GrpcTauriDescriptorPayload` in TS contracts.
/// Rust validates `content_sha256` before any prost-reflect dispatch.
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriDescriptorPayload {
    pub descriptor_key: String,
    pub protoset_base64: String,
    pub content_sha256: String,
}

// ─── Command input types ──────────────────────────────────────────────────────

/// Input for the `grpc_unary` Tauri command (Phase 7C).
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriUnaryRequest {
    pub schema_version: u32,
    pub request_id: String,
    pub tab_id: String,
    pub target: GrpcTauriTarget,
    pub service: String,
    pub method: String,
    pub body: serde_json::Value,
    pub metadata: Option<HashMap<String, String>>,
    pub auth: Option<GrpcTauriAuthConfig>,
    pub timeout_ms: Option<u64>,
    pub descriptor: GrpcTauriDescriptorPayload,
}

/// Input for the `grpc_call_cancel` Tauri command (Phase 7C).
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriCallCancelRequest {
    pub schema_version: u32,
    pub request_id: String,
    pub tab_id: String,
}

/// Streaming call type variants — mirrors `GrpcTauriStreamingCallType` in TS contracts.
#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GrpcTauriStreamingCallType {
    ServerStreaming,
    ClientStreaming,
    BidiStreaming,
}

/// Input for the `grpc_stream_start` Tauri command (Phase 7D).
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriStreamStartRequest {
    pub schema_version: u32,
    pub request_id: String,
    pub tab_id: String,
    pub call_type: GrpcTauriStreamingCallType,
    pub target: GrpcTauriTarget,
    pub service: String,
    pub method: String,
    pub body: serde_json::Value,
    pub metadata: Option<HashMap<String, String>>,
    pub auth: Option<GrpcTauriAuthConfig>,
    pub timeout_ms: Option<u64>,
    pub descriptor: GrpcTauriDescriptorPayload,
}

/// Input for the `grpc_stream_send` Tauri command (Phase 7D; client/bidi).
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriStreamSendRequest {
    pub schema_version: u32,
    pub stream_id: String,
    pub tab_id: String,
    pub body: serde_json::Value,
}

/// Input for the `grpc_stream_end` Tauri command (Phase 7D; half-close).
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriStreamEndRequest {
    pub schema_version: u32,
    pub stream_id: String,
    pub tab_id: String,
}

/// Input for the `grpc_stream_cancel` Tauri command (Phase 7D).
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriStreamCancelRequest {
    pub schema_version: u32,
    pub stream_id: String,
    pub tab_id: String,
}

/// Input for the `grpc_tab_cleanup` Tauri command (Phase 7H).
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriTabCleanupRequest {
    pub schema_version: u32,
    pub tab_id: String,
}

// ─── Envelope / result types ──────────────────────────────────────────────────

/// Metadata included in every command response envelope.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriEnvelopeMeta {
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    pub schema_version: u32,
}

/// Error detail for `GrpcTauriErrorEnvelope`.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriErrorBody {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retryable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grpc_status: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trailers: Option<HashMap<String, String>>,
}

/// Successful response envelope — mirrors `GrpcTauriSuccessEnvelope<T>` in TS.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriSuccessEnvelope<T: Serialize> {
    pub ok: bool,
    pub op: String,
    pub data: T,
    pub meta: GrpcTauriEnvelopeMeta,
}

/// Error response envelope — mirrors `GrpcTauriErrorEnvelope` in TS.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriErrorEnvelope {
    pub ok: bool,
    pub op: String,
    pub error: GrpcTauriErrorBody,
    pub meta: GrpcTauriEnvelopeMeta,
}

// ─── Unary result ─────────────────────────────────────────────────────────────

/// Unary call result — parity with `GrpcCallResult` from TS contracts.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriUnaryResult {
    pub call_type: String,
    pub status: i32,
    pub status_message: String,
    pub headers: HashMap<String, String>,
    pub trailers: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<serde_json::Value>,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_detail: Option<String>,
    pub transport_used: String,
    pub request_id: String,
}

// ─── Stream start result ──────────────────────────────────────────────────────

/// Result of `grpc_stream_start` — mirrors `GrpcTauriStreamStartResult` in TS.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriStreamStartResult {
    pub stream_id: String,
    pub request_id: String,
    pub tab_id: String,
    pub transport_used: String,
}

// ─── Stream events ────────────────────────────────────────────────────────────

/// Event type discriminant — mirrors `GrpcTauriEventType` in TS contracts.
/// Uses explicit per-variant renames because the values contain hyphens.
#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq)]
pub enum GrpcTauriEventType {
    #[serde(rename = "grpc-message")]
    GrpcMessage,
    #[serde(rename = "grpc-end")]
    GrpcEnd,
    #[serde(rename = "grpc-error")]
    GrpcError,
    #[serde(rename = "grpc-heartbeat")]
    GrpcHeartbeat,
}

/// Event payload emitted on `grpc-event-{tabId}` — mirrors `GrpcTauriEvent` in TS.
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriEvent {
    pub schema_version: u32,
    #[serde(rename = "type")]
    pub event_type: GrpcTauriEventType,
    pub stream_id: String,
    pub request_id: String,
    pub tab_id: String,
    /// Monotonic per-stream sequence number (1-based).
    pub sequence: u64,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    /// `inbound` for server→client messages; `outbound` for client→server writes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grpc_status: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grpc_status_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trailers: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport_used: Option<String>,
}

// ─── Control operation results ────────────────────────────────────────────────

/// Result of `grpc_call_cancel` — mirrors `GrpcTauriCancelResult` in TS.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriCancelResult {
    pub request_id: String,
    pub cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub already_completed: Option<bool>,
}

/// Stream control operation — mirrors `GrpcTauriStreamControlResult.op` in TS contracts.
#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GrpcTauriStreamControlOp {
    End,
    Cancel,
}

/// Result of `grpc_stream_end` / `grpc_stream_cancel` — mirrors `GrpcTauriStreamControlResult` in TS.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriStreamControlResult {
    pub stream_id: String,
    pub tab_id: String,
    pub op: GrpcTauriStreamControlOp,
    pub acknowledged: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub already_terminal: Option<bool>,
}

/// Result of `grpc_tab_cleanup` — mirrors `GrpcTauriTabCleanupResult` in TS.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GrpcTauriTabCleanupResult {
    pub tab_id: String,
    pub cancelled_streams: u32,
    pub released_channels: u32,
}
