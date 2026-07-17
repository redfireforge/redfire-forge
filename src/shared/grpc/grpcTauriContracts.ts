/**
 * grpcTauriContracts.ts — Phase 7A
 *
 * Frozen renderer ↔ Rust native gRPC transport protocol.
 * All Tauri command inputs, result envelopes, and event payloads are defined here.
 *
 * Design rules:
 * - Types are standalone (no imports from contracts.ts) for protocol independence.
 * - Every command payload carries `schemaVersion`; Rust validates and returns
 *   `GRPC_TAURI_SCHEMA_MISMATCH` on version mismatch (never panics).
 * - Streaming events are tab-scoped: `grpc-event-{tabId}` with multiplexed streamId.
 * - Sequence numbers are monotonic per streamId; renderer deduplicates and buffers
 *   up to GRPC_TAURI_EVENT_REORDER_BUFFER out-of-order events before discarding.
 *
 * Phase history:
 * - 7A: initial freeze — all contracts defined, no tonic I/O yet.
 */

// ─── Schema versioning ────────────────────────────────────────────────────────

/**
 * Immutable schema version for the renderer↔Rust native gRPC protocol.
 * Bump this constant (and the Rust mirror) on any breaking command/event shape change.
 */
export const GRPC_TAURI_SCHEMA_VERSION = 1 as const;
export type GrpcTauriSchemaVersion = typeof GRPC_TAURI_SCHEMA_VERSION;

/** Returns true when `version` matches the frozen native protocol schema version. */
export function validateGrpcTauriSchemaVersion(
  version: number,
): version is GrpcTauriSchemaVersion {
  return version === GRPC_TAURI_SCHEMA_VERSION;
}

// ─── Error codes ──────────────────────────────────────────────────────────────

export const GRPC_TAURI_ERROR_CODES = {
  /** Renderer and Rust are running incompatible protocol versions. */
  SCHEMA_MISMATCH: 'GRPC_TAURI_SCHEMA_MISMATCH',
  /** Descriptor bytes failed SHA-256 integrity check. */
  DESCRIPTOR_INTEGRITY: 'GRPC_TAURI_DESCRIPTOR_INTEGRITY',
  /** Failed to build or acquire a tonic channel for the target. */
  CHANNEL_BUILD: 'GRPC_TAURI_CHANNEL_BUILD',
  /** The gRPC call itself returned a non-OK status (transport-level success). */
  CALL_FAILED: 'GRPC_TAURI_CALL_FAILED',
  /** The in-flight call or stream was cancelled by the renderer. */
  CANCELLED: 'GRPC_TAURI_CANCELLED',
  /** In-flight unary requestId not found in the call registry. */
  REQUEST_NOT_FOUND: 'GRPC_TAURI_REQUEST_NOT_FOUND',
  /** Request payload or tab ownership validation failed. */
  INVALID_REQUEST: 'GRPC_TAURI_INVALID_REQUEST',
  /** Stream ID not found in the active stream registry. */
  STREAM_NOT_FOUND: 'GRPC_TAURI_STREAM_NOT_FOUND',
  /** Command issued from a tabId that does not own the stream. */
  STREAM_OWNERSHIP: 'GRPC_TAURI_STREAM_OWNERSHIP',
  /** Cleanup command failed to cancel all operations for the tab. */
  TAB_CLEANUP: 'GRPC_TAURI_TAB_CLEANUP',
  /** Unexpected internal error in the native transport layer. */
  INTERNAL: 'GRPC_TAURI_INTERNAL',
} as const;

export type GrpcTauriErrorCode =
  (typeof GRPC_TAURI_ERROR_CODES)[keyof typeof GRPC_TAURI_ERROR_CODES];

// ─── Event channel ────────────────────────────────────────────────────────────

/**
 * All streaming events for a given tab are multiplexed on this single channel.
 * One `unlisten` on tab close handles full lifecycle — matches WS `ws-message` pattern.
 */
export const GRPC_TAURI_EVENT_CHANNEL_PREFIX = 'grpc-event-' as const;

