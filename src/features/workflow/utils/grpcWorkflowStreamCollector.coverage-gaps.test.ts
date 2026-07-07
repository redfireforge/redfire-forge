/**
 * Coverage gaps — grpcWorkflowStreamCollector.ts
 */
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

describe('grpcWorkflowStreamCollector coverage gaps', () => {
  const request = {
    requestId: 'req-stream',
    target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
    descriptorKey: 'dk',
    service: 'echo.EchoService',
    method: 'ServerStream',
    body: { message: 'hi' },
  } satisfies GrpcStreamStartRequest;

  it('skips grpc-heartbeat frames and invalid JSON payloads', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-hb' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-heartbeat', data: '{}' },
        { event: 'grpc-message', data: 'not-json' },
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { n: 1 } }) },
        { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end', status: 0, statusMessage: 'OK' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-hb',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.messages).toEqual([{ n: 1 }]);
    expect(result.stopReason).toBe('stream_end');
  });

  it('returns transport_error when events response is not ok', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-bad' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: false,
      status: 502,
      body: null,
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-bad',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('transport_error');
    expect(result.errorDetail).toContain('502');
    expect(cancelStream).toHaveBeenCalledWith('stream-bad', 'workflow:node-bad');
  });

  it('defaults stopReason to stream_end when SSE closes without terminal event', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-quiet' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-quiet',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('stream_end');
    expect(result.grpcStatus).toBe(0);
    expect(result.grpcStatusMessage).toBe('OK');
  });

  it('ignores frames missing type field', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-shape' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-message', data: JSON.stringify({ notType: true }) },
        { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end', status: 0, statusMessage: 'OK' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-shape',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.messages).toEqual([]);
    expect(result.stopReason).toBe('stream_end');
  });

  it('builds events URL with encoded stream id and tab id', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream/with space' },
    }));
    const fetchEvents = vi.fn(async (url: string) => {
      expect(url).toContain(encodeURIComponent('stream/with space'));
      expect(url).toContain('tabId=workflow%3Anode-url');
      return {
        ok: true,
        body: sseBody([
          { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end', status: 0, statusMessage: 'OK' }) },
        ]),
      } as Response;
    });

    await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-url',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );
  });

  it('stops with cancelled reason when controller aborts mid-loop', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const abortController = new AbortController();
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-abort-loop' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(
            `event: grpc-message\ndata: ${JSON.stringify({ type: 'grpc-message', data: { n: 1 } })}\n\n`,
          ));
          await new Promise((resolve) => setTimeout(resolve, 20));
          abortController.abort();
          controller.enqueue(new TextEncoder().encode(
            `event: grpc-message\ndata: ${JSON.stringify({ type: 'grpc-message', data: { n: 2 } })}\n\n`,
          ));
          controller.close();
        },
      }),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-abort-loop',
      { maxMessages: 5 },
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, fetchEvents },
      },
    );

    expect(result.stopReason).toBe('cancelled');
    expect(cancelStream).toHaveBeenCalledWith('stream-abort-loop', 'workflow:node-abort-loop');
  });

  it('returns transport_error when response body is missing', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-no-body' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: null,
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-no-body',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('transport_error');
    expect(cancelStream).toHaveBeenCalled();
  });

  it('registers abort listener when abortSignal is provided but not yet aborted', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const abortController = new AbortController();
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-listener' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end', status: 0, statusMessage: 'OK' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-listener',
      {},
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, fetchEvents },
      },
    );

    expect(result.stopReason).toBe('stream_end');
  });

  it('sets grpcStatus OK for max_messages stop reason', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-ok-status' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { n: 1 } }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-ok-status',
      { maxMessages: 1 },
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('max_messages');
    expect(result.grpcStatus).toBe(0);
    expect(result.grpcStatusMessage).toBe('OK');
  });

  it('skips grpc-message events without data payload', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-no-data' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message' }) },
        { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end', status: 0, statusMessage: 'OK' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-no-data',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.messages).toEqual([]);
    expect(result.stopReason).toBe('stream_end');
  });

  it('uses openStreamEvents transport when deps omit fetch override', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-default-fetch' },
    }));
    const openStreamEvents = vi.fn((_streamId: string, _tabId: string, handlers: {
      onEvent: (event: unknown) => void;
      onStateChange: (state: 'open' | 'closed') => void;
    }) => {
      handlers.onEvent({ type: 'grpc-end', status: 0, statusMessage: 'OK' });
      handlers.onStateChange('closed');
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-default-fetch',
      {},
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(openStreamEvents).toHaveBeenCalled();
    expect(result.stopReason).toBe('stream_end');
  });

  it('breaks the SSE loop when controller aborts between frames', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const abortController = new AbortController();
    let pullCount = 0;
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-loop-abort' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        async pull(controller) {
          pullCount += 1;
          if (pullCount === 1) {
            controller.enqueue(new TextEncoder().encode(
              `event: grpc-message\ndata: ${JSON.stringify({ type: 'grpc-message', data: { n: 1 } })}\n\n`,
            ));
            await new Promise((resolve) => setTimeout(resolve, 20));
            abortController.abort();
            return;
          }
          controller.close();
        },
      }),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-loop-abort',
      {},
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, fetchEvents },
      },
    );

    expect(result.stopReason).toBe('cancelled');
    expect(result.messages).toHaveLength(1);
  });

  it('fires maxDurationMs timer callback and stops with max_duration', async () => {
    vi.useFakeTimers();
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-timer' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: new ReadableStream<Uint8Array>({ start() {} }),
    } as Response));

    const pending = collectGrpcWorkflowServerStream(
      request,
      'workflow:node-timer',
      { maxDurationMs: 100 },
      { deps: { startStream, cancelStream, fetchEvents } },
    );
    await vi.advanceTimersByTimeAsync(100);
    const result = await pending;

    expect(result.stopReason).toBe('max_duration');
    expect(result.grpcStatus).toBe(0);
    expect(result.grpcStatusMessage).toBe('OK');
    vi.useRealTimers();
  }, 10000);

  it('defaults cancelled stopReason when stream ends empty under abort', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const abortController = new AbortController();
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-empty-abort' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          abortController.abort();
          controller.close();
        },
      }),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-empty-abort',
      {},
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, fetchEvents },
      },
    );

    expect(result.stopReason).toBe('cancelled');
  });

  it('handles grpc-error events with defaulted status fields', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-error-defaults' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-error', data: JSON.stringify({ type: 'grpc-error' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-error-defaults',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('stream_error');
    expect(result.grpcStatus).toBe(13);
    expect(result.grpcStatusMessage).toBe('Stream error');
  });

  it('handles grpc-end events with defaulted status fields', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-defaults' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-defaults',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.grpcStatus).toBe(0);
    expect(result.grpcStatusMessage).toBe('OK');
    expect(result.trailers).toEqual({});
  });

  it('ignores zero maxDurationMs values', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-zero-duration' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end', status: 0, statusMessage: 'OK' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-zero-duration',
      { maxDurationMs: 0 },
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('stream_end');
  });

  it('handles openStreamEvents closed state via deps override', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-closed', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: { onStateChange?: (state: string) => void },
    ) => {
      options.onStateChange?.('closed');
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-closed',
      {},
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(result.stopReason).toBe('stream_end');
    expect(result.grpcStatus).toBe(0);
    expect(result.grpcStatusMessage).toBe('OK');
  });

  it('collects via openStreamEvents until max_messages', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-max', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: { onEvent: (event: { type: string; data?: Record<string, unknown> }) => void },
    ) => {
      options.onEvent({ type: 'grpc-message', data: { n: 1 } });
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-max',
      { maxMessages: 1 },
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(result.stopReason).toBe('max_messages');
    expect(result.messages).toEqual([{ n: 1 }]);
    expect(result.grpcStatus).toBe(0);
  });

  it('stops openStreamEvents collection when abort signal is already set on event', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const abortController = new AbortController();
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-abort', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: {
        signal: AbortSignal;
        onEvent: (event: { type: string; data?: Record<string, unknown> }) => void;
      },
    ) => {
      options.onEvent({ type: 'grpc-message', data: { n: 1 } });
      abortController.abort();
      options.onEvent({ type: 'grpc-message', data: { n: 2 } });
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-abort',
      {},
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, openStreamEvents },
      },
    );

    expect(result.stopReason).toBe('cancelled');
    expect(result.messages).toEqual([{ n: 1 }]);
  });

  it('routes openStreamEvents onError through transport_error', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-error', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: { onError: (message: string) => void },
    ) => {
      options.onError('stream transport failed');
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-error',
      {},
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(result.stopReason).toBe('transport_error');
    expect(result.errorDetail).toBe('stream transport failed');
  });

  it('continues openStreamEvents until terminal grpc-end event', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-flow', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: { onEvent: (event: { type: string; data?: Record<string, unknown>; status?: number; statusMessage?: string }) => void },
    ) => {
      options.onEvent({ type: 'grpc-message', data: { n: 1 } });
      options.onEvent({ type: 'grpc-message', data: { n: 2 } });
      options.onEvent({ type: 'grpc-end', status: 0, statusMessage: 'OK' });
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-flow',
      {},
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(result.stopReason).toBe('stream_end');
    expect(result.messages).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('stops openStreamEvents on max_duration inside onEvent callback', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-duration', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: { onEvent: (event: { type: string; data?: Record<string, unknown> }) => void },
    ) => {
      options.onEvent({ type: 'grpc-message', data: { n: 1 } });
      return () => undefined;
    });
    let tick = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      tick += 1;
      return tick * 1500;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-duration',
      { maxDurationMs: 1000 },
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    vi.mocked(performance.now).mockRestore();
    expect(result.stopReason).toBe('max_duration');
    expect(result.grpcStatus).toBe(0);
  });

  it('ignores unknown openStreamEvents after terminal finish', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-finish', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: {
        onEvent: (event: { type: string; status?: number; statusMessage?: string }) => void;
        onError: (message: string) => void;
      },
    ) => {
      options.onEvent({ type: 'grpc-end', status: 0, statusMessage: 'OK' });
      options.onError('ignored');
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-finish',
      {},
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(result.stopReason).toBe('stream_end');
  });

  it('ignores unrecognized stream event types in SSE fetch path', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-unknown', requestId: 'req-stream' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-message', data: JSON.stringify({ type: 'unknown-event' }) },
        { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end', status: 0, statusMessage: 'OK' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-unknown',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.messages).toEqual([]);
    expect(result.stopReason).toBe('stream_end');
  });

  it('maps AbortError during SSE fetch to cancelled stopReason', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const abortController = new AbortController();
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-abort-error', requestId: 'req-stream' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: new ReadableStream({
        start() {
          abortController.abort();
        },
      }),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-abort-error',
      {},
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, fetchEvents },
      },
    );

    expect(result.stopReason).toBe('cancelled');
  });

  it('maps non-Error transport failures to string errorDetail', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-string-error', requestId: 'req-stream' },
    }));
    const fetchEvents = vi.fn(async () => {
      throw 'string transport failure';
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-string-error',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('transport_error');
    expect(result.errorDetail).toBe('string transport failure');
  });

  it('swallows cancelStream failures in finally block', async () => {
    const cancelStream = vi.fn(async () => {
      throw new Error('cancel failed');
    });
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-cancel-fail', requestId: 'req-stream' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end', status: 0, statusMessage: 'OK' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-cancel-fail',
      {},
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.stopReason).toBe('stream_end');
    expect(cancelStream).toHaveBeenCalled();
  });

  it('resolves openStreamEvents immediately when controller is already aborted', async () => {
    vi.useFakeTimers();
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-pre-abort', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn(() => () => undefined);

    const pending = collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-pre-abort',
      { maxDurationMs: 50 },
      { deps: { startStream, cancelStream, openStreamEvents } },
    );
    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;

    expect(result.stopReason).toBe('max_duration');
    expect(result.grpcStatus).toBe(0);
    vi.useRealTimers();
  }, 10000);

  it('handles openStreamEvents abort listener while waiting for events', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const abortController = new AbortController();
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-listener', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn(() => () => undefined);

    const pending = collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-listener',
      {},
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, openStreamEvents },
      },
    );
    abortController.abort();
    const result = await pending;

    expect(result.stopReason).toBe('cancelled');
  });

  it('stops openStreamEvents on untilExpression match', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-until', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: { onEvent: (event: { type: string; data?: Record<string, unknown> }) => void },
    ) => {
      options.onEvent({ type: 'grpc-message', data: { phase: 'done' } });
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-until',
      { untilExpression: '$.phase == "done"' },
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(result.stopReason).toBe('until_expression');
    expect(result.grpcStatus).toBe(0);
  });

  it('handles grpc-error events from openStreamEvents', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-grpc-error', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: { onEvent: (event: { type: string; status?: number; statusMessage?: string }) => void },
    ) => {
      options.onEvent({ type: 'grpc-error', status: 13, statusMessage: 'boom' });
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-grpc-error',
      {},
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(result.stopReason).toBe('stream_error');
    expect(result.errorDetail).toBe('boom');
  });

  it('continues collecting when untilExpression is set but does not match', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-until-miss', requestId: 'req-stream' },
    }));
    const fetchEvents = vi.fn(async () => ({
      ok: true,
      body: sseBody([
        { event: 'grpc-message', data: JSON.stringify({ type: 'grpc-message', data: { phase: 'start' } }) },
        { event: 'grpc-end', data: JSON.stringify({ type: 'grpc-end', status: 0, statusMessage: 'OK' }) },
      ]),
    } as Response));

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-until-miss',
      { untilExpression: '$.phase == "done"', maxMessages: 5 },
      { deps: { startStream, cancelStream, fetchEvents } },
    );

    expect(result.messages).toHaveLength(1);
    expect(result.stopReason).toBe('stream_end');
  });

  it('skips openStreamEvents grpc-message frames without data', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-no-data', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: { onEvent: (event: { type: string; data?: Record<string, unknown> }) => void },
    ) => {
      options.onEvent({ type: 'grpc-message' });
      options.onEvent({ type: 'grpc-end', status: 0, statusMessage: 'OK' });
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-no-data',
      {},
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(result.messages).toEqual([]);
    expect(result.stopReason).toBe('stream_end');
  });

  it('preserves an existing stopReason when openStreamEvents abort fires', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const abortController = new AbortController();
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-preserve-stop', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: {
        onEvent: (event: { type: string; data?: Record<string, unknown> }) => void;
      },
    ) => {
      options.onEvent({ type: 'grpc-message', data: { n: 1 } });
      abortController.abort();
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-preserve-stop',
      { maxMessages: 1 },
      {
        abortSignal: abortController.signal,
        deps: { startStream, cancelStream, openStreamEvents },
      },
    );

    expect(result.stopReason).toBe('max_messages');
    expect(result.messages).toEqual([{ n: 1 }]);
  });

  it('invokes openStreamEvents dispose cleanup on finish', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const dispose = vi.fn();
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-dispose', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: { onStateChange?: (state: string) => void },
    ) => {
      queueMicrotask(() => {
        options.onStateChange?.('closed');
      });
      return dispose;
    });

    await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-dispose',
      {},
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(dispose).toHaveBeenCalled();
  });

  it('ignores non-closed openStreamEvents state changes', async () => {
    const cancelStream = vi.fn(async () => undefined);
    const startStream = vi.fn(async () => ({
      ok: true as const,
      op: 'stream_start' as const,
      data: { streamId: 'stream-open-state', requestId: 'req-stream' },
    }));
    const openStreamEvents = vi.fn((
      _streamId: string,
      _tabId: string,
      options: {
        onStateChange?: (state: string) => void;
        onEvent: (event: { type: string; status?: number; statusMessage?: string }) => void;
      },
    ) => {
      options.onStateChange?.('connecting');
      options.onEvent({ type: 'grpc-end', status: 0, statusMessage: 'OK' });
      return () => undefined;
    });

    const result = await collectGrpcWorkflowServerStream(
      request,
      'workflow:node-open-state',
      {},
      { deps: { startStream, cancelStream, openStreamEvents } },
    );

    expect(result.stopReason).toBe('stream_end');
  });
});
