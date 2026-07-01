/**
 * Coverage gaps — grpcGrpcSpringServletUnaryClient.ts (Phase 10D).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  encodeGrpcWebTrailerFrame,
} from './grpcWebFramingCodec';
import { SPRING_SERVLET_CONTENT_TYPE } from './grpcSpringServletTransportContracts';
import { extractBrowserTransportFailure } from './grpcBrowserTransportErrorMapper';
import { GRPC_ERROR_CODES } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import * as springServletPathResolver from './grpcSpringServletPathResolver';

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

describe('grpcGrpcSpringServletUnaryClient coverage gaps', () => {
  beforeEach(() => {
    resetGrpcSpringServletUnaryClientForTests();
    clearGrpcWebProtoCodecCacheForTests();
  });

  it('maps SpringServletPathResolutionError at invoke to GRPC_INVALID_REQUEST', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn();

    await expect(invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'bad\\method',
        body: { message: 'ping' },
      },
      tabId: 'tab-path-error',
      protosetBase64,
      fetchFn,
    })).rejects.toMatchObject({
      code: 'GRPC_INVALID_REQUEST',
      category: 'validation',
    });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('invokeGrpcSpringServletUnary honors explicit requestTypeName and responseTypeName', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'servlet-explicit' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async () => new Response(body, {
      status: 200,
      headers: {
        'content-type': SPRING_SERVLET_CONTENT_TYPE,
        'grpc-status': '0',
      },
    }));

    const result = await invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-explicit-types',
      protosetBase64,
      requestTypeName: 'echo.EchoRequest',
      responseTypeName: 'echo.EchoResponse',
      fetchFn,
    });

    expect(result.body).toEqual({ message: 'servlet-explicit' });
  });

  it('invokeGrpcSpringServletUnary attaches errorDetail for non-zero grpc status', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const trailerBlock = new TextEncoder().encode('grpc-status: 7\r\ngrpc-message: permission%20denied\r\n');
    const body = concatGrpcWebFrames([encodeGrpcWebTrailerFrame(trailerBlock)]);

    const fetchFn = vi.fn(async () => new Response(body, {
      status: 200,
      headers: { 'content-type': SPRING_SERVLET_CONTENT_TYPE },
    }));

    const result = await invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-grpc-error',
      protosetBase64,
      fetchFn,
    });

    expect(result.status).toBe(7);
    expect(result.errorDetail).toBe('permission denied');
    expect(result.body).toBeUndefined();
  });

  it('aborts fetch when client timeoutMs elapses via mergeAbortSignals path', async () => {
    vi.useFakeTimers();
    try {
      const protosetBase64 = buildEchoProtosetBase64();
      const externalController = new AbortController();
      const fetchFn = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }));

      const invokePromise = invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          requestId: 'req-timeout-merge',
          target: FIXTURE_TARGET,
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'ping' },
          timeoutMs: 50,
        },
        tabId: 'tab-timeout-merge',
        protosetBase64,
        fetchFn,
        signal: externalController.signal,
      });

      await vi.waitFor(() => {
        expect(fetchFn).toHaveBeenCalled();
      });

      const rejection = expect(invokePromise).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(GrpcApiClientError);
        const body = (error as GrpcApiClientError).toErrorBody();
        expect(extractBrowserTransportFailure(body)?.browserTransportFailure).toBe('timeout');
        return true;
      });
      await vi.advanceTimersByTimeAsync(50);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancelGrpcSpringServletUnary returns false when no matching in-flight call exists', () => {
    expect(cancelGrpcSpringServletUnary('missing-tab', 'missing-request')).toBe(false);
  });

  it('resetGrpcSpringServletUnaryClientForTests aborts and clears in-flight calls', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }));

    const invokePromise = invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-reset',
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-reset',
      protosetBase64,
      fetchFn,
    });

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    expect(() => resetGrpcSpringServletUnaryClientForTests()).not.toThrow();
    expect(cancelGrpcSpringServletUnary('tab-reset', 'req-reset')).toBe(false);

    await expect(invokePromise).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('invokeGrpcSpringServletUnary resolves method types when only one explicit type name is provided', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'servlet-resolved-types' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async () => new Response(body, {
      status: 200,
      headers: {
        'content-type': SPRING_SERVLET_CONTENT_TYPE,
        'grpc-status': '0',
      },
    }));

    const result = await invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
        timeoutMs: 0,
      },
      tabId: 'tab-partial-types',
      protosetBase64,
      responseTypeName: 'echo.EchoResponse',
      fetchFn,
    });

    expect(result.body).toEqual({ message: 'servlet-resolved-types' });
  });

  it('invokeGrpcSpringServletUnary omits errorDetail when grpc status is zero', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'ok' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async () => new Response(body, {
      status: 200,
      headers: {
        'content-type': SPRING_SERVLET_CONTENT_TYPE,
        'grpc-status': '0',
      },
    }));

    const result = await invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-no-error-detail',
      protosetBase64,
      fetchFn,
    });

    expect(result.errorDetail).toBeUndefined();
  });

  it('clears timeout timer after successful invoke', async () => {
    vi.useFakeTimers();
    try {
      const protosetBase64 = buildEchoProtosetBase64();
      const responsePayload = encodeGrpcWebProtoMessage(
        protosetBase64,
        'echo.EchoResponse',
        { message: 'ok' },
      );
      const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

      const fetchFn = vi.fn(async () => new Response(body, {
        status: 200,
        headers: {
          'content-type': SPRING_SERVLET_CONTENT_TYPE,
          'grpc-status': '0',
        },
      }));

      const result = await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          requestId: 'req-timeout-clear',
          target: FIXTURE_TARGET,
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'ping' },
          timeoutMs: 5000,
        },
        tabId: 'tab-timeout-clear',
        protosetBase64,
        fetchFn,
      });

      expect(result.status).toBe(0);
      expect(cancelGrpcSpringServletUnary('tab-timeout-clear', 'req-timeout-clear')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mergeAbortSignals returns already-aborted signal when external signal starts aborted', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const externalController = new AbortController();
    externalController.abort();

    const fetchFn = vi.fn((_url: string, init: RequestInit) => {
      expect(init.signal?.aborted).toBe(true);
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });

    await expect(invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-pre-aborted',
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-pre-aborted',
      protosetBase64,
      fetchFn,
      signal: externalController.signal,
    })).rejects.toMatchObject({ code: 'GRPC_CANCELLED' });
  });

  it('invokeGrpcSpringServletUnary maps HTTP 404 responses to transport errors', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn(async () => new Response('', {
      status: 404,
      statusText: 'Not Found',
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
      tabId: 'tab-http-404',
      protosetBase64,
      fetchFn,
    })).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('invokeGrpcSpringServletUnary rejects incompatible response content types', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn(async () => new Response('not grpc', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    }));

    await expect(invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-bad-content-type',
      protosetBase64,
      fetchFn,
    })).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('invokeGrpcSpringServletUnary maps non-ok empty responses to transport errors', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn(async () => new Response(null, {
      status: 502,
      statusText: 'Bad Gateway',
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
      tabId: 'tab-http-502',
      protosetBase64,
      fetchFn,
    })).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('cancelGrpcSpringServletUnary aborts an in-flight request', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }));

    const invokePromise = invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-cancel-active',
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-cancel-active',
      protosetBase64,
      fetchFn,
    });

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    expect(cancelGrpcSpringServletUnary('tab-cancel-active', 'req-cancel-active')).toBe(true);
    await expect(invokePromise).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('uses default Spring Servlet content type when response omits content-type header', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'no-content-type' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async () => new Response(body, {
      status: 200,
      headers: { 'grpc-status': '0' },
    }));

    const result = await invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-default-content-type',
      protosetBase64,
      fetchFn,
    });

    expect(result.body).toEqual({ message: 'no-content-type' });
  });

  it('rethrows unexpected path resolution failures that are not SpringServletPathResolutionError', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    vi.spyOn(springServletPathResolver, 'buildSpringServletMethodUrls').mockImplementation(() => {
      throw new Error('unexpected resolver failure');
    });

    await expect(invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-resolver-boom',
      protosetBase64,
      fetchFn: vi.fn(),
    })).rejects.toThrow('unexpected resolver failure');

    vi.restoreAllMocks();
  });

  it('uses global fetch when fetchFn is omitted', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'global-fetch' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, {
      status: 200,
      headers: {
        'content-type': SPRING_SERVLET_CONTENT_TYPE,
        'grpc-status': '0',
      },
    }));

    const result = await invokeGrpcSpringServletUnary({
      request: {
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-global-fetch',
      protosetBase64,
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.body).toEqual({ message: 'global-fetch' });
    fetchSpy.mockRestore();
  });

  it('throws the last 404 transport error after exhausting servlet path candidates', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn(async () => new Response('', {
      status: 404,
      statusText: 'Not Found',
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
      tabId: 'tab-all-404',
      protosetBase64,
      fetchFn,
    })).rejects.toMatchObject({
      code: GRPC_ERROR_CODES.CALL_FAILED,
    });

    expect(fetchFn.mock.calls.length).toBeGreaterThan(1);
  });

  it('retries alternate servlet paths after a 404 on the canonical URL', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'short-path' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('/echo.EchoService/Echo')) {
        return new Response('', {
          status: 404,
          statusText: 'Not Found',
          headers: { 'content-type': SPRING_SERVLET_CONTENT_TYPE },
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
      tabId: 'tab-short-path-retry',
      protosetBase64,
      fetchFn,
    });

    expect(result.body).toEqual({ message: 'short-path' });
    expect(fetchFn.mock.calls.length).toBeGreaterThan(1);
  });
});