/** Returns the Tauri event channel name for a given tabId. */
export function grpcTauriEventChannel(tabId: string): string {
  return `${GRPC_TAURI_EVENT_CHANNEL_PREFIX}${tabId}`;
}

/**
 * Maximum number of out-of-order events buffered per streamId before discarding.
 * Renderer must enforce this to prevent unbounded memory usage on sequence gaps.
 */
export const GRPC_TAURI_EVENT_REORDER_BUFFER = 16;

// ─── Descriptor payload ───────────────────────────────────────────────────────

/**
 * Descriptor bytes passed to native commands for dynamic prost-reflect dispatch.
 * Rust validates `contentSha256` before constructing dynamic messages (7G+).
 */
export interface GrpcTauriDescriptorPayload {
  /** Opaque renderer-side cache key for the descriptor. */
  descriptorKey: string;
  /** Base64-encoded serialized `FileDescriptorSet` bytes. */
  protosetBase64: string;
  /** SHA-256 hex of the protoset bytes; Rust validates before use. */
  contentSha256: string;
}

// ─── TLS / Target / Auth mirrors ─────────────────────────────────────────────
// Defined independently from contracts.ts for protocol freeze isolation.

/** Mirrors GrpcTlsConfig from contracts.ts. */
export interface GrpcTauriTlsConfig {
  serverCaPem?: string;
  clientCertPem?: string;
  clientKeyPem?: string;
  serverNameOverride?: string;
}

/** TLS mode — mirrors GrpcTlsMode from contracts.ts. */
export type GrpcTauriTlsMode = 'disabled' | 'tls' | 'mtls';

/** Mirrors GrpcTarget from contracts.ts. */
export interface GrpcTauriTarget {
  address: string;
  tlsMode: GrpcTauriTlsMode;
  tlsConfig?: GrpcTauriTlsConfig;
}

/** OAuth2 client-credentials config mirror. */
export interface GrpcTauriOAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

/** Auth type — mirrors GrpcAuthConfig.type from contracts.ts. */
export type GrpcTauriAuthType = 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2';

/** Mirrors GrpcAuthConfig from contracts.ts. */
export interface GrpcTauriAuthConfig {
  type: GrpcTauriAuthType;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  oauth2?: GrpcTauriOAuth2Config;
}

// ─── Command input types ──────────────────────────────────────────────────────

/** Input payload for the `grpc_unary` Tauri command (Phase 7C). */
export interface GrpcTauriUnaryRequest {
  schemaVersion: GrpcTauriSchemaVersion;
  requestId: string;
  tabId: string;
  target: GrpcTauriTarget;
  service: string;
  method: string;
  body: Record<string, unknown>;
  metadata?: Record<string, string>;
  auth?: GrpcTauriAuthConfig;
  timeoutMs?: number;
  descriptor: GrpcTauriDescriptorPayload;
}

/** Input payload for the `grpc_call_cancel` Tauri command (Phase 7C). */
export interface GrpcTauriCallCancelRequest {
  schemaVersion: GrpcTauriSchemaVersion;
  requestId: string;
  tabId: string;
}

/** Streaming call type — subset of GrpcCallType from contracts.ts. */
export type GrpcTauriStreamingCallType =
  | 'server_streaming'
  | 'client_streaming'
  | 'bidi_streaming';

/** Input payload for the `grpc_stream_start` Tauri command (Phase 7D). */
export interface GrpcTauriStreamStartRequest {
  schemaVersion: GrpcTauriSchemaVersion;
  requestId: string;
  tabId: string;
  callType: GrpcTauriStreamingCallType;
  target: GrpcTauriTarget;
  service: string;
  method: string;
  body: Record<string, unknown>;
  metadata?: Record<string, string>;
  auth?: GrpcTauriAuthConfig;
  timeoutMs?: number;
  descriptor: GrpcTauriDescriptorPayload;
}

