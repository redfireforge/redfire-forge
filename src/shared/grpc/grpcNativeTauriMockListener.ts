/**
 * Native Tauri commands for gRPC mock network listener parity.
 */
import {
  GRPC_TAURI_SCHEMA_VERSION,
  type GrpcTauriEnvelope,
} from './grpcTauriContracts';
import type {
  GrpcMockListenerCommitRequest,
  GrpcMockListenerCommitResult,
  GrpcMockListenerLogsResult,
  GrpcMockListenerStartRequest,
  GrpcMockListenerStatus,
} from './grpcMockListenerContracts';

interface GrpcTauriMockListenerTabRequest {
  schemaVersion: number;
  tabId: string;
}

interface GrpcTauriMockListenerLogRequest extends GrpcTauriMockListenerTabRequest {
  since: number;
}

interface GrpcTauriMockListenerStartRequestNative extends GrpcMockListenerStartRequest {
  schemaVersion: number;
}

interface GrpcTauriMockListenerCommitRequestNative extends GrpcMockListenerCommitRequest {
  schemaVersion: number;
}

export class GrpcNativeTauriMockListenerError extends Error {
  readonly code: string;
  readonly op: 'mock_listener_start' | 'mock_listener_stop' | 'mock_listener_status' | 'mock_listener_commit' | 'mock_listener_log';
  readonly retryable: boolean;

  constructor(
    op: 'mock_listener_start' | 'mock_listener_stop' | 'mock_listener_status' | 'mock_listener_commit' | 'mock_listener_log',
    message: string,
    options?: { code?: string; retryable?: boolean },
  ) {
    super(message);
    this.name = 'GrpcNativeTauriMockListenerError';
    this.op = op;
    this.code = options?.code ?? 'GRPC_TAURI_INVOKE_ERROR';
    this.retryable = options?.retryable ?? false;
  }
}

function throwIfEnvelopeNotOk<T>(
  op: 'mock_listener_start' | 'mock_listener_stop' | 'mock_listener_status' | 'mock_listener_commit' | 'mock_listener_log',
  envelope: GrpcTauriEnvelope<T>,
): asserts envelope is Extract<GrpcTauriEnvelope<T>, { ok: true }> {
  if (!envelope.ok) {
    throw new GrpcNativeTauriMockListenerError(op, envelope.error.message, {
      code: envelope.error.code,
      retryable: envelope.error.retryable ?? false,
    });
  }
}

function toTabRequest(tabId: string): GrpcTauriMockListenerTabRequest {
  return {
    schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
    tabId,
  };
}

export function toGrpcTauriMockListenerStartRequest(
  request: GrpcMockListenerStartRequest,
): GrpcTauriMockListenerStartRequestNative {
  return {
    ...request,
    schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
  };
}

export function toGrpcTauriMockListenerCommitRequest(
  request: GrpcMockListenerCommitRequest,
): GrpcTauriMockListenerCommitRequestNative {
  return {
    ...request,
    schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
  };
}

async function invokeCommand<TRequest, TResult>(
  op: 'mock_listener_start' | 'mock_listener_stop' | 'mock_listener_status' | 'mock_listener_commit' | 'mock_listener_log',
  command:
    | 'grpc_mock_listener_start'
    | 'grpc_mock_listener_stop'
    | 'grpc_mock_listener_status'
    | 'grpc_mock_listener_commit'
    | 'grpc_mock_listener_log',
  request: TRequest,
): Promise<TResult> {
  const { invoke } = await import('@tauri-apps/api/core');

  let envelope: GrpcTauriEnvelope<TResult>;
  try {
    envelope = await invoke<GrpcTauriEnvelope<TResult>>(command, { request });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GrpcNativeTauriMockListenerError(op, message, {
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  }

  throwIfEnvelopeNotOk(op, envelope);
  return envelope.data;
}

export async function invokeGrpcMockListenerStartNative(
  request: GrpcMockListenerStartRequest,
): Promise<GrpcMockListenerStatus> {
  const result = await invokeCommand<GrpcTauriMockListenerStartRequestNative, { status: GrpcMockListenerStatus }>(
    'mock_listener_start',
    'grpc_mock_listener_start',
    toGrpcTauriMockListenerStartRequest(request),
  );
  return result.status;
}

export async function invokeGrpcMockListenerStopNative(tabId: string): Promise<GrpcMockListenerStatus> {
  return invokeCommand<GrpcTauriMockListenerTabRequest, GrpcMockListenerStatus>(
    'mock_listener_stop',
    'grpc_mock_listener_stop',
    toTabRequest(tabId),
  );
}

export async function invokeGrpcMockListenerStatusNative(tabId: string): Promise<GrpcMockListenerStatus> {
  return invokeCommand<GrpcTauriMockListenerTabRequest, GrpcMockListenerStatus>(
    'mock_listener_status',
    'grpc_mock_listener_status',
    toTabRequest(tabId),
  );
}

export async function invokeGrpcMockListenerCommitNative(
  request: GrpcMockListenerCommitRequest,
): Promise<GrpcMockListenerCommitResult> {
  return invokeCommand<GrpcTauriMockListenerCommitRequestNative, GrpcMockListenerCommitResult>(
    'mock_listener_commit',
    'grpc_mock_listener_commit',
    toGrpcTauriMockListenerCommitRequest(request),
  );
}

export async function invokeGrpcMockListenerLogNative(
  tabId: string,
  since: number,
): Promise<GrpcMockListenerLogsResult> {
  const request: GrpcTauriMockListenerLogRequest = {
    ...toTabRequest(tabId),
    since,
  };
  return invokeCommand<GrpcTauriMockListenerLogRequest, GrpcMockListenerLogsResult>(
    'mock_listener_log',
    'grpc_mock_listener_log',
    request,
  );
}
