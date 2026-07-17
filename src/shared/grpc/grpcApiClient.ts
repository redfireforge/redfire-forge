/**
 * gRPC Studio — renderer HTTP client for src-server grpc routes (Phase 1E+).
 */
import { httpFetch } from '../utils/httpClient';
import {
  type GrpcCallRequest,
  type GrpcCallResult,
  type GrpcCancelCallResult,
  type GrpcDescribeRequest,
  type GrpcDescriptor,
  type GrpcDescriptorLookupRequest,
  type GrpcErrorBody,
  type GrpcExportProtosetRequest,
  type GrpcExportProtosetResult,
  type GrpcOperation,
  type GrpcReflectRequest,
  type GrpcRouteEnvelope,
  type GrpcStatusRequest,
  type GrpcStatusResult,
  type GrpcSuccessEnvelope,
  grpcErrorCategoryForCode,
} from './contracts';

export class GrpcApiClientError extends Error {
  readonly code: string;
  readonly op: GrpcOperation;
  readonly retryable: boolean;
  readonly category?: GrpcErrorBody['category'];
  readonly details?: GrpcErrorBody['details'];

  constructor(
    op: GrpcOperation,
    message: string,
    options?: {
      code?: string;
      retryable?: boolean;
      category?: GrpcErrorBody['category'];
      details?: GrpcErrorBody['details'];
    },
  ) {
    super(message);
    this.name = 'GrpcApiClientError';
    this.op = op;
    this.code = options?.code ?? 'GRPC_CLIENT_ERROR';
    this.retryable = options?.retryable ?? false;
    this.category = options?.category;
    this.details = options?.details;
  }

