/**
 * gRPC Studio — shared API contracts (Phase 1A).
 * Used by the renderer and src-server route handlers.
 */
import { validateResolvedGrpcTargetAddress } from './targetValidation';

export type GrpcCallType =
  | 'unary'
  | 'server_streaming'
  | 'client_streaming'
  | 'bidi_streaming';

export type GrpcDescriptorSource =
  | 'reflection'
  | 'proto_files'
  | 'protoset'
  | 'bsr'
  | 'url_proto';

export type GrpcTlsMode = 'disabled' | 'tls' | 'mtls';

export type GrpcAuthType = 'none' | 'inherit' | 'bearer' | 'basic' | 'api_key' | 'oauth2';

/** Auth/manual metadata conflict resolution behavior. */
export type GrpcAuthMetadataConflictPolicy = 'override' | 'error';

/** Phase 4A — persisted TLS material storage key (browser localStorage / Tauri FS). */
export const GRPC_TLS_STORAGE_KEY = 'grpc_tls_certs_v1';

/** Phase 4E — desktop auth secret vault blob (Tauri FS; web uses session memory only). */
export const GRPC_AUTH_SECRETS_STORAGE_KEY = 'grpc_auth_secrets_v1';

/** Phase 4A — connection profile storage key (non-secret fields only when persisted). */
export const GRPC_CONNECTION_PROFILES_STORAGE_KEY = 'grpc_connection_profiles_v1';

/** Phase 4E — vault scopes for secret material. */
export type GrpcSecretVaultScope = 'tls_pem' | 'auth_credentials' | 'bsr_token';

/** Phase 4A — where secret material may live at rest. */
export type GrpcSecretStorageClass =
  | 'session_memory'
  | 'encrypted_local'
  | 'os_keychain'
  | 'forbidden_persist';

/** Phase 4A — transport TLS failure categories (Phase 4F maps runtime errors). */
export type GrpcTlsFailureCategory =
  | 'unknown_ca'
  | 'hostname_mismatch'
  | 'expired_cert'
  | 'handshake_timeout'
  | 'invalid_client_cert'
  | 'invalid_pem';

/** Phase 4A — auth vs manual metadata conflict record. */
export interface GrpcAuthMetadataConflict {
  key: string;
  manualValue: string;
  authValue: string;
}

export type GrpcOperation =
  | 'status'
  | 'reflect'
  | 'describe'
  | 'export_protoset'
  | 'lookup_descriptor'
  | 'call'
  | 'cancel'
  | 'stream_start'
  | 'stream_events'
  | 'stream_send'
  | 'stream_end'
  | 'stream_cancel';

export type GrpcStreamingCallType =
  | 'server_streaming'
  | 'client_streaming'
  | 'bidi_streaming';

export type GrpcErrorCategory =
  | 'validation'
  | 'conflict'           // ownership/state violation (duplicate requestId, tabId mismatch, invalid op) → 409
  | 'unreachable'
  | 'reflection_failed'
  | 'describe_failed'
  | 'call_failed'
  | 'cancelled'
  | 'not_found'
  | 'source_unavailable'
  | 'import_resolution_failed'
  | 'schema_drift'
  | 'cache_stale';

/** Tab-level descriptor refresh / drift state (Phase 3A). */
export type GrpcDescriptorDriftState = 'none' | 'warning' | 'blocking';

/** How a tab chooses its active descriptor source (Phase 3A). */
export type GrpcDescriptorSelectionMode = 'auto' | 'manual';

/** Default unary call timeout (ms). */
export const GRPC_DEFAULT_CALL_TIMEOUT_MS = 30_000;

/** Default streaming call timeout (ms). */
export const GRPC_DEFAULT_STREAM_CALL_TIMEOUT_MS = 120_000;

/** Default reachability / reflection probe timeout (ms). */
export const GRPC_DEFAULT_PROBE_TIMEOUT_MS = 5_000;

/** Max stream log rows retained per tab (Phase 2F). */
export const GRPC_STREAM_MESSAGE_CAP = 10_000;

/** SSE heartbeat interval for active stream relay (Phase 2C). */
export const GRPC_STREAM_HEARTBEAT_INTERVAL_MS = 15_000;

/** Grace period before dropping SSE subscriber after disconnect (Phase 2B). */
export const GRPC_STREAM_SSE_DISCONNECT_GRACE_MS = 60_000;

