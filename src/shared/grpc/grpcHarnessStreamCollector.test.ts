/**
 * Phase 8C — harness stream collector tests.
 */
import { describe, expect, it, vi } from 'vitest';
import type { GrpcStreamEvent } from './contracts';
import { FIXTURE_SERVER_STREAM_START_REQUEST } from './contractFixtures';
import {
  collectGrpcHarnessServerStream,
  executeGrpcHarnessBidiStream,
  executeGrpcHarnessClientStream,
} from './grpcHarnessStreamCollector';

const TAB_ID = 'harness:grpc-1';

function makeStreamDeps(events: GrpcStreamEvent[]) {
  const cancelStream = vi.fn(async () => undefined);
  const startStream = vi.fn(async () => ({
    data: { streamId: 'stream-1', requestId: 'req-1' },
  }));
  const sendStreamMessage = vi.fn(async () => undefined);
  const endStream = vi.fn(async () => undefined);
  const openStreamEvents = vi.fn((_streamId, _tabId, handlers) => {
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
  };
}

describe('grpcHarnessStreamCollector (Phase 8C)', () => {
  it('collectGrpcHarnessServerStream delegates to workflow collector', async () => {
    const collectServerStream = vi.fn(async () => ({
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      durationMs: 10,
      messages: [{ message: 'a' }],
      trailers: {},
      stopReason: 'stream_end' as const,
    }));
    const outcome = await collectGrpcHarnessServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      { maxMessages: 5 },
      { deps: { collectServerStream } },
    );
    expect(outcome.passed).toBe(true);
    expect(outcome.messages).toHaveLength(1);
    expect(collectServerStream).toHaveBeenCalledTimes(1);
  });

  it('executeGrpcHarnessClientStream sends messages, ends stream, and cancels in finally', async () => {
    const deps = makeStreamDeps([
      {
        type: 'grpc-end',
        status: 0,
        statusMessage: 'OK',
        data: { message: 'aggregated' },
        trailers: {},
      },
    ]);
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }, { message: 'two' }],
      { deps },
    );
    expect(outcome.passed).toBe(true);
    expect(outcome.body).toEqual({ message: 'aggregated' });
    expect(deps.sendStreamMessage).toHaveBeenCalledTimes(2);
    expect(deps.endStream).toHaveBeenCalledTimes(1);
    expect(deps.cancelStream).toHaveBeenCalledTimes(1);
  });

  it('executeGrpcHarnessBidiStream stops at max_messages', async () => {
    const deps = makeStreamDeps([
      { type: 'grpc-message', direction: 'inbound', data: { message: 'a' } },
      { type: 'grpc-message', direction: 'inbound', data: { message: 'b' } },
    ]);
    const outcome = await executeGrpcHarnessBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'ping' }],
      { maxMessages: 2 },
      { deps },
    );
    expect(outcome.passed).toBe(true);
    expect(outcome.streamStopReason).toBe('max_messages');
    expect(outcome.messages).toHaveLength(2);
    expect(deps.cancelStream).toHaveBeenCalledTimes(1);
    expect(deps.endStream).not.toHaveBeenCalled();
  });

  it('marks stream_error outcomes as failed', async () => {
    const deps = makeStreamDeps([
      {
        type: 'grpc-error',
        status: 13,
        statusMessage: 'Internal error',
        trailers: {},
      },
    ]);
    const outcome = await executeGrpcHarnessClientStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      TAB_ID,
      [{ message: 'one' }],
      { deps },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.streamStopReason).toBe('stream_error');
    expect(deps.cancelStream).toHaveBeenCalledTimes(1);
  });
});
