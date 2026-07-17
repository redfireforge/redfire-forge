import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GrpcNativeTauriMockListenerError,
  invokeGrpcMockListenerCommitNative,
  invokeGrpcMockListenerLogNative,
  invokeGrpcMockListenerStartNative,
  invokeGrpcMockListenerStatusNative,
  invokeGrpcMockListenerStopNative,
  toGrpcTauriMockListenerCommitRequest,
  toGrpcTauriMockListenerStartRequest,
} from './grpcNativeTauriMockListener';
import { GRPC_TAURI_SCHEMA_VERSION } from './grpcTauriContracts';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe('grpcNativeTauriMockListener', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('wraps start/stop/status/commit/log commands and maps status payloads', async () => {
    const status = {
      running: true,
      tabId: 'tab-1',
      listenTarget: '127.0.0.1:50051',
      generation: 1,
    };

    invokeMock
      .mockResolvedValueOnce({ ok: true, data: { status } })
      .mockResolvedValueOnce({ ok: true, data: status })
      .mockResolvedValueOnce({ ok: true, data: status })
      .mockResolvedValueOnce({ ok: true, data: { ruleCount: 2 } })
      .mockResolvedValueOnce({ ok: true, data: { entries: [], nextCursor: 0 } });

    await expect(invokeGrpcMockListenerStartNative({
      tabId: 'tab-1',
      connectionId: 'conn-1',
      descriptorKey: 'desc-1',
      ruleSet: { rules: [] },
    })).resolves.toEqual(status);

    await expect(invokeGrpcMockListenerStopNative('tab-1')).resolves.toEqual(status);
    await expect(invokeGrpcMockListenerStatusNative('tab-1')).resolves.toEqual(status);
    await expect(invokeGrpcMockListenerCommitNative({
      tabId: 'tab-1',
      ruleSet: { rules: [] },
    })).resolves.toEqual({ ruleCount: 2 });
    await expect(invokeGrpcMockListenerLogNative('tab-1', 3)).resolves.toEqual({
      entries: [],
      nextCursor: 0,
    });

    expect(invokeMock).toHaveBeenCalledWith('grpc_mock_listener_start', {
      request: expect.objectContaining({ schemaVersion: GRPC_TAURI_SCHEMA_VERSION, tabId: 'tab-1' }),
    });
    expect(invokeMock).toHaveBeenCalledWith('grpc_mock_listener_log', {
      request: expect.objectContaining({ tabId: 'tab-1', since: 3 }),
    });
  });

  it('throws envelope and transport errors with retryable metadata', async () => {
    invokeMock.mockResolvedValueOnce({
      ok: false,
      error: { code: 'MOCK_FAILED', message: 'listen failed', retryable: true },
    });
    await expect(invokeGrpcMockListenerStatusNative('tab-1')).rejects.toMatchObject({
      name: 'GrpcNativeTauriMockListenerError',
      op: 'mock_listener_status',
      code: 'MOCK_FAILED',
      retryable: true,
      message: 'listen failed',
    });

    invokeMock.mockRejectedValueOnce(new Error('ipc down'));
    await expect(invokeGrpcMockListenerStopNative('tab-1')).rejects.toMatchObject({
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
      message: 'ipc down',
    });

    invokeMock.mockRejectedValueOnce('string-failure');
    await expect(invokeGrpcMockListenerCommitNative({
      tabId: 'tab-1',
      ruleSet: { rules: [] },
    })).rejects.toMatchObject({
      message: 'string-failure',
      retryable: true,
    });
  });

  it('uses defaults on error constructor options and request helpers', () => {
    const err = new GrpcNativeTauriMockListenerError('mock_listener_log', 'boom');
    expect(err.code).toBe('GRPC_TAURI_INVOKE_ERROR');
    expect(err.retryable).toBe(false);

    expect(toGrpcTauriMockListenerStartRequest({
      tabId: 't',
      connectionId: 'c',
      descriptorKey: 'd',
      ruleSet: { rules: [] },
    }).schemaVersion).toBe(GRPC_TAURI_SCHEMA_VERSION);

    expect(toGrpcTauriMockListenerCommitRequest({
      tabId: 't',
      ruleSet: { rules: [] },
    }).schemaVersion).toBe(GRPC_TAURI_SCHEMA_VERSION);
  });
});
