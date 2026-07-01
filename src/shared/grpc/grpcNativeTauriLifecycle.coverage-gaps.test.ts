/**
 * @vitest-environment jsdom
 * Coverage gaps — grpcNativeTauriLifecycle.ts (Phase 7H).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GrpcNativeTauriLifecycleError,
  invokeGrpcTabCleanupNative,
  invokeGrpcTabEventsAttachNative,
  invokeGrpcTabEventsDetachNative,
} from './grpcNativeTauriLifecycle';
import { GRPC_TAURI_SCHEMA_VERSION } from './grpcTauriContracts';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe('grpcNativeTauriLifecycle coverage gaps', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('wraps invoke transport failures for tab cleanup as retryable lifecycle errors', async () => {
    invokeMock.mockRejectedValueOnce(new Error('ipc unavailable'));
    await expect(invokeGrpcTabCleanupNative('tab-x')).rejects.toMatchObject({
      name: 'GrpcNativeTauriLifecycleError',
      op: 'tab_cleanup',
      retryable: true,
      code: 'GRPC_TAURI_INVOKE_ERROR',
    });
  });

  it('wraps invoke transport failures for tab events attach', async () => {
    invokeMock.mockRejectedValueOnce('string failure');
    await expect(invokeGrpcTabEventsAttachNative('tab-x')).rejects.toMatchObject({
      name: 'GrpcNativeTauriLifecycleError',
      op: 'tab_events_attach',
      retryable: true,
    });
  });

  it('swallows envelope errors for best-effort tab events detach', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: false,
      op: 'tab_events_detach',
      error: { code: 'GRPC_TAURI_INVALID_REQUEST', message: 'tabId is required' },
      meta: { timestamp: 'now', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    await expect(invokeGrpcTabEventsDetachNative('tab-x')).resolves.toBeUndefined();
  });

  it('propagates envelope retryable flag for tab cleanup failures', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: false,
      op: 'tab_cleanup',
      error: { code: 'GRPC_TAURI_BUSY', message: 'busy', retryable: true },
      meta: { timestamp: 'now', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    await expect(invokeGrpcTabCleanupNative('tab-x')).rejects.toMatchObject({
      op: 'tab_cleanup',
      code: 'GRPC_TAURI_BUSY',
      retryable: true,
    });
  });

  it('constructs GrpcNativeTauriLifecycleError with defaults', () => {
    const error = new GrpcNativeTauriLifecycleError('tab_cleanup', 'failed');
    expect(error.code).toBe('GRPC_TAURI_INVOKE_ERROR');
    expect(error.retryable).toBe(false);
  });

  it('propagates envelope errors for tab events attach', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: false,
      op: 'tab_events_attach',
      error: { code: 'GRPC_TAURI_INVALID_REQUEST', message: 'tabId is required', retryable: false },
      meta: { timestamp: 'now', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });
    await expect(invokeGrpcTabEventsAttachNative('tab-x')).rejects.toMatchObject({
      op: 'tab_events_attach',
      code: 'GRPC_TAURI_INVALID_REQUEST',
      retryable: false,
    });
  });
});