/** Input payload for the `grpc_stream_send` Tauri command (Phase 7D; client/bidi). */
export interface GrpcTauriStreamSendRequest {
  schemaVersion: GrpcTauriSchemaVersion;
  streamId: string;
  tabId: string;
  body: Record<string, unknown>;
}

/** Input payload for the `grpc_stream_end` Tauri command (Phase 7D; half-close). */
export interface GrpcTauriStreamEndRequest {
  schemaVersion: GrpcTauriSchemaVersion;
  streamId: string;
  tabId: string;
}

/** Input payload for the `grpc_stream_cancel` Tauri command (Phase 7D). */
export interface GrpcTauriStreamCancelRequest {
  schemaVersion: GrpcTauriSchemaVersion;
  streamId: string;
  tabId: string;
}

/** Input payload for the `grpc_tab_cleanup` Tauri command (Phase 7H). */
export interface GrpcTauriTabCleanupRequest {
  schemaVersion: GrpcTauriSchemaVersion;
  tabId: string;
}

/** Input payload for the `grpc_native_diagnostics` Tauri command (Post-GA P2-A). */
export interface GrpcTauriNativeDiagnosticsRequest {
  schemaVersion: GrpcTauriSchemaVersion;
  /** Optional active tab context for diagnostics correlation. */
  tabId?: string;
}

// ─── Envelope / result types ──────────────────────────────────────────────────

/** Metadata included in every command response envelope. */
export interface GrpcTauriEnvelopeMeta {
  /** ISO-8601 timestamp of the response. */
  timestamp: string;
  /** Wall-clock duration of the operation in milliseconds. */
  durationMs?: number;
  schemaVersion: GrpcTauriSchemaVersion;
}

/** Error detail included in `GrpcTauriErrorEnvelope`. */
export interface GrpcTauriErrorBody {
  /** Structured error code from `GRPC_TAURI_ERROR_CODES` or a gRPC status string. */
  code: GrpcTauriErrorCode | string;
  message: string;
  /** True if retrying the same operation may succeed (e.g. transient channel failure). */
  retryable?: boolean;
  /** gRPC status integer when the error originated at the transport layer. */
  grpcStatus?: number;
  /** gRPC trailing metadata captured on error. */
  trailers?: Record<string, string>;
}

export interface GrpcTauriSuccessEnvelope<T> {
  ok: true;
  op: string;
  data: T;
  meta: GrpcTauriEnvelopeMeta;
}

export interface GrpcTauriErrorEnvelope {
  ok: false;
  op: string;
  error: GrpcTauriErrorBody;
  meta: GrpcTauriEnvelopeMeta;
}

/** Discriminated union of success/error response envelopes. */
export type GrpcTauriEnvelope<T> =
  | GrpcTauriSuccessEnvelope<T>
  | GrpcTauriErrorEnvelope;

// ─── Unary result ─────────────────────────────────────────────────────────────

/**
 * Unary call result — parity with `GrpcCallResult` from contracts.ts.
 * Returned by `grpc_unary` inside a `GrpcTauriSuccessEnvelope` or
 * surfaced as an error body inside `GrpcTauriErrorEnvelope`.
 */
export interface GrpcTauriUnaryResult {
  callType: 'unary';
  status: number;
  statusMessage: string;
  headers: Record<string, string>;
  trailers: Record<string, string>;
  body?: Record<string, unknown>;
  durationMs: number;
  errorDetail?: string;
  /** Always 'tauri' when returned from the native command. */
  transportUsed: 'tauri';
  /** requestId echoed for renderer correlation. */
  requestId: string;
}

// ─── Stream start result ──────────────────────────────────────────────────────

/**
 * Result returned synchronously by `grpc_stream_start`.
 * Parity with `GrpcStreamStartResponse` from contracts.ts.
 */
export interface GrpcTauriStreamStartResult {
  streamId: string;
  requestId: string;
  tabId: string;
  /** Always 'tauri'. */
  transportUsed: 'tauri';
}

// ─── Stream events ────────────────────────────────────────────────────────────

