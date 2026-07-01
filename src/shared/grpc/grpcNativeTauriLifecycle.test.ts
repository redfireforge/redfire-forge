/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  invokeGrpcTabCleanupNative,
  invokeGrpcTabEventsAttachNative,
  invokeGrpcTabEventsDetachNative,
  toGrpcTauriTabCleanupRequest,
} from './grpcNativeTauriLifecycle';
import { GRPC_TAURI_SCHEMA_VERSION } from './grpcTauriContracts';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe('grpcNativeTauriLifecycle', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('toGrpcTauriTabCleanupRequest includes schema version', () => {
    expect(toGrpcTauriTabCleanupRequest('tab-a')).toEqual({
      schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
      tabId: 'tab-a',
    });
  });

  it('invokeGrpcTabCleanupNative returns cleanup result', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'tab_cleanup',
      data: { tabId: 'tab-a', cancelledStreams: 2, releasedChannels: 0 },
      meta: { timestamp: 'now', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    await expect(invokeGrpcTabCleanupNative('tab-a')).resolves.toEqual({
      tabId: 'tab-a',
      cancelledStreams: 2,
      releasedChannels: 0,
    });
    expect(invokeMock).toHaveBeenCalledWith('grpc_tab_cleanup', {
      request: toGrpcTauriTabCleanupRequest('tab-a'),
    });
  });

  it('invokeGrpcTabCleanupNative throws on envelope error', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: false,
      op: 'tab_cleanup',
      error: { code: 'GRPC_TAURI_INVALID_REQUEST', message: 'tabId is required' },
      meta: { timestamp: 'now', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    await expect(invokeGrpcTabCleanupNative('tab-a')).rejects.toMatchObject({
      name: 'GrpcNativeTauriLifecycleError',
      op: 'tab_cleanup',
    });
  });

  it('invokeGrpcTabEventsAttachNative calls attach command', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: true,
      op: 'tab_events_attach',
      data: { tabId: 'tab-a', listenerCount: 1 },
      meta: { timestamp: 'now', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    await invokeGrpcTabEventsAttachNative('tab-a');
    expect(invokeMock).toHaveBeenCalledWith('grpc_tab_events_attach', {
      request: toGrpcTauriTabCleanupRequest('tab-a'),
    });
  });

  it('invokeGrpcTabEventsAttachNative throws on envelope error', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: false,
      op: 'tab_events_attach',
      error: { code: 'GRPC_TAURI_INVALID_REQUEST', message: 'tabId is required' },
      meta: { timestamp: 'now', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    await expect(invokeGrpcTabEventsAttachNative('tab-a')).rejects.toMatchObject({
      name: 'GrpcNativeTauriLifecycleError',
      op: 'tab_events_attach',
    });
  });

  it('invokeGrpcTabEventsDetachNative swallows invoke transport errors', async () => {
    invokeMock.mockRejectedValueOnce(new Error('ipc down'));
    await expect(invokeGrpcTabEventsDetachNative('tab-a')).resolves.toBeUndefined();
  });
});
