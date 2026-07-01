import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetGrpcTabTransportRoutingForTests,
  syncGrpcTabTransportMode,
} from './grpcTransportTabRouting';
import {
  openGrpcStreamEvents,
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

describe('grpcStreamClient helpers', () => {
  it('accepts strictly increasing sequences', () => {
    expect(shouldAcceptGrpcStreamSequence(1, 0)).toBe(true);
    expect(shouldAcceptGrpcStreamSequence(2, 1)).toBe(true);
  });

  it('rejects duplicate or older sequences', () => {
    expect(shouldAcceptGrpcStreamSequence(1, 1)).toBe(false);
    expect(shouldAcceptGrpcStreamSequence(1, 5)).toBe(false);
  });
});

describe('openGrpcStreamEvents', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delivers parsed events and stops after grpc-end (no reconnect)', async () => {
    const endPayload = JSON.stringify({
      type: 'grpc-end',
      streamId: 's1',
      requestId: 'r1',
      tabId: 'tab-1',
      sequence: 2,
      timestamp: '2026-01-01T00:00:01.000Z',
      status: 0,
      statusMessage: 'OK',
    });
    fetchMock.mockResolvedValueOnce(
      sseResponse([`event: grpc-end\ndata: ${endPayload}\n\n`]),
    );

    const events: string[] = [];
    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: (event) => events.push(event.type),
    });

    await vi.waitFor(() => {
      expect(events).toContain('grpc-end');
    });
    dispose();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect after terminal grpc-error event', async () => {
    const errorPayload = JSON.stringify({
      type: 'grpc-error',
      streamId: 's1',
      requestId: 'r1',
      tabId: 'tab-1',
      sequence: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      statusMessage: 'boom',
    });
    fetchMock.mockResolvedValueOnce(
      sseResponse([`event: grpc-error\ndata: ${errorPayload}\n\n`]),
    );

    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    dispose();
  });

  it('uses resolveLastSequence on reconnect attempts', async () => {
    fetchMock
      .mockResolvedValueOnce(sseResponse([]))
      .mockResolvedValueOnce(sseResponse([]));

    vi.useFakeTimers();
    const resolveLastSequence = vi.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(5);

    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      lastSequence: 0,
      resolveLastSequence,
      onEvent: () => undefined,
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock.mock.calls[1]?.[0]).toContain('lastSequence=5');
    dispose();
    vi.useRealTimers();
  });

  it('does not retry SSE attach on HTTP 404', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        ok: false,
        op: 'stream_events',
        error: { code: 'GRPC_REQUEST_NOT_FOUND', message: 'Stream not found' },
      }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
    );

    const onError = vi.fn();
    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
    });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('notifies closed when abort signal fires before SSE completes', async () => {
    fetchMock.mockImplementation((_url, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));

    const controller = new AbortController();
    const states: string[] = [];
    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      signal: controller.signal,
      onStateChange: (state) => states.push(state),
    });

    controller.abort();
    await vi.waitFor(() => {
      expect(states).toContain('closed');
    });
    dispose();
  });

  it('drops SSE events with mismatched tabId, streamId, or requestId', async () => {
    const makeMessagePayload = (overrides: Record<string, unknown>) => JSON.stringify({
      type: 'grpc-message',
      streamId: 's1',
      requestId: 'r1',
      tabId: 'tab-1',
      sequence: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { message: 'ok' },
      ...overrides,
    });

    fetchMock.mockResolvedValueOnce(
      sseResponse([
        `event: grpc-message\ndata: ${makeMessagePayload({ tabId: 'tab-other', data: { message: 'wrong-tab' } })}\n\n`,
        `event: grpc-message\ndata: ${makeMessagePayload({ streamId: 's-other', data: { message: 'wrong-stream' } })}\n\n`,
        `event: grpc-message\ndata: ${makeMessagePayload({ requestId: 'r-other', data: { message: 'wrong-req' } })}\n\n`,
        `event: grpc-message\ndata: ${makeMessagePayload({ data: { message: 'good' } })}\n\n`,
      ]),
    );

    const messages: string[] = [];
    const dispose = openGrpcStreamEvents('s1', 'tab-1', {
      expectedRequestId: 'r1',
      onEvent: (event) => {
        if (event.type === 'grpc-message' && event.data?.message) {
          messages.push(String(event.data.message));
        }
      },
    });

    await vi.waitFor(() => {
      expect(messages).toEqual(['good']);
    });
    dispose();
  });
});

describe('startGrpcStream transport dispatch (Phase 10A)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    resetGrpcTabTransportRoutingForTests();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects grpc-web stream_start with Phase 10H guidance when adapter has no startStream', async () => {
    syncGrpcTabTransportMode('tab-grpc-web', 'grpc-web');

    await expect(startGrpcStream({
      callType: 'server_streaming',
    } as never, 'tab-grpc-web')).rejects.toMatchObject({
      message: expect.stringMatching(/Phase 10H/i),
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects spring-servlet stream_start with Phase 10H guidance when adapter has no startStream', async () => {
    syncGrpcTabTransportMode('tab-servlet', 'spring-servlet');

    await expect(startGrpcStream({
      callType: 'server_streaming',
    } as never, 'tab-servlet')).rejects.toMatchObject({
      message: expect.stringMatching(/Phase 10H/i),
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses snapshot transportMode over tab registry for stream_start', async () => {
    syncGrpcTabTransportMode('tab-snapshot-stream', 'grpc-web');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        op: 'stream_start',
        data: { streamId: 'stream-1', requestId: 'req-1', tabId: 'tab-snapshot-stream' },
        meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: 'req-1' },
      }),
    });

    const envelope = await startGrpcStream({
      callType: 'server_streaming',
    } as never, 'tab-snapshot-stream', { transportMode: 'express' });

    expect(fetchMock).toHaveBeenCalled();
    expect(envelope.data.streamId).toBe('stream-1');
  });
});