/** Client SSE reconnect attempts before giving up (Phase 2E). */
export const GRPC_STREAM_RECONNECT_MAX_ATTEMPTS = 3;

/** Exponential backoff delays for SSE reconnect (Phase 2E): 1s, 2s, 4s. */
export const GRPC_STREAM_RECONNECT_BACKOFF_MS = [1_000, 2_000, 4_000] as const;

export const GRPC_ERROR_CODES = {
  INVALID_REQUEST: 'GRPC_INVALID_REQUEST',
  INVALID_TARGET: 'GRPC_INVALID_TARGET',
  INVALID_DESCRIPTOR: 'GRPC_INVALID_DESCRIPTOR',
  MISSING_DESCRIPTOR_KEY: 'GRPC_MISSING_DESCRIPTOR_KEY',
  UNREACHABLE: 'GRPC_UNREACHABLE',
  REFLECTION_FAILED: 'GRPC_REFLECTION_FAILED',
  DESCRIBE_FAILED: 'GRPC_DESCRIBE_FAILED',
  CALL_FAILED: 'GRPC_CALL_FAILED',
  CANCELLED: 'GRPC_CANCELLED',
  REQUEST_NOT_FOUND: 'GRPC_REQUEST_NOT_FOUND',
  SOURCE_UNAVAILABLE: 'GRPC_SOURCE_UNAVAILABLE',
  IMPORT_RESOLUTION_FAILED: 'GRPC_IMPORT_RESOLUTION_FAILED',
  SCHEMA_DRIFT: 'GRPC_SCHEMA_DRIFT',
  CACHE_STALE: 'GRPC_CACHE_STALE',
} as const;

export type GrpcErrorCode = (typeof GRPC_ERROR_CODES)[keyof typeof GRPC_ERROR_CODES];

export interface GrpcTarget {
  address: string;
  tlsMode: GrpcTlsMode;
  tlsConfig?: GrpcTlsConfig;
}

export interface GrpcTlsConfig {
  serverCaPem?: string;
  clientCertPem?: string;
  clientKeyPem?: string;
  serverNameOverride?: string;
}

export interface GrpcAuthConfig {
  type: GrpcAuthType;
  /** `override` (default) keeps current precedence; `error` blocks execute on auth/manual key conflict. */
  metadataConflictPolicy?: GrpcAuthMetadataConflictPolicy;
  /** When type is `inherit`, references a GlobalAuthProfile id from Environment Manager. */
  globalProfileId?: string;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  oauth2?: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
  };
}

/** Phase 4J-D — per-call compression via grpc-encoding metadata. */
export type GrpcCompressionAlgorithm = 'identity' | 'gzip' | 'deflate';

export interface GrpcCompressionConfig {
  enabled: boolean;
  algorithm: GrpcCompressionAlgorithm;
}

export interface GrpcDescriptorSourceFingerprint {
  source: GrpcDescriptorSource;
  /** Source-specific identity (normalized target, proto bundle hash, BSR module@digest, URL+etag, etc.). */
  sourceRef: string;
  /** sha256 short hash of normalized descriptor content — matches `GrpcDescriptor.contentSha256`. */
  contentSha256: string;
  resolvedAt?: string;
  reflectionVersion?: 'v1' | 'v1alpha';
  etag?: string;
  bsrModule?: string;
  bsrDigest?: string;
}

export interface GrpcDescriptorSourceSelection {
  mode: GrpcDescriptorSelectionMode;
  /** Required when `mode` is `manual`. */
  activeSource?: GrpcDescriptorSource;
  /** Auto-mode precedence; defaults to reflection → proto_files → protoset → bsr → url_proto. */
  autoPrecedence?: GrpcDescriptorSource[];
}

export interface GrpcEnumSchema {
  typeName: string;
  values: Array<{ name: string; number: number; docComment?: string }>;
  docComment?: string;
}

export interface GrpcDescriptor {
  source: GrpcDescriptorSource;
  key: string;
  sourceRef?: string;
  contentSha256?: string;
  sourceFingerprint?: GrpcDescriptorSourceFingerprint;
  reflectionVersion?: 'v1' | 'v1alpha';
  services: GrpcServiceInfo[];
  /** All message types in the loaded descriptor set (Phase 3G schema browser). */
  messageTypes?: GrpcMessageSchema[];
  /** All enum types in the loaded descriptor set (Phase 3G schema browser). */
  enumTypes?: GrpcEnumSchema[];
}

