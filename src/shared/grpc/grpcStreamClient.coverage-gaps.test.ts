import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelGrpcStream,
  endGrpcStream,
  openGrpcStreamEvents,
  sendGrpcStreamMessage,
  setGrpcStreamEventsOpener,
  setGrpcStreamTransport,
  shouldAcceptGrpcStreamSequence,
  startGrpcStream,
} from './grpcStreamClient';

function sseResponse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('grpcStreamClient coverage gaps', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    setGrpcStreamTransport(null);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    setGrpcStreamTransport(null);
    setGrpcStreamEventsOpener(null);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('startGrpcStream, sendGrpcStreamMessage, endGrpcStream, and cancelGrpcStream use transport override', async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        op: 'stream_start',
        data: { streamId: 's1', requestId: 'r1' },
      })
      .mockResolvedValueOnce({
        ok: true,
        op: 'stream_send',
        data: { streamId: 's1', tabId: 'tab-1', sequence: 1 },
      })
      .mockResolvedValueOnce({
        ok: true,
        op: 'stream_end',
        data: { streamId: 's1', tabId: 'tab-1' },
      })
      .mockResolvedValueOnce({
        ok: true,
        op: 'stream_cancel',
        data: { streamId: 's1', tabId: 'tab-1' },
      });
    setGrpcStreamTransport(transport);

    await startGrpcStream({ callType: 'server_streaming' } as never, 'tab-1');
    await sendGrpcStreamMessage('s1', 'tab-1', { body: {} } as never);
    await endGrpcStream('s1', 'tab-1');
    await cancelGrpcStream('s1', 'tab-1');

    expect(transport).toHaveBeenCalledTimes(4);
  });

  it('openGrpcStreamEvents skips malformed event frames', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse(['event: grpc-message\ndata: not-json\n\n']),
    );

    const onEvent = vi.fn();
    const dispose = openGrpcStreamEvents('s1', 'tab-1', { onEvent });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(onEvent).not.toHaveBeenCalled();
    dispose();
  });

  it('openGrpcStreamEvents aborts when external signal is aborted', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));

    const controller = new AbortController();
    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      signal: controller.signal,
      onEvent: () => undefined,
    });

    controller.abort();
    dispose();
    vi.useRealTimers();
  });

  it('skips heartbeat frames and reconnects after unexpected stream close', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(sseResponse(['event: grpc-heartbeat\ndata: {}\n\n']))
      .mockResolvedValueOnce(sseResponse([]));

    const onStateChange = vi.fn();
    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onStateChange,
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(onStateChange).toHaveBeenCalledWith('reconnecting', 1);
    dispose();
  });

  it('stops reconnecting after max attempts', async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new Error('network down'));

    const onError = vi.fn();
    const onStateChange = vi.fn();
    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
      onStateChange,
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await vi.waitFor(() => {
        expect(fetchMock.mock.calls.length).toBeGreaterThan(attempt);
      });
      await vi.advanceTimersByTimeAsync(10_000);
    }

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('network down');
    });
    expect(onStateChange).toHaveBeenCalledWith('closed');
    dispose();
  });

  it('openGrpcStreamEvents surfaces JSON error body on HTTP 409 without retry', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        ok: false,
        op: 'stream_events',
        error: { code: 'GRPC_STREAM_CONFLICT', message: 'Stream conflict' },
      }), { status: 409, headers: { 'Content-Type': 'application/json' } }),
    );

    const onError = vi.fn();
    openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
    });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Stream conflict');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('startGrpcStream throws on transport error envelope', async () => {
    setGrpcStreamTransport(async () => ({
      ok: false,
      op: 'stream_start',
      error: { code: 'GRPC_CALL_FAILED', message: 'start rejected', retryable: false },
    }));

    await expect(startGrpcStream({ callType: 'server_streaming' } as never, 'tab-1'))
      .rejects.toThrow(/start rejected/);
  });

  it('fetch path rejects non-JSON responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    await expect(startGrpcStream({ callType: 'server_streaming' } as never, 'tab-1'))
      .rejects.toThrow(/non-JSON response/i);
  });

  it('shouldAcceptGrpcStreamSequence accepts strictly greater sequences', () => {
    expect(shouldAcceptGrpcStreamSequence(2, 1)).toBe(true);
    expect(shouldAcceptGrpcStreamSequence(1, 1)).toBe(false);
  });

  it('openGrpcStreamEvents dispatches parsed grpc-message events', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'event: grpc-message\ndata: {"type":"grpc-message","streamId":"s1","tabId":"tab-1","requestId":"r1","sequence":1,"timestamp":"2026-01-01T00:00:00.000Z","direction":"inbound","data":{"message":"hi"}}\n\n',
      ]),
    );

    const onEvent = vi.fn();
    const onStateChange = vi.fn();
    const dispose = openGrpcStreamEvents('s1', 'tab-1', { onEvent, onStateChange });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'grpc-message' }));
    });
    expect(onStateChange).toHaveBeenCalledWith('connected');
    dispose();
  });

  it('openGrpcStreamEvents stops after grpc-end terminal event', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'event: grpc-end\ndata: {"type":"grpc-end","streamId":"s1","tabId":"tab-1","requestId":"r1","sequence":2,"timestamp":"2026-01-01T00:00:01.000Z","status":0,"statusMessage":"OK"}\n\n',
      ]),
    );

    const onStateChange = vi.fn();
    openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onStateChange,
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith('connected');
    });
  });

  it('openGrpcStreamEvents uses resolveLastSequence in reconnect query', async () => {
    fetchMock.mockResolvedValueOnce(sseResponse([]));
    openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      resolveLastSequence: () => 42,
    });
    await vi.waitFor(() => {
      expect(fetchMock.mock.calls[0]?.[0]).toContain('lastSequence=42');
    });
  });

  it('openGrpcStreamEvents closes without retry on HTTP 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));

    const onError = vi.fn();
    const onStateChange = vi.fn();
    openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
      onStateChange,
    });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/404/));
    });
    expect(onStateChange).toHaveBeenCalledWith('closed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('openGrpcStreamEvents surfaces error when response body is missing', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const onError = vi.fn();
    openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await vi.waitFor(() => {
        expect(fetchMock.mock.calls.length).toBeGreaterThan(attempt);
      });
      await vi.advanceTimersByTimeAsync(10_000);
    }

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
    expect(onError.mock.calls.at(-1)?.[0]).toMatch(/body|undefined/i);
  });

  it('fetch dispatchJson rejects mismatched operation envelopes', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      op: 'stream_send',
      data: {},
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(startGrpcStream({ callType: 'server_streaming' } as never, 'tab-1'))
      .rejects.toThrow(/mismatched operation/i);
  });

  it('transport throwIfNotOk uses fallback code and message', async () => {
    setGrpcStreamTransport(async () => ({
      ok: false,
      op: 'stream_start',
      error: { code: '   ', message: '   ', retryable: false },
    }));

    await expect(startGrpcStream({ callType: 'server_streaming' } as never, 'tab-1'))
      .rejects.toThrow(/GRPC_CLIENT_ERROR/);
  });

  it('setGrpcStreamEventsOpener override bypasses fetch SSE loop', () => {
    const opener = vi.fn(() => vi.fn());
    setGrpcStreamEventsOpener(opener);
    const dispose = openGrpcStreamEvents('s1', 'tab-1', { onEvent: () => undefined });
    expect(opener).toHaveBeenCalledWith('s1', 'tab-1', expect.any(Object));
    dispose();
  });

  it('openGrpcStreamEvents ignores SSE frames without a typed event payload', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse(['event: grpc-message\ndata: {"not":"event"}\n\n']),
    );
    const onEvent = vi.fn();
    openGrpcStreamEvents('s1', 'tab-1', { onEvent });
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('openGrpcStreamEvents dispose is idempotent', async () => {
    fetchMock.mockImplementation((_url, init) => new Promise(() => {
      init?.signal?.addEventListener('abort', () => undefined);
    }));
    const dispose = openGrpcStreamEvents('s1', 'tab-1', { onEvent: () => undefined });
    dispose();
    dispose();
  });

  it('openGrpcStreamEvents reconnects after SSE closes without terminal event', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(sseResponse([]));

    const onStateChange = vi.fn();
    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onStateChange,
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
    dispose();
    vi.useRealTimers();
  });

  it('openGrpcStreamEvents uses static lastSequence query param', async () => {
    fetchMock.mockResolvedValueOnce(sseResponse([]));
    openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      lastSequence: 9,
    });
    await vi.waitFor(() => {
      expect(fetchMock.mock.calls[0]?.[0]).toContain('lastSequence=9');
    });
  });

  it('setGrpcStreamEventsOpener override returns custom dispose handler', () => {
    const dispose = vi.fn();
    setGrpcStreamEventsOpener(() => dispose);
    const returned = openGrpcStreamEvents('s1', 'tab-1', { onEvent: () => undefined });
    returned();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('openGrpcStreamEvents dispose only emits closed state once', async () => {
    fetchMock.mockImplementation((_url, init) => new Promise(() => {
      init?.signal?.addEventListener('abort', () => undefined);
    }));
    const onStateChange = vi.fn();
    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onStateChange,
    });
    dispose();
    onStateChange.mockClear();
    dispose();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('sendGrpcStreamMessage uses fetch when transport override is unset', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      op: 'stream_send',
      data: { streamId: 's1', tabId: 'tab-1', sequence: 1 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await sendGrpcStreamMessage('s1', 'tab-1', { body: {} } as never);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('endGrpcStream and cancelGrpcStream use fetch when transport override is unset', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        op: 'stream_end',
        data: { streamId: 's1', tabId: 'tab-1' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        op: 'stream_cancel',
        data: { streamId: 's1', tabId: 'tab-1' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await endGrpcStream('s1', 'tab-1');
    await cancelGrpcStream('s1', 'tab-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('openGrpcStreamEvents surfaces default message for non-JSON 409 responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('plain conflict', { status: 409 }));

    const onError = vi.fn();
    openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
    });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/409/));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('openGrpcStreamEvents emits connecting before connected', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'event: grpc-message\ndata: {"type":"grpc-message","streamId":"s1","tabId":"tab-1","requestId":"r1","sequence":1,"timestamp":"2026-01-01T00:00:00.000Z","direction":"inbound","data":{"message":"hi"}}\n\n',
      ]),
    );

    const onStateChange = vi.fn();
    openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onStateChange,
    });

    await vi.waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith('connecting', 0);
      expect(onStateChange).toHaveBeenCalledWith('connected');
    });
  });

  it('openGrpcStreamEvents stops after grpc-error terminal event', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'event: grpc-error\ndata: {"type":"grpc-error","streamId":"s1","tabId":"tab-1","requestId":"r1","sequence":1,"timestamp":"2026-01-01T00:00:00.000Z","status":13,"statusMessage":"INTERNAL"}\n\n',
      ]),
    );

    const onEvent = vi.fn();
    openGrpcStreamEvents('s1', 'tab-1', { onEvent });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'grpc-error' }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
