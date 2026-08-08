/**
 * Phase 10C — gRPC-Web unary client unit tests.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor/index.js';
import { FIXTURE_ECHO_PROTO, FIXTURE_TARGET, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import {
  buildGrpcWebMethodUrl,
  cancelGrpcWebUnary,
  invokeGrpcWebUnary,
  resetGrpcWebUnaryClientForTests,
} from './grpcGrpcWebUnaryClient';
import {
  clearGrpcWebProtoCodecCacheForTests,
  encodeGrpcWebProtoMessage,
} from './grpcWebProtoCodec';
import {
  concatGrpcWebFrames,
  encodeGrpcWebDataFrame,
} from './grpcWebFramingCodec';
import { GRPC_WEB_CONTENT_TYPES } from './grpcWebTransportContracts';
import { extractBrowserTransportFailure } from './grpcBrowserTransportErrorMapper';
import { GrpcApiClientError } from './grpcApiClient';

function buildEchoProtosetBase64(): string {
  const root = new protobuf.Root();
  protobuf.parse(FIXTURE_ECHO_PROTO, root, { keepCase: true, alternateCommentMode: true });
  root.resolveAll();
  const fileDescriptorSet = root.toDescriptor('proto3');
  const bytes = descriptor.FileDescriptorSet.encode(fileDescriptorSet).finish();
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}

describe('grpcGrpcWebUnaryClient (Phase 10C)', () => {
  beforeEach(() => {
    resetGrpcWebUnaryClientForTests();
    clearGrpcWebProtoCodecCacheForTests();
  });

  it('buildGrpcWebMethodUrl uses http scheme for plaintext targets', () => {
    expect(buildGrpcWebMethodUrl(FIXTURE_TARGET, 'echo.EchoService', 'Echo'))
      .toBe('http://localhost:50051/echo.EchoService/Echo');
  });

  it('blocks real browser fetch against native gRPC :50051 without calling fetch', async () => {
    const fetchFn = vi.fn();
    // No fetchFn override — uses global fetch path after guard. Stub global to detect leaks.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchFn as unknown as typeof fetch;
    try {
      await expect(invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          target: FIXTURE_TARGET,
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'ping' },
        },
        tabId: 'tab-native-block',
        protosetBase64: buildEchoProtosetBase64(),
      })).rejects.toBeInstanceOf(GrpcApiClientError);
      expect(fetchFn).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('invokeGrpcWebUnary decodes framed success response', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'pong' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async () => new Response(body, {
      status: 200,
      headers: {
        'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
        'grpc-status': '0',
        'grpc-message': '',
      },
    }));

    const result = await invokeGrpcWebUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-grpc-web',
      protosetBase64,
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.transportUsed).toBe('grpc-web');
    expect(result.status).toBe(0);
    expect(result.body).toEqual({ message: 'pong' });
    expect(result.timingBreakdown?.protoSerializationMs).toBeGreaterThanOrEqual(0);
    expect(result.timingBreakdown?.responseDeserializationMs).toBeGreaterThanOrEqual(0);
    expect(result.timingBreakdown?.serverProcessingMs).toBeGreaterThanOrEqual(0);
  });

  it('does not let metadata overwrite grpc-web framing headers', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'pong' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe(GRPC_WEB_CONTENT_TYPES.BINARY);
      expect(headers['X-Grpc-Web']).toBe('1');
      expect(headers['x-custom']).toBe('trace-1');
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
          'grpc-status': '0',
          'grpc-message': '',
        },
      });
    });

    await invokeGrpcWebUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
        metadata: {
          'content-type': 'text/plain',
          'x-custom': 'trace-1',
        },
      },
      tabId: 'tab-headers',
      protosetBase64,
      fetchFn,
    });
  });

  it('aborts fetch when client timeoutMs elapses', async () => {
    vi.useFakeTimers();
    try {
      const protosetBase64 = buildEchoProtosetBase64();
      const fetchFn = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }));

      const invokePromise = invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          requestId: 'req-timeout',
          target: FIXTURE_TARGET,
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'ping' },
          timeoutMs: 50,
        },
        tabId: 'tab-timeout',
        protosetBase64,
        fetchFn,
      });

      await vi.waitFor(() => {
        expect(fetchFn).toHaveBeenCalled();
      });

      const rejection = expect(invokePromise).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(GrpcApiClientError);
        const body = (error as GrpcApiClientError).toErrorBody();
        expect(body.message).toMatch(/timed out/i);
        expect(body.code).toBe('GRPC_UNREACHABLE');
        expect(extractBrowserTransportFailure(body)?.browserTransportFailure).toBe('timeout');
        return true;
      });
      await vi.advanceTimersByTimeAsync(50);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('classifies Failed to fetch as proxy_unreachable with browserTransportFailure (Phase 10E)', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(invokeGrpcWebUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-cors',
      protosetBase64,
      fetchFn,
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(GrpcApiClientError);
      const body = (error as GrpcApiClientError).toErrorBody();
      expect(extractBrowserTransportFailure(body)?.browserTransportFailure).toBe('proxy_unreachable');
      return true;
    });
  });

  it('rejects HTML responses as protocol_mismatch (Phase 10E)', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn(async () => new Response('<html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }));

    await expect(invokeGrpcWebUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-html',
      protosetBase64,
      fetchFn,
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(GrpcApiClientError);
      const body = (error as GrpcApiClientError).toErrorBody();
      expect(extractBrowserTransportFailure(body)?.browserTransportFailure).toBe('protocol_mismatch');
      return true;
    });
  });

  it('rejects JSON responses as protocol_mismatch (Phase 10E)', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn(async () => new Response('{"error":"not grpc"}', {
      status: 502,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(invokeGrpcWebUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-json',
      protosetBase64,
      fetchFn,
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(GrpcApiClientError);
      const body = (error as GrpcApiClientError).toErrorBody();
      expect(extractBrowserTransportFailure(body)?.browserTransportFailure).toBe('protocol_mismatch');
      return true;
    });
  });

  it('classifies HTTP 404 with empty body as protocol_mismatch (Phase 10E)', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn(async () => new Response(null, {
      status: 404,
      headers: { 'content-type': 'application/grpc-web+proto' },
    }));

    await expect(invokeGrpcWebUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-404',
      protosetBase64,
      fetchFn,
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(GrpcApiClientError);
      const body = (error as GrpcApiClientError).toErrorBody();
      expect(extractBrowserTransportFailure(body)?.browserTransportFailure).toBe('protocol_mismatch');
      expect((body.details as { httpStatus?: number }).httpStatus).toBe(404);
      return true;
    });
  });

  it('cancelGrpcWebUnary aborts in-flight fetch', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    let abortSignal: AbortSignal | undefined;
    const fetchFn = vi.fn((_url: string, init: RequestInit) => {
      abortSignal = init.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    });

    const invokePromise = invokeGrpcWebUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-abort',
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-abort',
      protosetBase64,
      fetchFn,
    });

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    expect(cancelGrpcWebUnary('tab-abort', 'req-abort')).toBe(true);
    expect(abortSignal?.aborted).toBe(true);

    await expect(invokePromise).rejects.toMatchObject({
      code: 'GRPC_CANCELLED',
    });
  });
});