export interface GrpcServiceInfo {
  fullName: string;
  methods: GrpcMethodInfo[];
}

export interface GrpcMethodInfo {
  name: string;
  callType: GrpcCallType;
  requestTypeName: string;
  responseTypeName: string;
  requestSchema: GrpcMessageSchema;
  responseSchema: GrpcMessageSchema;
  docComment?: string;
}

export interface GrpcMessageSchema {
  typeName: string;
  fields: GrpcFieldSchema[];
  docComment?: string;
}

export interface GrpcFieldSchema {
  name: string;
  number: number;
  type: GrpcFieldType;
  label: 'optional' | 'repeated' | 'required';
  messageTypeName?: string;
  enumTypeName?: string;
  enumValues?: { name: string; number: number }[];
  docComment?: string;
  isOneofMember?: boolean;
  oneofName?: string;
  /** Proto3 map field — JSON encoding is a string-keyed object. */
  isMap?: boolean;
  mapKeyType?: GrpcFieldType;
}

export type GrpcFieldType =
  | 'bool'
  | 'bytes'
  | 'string'
  | 'int32'
  | 'int64'
  | 'uint32'
  | 'uint64'
  | 'sint32'
  | 'sint64'
  | 'fixed32'
  | 'fixed64'
  | 'sfixed32'
  | 'sfixed64'
  | 'float'
  | 'double'
  | 'enum'
  | 'message'
  | 'google.protobuf.Timestamp'
  | 'google.protobuf.Duration'
  | 'google.protobuf.Any'
  | 'google.protobuf.Struct'
  | 'google.protobuf.Value'
  | 'google.protobuf.BoolValue'
  | 'google.protobuf.StringValue'
  | 'google.protobuf.Int32Value'
  | 'google.protobuf.Int64Value';

export interface GrpcCallRequest {
  callType: GrpcCallType;
  requestId: string;
  target: GrpcTarget;
  service: string;
  method: string;
  body: Record<string, unknown>;
  metadata?: Record<string, string>;
  auth?: GrpcAuthConfig;
  timeoutMs?: number;
  descriptorKey: string;
}

/** Phase 9C — frozen env context bound at execute click (re-exported shape). */
export type { GrpcInterpolationEnvSnapshot } from './grpcInterpolationEnvSnapshot';

/** Immutable snapshot captured when Execute is clicked (tab-scoped). Phase 4A export/redaction contract. */
export interface GrpcTabExecuteSnapshot {
  tabId: string;
  requestId: string;
  capturedAt: string;
  callType: GrpcCallType;
  target: GrpcTarget;
  service: string;
  method: string;
  body: Record<string, unknown>;
  metadata: Record<string, string>;
  timeoutMs: number;
  /** Phase 4J-D — frozen compression settings at execute click. */
  compression?: GrpcCompressionConfig;
  descriptorKey: string;
  /** Phase 3A — prevents mixed-cache execution when descriptor refresh changes underneath. */
  sourceFingerprint?: GrpcDescriptorSourceFingerprint;
  auth?: GrpcAuthConfig;
  /** Phase 9C — immutable env map used when this snapshot was captured. */
  interpolationEnv?: import('./grpcInterpolationEnvSnapshot').GrpcInterpolationEnvSnapshot;
  /** Phase 10A — frozen transport mode at execute click (immutable for in-flight calls). */
  transportMode?: import('./grpcWebTransportContracts').GrpcStudioTransportMode;
  /** Phase 10A — schema version for transport snapshot fields. */
  transportSchemaVersion?: import('./grpcWebTransportContracts').GrpcWebTransportSchemaVersion;
}

/** Phase 1 — RPC timing breakdown (mockup 01 Timing tab). All fields optional for partial transports. */
export interface GrpcCallTimingBreakdown {
  dnsLookupMs?: number;
  tcpConnectTlsMs?: number;
  http2HandshakeMs?: number;
  protoSerializationMs?: number;
  serverProcessingMs?: number;
  responseDeserializationMs?: number;
}

/** Phase 1 — explicit Connect/Disconnect probe session (per-tab, not a persistent channel). */
export type GrpcTargetConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export interface GrpcTargetConnectionSession {
  state: GrpcTargetConnectionState;
  latencyMs?: number;
  errorMessage?: string;
  checkedAt?: string;
}

