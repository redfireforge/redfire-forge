/**
 * Coverage gaps — grpcGrpcWebUnaryClient.ts (Phase 10C).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  encodeGrpcWebTrailerFrame,
} from './grpcWebFramingCodec';
import { GRPC_WEB_CONTENT_TYPES } from './grpcWebTransportContracts';
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

describe('grpcGrpcWebUnaryClient coverage gaps', () => {
  beforeEach(() => {
    resetGrpcWebUnaryClientForTests();
    clearGrpcWebProtoCodecCacheForTests();
  });

  it('buildGrpcWebMethodUrl uses https scheme for TLS targets and preserves leading slash on service', () => {
    expect(buildGrpcWebMethodUrl(
      { address: 'localhost:9090', tlsMode: 'tls' },
      '/echo.EchoService',
      'Echo',
    )).toBe('https://localhost:9090/echo.EchoService/Echo');
  });

  it('invokeGrpcWebUnary honors explicit requestTypeName and responseTypeName', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'explicit-types' },
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
      tabId: 'tab-explicit-types',
      protosetBase64,
      requestTypeName: 'echo.EchoRequest',
      responseTypeName: 'echo.EchoResponse',
      fetchFn,
    });

    expect(result.body).toEqual({ message: 'explicit-types' });
  });

  it('invokeGrpcWebUnary attaches errorDetail for non-zero grpc status', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const trailerBlock = new TextEncoder().encode('grpc-status: 5\r\ngrpc-message: not%20found\r\n');
    const body = concatGrpcWebFrames([encodeGrpcWebTrailerFrame(trailerBlock)]);

    const fetchFn = vi.fn(async () => new Response(body, {
      status: 200,
      headers: { 'content-type': GRPC_WEB_CONTENT_TYPES.BINARY },
    }));

    const result = await invokeGrpcWebUnary({
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

    expect(result.status).toBe(5);
    expect(result.errorDetail).toBe('not found');
    expect(result.body).toBeUndefined();
  });

  it('invokeGrpcWebUnary skips decode when response has no data payload', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn(async () => new Response(new Uint8Array(0), {
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
      tabId: 'tab-empty-body',
      protosetBase64,
      fetchFn,
    });

    expect(result.status).toBe(0);
    expect(result.body).toBeUndefined();
  });

  it('mergeAbortSignals aborts fetch when external signal is aborted', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const externalController = new AbortController();
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
        requestId: 'req-external-abort',
        target: FIXTURE_TARGET,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'ping' },
      },
      tabId: 'tab-external-signal',
      protosetBase64,
      fetchFn,
      signal: externalController.signal,
    });

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    externalController.abort();
    expect(abortSignal?.aborted).toBe(true);

    await expect(invokePromise).rejects.toMatchObject({
      code: 'GRPC_CANCELLED',
    });
  });

  it('resetGrpcWebUnaryClientForTests aborts and clears in-flight calls', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const fetchFn = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }));

    const invokePromise = invokeGrpcWebUnary({
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

    expect(() => resetGrpcWebUnaryClientForTests()).not.toThrow();
    expect(cancelGrpcWebUnary('tab-reset', 'req-reset')).toBe(false);

    await expect(invokePromise).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('invokeGrpcWebUnary resolves method types when only one explicit type name is provided', async () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const responsePayload = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'resolved-types' },
    );
    const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);

    const fetchFn = vi.fn(async () => new Response(body, {
      status: 200,
      headers: {
        'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
        'grpc-status': '0',
      },
    }));

    const result = await invokeGrpcWebUnary({
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
      requestTypeName: 'echo.EchoRequest',
      fetchFn,
    });

    expect(result.body).toEqual({ message: 'resolved-types' });
  });

  it('invokeGrpcWebUnary omits errorDetail when grpc status is zero', async () => {
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
          'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
          'grpc-status': '0',
        },
      }));

      const result = await invokeGrpcWebUnary({
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
      expect(cancelGrpcWebUnary('tab-timeout-clear', 'req-timeout-clear')).toBe(false);
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

    await expect(invokeGrpcWebUnary({
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

  it('cancelGrpcWebUnary returns false when no matching in-flight call exists', () => {
    expect(cancelGrpcWebUnary('missing-tab', 'missing-request')).toBe(false);
  });
});
