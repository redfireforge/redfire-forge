import { describe, expect, it, vi } from 'vitest';
import { collectGrpcWorkflowServerStream } from './grpcWorkflowStreamCollector';
import type { GrpcStreamStartRequest } from '../../../shared/grpc/contracts';

function sseBody(frames: Array<{ event: string; data: string }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = frames
    .map((frame) => `event: ${frame.event}\ndata: ${frame.data}\n\n`)
    .join('');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

describe('collectGrpcWorkflowServerStream', () => {
  const request = {
    requestId: 'req-stream',
    target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
    descriptorKey: 'dk',
    service: 'echo.EchoService',
    method: 'ServerStream',
    body: { message: 'hi' },
  } satisfies GrpcStreamStartRequest;

  it('stops on maxMessages and cancels stream', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-1' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { n: 1 } }) },
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { n: 2 } }) },
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { n: 3 } }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-1',
      { maxMessages: 2 },
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('max_messages');
    expect(result.messages).toHaveLength(2);
    expect(cancelStream).toHaveBeenCalledWith('stream-1', 'workflow:node-1');
  });

  it('stops on untilExpression', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-2' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { phase: 'start' } }) },
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { phase: 'done' } }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-2',
      { untilExpression: '$.phase == "done"' },
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('until_expression');
    expect(result.messages).toHaveLength(2);
    expect(cancelStream).toHaveBeenCalled();
  });

  it('always cancels stream when start throws', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => {
      throw new Error('start failed');
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-3',
      {},
      { deps: { startStream, cancelStream } },
    );

    expect(result.stopReason).toBe('transport_error');
    expect(cancelStream).not.toHaveBeenCalled();
  });

  it('cancels stream after grpc-error event', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-4' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-error', data: JSON.stringify({ type: 'grpc-error', status: 13, statusMessage: 'boom' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-4',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('stream_error');
    expect(cancelStream).toHaveBeenCalledWith('stream-4', 'workflow:node-4');
  });

  it('stops on grpc-end with server status', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-5' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { n: 1 } }) },
        { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end', status: 0, statusMessage: 'OK', trailers: { 'x-test': '1' } }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-5',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('stream_end');
    expect(result.grpcStatus).toBe(0);
    expect(result.messages).toHaveLength(1);
    expect(result.trailers).toEqual({ 'x-test': '1' });
    expect(cancelStream).toHaveBeenCalled();
  });

  it('stops on maxDurationMs at loop tick', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-6' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { n: 1 } }) },
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { n: 2 } }) },
      ]),
    } as Response));

    let tick = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      tick += 1;
      return tick * 600;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-6',
      { maxDurationMs: 1000 },
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    vi.mocked(performance.now).mockRestore();
    expect(result.stopReason).toBe('max_duration');
    expect(result.messages).toHaveLength(1);
    expect(cancelStream).toHaveBeenCalled();
  });

  it('stops on maxDurationMs when SSE stream is idle (no frames)', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-idle' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: new ReadableStream<Uint8Array>({ start() {} }),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-idle',
      { maxDurationMs: 50 },
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('max_duration');
    expect(result.messages).toHaveLength(0);
    expect(cancelStream).toHaveBeenCalledWith('stream-idle', 'workflow:node-idle');
  }, 5000);

  it('prefers untilExpression over maxMessages on the same message', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-7' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { phase: 'done' } }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-7',
      { maxMessages: 1, untilExpression: '$.phase == "done"' },
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('until_expression');
    expect(result.messages).toHaveLength(1);
  });

  it('cancels stream when fetchEvents throws after start', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-8' },
    }));
    const fetchEvents = vi.fn(async () => {
      throw new Error('SSE connection lost');
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-8',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('transport_error');
    expect(cancelStream).toHaveBeenCalledWith('stream-8', 'workflow:node-8');
  });

  it('returns cancelled without starting when abortSignal is already aborted', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-9' },
    }));
    const controller = new AbortController();
    controller.abort();

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-9',
      {},
      { abortSignal: controller.signal, deps: { startStream, cancelStream } },
    );

    expect(result.stopReason).toBe('cancelled');
    expect(startStream).not.toHaveBeenCalled();
    expect(cancelStream).not.toHaveBeenCalled();
  });

  it('cancels active stream when abortSignal fires during collection', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const abortController = new AbortController();
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-10' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            `event: grpc-message\ndata: ${JSON.stringify({ type: 'grpc-message', data: { n: 1 } })}\n\n`,
          ));
          abortController.abort();
        },
      }),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-10',
      { maxMessages: 5 },
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, fetchEvents },
      },
    );

    expect(result.stopReason).toBe('cancelled');
    expect(cancelStream).toHaveBeenCalledWith('stream-10', 'workflow:node-10');
  });

  it('collects via openStreamEvents when fetchEvents is not injected (Phase 7E native path)', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-native', requestId: 'req-native' },
    }));
    const openStreamEvents = vi.fn((_streamId, _tabId, options) => {
      queueMicrotask(() => {
        options.onStateChange?.('connected');
        options.onEvent({
          type: 'grpc-message',
          streamId: 'stream-native',
          requestId: 'req-native',
          tabId: 'workflow:node-native',
          sequence: 1,
          timestamp: '2026-06-30T00:00:00.000Z',
          data: { n: 1 },
        });
        options.onEvent({
          type: 'grpc-end',
          streamId: 'stream-native',
          requestId: 'req-native',
          tabId: 'workflow:node-native',
          sequence: 2,
          timestamp: '2026-06-30T00:00:00.000Z',
          status: 0,
          statusMessage: 'OK',
        });
        options.onStateChange?.('closed');
      });
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-native',
      {},
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(openStreamEvents).toHaveBeenCalledWith(
      'stream-native',
      'workflow:node-native',
      expect.objectContaining({ expectedRequestId: 'req-native' }),
    );
    expect(result.stopReason).toBe('stream_end');
    expect(result.messages).toEqual([{ n: 1 }]);
    expect(cancelStream).toHaveBeenCalledWith('stream-native', 'workflow:node-native');
  });

  it('stops on maxDurationMs when openStreamEvents is idle (production path)', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-idle-open', requestId: 'req-idle' },
    }));
    const openStreamEvents = vi.fn((_streamId, _tabId, options) => {
      options.onStateChange?.('connecting');
      options.onStateChange?.('connected');
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-idle-open',
      { maxDurationMs: 50 },
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(result.stopReason).toBe('max_duration');
    expect(cancelStream).toHaveBeenCalledWith('stream-idle-open', 'workflow:node-idle-open');
  }, 5000);

  it('cancels when abortSignal fires during idle openStreamEvents (production path)', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-abort-open', requestId: 'req-abort' },
    }));
    const openStreamEvents = vi.fn((_streamId, _tabId, options) => {
      options.onStateChange?.('connected');
      return () => undefined;
    });

    const abortController = new AbortController();
    const collectPromise = collectGrpcWorkflowServerStream(
      request,
      'workflow:node-abort-open',
      {},
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, openStreamEvents },
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    abortController.abort();

    const result = await collectPromise;
    expect(result.stopReason).toBe('cancelled');
    expect(cancelStream).toHaveBeenCalledWith('stream-abort-open', 'workflow:node-abort-open');
  }, 5000);
});
