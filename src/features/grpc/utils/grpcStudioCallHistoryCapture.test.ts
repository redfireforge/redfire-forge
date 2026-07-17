/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';

const appendMock = vi.fn().mockResolvedValue(undefined);
const prepareMock = vi.fn((input: unknown) => input);

vi.mock('../data/grpcCallHistoryRecorder', () => ({
  appendGrpcCallHistory: (...args: unknown[]) => appendMock(...args),
}));

vi.mock('./grpcCrossFeatureExport', () => ({
  prepareGrpcCallHistoryExport: (input: unknown) => prepareMock(input),
}));

import {
  clearRuntimeGrpcHistoryMetadataForTests,
  clearAllRuntimeGrpcHistoryMetadata,
  captureGrpcCallHistoryFromOutcome,
  captureGrpcCallHistoryFromStreamTerminal,
  getRuntimeGrpcHistoryMetadata,
  GRPC_CALL_HISTORY_UPDATED_EVENT,
} from './grpcStudioCallHistoryCapture';
import {
  clearGrpcRpcSessionStatsForTests,
  getGrpcRpcSessionStats,
} from '../../../shared/grpc/grpcRpcSessionStats';

const TS = '2026-06-29T12:00:00.000Z';

function snapshot() {
  return {
    tabId: 'tab-1',
    requestId: 'req-1',
    capturedAt: TS,
    callType: 'unary' as const,
    target: FIXTURE_UNARY_CALL_REQUEST.target,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    body: { message: 'hi' },
    metadata: {},
    timeoutMs: 30_000,
    descriptorKey: 'desc-1',
  };
}

beforeEach(() => {
  appendMock.mockClear();
  prepareMock.mockClear();
  prepareMock.mockImplementation((input: unknown) => input);
  appendMock.mockResolvedValue({ id: 'history-1' });
  clearRuntimeGrpcHistoryMetadataForTests();
  clearGrpcRpcSessionStatsForTests();
});

describe('grpcStudioCallHistoryCapture (Phase 5H)', () => {
  it('appends history and dispatches update event on success', async () => {
    const listener = vi.fn();
    window.addEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, listener);

    captureGrpcCallHistoryFromOutcome({
      snapshot: snapshot(),
      result: { grpcStatus: 0, durationMs: 12, metadata: {}, body: { message: 'hi' } },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));

    window.removeEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, listener);
  });

  it('appends history on error outcomes', async () => {
    captureGrpcCallHistoryFromOutcome({
      snapshot: snapshot(),
      error: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'boom',
      },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(prepareMock).toHaveBeenCalled();
  });

  it('records rpc session stats alongside history capture', () => {
    captureGrpcCallHistoryFromOutcome({
      snapshot: snapshot(),
      result: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        durationMs: 42,
      },
    });

    const stats = getGrpcRpcSessionStats('tab-1');
    const row = stats.byMethodKey[`${FIXTURE_UNARY_CALL_REQUEST.service}/${FIXTURE_UNARY_CALL_REQUEST.method}`];
    expect(row.calls).toBe(1);
    expect(row.latencyMs.avg).toBe(42);
  });

  it('captureGrpcCallHistoryFromStreamTerminal records stream_terminal stats with timing', () => {
    captureGrpcCallHistoryFromStreamTerminal({
      lastExecuteSnapshot: { ...snapshot(), callType: 'server_streaming' },
      streamStartedAt: '2026-07-01T00:00:00.000Z',
      streamEndedAt: '2026-07-01T00:00:01.000Z',
    }, {
      result: {
        callType: 'server_streaming',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        durationMs: 0,
      },
    });

    const stats = getGrpcRpcSessionStats('tab-1');
    const row = Object.values(stats.byMethodKey)[0];
    expect(row.calls).toBe(1);
    expect(row.latencyMs.avg).toBe(1000);
  });

  it('swallows append failures without throwing', async () => {
    appendMock.mockRejectedValueOnce(new Error('persist failed'));
    expect(() => captureGrpcCallHistoryFromOutcome({ snapshot: snapshot() })).not.toThrow();
    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
  });

  it('captureGrpcCallHistoryFromStreamTerminal no-ops without snapshot', () => {
    captureGrpcCallHistoryFromStreamTerminal({});
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('captureGrpcCallHistoryFromStreamTerminal forwards stream error', async () => {
    captureGrpcCallHistoryFromStreamTerminal({
      lastExecuteSnapshot: snapshot(),
      streamError: {
        code: 'GRPC_STREAM_ERROR',
        category: 'stream_error',
        message: 'stream died',
      },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(prepareMock).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: 'stream died' }),
    }));
  });

  it('captureGrpcCallHistoryFromStreamTerminal prefers explicit error override', async () => {
    captureGrpcCallHistoryFromStreamTerminal(
      { lastExecuteSnapshot: snapshot() },
      {
        error: {
          code: 'GRPC_STREAM_ERROR',
          category: 'stream_error',
          message: 'explicit terminal error',
        },
      },
    );

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(prepareMock).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: 'explicit terminal error' }),
    }));
  });

  it('stores runtime request metadata for exact grpcurl history export', async () => {
    captureGrpcCallHistoryFromOutcome({
      snapshot: {
        ...snapshot(),
        metadata: {
          'x-env-token': '{{authToken}}',
        },
        auth: {
          type: 'api_key',
          apiKeyName: 'x-api-key',
          apiKeyValue: 'my-key-123',
        },
        interpolationEnv: {
          env: { authToken: 'rf-demo-auth-token-lesson4' },
          appliedAt: TS,
        },
      },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    const runtimeMetadata = getRuntimeGrpcHistoryMetadata('history-1');
    expect(runtimeMetadata).toEqual({
      'x-api-key': 'my-key-123',
      'x-env-token': '{{authToken}}',
    });
  });

  it('stores compression headers in runtime metadata when gzip is enabled', async () => {
    captureGrpcCallHistoryFromOutcome({
      snapshot: {
        ...snapshot(),
        compression: { enabled: true, algorithm: 'gzip' },
      },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(getRuntimeGrpcHistoryMetadata('history-1')).toEqual({
      'grpc-encoding': 'gzip',
      'grpc-accept-encoding': 'gzip,identity',
    });
  });

  it('ignores redacted runtime metadata values and keeps cache empty', async () => {
    captureGrpcCallHistoryFromOutcome({
      snapshot: {
        ...snapshot(),
        metadata: {
          authorization: '[REDACTED]'
        },
      },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(getRuntimeGrpcHistoryMetadata('history-1')).toBeUndefined();
  });

  it('clears runtime metadata cache and session storage', async () => {
    captureGrpcCallHistoryFromOutcome({
      snapshot: {
        ...snapshot(),
        metadata: { 'x-request-id': 'abc-123' },
      },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(getRuntimeGrpcHistoryMetadata('history-1')).toEqual({ 'x-request-id': 'abc-123' });

    clearAllRuntimeGrpcHistoryMetadata();
    expect(getRuntimeGrpcHistoryMetadata('history-1')).toBeUndefined();
    expect(window.sessionStorage.getItem('grpc-runtime-history-metadata')).toBeNull();
  });
});
