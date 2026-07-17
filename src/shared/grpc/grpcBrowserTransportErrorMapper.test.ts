/**
 * Phase 10E — Browser transport error mapper unit tests.
 */
import { describe, expect, it } from 'vitest';
import { GRPC_ERROR_CODES } from './contracts';
import {
  assertIncompatibleBrowserTransportContentType,
  buildBrowserTransportGrpcApiError,
  classifyBrowserTransportFetchFailure,
  classifyBrowserTransportHttpResponse,
  extractBrowserTransportFailure,
  formatBrowserTransportFailureHint,
  formatBrowserTransportFailureMessage,
  grpcApiErrorToBrowserExpressFallbackBody,
  isBrowserTransportExpressFallbackEligible,
  mapBrowserTransportFetchFailure,
  mapBrowserTransportDecodeFailure,
  shouldSuggestExpressProxyForBrowserFailure,
} from './grpcBrowserTransportErrorMapper';
import { GrpcApiClientError } from './grpcApiClient';
import { isGrpcExpressFallbackOffered } from './grpcTransportFallback';

describe('grpcBrowserTransportErrorMapper (Phase 10E)', () => {
  it('classifies explicit CORS failures', () => {
    expect(classifyBrowserTransportFetchFailure({
      error: new TypeError('Access to fetch has been blocked by CORS policy'),
      transportMode: 'grpc-web',
    })).toBe('cors');
  });

  it('classifies network unreachable fetch failures', () => {
    expect(classifyBrowserTransportFetchFailure({
      error: new TypeError('Failed to fetch'),
      transportMode: 'spring-servlet',
    })).toBe('proxy_unreachable');
  });

  it('classifies protocol mismatch from error message', () => {
    expect(classifyBrowserTransportFetchFailure({
      error: new Error('Unexpected content-type text/html'),
      transportMode: 'grpc-web',
    })).toBe('protocol_mismatch');
  });

  it('maps timeout abort cause to timeout failure kind', () => {
    const error = mapBrowserTransportFetchFailure('call', new DOMException('Aborted', 'AbortError'), {
      transportMode: 'grpc-web',
      abortCause: 'timeout',
    });
    expect(error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    expect(extractBrowserTransportFailure(error.toErrorBody())?.browserTransportFailure).toBe('timeout');
    expect(formatBrowserTransportFailureMessage('timeout', { transportMode: 'grpc-web' }))
      .toMatch(/timed out/i);
  });

  it('maps cancel abort to cancelled without browserTransportFailure', () => {
    const error = mapBrowserTransportFetchFailure('call', new DOMException('Aborted', 'AbortError'), {
      transportMode: 'grpc-web',
      abortCause: 'cancel',
    });
    expect(error.code).toBe(GRPC_ERROR_CODES.CANCELLED);
    expect(extractBrowserTransportFailure(error.toErrorBody())).toBeUndefined();
  });

  it('classifies HTTP 415 as protocol_mismatch', () => {
    expect(classifyBrowserTransportHttpResponse({
      httpStatus: 415,
      contentType: 'text/plain',
      bodyLength: 0,
      transportMode: 'grpc-web',
    })).toBe('protocol_mismatch');
  });

  it('classifies Spring Servlet HTTP 404 as protocol_mismatch', () => {
    expect(classifyBrowserTransportHttpResponse({
      httpStatus: 404,
      contentType: 'application/grpc',
      bodyLength: 0,
      transportMode: 'spring-servlet',
    })).toBe('protocol_mismatch');
  });

  it('classifies grpc-web HTTP 404 as protocol_mismatch', () => {
    expect(classifyBrowserTransportHttpResponse({
      httpStatus: 404,
      contentType: 'application/grpc-web+proto',
      bodyLength: 0,
      transportMode: 'grpc-web',
    })).toBe('protocol_mismatch');
  });

  it('classifies other HTTP errors as server_status', () => {
    expect(classifyBrowserTransportHttpResponse({
      httpStatus: 503,
      contentType: 'application/grpc',
      bodyLength: 0,
      transportMode: 'grpc-web',
    })).toBe('server_status');
  });

  it('classifies HTTP JSON content-type as protocol_mismatch', () => {
    expect(classifyBrowserTransportHttpResponse({
      httpStatus: 502,
      contentType: 'application/json; charset=utf-8',
      bodyLength: 0,
      transportMode: 'spring-servlet',
    })).toBe('protocol_mismatch');
  });

  it('buildBrowserTransportGrpcApiError attaches details and hint copy per kind', () => {
    for (const kind of ['cors', 'proxy_unreachable', 'protocol_mismatch', 'timeout', 'server_status'] as const) {
      const error = buildBrowserTransportGrpcApiError('call', kind, {
        transportMode: 'grpc-web',
        httpStatus: kind === 'server_status' ? 502 : undefined,
      });
      const body = error.toErrorBody();
      expect(extractBrowserTransportFailure(body)?.browserTransportFailure).toBe(kind);
      expect(formatBrowserTransportFailureHint(body)).toBeTruthy();
    }
  });

  it('suggests Express Proxy for cors, proxy_unreachable, and protocol_mismatch', () => {
    expect(shouldSuggestExpressProxyForBrowserFailure('cors')).toBe(true);
    expect(shouldSuggestExpressProxyForBrowserFailure('proxy_unreachable')).toBe(true);
    expect(shouldSuggestExpressProxyForBrowserFailure('protocol_mismatch')).toBe(true);
    expect(shouldSuggestExpressProxyForBrowserFailure('timeout')).toBe(false);
    expect(shouldSuggestExpressProxyForBrowserFailure('server_status')).toBe(false);
  });

  it('grpcApiErrorToBrowserExpressFallbackBody offers Express retry for suggestExpressProxy without browserTransportFailure', () => {
    const error = new GrpcApiClientError('stream_start', 'deferred streaming', {
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      category: 'validation',
      retryable: false,
      details: { suggestExpressProxy: true, transportMode: 'grpc-web' },
    });
    const body = grpcApiErrorToBrowserExpressFallbackBody(error, 'grpc-web');
    expect(isBrowserTransportExpressFallbackEligible(body)).toBe(true);
    expect(isGrpcExpressFallbackOffered(body)).toBe(true);
    expect((body.details as { transportAttempted?: string }).transportAttempted).toBe('grpc-web');
  });

  it('grpcApiErrorToBrowserExpressFallbackBody offers Express retry for eligible browser failures', () => {
    const error = buildBrowserTransportGrpcApiError('call', 'cors', {
      transportMode: 'spring-servlet',
    });
    const body = grpcApiErrorToBrowserExpressFallbackBody(error, 'spring-servlet');
    expect(isBrowserTransportExpressFallbackEligible(body)).toBe(true);
    expect(isGrpcExpressFallbackOffered(body)).toBe(true);
    expect((body.details as { transportAttempted?: string }).transportAttempted).toBe('spring-servlet');
  });

  it('grpcApiErrorToBrowserExpressFallbackBody prefers transportMode from error details', () => {
    const error = buildBrowserTransportGrpcApiError('call', 'cors', {
      transportMode: 'spring-servlet',
    });
    const body = grpcApiErrorToBrowserExpressFallbackBody(error, 'grpc-web');
    expect((body.details as { transportAttempted?: string }).transportAttempted).toBe('spring-servlet');
  });

  it('does not offer Express fallback for timeout failures', () => {
    const error = buildBrowserTransportGrpcApiError('call', 'timeout', {
      transportMode: 'grpc-web',
    });
    expect(isBrowserTransportExpressFallbackEligible(error.toErrorBody())).toBe(false);
  });

  it('includes CORS header guidance in cors hint', () => {
    const hint = formatBrowserTransportFailureHint(
      buildBrowserTransportGrpcApiError('call', 'cors', { transportMode: 'grpc-web' }).toErrorBody(),
    );
    expect(hint).toMatch(/CORS/i);
    expect(hint).toMatch(/Express Proxy/i);
  });

  it('assertIncompatibleBrowserTransportContentType rejects JSON responses', () => {
    const error = assertIncompatibleBrowserTransportContentType('application/json', 'grpc-web');
    expect(extractBrowserTransportFailure(error?.toErrorBody())?.browserTransportFailure).toBe('protocol_mismatch');
  });

  it('classifyBrowserTransportFetchFailure treats incomplete frame errors as protocol_mismatch', () => {
    expect(classifyBrowserTransportFetchFailure({
      error: new Error('Incomplete gRPC-Web frame header'),
      transportMode: 'grpc-web',
    })).toBe('protocol_mismatch');
  });

  it('mapBrowserTransportDecodeFailure maps framing errors to protocol_mismatch', () => {
    const error = mapBrowserTransportDecodeFailure('grpc-web', new Error('Incomplete gRPC-Web frame header'));
    expect(error).toBeInstanceOf(GrpcApiClientError);
    expect(extractBrowserTransportFailure(error!.toErrorBody())?.browserTransportFailure).toBe('protocol_mismatch');
  });
});
