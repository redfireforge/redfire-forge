/**
 * Native Tauri diagnostics command wrapper — Post-GA P2-A.
 */
import {
  GRPC_TAURI_SCHEMA_VERSION,
  type GrpcTauriEnvelope,
  type GrpcTauriNativeDiagnosticsRequest,
  type GrpcTauriNativeDiagnosticsResult,
} from './grpcTauriContracts';

export class GrpcNativeTauriDiagnosticsError extends Error {
  readonly code: string;
  readonly op: 'native_diagnostics';
  readonly retryable: boolean;

  constructor(message: string, options?: { code?: string; retryable?: boolean }) {
    super(message);
    this.name = 'GrpcNativeTauriDiagnosticsError';
    this.op = 'native_diagnostics';
    this.code = options?.code ?? 'GRPC_TAURI_INVOKE_ERROR';
    this.retryable = options?.retryable ?? false;
  }
}

export function toGrpcTauriNativeDiagnosticsRequest(
  tabId?: string,
): GrpcTauriNativeDiagnosticsRequest {
  const request: GrpcTauriNativeDiagnosticsRequest = {
    schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
  };
  if (tabId?.trim()) {
    request.tabId = tabId.trim();
  }
  return request;
}

function throwIfEnvelopeNotOk<T>(
  envelope: GrpcTauriEnvelope<T>,
): asserts envelope is Extract<GrpcTauriEnvelope<T>, { ok: true }> {
  if (!envelope.ok) {
    throw new GrpcNativeTauriDiagnosticsError(envelope.error.message, {
      code: envelope.error.code,
      retryable: envelope.error.retryable ?? false,
    });
  }
}

export async function invokeGrpcNativeDiagnosticsNative(
  tabId?: string,
): Promise<GrpcTauriNativeDiagnosticsResult> {
  const { invoke } = await import('@tauri-apps/api/core');
  const request = toGrpcTauriNativeDiagnosticsRequest(tabId);

  let envelope: GrpcTauriEnvelope<GrpcTauriNativeDiagnosticsResult>;
  try {
    envelope = await invoke<GrpcTauriEnvelope<GrpcTauriNativeDiagnosticsResult>>(
      'grpc_native_diagnostics',
      { request },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GrpcNativeTauriDiagnosticsError(message, {
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  }

  throwIfEnvelopeNotOk(envelope);
  return envelope.data;
}