/**
 * Event type discriminant — intentionally mirrors `GrpcStreamEventType` from contracts.ts.
 */
export type GrpcTauriEventType =
  | 'grpc-message'
  | 'grpc-end'
  | 'grpc-error'
  | 'grpc-heartbeat';

/**
 * Event payload emitted by Rust → renderer on `grpc-event-{tabId}`.
 *
 * Ordering contract (renderer MUST enforce):
 * - `sequence` is monotonically increasing per `streamId`, starting at 1.
 * - Renderer ignores events with a sequence number already seen for that stream.
 * - Renderer buffers up to `GRPC_TAURI_EVENT_REORDER_BUFFER` out-of-order
 *   events per stream before discarding.
 *
 * Parity with `GrpcStreamEvent` from contracts.ts; adds `schemaVersion`.
 *
 * Field naming note: native events use `grpcStatus` / `grpcStatusMessage` (not
 * SSE `status` / `statusMessage`). The Phase 7E transport facade normalizes
 * Tauri events into the existing `GrpcStreamEvent` shape for Studio/workflow.
 */
export interface GrpcTauriEvent {
  schemaVersion: GrpcTauriSchemaVersion;
  type: GrpcTauriEventType;
  streamId: string;
  requestId: string;
  tabId: string;
  /** Monotonic sequence number per streamId (1-based). */
  sequence: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Message body for `grpc-message` events. */
  data?: Record<string, unknown>;
  /** `inbound` for server→client; `outbound` for client→server (grpc-message only). */
  direction?: 'inbound' | 'outbound';
  /** gRPC status code on `grpc-end` or `grpc-error`. */
  grpcStatus?: number;
  grpcStatusMessage?: string;
  /** Response headers on `grpc-end`. */
  headers?: Record<string, string>;
  /** Trailing metadata on `grpc-end` or `grpc-error`. */
  trailers?: Record<string, string>;
  /** Human-readable error description on `grpc-error`. */
  errorDetail?: string;
  /** Which transport executed the call (always 'tauri' from native layer). */
  transportUsed?: 'tauri' | 'express';
}

// ─── Control operation results ────────────────────────────────────────────────

/** Result of `grpc_call_cancel`. */
export interface GrpcTauriCancelResult {
  requestId: string;
  cancelled: boolean;
  alreadyCompleted?: boolean;
}

/** Result of `grpc_stream_end` or `grpc_stream_cancel`. */
export interface GrpcTauriStreamControlResult {
  streamId: string;
  tabId: string;
  /** Which control operation was performed. */
  op: 'end' | 'cancel';
  acknowledged: boolean;
  /** True if the stream was already in a terminal state when the command arrived. */
  alreadyTerminal?: boolean;
}

/** Result of `grpc_tab_cleanup`. */
export interface GrpcTauriTabCleanupResult {
  tabId: string;
  cancelledStreams: number;
  releasedChannels: number;
}

export interface GrpcTauriChannelPoolSnapshot {
  size: number;
  capacity: number;
  hitCountTotal: number;
}

export interface GrpcTauriCallRegistrySnapshot {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
}

export interface GrpcTauriStreamRegistrySnapshot {
  total: number;
  active: number;
  ended: number;
  cancelled: number;
  error: number;
}

export interface GrpcTauriListenerSnapshot {
  attachedTabs: number;
  detachedTabs: number;
  staleAttachedTabs: number;
  totalListenerCount: number;
}

export interface GrpcTauriDiagnosticsTaxonomy {
  state: 'healthy' | 'degraded';
  activeIssueCodes: string[];
}

/** Result of `grpc_native_diagnostics`. */
export interface GrpcTauriNativeDiagnosticsResult {
  transportUsed: 'tauri';
  tabId?: string;
  channelPool: GrpcTauriChannelPoolSnapshot;
  calls: GrpcTauriCallRegistrySnapshot;
  streams: GrpcTauriStreamRegistrySnapshot;
  listeners: GrpcTauriListenerSnapshot;
  taxonomy: GrpcTauriDiagnosticsTaxonomy;
}
