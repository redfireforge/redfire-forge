import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./grpcTauriDescriptorBridge', () => ({
  prepareGrpcTauriDescriptorPayload: vi.fn(),
}));

import { prepareGrpcTauriDescriptorPayload } from './grpcTauriDescriptorBridge';
import {
  FIXTURE_ECHO_DESCRIPTOR_PAYLOAD,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from './contractFixtures';
import { encodeGrpcWebProtoMessage } from './grpcWebProtoCodec';
import { concatGrpcWebFrames, encodeGrpcWebDataFrame } from './grpcWebFramingCodec';
import { GRPC_WEB_CONTENT_TYPES } from './grpcWebTransportContracts';
import { syncGrpcTabTransportMode, resetGrpcTabTransportRoutingForTests } from './grpcTransportTabRouting';
import { GrpcApiClientError } from './grpcApiClient';
import * as grpcBrowserTransportAdapters from './grpcBrowserTransportAdapters';
import {
  cancelGrpcStream,
  endGrpcStream,
  openGrpcStreamEvents,
  resetBrowserDirectGrpcStreamsForTests,
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
  let adapterSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    fetchMock.mockReset();
    adapterSpy?.mockRestore();
    adapterSpy = undefined;
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

  it('startGrpcStream throws generic message when adapter lacks stream start on express', async () => {
    adapterSpy = vi.spyOn(grpcBrowserTransportAdapters, 'getGrpcBrowserTransportAdapter').mockReturnValue({
      mode: 'express',
      dispatchReady: true,
      invokeUnary: vi.fn(),
      cancelUnary: vi.fn(),
    });
    syncGrpcTabTransportMode('tab-express-no-stream', 'express');

    await expect(startGrpcStream({
      callType: 'client_streaming',
      requestId: 'req-express-no-stream',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ClientStream',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-express-no-stream')).rejects.toThrow(/does not support stream start/);
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

  it('openGrpcStreamEvents ignores duplicate SSE sequence numbers', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'event: grpc-message\ndata: {"type":"grpc-message","streamId":"s1","tabId":"tab-1","requestId":"r1","sequence":2,"timestamp":"2026-01-01T00:00:00.000Z","direction":"inbound","data":{"message":"first"}}\n\n',
        'event: grpc-message\ndata: {"type":"grpc-message","streamId":"s1","tabId":"tab-1","requestId":"r1","sequence":2,"timestamp":"2026-01-01T00:00:01.000Z","direction":"inbound","data":{"message":"dup"}}\n\n',
      ]),
    );

    const onEvent = vi.fn();
    openGrpcStreamEvents('s1', 'tab-1', { onEvent, lastSequence: 1 });

    await vi.waitFor(() => {
      expect(onEvent).not.toHaveBeenCalled();
    });
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

function buildSuccessGrpcWebStreamResponse(protosetBase64: string): Response {
  const responsePayload = encodeGrpcWebProtoMessage(
    protosetBase64,
    'echo.EchoResponse',
    { message: 'stream-pong' },
  );
  const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
      'grpc-status': '0',
      'grpc-message': '',
    },
  });
}

