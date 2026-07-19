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
import { concatGrpcWebFrames, encodeGrpcWebDataFrame } from './grpcWebFramingCodec';
import { GRPC_WEB_CONTENT_TYPES } from './grpcWebTransportContracts';
import { syncGrpcTabTransportMode, resetGrpcTabTransportRoutingForTests } from './grpcTransportTabRouting';
import * as springServletPathResolver from './grpcSpringServletPathResolver';
import { GrpcApiClientError } from './grpcApiClient';
import {
  cancelGrpcStream,
  endGrpcStream,
  openGrpcStreamEvents,
  resetBrowserDirectGrpcStreamsForTests,
  sendGrpcStreamMessage,
  setGrpcStreamEventsOpener,
  setGrpcStreamTransport,
  startGrpcStream,
} from './grpcStreamClient';

import { buildSuccessGrpcWebStreamResponse} from './grpcStreamClientCoverageGaps.testHelpers';

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

  it('supports grpc-web service paths already prefixed with slash', async () => {
    syncGrpcTabTransportMode('tab-grpc-web-leading-slash', 'grpc-web');
    fetchMock.mockResolvedValueOnce(buildSuccessGrpcWebStreamResponse(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.protosetBase64));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-grpc-web-leading-slash',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: '/echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-grpc-web-leading-slash');

    const messages: string[] = [];
    const dispose = openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-grpc-web-leading-slash', {
      onEvent: (event) => {
        if (event.type === 'grpc-message' && event.data?.message) {
          messages.push(String(event.data.message));
        }
      },
    });

    await vi.waitFor(() => {
      expect(messages).toContain('stream-pong');
    });
    dispose();
  });

  it('filters local session replay by expectedRequestId mismatch', async () => {
    syncGrpcTabTransportMode('tab-expected-request-filter', 'grpc-web');
    fetchMock.mockResolvedValueOnce(buildSuccessGrpcWebStreamResponse(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.protosetBase64));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-expected-request-filter',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-expected-request-filter');

    const matchingEvents: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-expected-request-filter', {
      expectedRequestId: 'another-request-id',
      onEvent: (event) => {
        matchingEvents.push(event.type);
      },
    });

    await vi.waitFor(() => {
      expect(matchingEvents).toEqual([]);
    });
  });

  it('cancels a terminal local session without emitting extra cancel error event', async () => {
    syncGrpcTabTransportMode('tab-cancel-terminal', 'grpc-web');
    fetchMock.mockResolvedValueOnce(buildSuccessGrpcWebStreamResponse(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.protosetBase64));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-cancel-terminal',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-cancel-terminal');

    let endSeen = false;
    let cancelResult: Awaited<ReturnType<typeof cancelGrpcStream>> | null = null;
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-cancel-terminal', {
      onEvent: (event) => {
        if (event.type === 'grpc-end' && !endSeen) {
          endSeen = true;
          void cancelGrpcStream(startEnvelope.data.streamId, 'tab-cancel-terminal').then((result) => {
            cancelResult = result;
          });
        }
      },
    });

    await vi.waitFor(() => {
      expect(endSeen).toBe(true);
      expect(cancelResult?.ok).toBe(true);
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

  it('emits unreachable error when spring resolver returns no candidate URLs', async () => {
    syncGrpcTabTransportMode('tab-servlet-no-urls', 'spring-servlet');
    const resolverSpy = vi
      .spyOn(springServletPathResolver, 'buildSpringServletMethodUrls')
      .mockReturnValue([]);

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-servlet-no-urls',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-servlet-no-urls');

    const errors: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-servlet-no-urls', {
      onEvent: (event) => {
        if (event.type === 'grpc-error') {
          errors.push(event.statusMessage ?? 'error');
        }
      },
    });

    await vi.waitFor(() => {
      expect(errors.some((message) => message.includes('path resolution failed'))).toBe(true);
    });

    resolverSpy.mockRestore();
  });

  it('throws grpc api client errors without transport details on spring fallback fetch', async () => {
    syncGrpcTabTransportMode('tab-servlet-raw-error', 'spring-servlet');
    fetchMock.mockRejectedValueOnce(new GrpcApiClientError('stream_start', 'raw grpc error', {
      code: 'GRPC_CALL_FAILED',
      category: 'call_failed',
      retryable: false,
    }));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-servlet-raw-error',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-servlet-raw-error');

    const errors: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-servlet-raw-error', {
      onEvent: (event) => {
        if (event.type === 'grpc-error') {
          errors.push(event.statusMessage ?? 'error');
        }
      },
    });

    await vi.waitFor(() => {
      expect(errors).toContain('raw grpc error');
    });
  });

  it('reopens terminal local session as closed immediately and respects abort listener path', async () => {
    syncGrpcTabTransportMode('tab-terminal-reopen', 'grpc-web');
    fetchMock.mockResolvedValueOnce(buildSuccessGrpcWebStreamResponse(FIXTURE_ECHO_DESCRIPTOR_PAYLOAD.protosetBase64));

    const startEnvelope = await startGrpcStream({
      callType: 'server_streaming',
      requestId: 'req-terminal-reopen',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 30_000,
    }, 'tab-terminal-reopen');

    const firstEvents: string[] = [];
    openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-terminal-reopen', {
      onEvent: (event) => {
        if (event.type === 'grpc-end') firstEvents.push(event.type);
      },
    });
    await vi.waitFor(() => {
      expect(firstEvents).toContain('grpc-end');
    });

    const states: string[] = [];
    const controller = new AbortController();
    const dispose = openGrpcStreamEvents(startEnvelope.data.streamId, 'tab-terminal-reopen', {
      signal: controller.signal,
      onStateChange: (state) => states.push(state),
      onEvent: () => undefined,
    });
    controller.abort();
    dispose();

    expect(states).toContain('connecting');
    expect(states).toContain('closed');
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