export interface GrpcCallResult {
  callType: GrpcCallType;
  status: number;
  statusMessage: string;
  headers: Record<string, string>;
  trailers: Record<string, string>;
  body?: Record<string, unknown>;
  messages?: Record<string, unknown>[];
  durationMs: number;
  timingBreakdown?: GrpcCallTimingBreakdown;
  errorDetail?: string;
  /** Phase 7F / 10A — which transport executed the call. */
  transportUsed?: import('./grpcWebTransportContracts').GrpcStudioTransportMode;
  /** Phase 7F — when retried via express after native pre-start failure. */
  fallbackReason?: string;
}

export interface GrpcStatusRequest {
  address: string;
  tlsMode?: GrpcTlsMode;
  timeoutMs?: number;
}

export interface GrpcStatusResult {
  reachable: boolean;
  address: string;
  tlsMode: GrpcTlsMode;
  latencyMs?: number;
  reflectionSupported?: boolean;
  errorMessage?: string;
}

export interface GrpcReflectRequest {
  requestId?: string;
  target: GrpcTarget;
  timeoutMs?: number;
  serviceNames?: string[];
}

/** Response body for POST /api/grpc/reflect and POST /api/grpc/describe. */
export type GrpcReflectResult = GrpcDescriptor;
export type GrpcDescribeResult = GrpcDescriptor;

export interface GrpcExportProtosetRequest {
  requestId?: string;
  descriptorKey: string;
}

export interface GrpcExportProtosetResult {
  protosetBase64: string;
  fileName: string;
}

/** Request body for POST /api/grpc/descriptor/lookup (Phase 11N workflow schema diff). */
export interface GrpcDescriptorLookupRequest {
  requestId?: string;
  descriptorKey: string;
}

/** Response body for POST /api/grpc/descriptor/lookup. */
export type GrpcDescriptorLookupResult = GrpcDescriptor;

export interface GrpcDescribeRequest {
  requestId?: string;
  source: 'proto_files' | 'protoset' | 'bsr' | 'url_proto';
  /** Proto ingest payload grouped by virtual root. */
  protoRoots?: GrpcProtoRootInput[];
  protosetBase64?: string;
  importPaths?: string[];
  /** BSR module reference (Phase 3E fetch — contract frozen in 3A). */
  bsrModule?: string;
  bsrVersion?: string;
  bsrDigest?: string;
  /** Optional BSR API token for private modules (server-side only). */
  bsrToken?: string;
  /** HTTPS URL to a `.proto` file (Phase 3E fetch — contract frozen in 3A). */
  url?: string;
}

export interface GrpcProtoFileInput {
  path: string;
  content: string;
  sizeBytes?: number;
}

export interface GrpcProtoRootInput {
  id: string;
  mountPath: string;
  files: GrpcProtoFileInput[];
}

export interface GrpcCancelCallResult {
  requestId: string;
  cancelled: boolean;
  alreadyCompleted?: boolean;
}

/** DELETE /api/grpc/call/:requestId — optional tabId query for ownership checks (Phase 1B). */
export interface GrpcCancelCallParams {
  requestId: string;
  tabId?: string;
}

/** POST /api/grpc/stream/start?tabId=… — tabId is query-only; body matches GrpcCallRequest with streaming callType. */
export type GrpcStreamStartRequest = Omit<GrpcCallRequest, 'callType'> & {
  callType: GrpcStreamingCallType;
};

export interface GrpcStreamStartResponse {
  streamId: string;
  requestId: string;
  tabId: string;
}

export interface GrpcStreamSendRequest {
  body: Record<string, unknown>;
}

export type GrpcStreamEventType =
  | 'grpc-message'
  | 'grpc-end'
  | 'grpc-error'
  | 'grpc-heartbeat';

export type GrpcStreamMessageDirection = 'inbound' | 'outbound';

export interface GrpcStreamEvent {
  type: GrpcStreamEventType;
  streamId: string;
  requestId: string;
  tabId: string;
  sequence: number;
  timestamp: string;
  direction?: GrpcStreamMessageDirection;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  trailers?: Record<string, string>;
  status?: number;
  statusMessage?: string;
}

/** One row in the tab stream message log (Phase 2A). */
export interface GrpcStreamLogEntry {
  sequence: number;
  timestamp: string;
  direction: GrpcStreamMessageDirection;
  data: Record<string, unknown>;
}

export type GrpcStreamRegistryStatus = 'active' | 'ended' | 'cancelled' | 'error';

export interface GrpcStreamCancelResult {
  streamId: string;
  requestId: string;
  tabId: string;
  cancelled: boolean;
  alreadyEnded?: boolean;
}

