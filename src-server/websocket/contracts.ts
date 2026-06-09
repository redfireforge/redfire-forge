export type WsProxyOperation =
  | 'connect'
  | 'disconnect'
  | 'send'
  | 'ping'
  | 'messages'
  | 'status';

// ── TLS Configuration ────────────────────────────────────────────────────────

export interface WsTlsConfig {
  rejectUnauthorized?: boolean;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
}

// ── Request types ─────────────────────────────────────────────────────────────

export interface WsProxyConnectRequest {
  url: string;
  headers?: Record<string, string>;
  subprotocols?: string[];
  timeoutMs?: number;
  tls?: WsTlsConfig;
}

export interface WsProxyDisconnectRequest {
  connectionId: string;
  code?: number;
  reason?: string;
}

export interface WsProxySendRequest {
  connectionId: string;
  data: string;
  type?: 'text' | 'binary';
}

export interface WsProxyPingRequest {
  connectionId: string;
  data?: string;
}

export interface WsProxyMessagesRequest {
  connectionId: string;
  sinceCursor?: number;
}

export interface WsProxyStatusRequest {
  connectionId: string;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface WsProxyConnectResult {
  connectionId: string;
  protocol: string;
  extensions: string;
  latencyMs: number;
}

export interface WsProxyDisconnectResult {
  connectionId: string;
  disconnected: boolean;
}

export interface WsProxySendResult {
  connectionId: string;
  sentAt: string;
}

export interface WsProxyPingResult {
  connectionId: string;
  sentAt: string;
}

export interface WsProxyMessageRecord {
  data: string;
  type: 'text' | 'binary';
  receivedAt: string;
  size: number;
}

export interface WsProxyMessagesResult {
  connectionId: string;
  messages: WsProxyMessageRecord[];
  cursor: number;
  bufferSize: number;
}

export interface WsProxyStatusResult {
  connectionId: string;
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  url: string;
  connectedAt?: string;
  closedAt?: string;
  closeCode?: number;
  closeReason?: string;
  lastError?: string;
  protocol?: string;
  extensions?: string;
  sentCount: number;
  receivedCount: number;
  uptimeMs?: number;
}

// ── Envelope types ────────────────────────────────────────────────────────────

export interface WsEnvelopeMeta {
  requestId?: string;
  durationMs?: number;
  timestamp: string;
}

export interface WsSuccessEnvelope<TData> {
  ok: true;
  op: WsProxyOperation;
  data: TData;
  meta: WsEnvelopeMeta;
}

export interface WsErrorBody {
  code: string;
  message: string;
  retryable?: boolean;
  details?: unknown;
}

export interface WsErrorEnvelope {
  ok: false;
  op: WsProxyOperation;
  error: WsErrorBody;
  meta: WsEnvelopeMeta;
}

export type WsRouteEnvelope<TData> = WsSuccessEnvelope<TData> | WsErrorEnvelope;

export function createWsSuccessEnvelope<TData>(
  op: WsProxyOperation,
  data: TData,
  meta?: Partial<WsEnvelopeMeta>,
): WsSuccessEnvelope<TData> {
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

export function createWsErrorEnvelope(
  op: WsProxyOperation,
  error: WsErrorBody,
  meta?: Partial<WsEnvelopeMeta>,
): WsErrorEnvelope {
  return {
    ok: false,
    op,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}
