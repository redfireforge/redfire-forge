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
  captureGrpcCallHistoryFromOutcome,
  captureGrpcCallHistoryFromStreamTerminal,
  GRPC_CALL_HISTORY_UPDATED_EVENT,
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
  prepareMock.mockClear();
  prepareMock.mockImplementation((input: unknown) => input);
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
});