export interface GrpcStreamEndResult {
  streamId: string;
  requestId: string;
  tabId: string;
  ended: boolean;
  alreadyEnded?: boolean;
}

/** Stream route query params — tabId required on all stream control routes. */
export interface GrpcStreamRouteParams {
  streamId: string;
  tabId: string;
  lastSequence?: number;
}

/** Persisted tab identity — full runtime state lives in grpcStudioTypes.ts. */
export interface GrpcStudioTab {
  id: string;
  title: string;
  target?: string;
  connectionId?: string;
  service?: string;
  method?: string;
}

export interface GrpcErrorBody {
  code: GrpcErrorCode | string;
  category: GrpcErrorCategory;
  message: string;
  retryable?: boolean;
  details?: unknown;
}

export interface GrpcEnvelopeMeta {
  requestId?: string;
  durationMs?: number;
  timestamp: string;
}

export interface GrpcSuccessEnvelope<TData> {
  ok: true;
  op: GrpcOperation;
  data: TData;
  meta: GrpcEnvelopeMeta;
}

export interface GrpcErrorEnvelope {
  ok: false;
  op: GrpcOperation;
  error: GrpcErrorBody;
  meta: GrpcEnvelopeMeta;
}

export type GrpcRouteEnvelope<TData> = GrpcSuccessEnvelope<TData> | GrpcErrorEnvelope;

const ERROR_CODE_HTTP_STATUS: Record<string, number> = {
  [GRPC_ERROR_CODES.INVALID_REQUEST]: 400,
  [GRPC_ERROR_CODES.INVALID_TARGET]: 400,
  [GRPC_ERROR_CODES.INVALID_DESCRIPTOR]: 400,
  [GRPC_ERROR_CODES.MISSING_DESCRIPTOR_KEY]: 400,
  [GRPC_ERROR_CODES.UNREACHABLE]: 503,
  [GRPC_ERROR_CODES.REFLECTION_FAILED]: 502,
  [GRPC_ERROR_CODES.DESCRIBE_FAILED]: 422,
  [GRPC_ERROR_CODES.CALL_FAILED]: 500,
  [GRPC_ERROR_CODES.CANCELLED]: 409,
  [GRPC_ERROR_CODES.REQUEST_NOT_FOUND]: 404,
  [GRPC_ERROR_CODES.SOURCE_UNAVAILABLE]: 503,
  [GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED]: 422,
  [GRPC_ERROR_CODES.SCHEMA_DRIFT]: 409,
  [GRPC_ERROR_CODES.CACHE_STALE]: 409,
};

const ERROR_CODE_CATEGORY: Record<GrpcErrorCode, GrpcErrorCategory> = {
  [GRPC_ERROR_CODES.INVALID_REQUEST]: 'validation',
  [GRPC_ERROR_CODES.INVALID_TARGET]: 'validation',
  [GRPC_ERROR_CODES.INVALID_DESCRIPTOR]: 'validation',
  [GRPC_ERROR_CODES.MISSING_DESCRIPTOR_KEY]: 'validation',
  [GRPC_ERROR_CODES.UNREACHABLE]: 'unreachable',
  [GRPC_ERROR_CODES.REFLECTION_FAILED]: 'reflection_failed',
  [GRPC_ERROR_CODES.DESCRIBE_FAILED]: 'describe_failed',
  [GRPC_ERROR_CODES.CALL_FAILED]: 'call_failed',
  [GRPC_ERROR_CODES.CANCELLED]: 'cancelled',
  [GRPC_ERROR_CODES.REQUEST_NOT_FOUND]: 'not_found',
  [GRPC_ERROR_CODES.SOURCE_UNAVAILABLE]: 'source_unavailable',
  [GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED]: 'import_resolution_failed',
  [GRPC_ERROR_CODES.SCHEMA_DRIFT]: 'schema_drift',
  [GRPC_ERROR_CODES.CACHE_STALE]: 'cache_stale',
};

