/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as rpcSessionStats from '../../../shared/grpc/grpcRpcSessionStats';
import { FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';

const appendMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../data/grpcCallHistoryRecorder', () => ({
  appendGrpcCallHistory: (...args: unknown[]) => appendMock(...args),
}));

vi.mock('./grpcCrossFeatureExport', () => ({
  prepareGrpcCallHistoryExport: (input: unknown) => input,
}));

import {
  clearAllRuntimeGrpcHistoryMetadata,
  captureGrpcCallHistoryFromOutcome,
  captureGrpcCallHistoryFromStreamTerminal,
  getRuntimeGrpcHistoryMetadata,
} from './grpcStudioCallHistoryCapture';

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
  appendMock.mockResolvedValue(undefined);
});

describe('grpcStudioCallHistoryCapture coverage gaps', () => {
  it('captureGrpcCallHistoryFromOutcome skips stats when statsSource is false', async () => {
    const recordSpy = vi.spyOn(rpcSessionStats, 'recordGrpcRpcStatsEvent');
    captureGrpcCallHistoryFromOutcome({
      snapshot: snapshot(),
      result: { grpcStatus: 0, durationMs: 1, metadata: {}, body: {} },
      statsSource: false,
    });
    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(recordSpy).not.toHaveBeenCalled();
    recordSpy.mockRestore();
  });

  it('captureGrpcCallHistoryFromOutcome ignores append failures', async () => {
    appendMock.mockRejectedValueOnce(new Error('idb down'));
    captureGrpcCallHistoryFromOutcome({
      snapshot: snapshot(),
      result: { grpcStatus: 0, durationMs: 1, metadata: {}, body: {} },
    });
    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
  });

  it('captureGrpcCallHistoryFromStreamTerminal forwards explicit result override', async () => {
    captureGrpcCallHistoryFromStreamTerminal(
      { lastExecuteSnapshot: snapshot() },
      {
        result: {
          grpcStatus: 0,
          durationMs: 5,
          metadata: {},
          body: { message: 'done' },
        },
      },
    );

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(appendMock.mock.calls[0]?.[0]).toMatchObject({
      result: expect.objectContaining({ body: { message: 'done' } }),
    });
  });

  it('dispatchHistoryUpdated no-ops when window is undefined (SSR)', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error — simulate non-browser runtime
    delete globalThis.window;

    captureGrpcCallHistoryFromOutcome({
      snapshot: snapshot(),
      result: { grpcStatus: 0, durationMs: 1, metadata: {}, body: {} },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    globalThis.window = originalWindow;
  });

  it('does not store runtime metadata when append result has no entry id', async () => {
    appendMock.mockResolvedValueOnce(undefined);

    captureGrpcCallHistoryFromOutcome({
      snapshot: {
        ...snapshot(),
        metadata: {
          'x-test': '1',
        },
      },
      result: { grpcStatus: 0, durationMs: 1, metadata: {}, body: {} },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(getRuntimeGrpcHistoryMetadata('missing-id')).toBeUndefined();
  });

  it('returns a defensive clone of runtime metadata', async () => {
    appendMock.mockResolvedValueOnce({ id: 'entry-1' });

    captureGrpcCallHistoryFromOutcome({
      snapshot: {
        ...snapshot(),
        metadata: {
          'x-token': 'abc',
        },
      },
      result: { grpcStatus: 0, durationMs: 1, metadata: {}, body: {} },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    const first = getRuntimeGrpcHistoryMetadata('entry-1');
    expect(first).toEqual({ 'x-token': 'abc' });
    if (first) first['x-token'] = 'mutated';
    expect(getRuntimeGrpcHistoryMetadata('entry-1')).toEqual({ 'x-token': 'abc' });
  });

  it('clearAllRuntimeGrpcHistoryMetadata swallows sessionStorage remove failures', async () => {
    appendMock.mockResolvedValueOnce({ id: 'entry-2' });

    captureGrpcCallHistoryFromOutcome({
      snapshot: {
        ...snapshot(),
        metadata: { 'x-request-id': 'abc-123' },
      },
      result: { grpcStatus: 0, durationMs: 1, metadata: {}, body: {} },
    });
    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));

    const originalWindow = globalThis.window;
    const removeItem = vi.fn(() => {
      throw new Error('no-storage');
    });
    (globalThis as unknown as { window: { sessionStorage: { removeItem: (key: string) => void } } }).window = {
      sessionStorage: {
        removeItem,
      },
    };

    expect(() => clearAllRuntimeGrpcHistoryMetadata()).not.toThrow();
    expect(removeItem).toHaveBeenCalledWith('grpc-runtime-history-metadata');
    globalThis.window = originalWindow;
  });
});