  toErrorBody(): GrpcErrorBody {
    return {
      code: this.code,
      category: this.category ?? grpcErrorCategoryForCode(this.code),
      message: this.message,
      retryable: this.retryable,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export type GrpcClientTransport = (
  op: GrpcOperation,
  path: string,
  init: RequestInit,
) => Promise<GrpcRouteEnvelope<unknown>>;

let transportOverride: GrpcClientTransport | null = null;

export function setGrpcClientTransport(transport: GrpcClientTransport | null): void {
  transportOverride = transport;
}

function throwIfNotOk<T>(op: GrpcOperation, envelope: GrpcRouteEnvelope<T>): asserts envelope is GrpcSuccessEnvelope<T> {
  if (!envelope.ok) {
    const code = envelope.error.code?.trim() || 'GRPC_CLIENT_ERROR';
    const message = envelope.error.message?.trim() || `gRPC ${op} failed (${code})`;
    throw new GrpcApiClientError(op, message, {
      code,
      retryable: envelope.error.retryable ?? false,
      category: envelope.error.category,
      details: envelope.error.details,
    });
  }
}

async function parseEnvelope<T>(op: GrpcOperation, response: { body: string; error?: string; status: number }): Promise<GrpcSuccessEnvelope<T>> {
  if (response.error) {
    throw new GrpcApiClientError(op, response.error, { code: 'GRPC_NETWORK_ERROR', retryable: true });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new GrpcApiClientError(op, `gRPC ${op} returned non-JSON response`, {
      code: 'GRPC_INVALID_ENVELOPE',
      retryable: false,
    });
  }

  if (typeof parsed !== 'object' || parsed === null || !('ok' in parsed) || !('op' in parsed)) {
    throw new GrpcApiClientError(op, `gRPC ${op} returned invalid envelope`, {
      code: 'GRPC_INVALID_ENVELOPE',
      retryable: false,
    });
  }

  const envelope = parsed as GrpcRouteEnvelope<T>;
  if (envelope.op !== op) {
    throw new GrpcApiClientError(op, `gRPC ${op} returned mismatched operation envelope (${envelope.op})`, {
      code: 'GRPC_MISMATCHED_ENVELOPE',
      retryable: false,
    });
  }

  throwIfNotOk(op, envelope);
  return envelope;
}

async function dispatch<T>(
  op: GrpcOperation,
  path: string,
  init: RequestInit,
): Promise<GrpcSuccessEnvelope<T>> {
  if (transportOverride) {
    const envelope = await transportOverride(op, path, init);
    throwIfNotOk(op, envelope as GrpcRouteEnvelope<T>);
    return envelope as GrpcSuccessEnvelope<T>;
  }

  const method = init.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  let bodyText: string | undefined;

  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    bodyText = typeof init.body === 'string' ? init.body : undefined;
  }

  const response = await httpFetch(path, method, headers, bodyText);
  return parseEnvelope<T>(op, response);
}

export async function postGrpcReflect(
  request: GrpcReflectRequest,
): Promise<GrpcSuccessEnvelope<GrpcDescriptor>> {
  return dispatch('reflect', '/api/grpc/reflect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function postGrpcDescribe(
  request: GrpcDescribeRequest,
): Promise<GrpcSuccessEnvelope<GrpcDescriptor>> {
  return dispatch('describe', '/api/grpc/describe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function postGrpcExportProtoset(
  request: GrpcExportProtosetRequest,
): Promise<GrpcSuccessEnvelope<GrpcExportProtosetResult>> {
  return dispatch('export_protoset', '/api/grpc/export-protoset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function postGrpcDescriptorLookup(
  request: GrpcDescriptorLookupRequest,
): Promise<GrpcSuccessEnvelope<GrpcDescriptor>> {
  return dispatch('lookup_descriptor', '/api/grpc/descriptor/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function getGrpcStatus(
  request: GrpcStatusRequest,
): Promise<GrpcSuccessEnvelope<GrpcStatusResult>> {
  const params = new URLSearchParams();
  params.set('address', request.address);
  if (request.tlsMode) params.set('tlsMode', request.tlsMode);
  if (request.timeoutMs != null) params.set('timeoutMs', String(request.timeoutMs));

  return dispatch('status', `/api/grpc/status?${params.toString()}`, {
    method: 'GET',
  });
}

export async function postGrpcCall(
  request: GrpcCallRequest,
  tabId?: string,
): Promise<GrpcSuccessEnvelope<GrpcCallResult>> {
  const params = new URLSearchParams();
  if (tabId) params.set('tabId', tabId);

  const query = params.toString();
  const path = query ? `/api/grpc/call?${query}` : '/api/grpc/call';

  return dispatch('call', path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function deleteGrpcCall(
  requestId: string,
  tabId?: string,
): Promise<GrpcSuccessEnvelope<GrpcCancelCallResult>> {
  const params = new URLSearchParams();
  if (tabId) params.set('tabId', tabId);

  const query = params.toString();
  const path = query
    ? `/api/grpc/call/${encodeURIComponent(requestId)}?${query}`
    : `/api/grpc/call/${encodeURIComponent(requestId)}`;

  return dispatch('cancel', path, {
    method: 'DELETE',
  });
}

export interface GrpcK8sPortForwardApiConfig {
  namespace: string;
  targetType: 'service' | 'pod' | 'deployment';
  name: string;
  remotePort: number;
  localPort: number;
  context: string;
}

export interface GrpcK8sPortForwardApiState {
  scopeId: string;
  active: boolean;
  pid?: number;
  command?: string;
  target?: string;
  startedAt?: string;
  lastError?: string;
  config?: GrpcK8sPortForwardApiConfig;
}

export interface GrpcK8sPortForwardApiLogLine {
  seq: number;
  ts: string;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
}

export interface GrpcK8sPortForwardApiLogs {
  scopeId: string;
  lines: GrpcK8sPortForwardApiLogLine[];
  latestSeq: number;
}

export interface GrpcK8sPortForwardApiLogClear {
  scopeId: string;
  latestSeq: number;
}

interface GrpcK8sPortForwardResponse {
  ok: boolean;
  data?: GrpcK8sPortForwardApiState;
  error?: string;
}

interface GrpcK8sPortForwardLogsResponse {
  ok: boolean;
  data?: GrpcK8sPortForwardApiLogs;
  error?: string;
}

interface GrpcK8sPortForwardLogClearResponse {
  ok: boolean;
  data?: GrpcK8sPortForwardApiLogClear;
  error?: string;
}

async function requestGrpcK8sPortForward(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
): Promise<GrpcK8sPortForwardApiState> {
  const response = await httpFetch(
    path,
    method,
    {
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  );

  if (response.error) {
    throw new GrpcApiClientError('status', response.error, {
      code: 'GRPC_NETWORK_ERROR',
      retryable: true,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new GrpcApiClientError('status', 'gRPC K8s automation returned non-JSON response', {
      code: 'GRPC_INVALID_ENVELOPE',
      retryable: false,
    });
  }

  const payload = parsed as GrpcK8sPortForwardResponse;
  if (!payload || typeof payload !== 'object' || typeof payload.ok !== 'boolean') {
    throw new GrpcApiClientError('status', 'gRPC K8s automation returned invalid response', {
      code: 'GRPC_INVALID_ENVELOPE',
      retryable: false,
    });
  }

  if (!payload.ok || !payload.data) {
    throw new GrpcApiClientError('status', payload.error ?? 'gRPC K8s automation request failed', {
      code: 'GRPC_K8S_AUTOMATION_FAILED',
      retryable: false,
    });
  }

  return payload.data;
}

export async function getGrpcK8sPortForwardStatus(
  scopeId: string,
): Promise<GrpcK8sPortForwardApiState> {
  const params = new URLSearchParams({ scopeId });
  return requestGrpcK8sPortForward(`/api/grpc/k8s-port-forward/status?${params.toString()}`, 'GET');
}

export async function postGrpcK8sPortForwardStart(
  scopeId: string,
  config: GrpcK8sPortForwardApiConfig,
): Promise<GrpcK8sPortForwardApiState> {
  return requestGrpcK8sPortForward('/api/grpc/k8s-port-forward/start', 'POST', {
    scopeId,
    config,
  });
}

export async function postGrpcK8sPortForwardStop(
  scopeId: string,
): Promise<GrpcK8sPortForwardApiState> {
  return requestGrpcK8sPortForward('/api/grpc/k8s-port-forward/stop', 'POST', {
    scopeId,
  });
}

export async function getGrpcK8sPortForwardLogs(
  scopeId: string,
  afterSeq?: number,
): Promise<GrpcK8sPortForwardApiLogs> {
  const params = new URLSearchParams({ scopeId });
  if (afterSeq != null && Number.isFinite(afterSeq)) {
    params.set('afterSeq', String(afterSeq));
  }
  const response = await httpFetch(
    `/api/grpc/k8s-port-forward/logs?${params.toString()}`,
    'GET',
    { Accept: 'application/json' },
  );

  if (response.error) {
    throw new GrpcApiClientError('status', response.error, {
      code: 'GRPC_NETWORK_ERROR',
      retryable: true,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new GrpcApiClientError('status', 'gRPC K8s logs returned non-JSON response', {
      code: 'GRPC_INVALID_ENVELOPE',
      retryable: false,
    });
  }

  const payload = parsed as GrpcK8sPortForwardLogsResponse;
  if (!payload || typeof payload !== 'object' || typeof payload.ok !== 'boolean') {
    throw new GrpcApiClientError('status', 'gRPC K8s logs returned invalid response', {
      code: 'GRPC_INVALID_ENVELOPE',
      retryable: false,
    });
  }

  if (!payload.ok || !payload.data) {
    throw new GrpcApiClientError('status', payload.error ?? 'gRPC K8s logs request failed', {
      code: 'GRPC_K8S_AUTOMATION_FAILED',
      retryable: false,
    });
  }

  return payload.data;
}

export async function postGrpcK8sPortForwardClearLogs(
  scopeId: string,
): Promise<GrpcK8sPortForwardApiLogClear> {
  const response = await httpFetch(
    '/api/grpc/k8s-port-forward/logs/clear',
    'POST',
    {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    JSON.stringify({ scopeId }),
  );

  if (response.error) {
    throw new GrpcApiClientError('status', response.error, {
      code: 'GRPC_NETWORK_ERROR',
      retryable: true,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new GrpcApiClientError('status', 'gRPC K8s log clear returned non-JSON response', {
      code: 'GRPC_INVALID_ENVELOPE',
      retryable: false,
    });
  }

  const payload = parsed as GrpcK8sPortForwardLogClearResponse;
  if (!payload || typeof payload !== 'object' || typeof payload.ok !== 'boolean') {
    throw new GrpcApiClientError('status', 'gRPC K8s log clear returned invalid response', {
      code: 'GRPC_INVALID_ENVELOPE',
      retryable: false,
    });
  }

  if (!payload.ok || !payload.data) {
    throw new GrpcApiClientError('status', payload.error ?? 'gRPC K8s log clear failed', {
      code: 'GRPC_K8S_AUTOMATION_FAILED',
      retryable: false,
    });
  }

  return payload.data;
}
