/**
 * Coverage gaps — grpcHarnessStreamCollector.ts (Phase 8C streaming executors).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GrpcStreamEvent } from './contracts';
import { FIXTURE_SERVER_STREAM_START_REQUEST } from './contractFixtures';
import {
  collectGrpcHarnessServerStream,
  executeGrpcHarnessBidiStream,
  executeGrpcHarnessClientStream,
} from './grpcHarnessStreamCollector';

const TAB_ID = 'harness:coverage';

function makeStreamDeps(events: GrpcStreamEvent[], overrides: Record<string, unknown> = {}) {
  const cancelStream = vi.fn(async () => undefined);
  const startStream = vi.fn(async () => ({
    data: { streamId: 'stream-1', requestId: 'req-1' },
  }));
  const sendStreamMessage = vi.fn(async () => undefined);
  const endStream = vi.fn(async () => undefined);
  const openStreamEvents = vi.fn((_streamId: string, _tabId: string, handlers: {
    onEvent: (event: GrpcStreamEvent) => void;
    onError?: (message: string) => void;
    onStateChange?: (state: string) => void;
  }) => {
    queueMicrotask(() => {
      for (const event of events) {
        handlers.onEvent(event);
      }
    });
    return () => undefined;
  });
  return {
    startStream,
    sendStreamMessage,
    endStream,
    cancelStream,
    openStreamEvents,
    ...overrides,
  };
}

describe('grpcHarnessStreamCollector coverage gaps', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps until_expression stop reason to stream_end success', async () => {
    const collectServerStream = vi.fn(async () => ({
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      durationMs: 5,
      messages: [{ n: 1 }],
      trailers: {},
      stopReason: 'until_expression' as const,
    }));
    const outcome = await collectGrpcHarnessServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      { maxMessages: 1 },
      { deps: { collectServerStream } },
    );
    expect(outcome.passed).toBe(true);
    expect(outcome.streamStopReason).toBe('stream_end');
  });

  it('marks cancelled and transport_error server stream outcomes as failed', async () => {
    for (const stopReason of ['cancelled', 'transport_error'] as const) {
      const collectServerStream = vi.fn(async () => ({
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        durationMs: 5,
        messages: [],
        trailers: {},
        stopReason,
        errorDetail: stopReason === 'transport_error' ? 'network down' : undefined,
      }));
      const outcome = await collectGrpcHarnessServerStream(
        FIXTURE_SERVER_STREAM_START_REQUEST,
        TAB_ID,
        { maxMessages: 1 },
        { deps: { collectServerStream } },
      );
      expect(outcome.passed).toBe(false);
      expect(outcome.streamStopReason).toBe(stopReason);
      expect(outcome.errorCategory).toBe(stopReason === 'transport_error' ? 'network' : 'internal');
    }
  });

  it('fails server stream when stream_end carries non-zero grpc status', async () => {
    const collectServerStream = vi.fn(async () => ({
      grpcStatus: 3,
      grpcStatusMessage: 'INVALID_ARGUMENT',
      durationMs: 5,
      messages: [],
      trailers: {},
      stopReason: 'stream_end' as const,
    }));
    const outcome = await collectGrpcHarnessServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      { maxMessages: 1 },
      { deps: { collectServerStream } },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.grpcStatus).toBe(3);
  });

  it('passes custom startStream deps through to workflow collector', async () => {
    const startStream = vi.fn(async () => ({
      data: { streamId: 'custom', requestId: 'req-custom' },
    }));
    const collectServerStream = vi.fn(async (_req, _tab, _collect, options) => {
      expect(options?.deps?.startStream).toBe(startStream);
      return {
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        durationMs: 1,
        messages: [],
        trailers: {},
        stopReason: 'stream_end' as const,
      };
    });
    await collectGrpcHarnessServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      { maxMessages: 1 },
      { deps: { collectServerStream, startStream, cancelStream: vi.fn(), openStreamEvents: vi.fn() } },
    );
    expect(collectServerStream).toHaveBeenCalledTimes(1);
  });

  it('returns cancelled outcome when abortSignal is already set', async () => {
    const controller = new AbortController();
    controller.abort();
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { abortSignal: controller.signal, deps: makeStreamDeps([]) },
    );
    expect(outcome.streamStopReason).toBe('cancelled');
    expect(outcome.passed).toBe(false);
  });

  it('stops bidi stream at maxDurationMs', async () => {
    vi.useFakeTimers();
    const deps = makeStreamDeps([]);
    const promise = executeGrpcHarnessBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'ping' }],
      { maxDurationMs: 50 },
      { deps },
    );
    await vi.advanceTimersByTimeAsync(60);
    const outcome = await promise;
    expect(outcome.streamStopReason).toBe('max_duration');
    expect(outcome.passed).toBe(true);
    expect(deps.cancelStream).toHaveBeenCalled();
  });

  it('ignores outbound grpc-message events for inbound collection', async () => {
    const deps = makeStreamDeps([
      { type: 'grpc-message', direction: 'outbound', data: { message: 'sent' } },
      {
        type: 'grpc-end',
        status: 0,
        statusMessage: 'OK',
        data: { message: 'done' },
        trailers: {},
      },
    ]);
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.messages).toBeUndefined();
    expect(outcome.body).toEqual({ message: 'done' });
  });

  it('maps openStreamEvents transport errors to transport_error outcome', async () => {
    const openStreamEvents = vi.fn((_streamId, _tabId, handlers: { onError: (msg: string) => void }) => {
      queueMicrotask(() => handlers.onError('SSE disconnected'));
      return () => undefined;
    });
    const deps = makeStreamDeps([], { openStreamEvents });
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.streamStopReason).toBe('transport_error');
    expect(outcome.errorDetail).toContain('SSE disconnected');
  });

  it('maps sendStreamMessage failures to transport_error outcome', async () => {
    const deps = makeStreamDeps([], {
      sendStreamMessage: vi.fn(async () => {
        throw new Error('send failed');
      }),
    });
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.streamStopReason).toBe('transport_error');
    expect(outcome.errorDetail).toContain('send failed');
  });

  it('resolves when stream state changes to closed without terminal event', async () => {
    const openStreamEvents = vi.fn((_streamId, _tabId, handlers: { onStateChange: (s: string) => void }) => {
      queueMicrotask(() => handlers.onStateChange('closed'));
      return () => undefined;
    });
    const deps = makeStreamDeps([], { openStreamEvents });
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.streamStopReason).toBe('stream_end');
    expect(outcome.grpcStatus).toBe(0);
  });

  it('marks max_messages server stream collection as passed', async () => {
    const collectServerStream = vi.fn(async () => ({
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      durationMs: 5,
      messages: [{ n: 1 }],
      trailers: {},
      stopReason: 'max_messages' as const,
    }));
    const outcome = await collectGrpcHarnessServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      { maxMessages: 1 },
      { deps: { collectServerStream } },
    );
    expect(outcome.passed).toBe(true);
    expect(outcome.streamStopReason).toBe('max_messages');
  });

  it('uses collection errorDetail when stream fails', async () => {
    const collectServerStream = vi.fn(async () => ({
      grpcStatus: 13,
      grpcStatusMessage: 'Internal',
      durationMs: 5,
      messages: [],
      trailers: {},
      stopReason: 'stream_error' as const,
      errorDetail: 'custom stream failure',
    }));
    const outcome = await collectGrpcHarnessServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      { maxMessages: 1 },
      { deps: { collectServerStream } },
    );
    expect(outcome.errorDetail).toBe('custom stream failure');
  });

  it('swallows cancelStream cleanup failures in finally', async () => {
    const deps = makeStreamDeps([
      { type: 'grpc-end', status: 0, statusMessage: 'OK', trailers: {} },
    ], {
      cancelStream: vi.fn(async () => {
        throw new Error('cancel failed');
      }),
    });
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.passed).toBe(true);
    expect(deps.cancelStream).toHaveBeenCalled();
  });

  it('fails outbound stream when grpc-end carries non-zero status', async () => {
    const deps = makeStreamDeps([
      { type: 'grpc-end', status: 3, statusMessage: 'INVALID_ARGUMENT', trailers: {} },
    ]);
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.grpcStatus).toBe(3);
    expect(outcome.streamStopReason).toBe('stream_end');
  });

  it('collects inbound messages without collect bounds', async () => {
    const deps = makeStreamDeps([
      { type: 'grpc-message', direction: 'inbound', data: { n: 1 } },
      { type: 'grpc-end', status: 0, statusMessage: 'OK', trailers: {} },
    ]);
    const outcome = await executeGrpcHarnessBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'ping' }],
      {},
      { deps },
    );
    expect(outcome.messages).toHaveLength(1);
    expect(outcome.passed).toBe(true);
  });

  it('uses grpcStatusMessage fallback when stream end omits status fields', async () => {
    const deps = makeStreamDeps([
      { type: 'grpc-error', trailers: {} },
    ]);
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.grpcStatus).toBe(13);
    expect(outcome.grpcStatusMessage).toBe('Stream error');
  });

  it('captures terminal grpc-end body object on outbound streams', async () => {
    const deps = makeStreamDeps([
      {
        type: 'grpc-end',
        status: 0,
        statusMessage: 'OK',
        data: { total: 3 },
        trailers: { 'x-meta': '1' },
      },
    ]);
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.body).toEqual({ total: 3 });
    expect(outcome.trailers).toEqual({ 'x-meta': '1' });
  });

  it('skips endStream when max_duration abort fires before send completes', async () => {
    vi.useFakeTimers();
    const deps = makeStreamDeps([]);
    const bidiPromise = executeGrpcHarnessBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'ping' }],
      { maxDurationMs: 20 },
      { deps },
    );
    await vi.advanceTimersByTimeAsync(25);
    const outcome = await bidiPromise;
    expect(outcome.streamStopReason).toBe('max_duration');
    expect(outcome.passed).toBe(true);
  });

  it('aborts outbound stream when abortSignal fires after attach', async () => {
    const controller = new AbortController();
    const openStreamEvents = vi.fn(() => () => undefined);
    const deps = makeStreamDeps([], { openStreamEvents });
    const promise = executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { abortSignal: controller.signal, deps },
    );
    await Promise.resolve();
    controller.abort();
    const outcome = await promise;
    expect(outcome.streamStopReason).toBe('cancelled');
    expect(deps.cancelStream).toHaveBeenCalled();
  });

  it('uses grpc-error defaults when status fields are omitted', async () => {
    const deps = makeStreamDeps([{ type: 'grpc-error', trailers: {} }]);
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.grpcStatus).toBe(13);
    expect(outcome.errorDetail).toBe('Stream error');
  });

  it('registers abort listener when abortSignal is not yet aborted', async () => {
    const controller = new AbortController();
    const addSpy = vi.spyOn(AbortSignal.prototype, 'addEventListener');
    const deps = makeStreamDeps([
      { type: 'grpc-end', status: 0, statusMessage: 'OK', trailers: {} },
    ]);
    await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { abortSignal: controller.signal, deps },
    );
    expect(addSpy).toHaveBeenCalled();
    addSpy.mockRestore();
  });

  it('handles abort during event delivery', async () => {
    const openStreamEvents = vi.fn((_streamId, _tabId, handlers: { onEvent: (e: GrpcStreamEvent) => void }) => {
      queueMicrotask(() => {
        handlers.onEvent({ type: 'grpc-message', direction: 'inbound', data: { n: 1 } });
      });
      return () => undefined;
    });
    const deps = makeStreamDeps([], { openStreamEvents });
    const controller = new AbortController();
    const promise = executeGrpcHarnessBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'ping' }],
      { maxMessages: 5 },
      { abortSignal: controller.signal, deps },
    );
    controller.abort();
    const outcome = await promise;
    expect(outcome.streamStopReason).toBe('cancelled');
  });

  it('collects inbound grpc-message events when direction is omitted', async () => {
    const deps = makeStreamDeps([
      { type: 'grpc-message', data: { n: 42 } },
      { type: 'grpc-end', status: 0, statusMessage: 'OK', trailers: {} },
    ]);
    const outcome = await executeGrpcHarnessBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'ping' }],
      { maxMessages: 5 },
      { deps },
    );
    expect(outcome.messages).toEqual([{ n: 42 }]);
    expect(outcome.passed).toBe(true);
  });

  it('maps non-Error send failures to transport_error with string detail', async () => {
    const deps = makeStreamDeps([], {
      sendStreamMessage: vi.fn(async () => {
        throw 'send exploded';
      }),
    });
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.streamStopReason).toBe('transport_error');
    expect(outcome.errorDetail).toBe('send exploded');
  });

  it('stops sending when abortSignal fires mid outbound loop', async () => {
    const controller = new AbortController();
    const deps = makeStreamDeps([
      { type: 'grpc-end', status: 0, statusMessage: 'OK', trailers: {} },
    ], {
      sendStreamMessage: vi.fn(async () => {
        controller.abort();
      }),
    });
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }, { message: 'two' }],
      { abortSignal: controller.signal, deps },
    );
    expect(outcome.streamStopReason).toBe('cancelled');
    expect(deps.sendStreamMessage).toHaveBeenCalledTimes(1);
  });

  it('skips endStream when max_messages stop reason is already set', async () => {
    const deps = makeStreamDeps([
      { type: 'grpc-message', direction: 'inbound', data: { n: 1 } },
      { type: 'grpc-message', direction: 'inbound', data: { n: 2 } },
    ]);
    const outcome = await executeGrpcHarnessBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'ping' }],
      { maxMessages: 1 },
      { deps },
    );
    expect(outcome.streamStopReason).toBe('max_messages');
    expect(deps.endStream).not.toHaveBeenCalled();
  });

  it('defaults missing stopReason to transport_error in outbound outcome', async () => {
    const openStreamEvents = vi.fn((_streamId, _tabId, handlers: { onError: (msg: string) => void }) => {
      queueMicrotask(() => handlers.onError('SSE disconnected'));
      return () => undefined;
    });
    const deps = makeStreamDeps([], { openStreamEvents });
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.streamStopReason).toBe('transport_error');
    expect(outcome.errorCategory).toBe('network');
  });

  it('applies grpc-end defaults when status and trailers are omitted', async () => {
    const deps = makeStreamDeps([{ type: 'grpc-end' }]);
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.grpcStatus).toBe(0);
    expect(outcome.grpcStatusMessage).toBe('OK');
    expect(outcome.trailers).toEqual({});
  });

  it('uses string detail when endStream rejects with a non-Error value', async () => {
    const deps = makeStreamDeps([
      { type: 'grpc-message', direction: 'inbound', data: { n: 1 } },
    ], {
      endStream: vi.fn(async () => {
        throw 'end failed';
      }),
    });
    const outcome = await executeGrpcHarnessBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'ping' }],
      { maxMessages: 5 },
      { deps },
    );
    expect(outcome.streamStopReason).toBe('transport_error');
    expect(outcome.errorDetail).toBe('end failed');
  });
});
