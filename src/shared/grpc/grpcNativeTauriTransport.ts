/**
 * Native Tauri transport for gRPC unary operations — Phase 7C.
 */
import {
  GRPC_TAURI_SCHEMA_VERSION,
  type GrpcTauriCallCancelRequest,
  type GrpcTauriCancelResult,
  type GrpcTauriDescriptorPayload,
  type GrpcTauriEnvelope,
  type GrpcTauriUnaryRequest,
  type GrpcTauriUnaryResult,
} from './grpcTauriContracts';
import type { GrpcCallRequest, GrpcCancelCallResult } from './contracts';

export class GrpcNativeTauriTransportError extends Error {
  readonly code: string;
  readonly op: 'unary' | 'call_cancel';
  readonly retryable: boolean;

  constructor(
    op: 'unary' | 'call_cancel',
    message: string,
    options?: { code?: string; retryable?: boolean },
  ) {
    super(message);
    this.name = 'GrpcNativeTauriTransportError';
    this.op = op;
    this.code = options?.code ?? 'GRPC_TAURI_INVOKE_ERROR';
    this.retryable = options?.retryable ?? false;
  }
}

function throwIfEnvelopeNotOk<T>(
  op: 'unary' | 'call_cancel',
  envelope: GrpcTauriEnvelope<T>,
): asserts envelope is Extract<GrpcTauriEnvelope<T>, { ok: true }> {
  if (!envelope.ok) {
    throw new GrpcNativeTauriTransportError(op, envelope.error.message, {
      code: envelope.error.code,
      retryable: envelope.error.retryable ?? false,
    });
  }
}

export function toGrpcTauriUnaryRequest(
  request: GrpcCallRequest,
  tabId: string,
  descriptor: GrpcTauriDescriptorPayload,
): GrpcTauriUnaryRequest {
  return {
    schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
    requestId: request.requestId,
    tabId,
    target: request.target,
    service: request.service,
    method: request.method,
    body: request.body,
    metadata: request.metadata,
    auth: request.auth,
    timeoutMs: request.timeoutMs,
    descriptor,
  };
}

export function toGrpcTauriCallCancelRequest(
  requestId: string,
  tabId: string,
): GrpcTauriCallCancelRequest {
  return {
    schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
    requestId,
    tabId,
  };
}

export function mapGrpcTauriUnaryResultToCallResult(
  result: GrpcTauriUnaryResult,
): {
  callType: 'unary';
  status: number;
  statusMessage: string;
  headers: Record<string, string>;
  trailers: Record<string, string>;
  body?: Record<string, unknown>;
  durationMs: number;
  errorDetail?: string;
  transportUsed?: 'tauri' | 'express';
} {
  return {
    callType: 'unary',
    status: result.status,
    statusMessage: result.statusMessage,
    headers: result.headers,
    trailers: result.trailers,
    body: result.body,
    durationMs: result.durationMs,
    errorDetail: result.errorDetail,
    transportUsed: result.transportUsed ?? 'tauri',
  };
}

export function mapGrpcTauriCancelResultToCallCancel(
  result: GrpcTauriCancelResult,
): GrpcCancelCallResult {
  return {
    requestId: result.requestId,
    cancelled: result.cancelled,
    alreadyCompleted: result.alreadyCompleted,
  };
}

export async function invokeGrpcUnaryNative(
  request: GrpcTauriUnaryRequest,
): Promise<GrpcTauriUnaryResult> {
  const { invoke } = await import('@tauri-apps/api/core');

  let envelope: GrpcTauriEnvelope<GrpcTauriUnaryResult>;
  try {
    envelope = await invoke<GrpcTauriEnvelope<GrpcTauriUnaryResult>>('grpc_unary', { request });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GrpcNativeTauriTransportError('unary', message, {
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  }

  throwIfEnvelopeNotOk('unary', envelope);
  return envelope.data;
}

export async function invokeGrpcCallCancelNative(
  request: GrpcTauriCallCancelRequest,
): Promise<GrpcTauriCancelResult> {
  const { invoke } = await import('@tauri-apps/api/core');

  let envelope: GrpcTauriEnvelope<GrpcTauriCancelResult>;
  try {
    envelope = await invoke<GrpcTauriEnvelope<GrpcTauriCancelResult>>('grpc_call_cancel', { request });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GrpcNativeTauriTransportError('call_cancel', message, {
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  }

  throwIfEnvelopeNotOk('call_cancel', envelope);
  return envelope.data;
}
