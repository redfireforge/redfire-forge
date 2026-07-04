/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import {
  invokeGrpcNativeDiagnosticsNative,
  GrpcNativeTauriDiagnosticsError,
  toGrpcTauriNativeDiagnosticsRequest,
} from './grpcNativeTauriDiagnostics';
import { GRPC_TAURI_SCHEMA_VERSION } from './grpcTauriContracts';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe('grpcNativeTauriDiagnostics', () => {
  it('builds request with schema version and optional tab id', () => {
    expect(toGrpcTauriNativeDiagnosticsRequest()).toEqual({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
    });
    expect(toGrpcTauriNativeDiagnosticsRequest(' tab-a ')).toEqual({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      tabId: 'tab-a',
    });
  });

  it('invokes grpc_native_diagnostics and returns snapshot payload', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'native_diagnostics',
      data: {
        transportUsed: 'tauri',
        channelPool: { size: 1, capacity: 32, hitCountTotal: 5 },
        calls: { total: 2, active: 0, completed: 1, cancelled: 1 },
        streams: { total: 3, active: 1, ended: 1, cancelled: 1, error: 0 },
        listeners: { attachedTabs: 1, detachedTabs: 0, staleAttachedTabs: 0, totalListenerCount: 1 },
        taxonomy: { state: 'healthy', activeIssueCodes: [] },
      },
      meta: { timestamp: 'now', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    const result = await invokeGrpcNativeDiagnosticsNative('tab-a');

    expect(result.transportUsed).toBe('tauri');
    expect(invokeMock).toHaveBeenCalledWith('grpc_native_diagnostics', {
      request: {
        schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
        tabId: 'tab-a',
      },
    });
  });

  it('throws typed error when envelope reports failure', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: false,
      op: 'native_diagnostics',
      error: { code: 'GRPC_TAURI_INVALID_REQUEST', message: 'tabId invalid', retryable: false },
      meta: { timestamp: 'now', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    await expect(invokeGrpcNativeDiagnosticsNative('tab-a')).rejects.toMatchObject({
      name: 'GrpcNativeTauriDiagnosticsError',
      op: 'native_diagnostics',
      code: 'GRPC_TAURI_INVALID_REQUEST',
    });
  });

  it('throws retryable invoke error when Tauri invoke rejects', async () => {
    invokeMock.mockRejectedValueOnce(new Error('ipc down'));

    const rejection = invokeGrpcNativeDiagnosticsNative('tab-a');
    await expect(rejection).rejects.toBeInstanceOf(GrpcNativeTauriDiagnosticsError);
    await expect(rejection).rejects.toMatchObject({
      retryable: true,
      code: 'GRPC_TAURI_INVOKE_ERROR',
    });
  });
});
