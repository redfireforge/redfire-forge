/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as grpcCompressionPolicy from '@shared/grpc/grpcCompressionPolicy';
import * as rpcSessionStats from '@shared/grpc/grpcRpcSessionStats';
import { FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';

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
  clearAllRuntimeGrpcHistoryMetadata();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('grpcStudioCallHistoryCapture coverage gaps', () => {
  it('rehydrates runtime metadata from sessionStorage and strips redacted rows', async () => {
    vi.resetModules();
    window.sessionStorage.setItem('grpc-runtime-history-metadata', JSON.stringify([
      ['entry-a', { 'x-token': 'keep' }],
      ['entry-b', { authorization: '[REDACTED]' }],
    ]));
    const mod = await import('./grpcStudioCallHistoryCapture');
    expect(mod.getRuntimeGrpcHistoryMetadata('entry-a')).toEqual({ 'x-token': 'keep' });
    expect(mod.getRuntimeGrpcHistoryMetadata('entry-b')).toBeUndefined();
    mod.clearRuntimeGrpcHistoryMetadataForTests();
    vi.resetModules();
  });

  it('treats invalid sessionStorage payload as an empty cache', async () => {
    vi.resetModules();
    window.sessionStorage.setItem('grpc-runtime-history-metadata', 'not-json');
    const mod = await import('./grpcStudioCallHistoryCapture');
    expect(mod.getRuntimeGrpcHistoryMetadata('missing')).toBeUndefined();
    mod.clearRuntimeGrpcHistoryMetadataForTests();
    vi.resetModules();
  });

  it('falls back to snapshot metadata when prepareGrpcCallMetadata throws', async () => {
    appendMock.mockResolvedValueOnce({ id: 'entry-fallback' });
    vi.spyOn(grpcCompressionPolicy, 'prepareGrpcCallMetadata').mockImplementation(() => {
      throw new Error('prep failed');
    });

    captureGrpcCallHistoryFromOutcome({
      snapshot: {
        ...snapshot(),
        metadata: { 'x-fallback': '1' },
      },
      result: { grpcStatus: 0, durationMs: 1, metadata: {}, body: {} },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(getRuntimeGrpcHistoryMetadata('entry-fallback')).toEqual({ 'x-fallback': '1' });
  });

  it('evicts oldest runtime metadata when cache exceeds max entries', async () => {
    for (let i = 0; i < 201; i += 1) {
      appendMock.mockResolvedValueOnce({ id: `entry-${i}` });
      captureGrpcCallHistoryFromOutcome({
        snapshot: {
          ...snapshot(),
          metadata: { 'x-seq': String(i) },
        },
        result: { grpcStatus: 0, durationMs: 1, metadata: {}, body: {} },
      });
    }

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(201));
    expect(getRuntimeGrpcHistoryMetadata('entry-0')).toBeUndefined();
    expect(getRuntimeGrpcHistoryMetadata('entry-200')).toEqual({ 'x-seq': '200' });
  });

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

  it('captureGrpcCallHistoryFromStreamTerminal applies template context when target is set', async () => {
    captureGrpcCallHistoryFromStreamTerminal({
      lastExecuteSnapshot: snapshot(),
      target: 'localhost:50051',
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    expect(appendMock.mock.calls[0]?.[0]).toMatchObject({
      filterTarget: FIXTURE_UNARY_CALL_REQUEST.target.address,
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

  it('skips sessionStorage persistence when window is unavailable', async () => {
    appendMock.mockResolvedValueOnce({ id: 'entry-ssr' });
    const originalWindow = globalThis.window;
    // @ts-expect-error — simulate non-browser runtime
    delete globalThis.window;

    captureGrpcCallHistoryFromOutcome({
      snapshot: {
        ...snapshot(),
        metadata: { 'x-request-id': 'ssr' },
      },
      result: { grpcStatus: 0, durationMs: 1, metadata: {}, body: {} },
    });

    await vi.waitFor(() => expect(appendMock).toHaveBeenCalledTimes(1));
    globalThis.window = originalWindow;
  });

  it('clearAllRuntimeGrpcHistoryMetadata no-ops when sessionStorage is unavailable', () => {
    const originalWindow = globalThis.window;
    (globalThis as unknown as { window: Record<string, never> }).window = {};
    expect(() => clearAllRuntimeGrpcHistoryMetadata()).not.toThrow();
    globalThis.window = originalWindow;
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
