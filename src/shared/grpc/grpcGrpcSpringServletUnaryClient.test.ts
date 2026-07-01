/**
 * Phase 10D — Spring Servlet unary client unit tests.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor/index.js';
import { FIXTURE_ECHO_PROTO, FIXTURE_TARGET, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import {
  cancelGrpcSpringServletUnary,
  invokeGrpcSpringServletUnary,
  resetGrpcSpringServletUnaryClientForTests,
} from './grpcGrpcSpringServletUnaryClient';
import {
  clearGrpcWebProtoCodecCacheForTests,
  encodeGrpcWebProtoMessage,
} from './grpcWebProtoCodec';
import {
  concatGrpcWebFrames,
  encodeGrpcWebDataFrame,
} from './grpcWebFramingCodec';
import { SPRING_SERVLET_CONTENT_TYPE } from './grpcSpringServletTransportContracts';
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

describe('grpcGrpcSpringServletUnaryClient (Phase 10D)', () => {
  beforeEach(() => {
    resetGrpcSpringServletUnaryClientForTests();
    clearGrpcWebProtoCodecCacheForTests();
  });

  it('invokeGrpcSpringServletUnary posts application/grpc framed body to servlet path', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'pong' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('http://localhost:50051/echo.EchoService/Echo');
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe(SPRING_SERVLET_CONTENT_TYPE);
      expect(headers.TE).toBe('trailers');
      expect(headers['content-type']).toBeUndefined();
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': SPRING_SERVLET_CONTENT_TYPE,
          'grpc-status': '0',
          'grpc-message': '',
        },
      });
    });

    const result = await invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-servlet',
      protosetBase64,
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.transportUsed).toBe('spring-servlet');
    expect(result.status).toBe(0);
    expect(result.body).toEqual({ message: 'pong' });
  });

  it('does not let metadata overwrite servlet transport headers', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'pong' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe(SPRING_SERVLET_CONTENT_TYPE);
      expect(headers.TE).toBe('trailers');
      expect(headers['x-custom']).toBe('trace-1');
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': SPRING_SERVLET_CONTENT_TYPE,
          'grpc-status': '0',
        },
      });
    });

    await invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
        metadata: {
          'content-type': 'text/plain',
          te: 'gzip',
          'x-custom': 'trace-1',
        },
      },
      tabId: 'tab-servlet-headers',
      protosetBase64,
      fetchFn,
    });
  });

  it('maps invalid service segments to validation errors before fetch', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn();

    await expect(invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: '',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-invalid-path',
      protosetBase64,
      fetchFn,
    })).rejects.toMatchObject({
      code: 'GRPC_INVALID_REQUEST',
      category: 'validation',
    });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cancelGrpcSpringServletUnary aborts in-flight fetch', async () => {
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

    const invokePromise = invokeGrpcSpringServletUnary({
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

    expect(cancelGrpcSpringServletUnary('tab-abort', 'req-abort')).toBe(true);
    expect(abortSignal?.aborted).toBe(true);

    await expect(invokePromise).rejects.toMatchObject({
      code: 'GRPC_CANCELLED',
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

      const invokePromise = invokeGrpcSpringServletUnary({
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

    await expect(invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-unreachable',
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

    await expect(invokeGrpcSpringServletUnary({
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

    await expect(invokeGrpcSpringServletUnary({
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

  it('classifies HTTP 404 with empty body as protocol_mismatch after exhausting path candidates (Phase 10E)', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn(async () => new Response(null, {
      status: 404,
      headers: { 'content-type': SPRING_SERVLET_CONTENT_TYPE },
    }));

    await expect(invokeGrpcSpringServletUnary({
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
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://localhost:50051/echo.EchoService/Echo');
    expect(fetchFn.mock.calls[1]?.[0]).toBe('http://localhost:50051/EchoService/Echo');
  });

  it('retries short service path when canonical servlet path returns HTTP 404', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'pong' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith('/echo.EchoService/Echo')) {
        return new Response(null, {
          status: 404,
          headers: { 'content-type': SPRING_SERVLET_CONTENT_TYPE },
        });
      }
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': SPRING_SERVLET_CONTENT_TYPE,
          'grpc-status': '0',
          'grpc-message': '',
        },
      });
    });

    const result = await invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-retry',
      protosetBase64,
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1]?.[0]).toBe('http://localhost:50051/EchoService/Echo');
    expect(result.status).toBe(0);
    expect(result.body).toEqual({ message: 'pong' });
  });

  it('retries short service path when canonical returns HTTP 404 with HTML body', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'pong' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith('/echo.EchoService/Echo')) {
        return new Response('<html>404 Not Found</html>', {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': SPRING_SERVLET_CONTENT_TYPE,
          'grpc-status': '0',
        },
      });
    });

    const result = await invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-retry-html-404',
      protosetBase64,
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(0);
  });
});