describe('browser-direct grpc stream client coverage gaps', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    resetGrpcTabTransportRoutingForTests();
    resetBrowserDirectGrpcStreamsForTests();
    setGrpcStreamTransport(null);
    setGrpcStreamEventsOpener(null);
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(prepareGrpcTauriDescriptorPayload).mockResolvedValue(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD);
  });

  afterEach(() => {
    resetBrowserDirectGrpcStreamsForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('executes grpc-web server_streaming and delivers local stream events', async () => {
    syncGrpcTabTransportMode('tab-grpc-web-stream', 'grpc-web');
    fetchMock.mockResolvedValueOnce(buildSuccessGrpcWebStreamResponse(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.protosetBase64));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-grpc-web-stream',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-grpc-web-stream');

    const events: string[] = [];
    const dispose = openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-grpc-web-stream', {
      onEvent: (event) => {
        if (event.type === 'grpc-message' && event.data?.message) {
          events.push(String(event.data.message));
        }
      },
    });

    await vi.waitFor(() => {
      expect(events).toContain('stream-pong');
    });
    dispose();
  });

  it('rejects unsupported call types in browser-direct modes', async () => {
    syncGrpcTabTransportMode('tab-grpc-web-bidi', 'grpc-web');
    await expect(startGrpcStream({
      callType: 'bidi_streaming',
      requestId: 'req-bidi',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'BidiStream',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-grpc-web-bidi')).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('blocks send/end on active browser-direct sessions and cancels locally', async () => {
    syncGrpcTabTransportMode('tab-direct-cancel', 'grpc-web');
    fetchMock.mockImplementation(() => new Promise(() => {}));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-direct-cancel',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-direct-cancel');

    await expect(sendGrpcStreamMessage(
      startEnvelope.data.streamId,
      'tab-direct-cancel',
      { body: {} } as never,
    )).rejects.toBeInstanceOf(GrpcApiClientError);

    await expect(endGrpcStream(startEnvelope.data.streamId, 'tab-direct-cancel'))
      .rejects.toBeInstanceOf(GrpcApiClientError);

    const cancelEnvelope = await cancelGrpcStream(startEnvelope.data.streamId, 'tab-direct-cancel');
    expect(cancelEnvelope.ok).toBe(true);
    if (cancelEnvelope.ok) {
      expect(cancelEnvelope.data.cancelled).toBe(true);
    }
  });

  it('executes spring-servlet server_streaming with URL fallback after 404', async () => {
    syncGrpcTabTransportMode('tab-servlet-stream', 'spring-servlet');
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(buildSuccessGrpcWebStreamResponse(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.protosetBase64));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-servlet-stream',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-servlet-stream');

    const events: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-servlet-stream', {
      onEvent: (event) => {
        if (event.type === 'grpc-message' && event.data?.message) {
          events.push(String(event.data.message));
        }
      },
    });

    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(events).toContain('stream-pong');
    });
  });

  it('openBrowserDirectStreamEvents ignores mismatched requestId and disposes when signal already aborted', async () => {
    syncGrpcTabTransportMode('tab-direct-filter', 'grpc-web');
    fetchMock.mockImplementation(() => new Promise(() => {}));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-filter',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-direct-filter');

    const controller = new AbortController();
    controller.abort();
    const onEvent = vi.fn();
    const dispose = openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-direct-filter', {
      signal: controller.signal,
      expectedRequestId: 'other-request',
      onEvent,
    });
    dispose();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('reports HTTP failures with empty bodies for browser-direct streams', async () => {
    syncGrpcTabTransportMode('tab-http-empty', 'grpc-web');
    fetchMock.mockResolvedValueOnce(new Response(null, {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'content-type': GRPC_WEB_CONTENT_TYPES.BINARY },
    }));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-http-empty',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-http-empty');

    const errors: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-http-empty', {
      onEvent: (event) => {
        if (event.type === 'grpc-error') {
          errors.push(event.statusMessage ?? 'error');
        }
      },
    });

    await vi.waitFor(() => {
      expect(errors.some((message) => message.includes('502'))).toBe(true);
    });
  });

  it('aborts browser-direct streams when timeout elapses', async () => {
    vi.useFakeTimers();
    syncGrpcTabTransportMode('tab-timeout', 'grpc-web');
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-timeout',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 50,
    }, 'tab-timeout');

    const errors: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-timeout', {
      onEvent: (event) => {
        if (event.type === 'grpc-error') {
          errors.push(event.statusMessage ?? 'error');
        }
      },
    });

    await vi.advanceTimersByTimeAsync(60);
    await vi.waitFor(() => {
      expect(errors.length).toBeGreaterThan(0);
    });
    vi.useRealTimers();
  });

  it('emits grpc-error terminal events for non-zero grpc-web status codes', async () => {
    syncGrpcTabTransportMode('tab-grpc-web-status-error', 'grpc-web');
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(new Uint8Array())]);
    fetchMock.mockResolvedValueOnce(new Response(body, {
      status: 200,
      headers: {
        'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
        'grpc-status': '13',
        'grpc-message': 'internal',
      },
    }));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-grpc-web-status-error',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-grpc-web-status-error');

    const terminalEvents: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-grpc-web-status-error', {
      onEvent: (event) => {
        if (event.type === 'grpc-error' || event.type === 'grpc-end') {
          terminalEvents.push(event.type);
        }
      },
    });

    await vi.waitFor(() => {
      expect(terminalEvents).toContain('grpc-error');
    });
  });

  it('falls through all spring-servlet URL candidates before failing', async () => {
    syncGrpcTabTransportMode('tab-servlet-all-404', 'spring-servlet');
    fetchMock.mockResolvedValue(new Response('', { status: 404, statusText: 'Not Found' }));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-servlet-all-404',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-servlet-all-404');

    const errors: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-servlet-all-404', {
      onEvent: (event) => {
        if (event.type === 'grpc-error') {
          errors.push(event.statusMessage ?? 'error');
        }
      },
    });

    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('uses https grpc-web URLs when TLS is enabled on the target', async () => {
    syncGrpcTabTransportMode('tab-grpc-web-tls', 'grpc-web');
    fetchMock.mockResolvedValueOnce(buildSuccessGrpcWebStreamResponse(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.protosetBase64));

    await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-grpc-web-tls',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: { ...FIXTURE_UNARY_CALL_REQUEST.target, tlsMode: 'system' },
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-grpc-web-tls');

    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/^https:\/\//);
  });

  it('reports incompatible spring-servlet content types before decoding', async () => {
    syncGrpcTabTransportMode('tab-servlet-bad-ct', 'spring-servlet');
    fetchMock.mockResolvedValueOnce(new Response('not grpc', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-servlet-bad-ct',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-servlet-bad-ct');

    const errors: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-servlet-bad-ct', {
      onEvent: (event) => {
        if (event.type === 'grpc-error') {
          errors.push(event.statusMessage ?? 'error');
        }
      },
    });

    await vi.waitFor(() => expect(errors.length).toBeGreaterThan(0));
  });

  it('cancelGrpcStream emits grpc-error for in-flight browser-direct sessions', async () => {
    syncGrpcTabTransportMode('tab-direct-cancel-event', 'grpc-web');
    fetchMock.mockImplementation(() => new Promise(() => {}));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-direct-cancel-event',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-direct-cancel-event');

    const errors: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-direct-cancel-event', {
      onEvent: (event) => {
        if (event.type === 'grpc-error') {
          errors.push(event.statusMessage ?? 'error');
        }
      },
    });

    await cancelGrpcStream(startEnvelope.data.streamId, 'tab-direct-cancel-event');
    await vi.waitFor(() => expect(errors).toContain('Cancelled'));
  });

  it('rejects spring-servlet client streaming with browser-direct guidance', async () => {
    syncGrpcTabTransportMode('tab-servlet-client-stream', 'spring-servlet');
    await expect(startGrpcStream({
      callType: 'client_streaming',
      requestId: 'req-servlet-client-stream',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ClientStream',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-servlet-client-stream')).rejects.toThrow(/spring-servlet does not support client_streaming/);
  });

  it('includes grpc-timeout header for timed browser-direct streams', async () => {
    syncGrpcTabTransportMode('tab-grpc-web-timeout-header', 'grpc-web');
    fetchMock.mockImplementation(() => new Promise(() => {}));

    await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-timeout-header',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 5_000,
    }, 'tab-grpc-web-timeout-header');

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.['grpc-timeout']).toBe('5000m');
  });

  it('uses spring-servlet default content type when response omits header', async () => {
    syncGrpcTabTransportMode('tab-servlet-default-ct', 'spring-servlet');
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(new Uint8Array())]);
    fetchMock.mockResolvedValueOnce(new Response(body, {
      status: 200,
      headers: { 'grpc-status': '0', 'grpc-message': '' },
    }));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-servlet-default-ct',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-servlet-default-ct');

    const terminalEvents: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-servlet-default-ct', {
      onEvent: (event) => {
        if (event.type === 'grpc-end' || event.type === 'grpc-error') {
          terminalEvents.push(event.type);
        }
      },
    });

    await vi.waitFor(() => expect(terminalEvents.length).toBeGreaterThan(0));
  });

  it('falls back when crypto.randomUUID is unavailable for browser-direct sessions', async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });
    syncGrpcTabTransportMode('tab-no-crypto', 'grpc-web');
    fetchMock.mockImplementation(() => new Promise(() => {}));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-no-crypto',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-no-crypto');

    expect(startEnvelope.data.streamId).toMatch(/^stream-/);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('surfaces generic fetch failures from spring-servlet stream resolution', async () => {
    syncGrpcTabTransportMode('tab-servlet-generic-error', 'spring-servlet');
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-servlet-generic-error',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-servlet-generic-error');

    const errors: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-servlet-generic-error', {
      onEvent: (event) => {
        if (event.type === 'grpc-error') {
          errors.push(event.statusMessage ?? 'error');
        }
      },
    });

    await vi.waitFor(() => expect(errors.length).toBeGreaterThan(0));
  });

  it('openBrowserDirectStreamEvents ignores stale buffered sequences', async () => {
    syncGrpcTabTransportMode('tab-direct-seq-filter', 'grpc-web');
    fetchMock.mockResolvedValueOnce(buildSuccessGrpcWebStreamResponse(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.protosetBase64));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-direct-seq-filter',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-direct-seq-filter');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const messages: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-direct-seq-filter', {
      onEvent: (event) => {
        if (event.type === 'grpc-message' && event.data?.message) {
          messages.push(String(event.data.message));
        }
      },
      lastSequence: 99,
    });

    await vi.waitFor(() => {
      expect(messages).toHaveLength(0);
    });
  });

  it('skips browser-direct timeout scheduling when timeoutMs is zero', async () => {
    syncGrpcTabTransportMode('tab-no-timeout', 'grpc-web');
    fetchMock.mockImplementation(() => new Promise(() => {}));

    await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-no-timeout',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 0,
    }, 'tab-no-timeout');

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.['grpc-timeout']).toBeUndefined();
  });
});

