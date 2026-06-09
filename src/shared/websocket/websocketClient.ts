import { httpFetch, type HttpResponse } from '../utils/httpClient';

export type WsProxyOperation = 'connect' | 'disconnect' | 'send' | 'ping' | 'messages' | 'status';

type WsMethod = 'GET' | 'POST';

interface WsOperationSpec {
  method: WsMethod;
  path: string;
  queryKeys?: string[];
}

export interface WsDispatchRequest {
  op: WsProxyOperation;
  method: WsMethod;
  path: string;
  query: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface WsEnvelope<T = unknown> {
  ok: boolean;
  op: WsProxyOperation | string;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
  meta?: {
    timestamp?: string;
    durationMs?: number;
  };
}

export class WsClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly operation: WsProxyOperation;

  constructor(
    operation: WsProxyOperation,
    message: string,
    options?: { code?: string; retryable?: boolean },
  ) {
    super(message);
    this.name = 'WsClientError';
    this.operation = operation;
    this.code = options?.code ?? 'WS_CLIENT_ERROR';
    this.retryable = options?.retryable ?? true;
  }
}

export type WsClientTransport = (request: WsDispatchRequest) => Promise<WsEnvelope>;

/**
 * Throw a WsClientError if the envelope indicates a failure.
 * Shared by both the HTTP and Tauri transports.
 */
export function throwIfWsEnvelopeNotOk(op: WsProxyOperation, envelope: WsEnvelope): void {
  if (!envelope.ok) {
    const code = envelope.error?.code?.trim();
    const message = envelope.error?.message?.trim();
    const fallback = code ? `WebSocket ${op} failed (${code})` : `WebSocket ${op} failed`;
    throw new WsClientError(op, message && message.length > 0 ? message : fallback, {
      code: code && code.length > 0 ? code : 'WS_OPERATION_FAILED',
      retryable: envelope.error?.retryable ?? true,
    });
  }
}

const OPERATION_MAP: Record<WsProxyOperation, WsOperationSpec> = {
  connect: { method: 'POST', path: '/api/ws/connect' },
  disconnect: { method: 'POST', path: '/api/ws/disconnect' },
  send: { method: 'POST', path: '/api/ws/send' },
  ping: { method: 'POST', path: '/api/ws/ping' },
  messages: { method: 'GET', path: '/api/ws/messages', queryKeys: ['connectionId', 'sinceCursor'] },
  status: { method: 'GET', path: '/api/ws/status', queryKeys: ['connectionId'] },
};

let transportOverride: WsClientTransport | null = null;

export function setWsClientTransport(transport: WsClientTransport | null): void {
  transportOverride = transport;
}

function toQueryValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function buildQuery(
  request: Record<string, unknown> | undefined,
  keys: string[] | undefined,
): Record<string, string> {
  if (!request || !keys || keys.length === 0) return {};
  const query: Record<string, string> = {};
  for (const key of keys) {
    const value = toQueryValue(request[key]);
    if (value != null) query[key] = value;
  }
  return query;
}

function withQuery(path: string, query: Record<string, string>): string {
  const pairs = Object.entries(query);
  if (pairs.length === 0) return path;
  const params = new URLSearchParams();
  for (const [key, value] of pairs) params.set(key, value);
  return `${path}?${params.toString()}`;
}

function parseEnvelope(op: WsProxyOperation, response: HttpResponse): WsEnvelope {
  if (response.error) {
    throw new WsClientError(op, response.error, {
      code: 'WS_NETWORK_ERROR',
      retryable: true,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body || '{}');
  } catch {
    throw new WsClientError(op, `WebSocket ${op} returned non-JSON response`, {
      code: 'WS_INVALID_RESPONSE',
      retryable: false,
    });
  }

  if (typeof parsed !== 'object' || parsed === null || !('ok' in parsed) || !('op' in parsed)) {
    throw new WsClientError(op, `WebSocket ${op} returned invalid envelope`, {
      code: 'WS_INVALID_ENVELOPE',
      retryable: false,
    });
  }

  const envelope = parsed as WsEnvelope;
  throwIfWsEnvelopeNotOk(op, envelope);
  return envelope;
}

export async function defaultWsTransport(request: WsDispatchRequest): Promise<WsEnvelope> {
  const url = withQuery(request.path, request.query);
  const headers: Record<string, string> = { Accept: 'application/json' };
  let bodyText: string | undefined;

  if (request.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    bodyText = JSON.stringify(request.body ?? {});
  }

  const response = await httpFetch(url, request.method, headers, bodyText);
  return parseEnvelope(request.op, response);
}

export async function dispatchWsOperation<T = unknown>(
  op: WsProxyOperation,
  request?: Record<string, unknown>,
): Promise<WsEnvelope<T>> {
  const spec = OPERATION_MAP[op];
  const query = buildQuery(request, spec.queryKeys);

  const dispatchRequest: WsDispatchRequest = {
    op,
    method: spec.method,
    path: spec.path,
    query,
    body: spec.method === 'GET' ? undefined : request,
  };

  const transport = transportOverride ?? defaultWsTransport;
  return transport(dispatchRequest) as Promise<WsEnvelope<T>>;
}