export function grpcErrorCategoryForCode(code: string): GrpcErrorCategory {
  if (code in ERROR_CODE_CATEGORY) {
    return ERROR_CODE_CATEGORY[code as GrpcErrorCode];
  }
  if (code.startsWith('GRPC_INVALID_')) return 'validation';
  if (code.includes('REFLECTION')) return 'reflection_failed';
  if (code.includes('DESCRIBE')) return 'describe_failed';
  if (code.includes('UNREACHABLE')) return 'unreachable';
  if (code.includes('NOT_FOUND')) return 'not_found';
  if (code.includes('SOURCE_UNAVAILABLE')) return 'source_unavailable';
  if (code.includes('IMPORT_RESOLUTION')) return 'import_resolution_failed';
  if (code.includes('SCHEMA_DRIFT')) return 'schema_drift';
  if (code.includes('CACHE_STALE')) return 'cache_stale';
  if (code.includes('CANCEL')) return 'cancelled';
  return 'call_failed';
}

const STREAM_TAB_OWNERSHIP_OPS = new Set<GrpcOperation>([
  'stream_start',
  'stream_events',
  'stream_send',
  'stream_end',
  'stream_cancel',
]);

const STREAM_CONFLICT_OPS = new Set<GrpcOperation>([
  'stream_start',
  'stream_send',
  'stream_end',
]);

function isStreamConflictError(error: GrpcErrorBody, op?: GrpcOperation): boolean {
  if (!op || !STREAM_CONFLICT_OPS.has(op)) return false;
  if (error.code !== GRPC_ERROR_CODES.INVALID_REQUEST) return false;
  const message = error.message.toLowerCase();
  return message.includes('already in use')
    || message.includes('not valid for server-streaming')
    || message.includes('server-streaming rpcs')
    || message.includes('not valid after client stream eof');
}

export function mapGrpcErrorCodeToHttpStatus(error: GrpcErrorBody, op?: GrpcOperation): number {
  if (isStreamConflictError(error, op)) {
    return 409;
  }
  if (
    (op === 'cancel' || (op && STREAM_TAB_OWNERSHIP_OPS.has(op)))
    && error.code === GRPC_ERROR_CODES.INVALID_REQUEST
    && error.message.includes('tabId')
  ) {
    return 409;
  }
  return ERROR_CODE_HTTP_STATUS[error.code] ?? 500;
}

export function createGrpcSuccessEnvelope<TData>(
  op: GrpcOperation,
  data: TData,
  meta?: Partial<GrpcEnvelopeMeta>,
): GrpcSuccessEnvelope<TData> {
  return {
    ok: true,
    op,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

export function createGrpcErrorEnvelope(
  op: GrpcOperation,
  error: Omit<GrpcErrorBody, 'category'> & { category?: GrpcErrorCategory },
  meta?: Partial<GrpcEnvelopeMeta>,
): GrpcErrorEnvelope {
  const category = error.category ?? grpcErrorCategoryForCode(error.code);
  return {
    ok: false,
    op,
    error: {
      ...error,
      category,
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/** Unary-only guard for `POST /api/grpc/call` — streaming uses `/api/grpc/stream/*`. */
export function isPhase1UnaryCallRequest(
  request: Pick<GrpcCallRequest, 'callType'>,
): request is GrpcCallRequest & { callType: 'unary' } {
  return request.callType === 'unary';
}

export function isStreamingCallType(callType: GrpcCallType): callType is GrpcStreamingCallType {
  return callType === 'server_streaming'
    || callType === 'client_streaming'
    || callType === 'bidi_streaming';
}

/** Phase 2 stream start guard. */
export function isPhase2StreamStartRequest(
  request: Pick<GrpcCallRequest, 'callType'>,
): request is GrpcStreamStartRequest {
  return isStreamingCallType(request.callType);
}

/**
 * Normalize gRPC metadata keys to lowercase (Phase 1 contract).
 * Empty keys are dropped. Values are preserved as-is (*-bin values expected base64).
 */
export function normalizeGrpcMetadata(
  metadata: Record<string, string> | undefined,
): Record<string, string> {
  if (!metadata) return {};
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) continue;
    normalized[normalizedKey] = value;
  }
  return normalized;
}

/** Build GET /api/grpc/status query contract from a GrpcTarget. */
export function grpcTargetToStatusRequest(
  target: GrpcTarget,
  timeoutMs: number = GRPC_DEFAULT_PROBE_TIMEOUT_MS,
): GrpcStatusRequest {
  const check = validateResolvedGrpcTargetAddress(target.address);
  return {
    address: check.valid ? check.normalized : target.address,
    tlsMode: target.tlsMode,
    timeoutMs,
  };
}

/** Default tlsMode when omitted on status probes. */
export function defaultGrpcTlsMode(): GrpcTlsMode {
  return 'disabled';
}