describe('openGrpcStreamEventsViaSse coverage gaps', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    setGrpcStreamTransport(null);
    setGrpcStreamEventsOpener(null);
  });

  afterEach(() => {
    setGrpcStreamTransport(null);
    setGrpcStreamEventsOpener(null);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses custom stream events opener override when set', () => {
    const override = vi.fn(() => vi.fn());
    setGrpcStreamEventsOpener(override);
    const dispose = openGrpcStreamEvents('s1', 'tab-1', { onEvent: () => undefined });
    expect(override).toHaveBeenCalledWith('s1', 'tab-1', expect.any(Object));
    dispose();
  });

  it('openGrpcStreamEventsViaSse closes on non-retryable 409 responses', async () => {
    const { openGrpcStreamEventsViaSse } = await import('./grpcStreamClient');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ok: false,
      error: { message: 'stream tab mismatch' },
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }));

    const onError = vi.fn();
    const onStateChange = vi.fn();
    const dispose = openGrpcStreamEventsViaSse('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
      onStateChange,
    });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onStateChange).toHaveBeenCalledWith('closed');
    dispose();
  });

  it('openGrpcStreamEventsViaSse parses JSON error envelopes on retryable failures', async () => {
    vi.useFakeTimers();
    const { openGrpcStreamEventsViaSse } = await import('./grpcStreamClient');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: false,
        error: { message: 'temporary outage' },
      }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(sseResponse([]));

    const onError = vi.fn();
    openGrpcStreamEventsViaSse('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    expect(onError).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('openGrpcStreamEventsViaSse closes when reconnect backoff aborts', async () => {
    vi.useFakeTimers();
    const { openGrpcStreamEventsViaSse } = await import('./grpcStreamClient');
    fetchMock.mockRejectedValue(new Error('network down'));

    const controller = new AbortController();
    const onStateChange = vi.fn();
    const dispose = openGrpcStreamEventsViaSse('s1', 'tab-1', {
      onEvent: () => undefined,
      onStateChange,
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onStateChange).toHaveBeenCalledWith('closed');
    dispose();
    vi.useRealTimers();
  });

  it('openGrpcStreamEventsViaSse retries after non-JSON retryable HTTP failures', async () => {
    vi.useFakeTimers();
    const { openGrpcStreamEventsViaSse } = await import('./grpcStreamClient');
    fetchMock
      .mockResolvedValueOnce(new Response('plain-text-error', { status: 503 }))
      .mockResolvedValueOnce(sseResponse([]));

    const onError = vi.fn();
    openGrpcStreamEventsViaSse('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    expect(onError).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('openGrpcStreamEventsViaSse surfaces non-Error reconnect failures', async () => {
    vi.useFakeTimers();
    const { openGrpcStreamEventsViaSse } = await import('./grpcStreamClient');
    fetchMock.mockRejectedValue('plain string failure');

    const onError = vi.fn();
    openGrpcStreamEventsViaSse('s1', 'tab-1', {
      onEvent: () => undefined,
      onError,
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(attempt));
      await vi.advanceTimersByTimeAsync(10_000);
    }
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('plain string failure'));
    vi.useRealTimers();
  });
});
