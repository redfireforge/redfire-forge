/**
 * Coverage gaps — grpcBrowserTransportErrorMapper.ts (Phase 10E).
 */
import { describe, expect, it } from 'vitest';
import { GRPC_ERROR_CODES } from './contracts';
import type { GrpcErrorBody } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import type { GrpcStudioTransportMode } from './grpcWebTransportContracts';
import {
  assertIncompatibleBrowserTransportContentType,
  buildBrowserTransportGrpcApiError,
  classifyBrowserTransportFetchFailure,
  classifyBrowserTransportHttpResponse,
  extractBrowserTransportFailure,
  formatBrowserTransportFailureHint,
  formatBrowserTransportFailureMessage,
  grpcApiErrorToBrowserExpressFallbackBody,
  isBrowserDirectTransportMode,
  isBrowserTransportExpressFallbackEligible,
  mapBrowserTransportDecodeFailure,
  mapBrowserTransportFetchFailure,
  resetGrpcBrowserTransportErrorMapperForTests,
  transportModeLabel,
} from './grpcBrowserTransportErrorMapper';
import { isGrpcExpressFallbackOffered } from './grpcTransportFallback';

describe('grpcBrowserTransportErrorMapper coverage gaps', () => {
  it('isBrowserDirectTransportMode is false for express and tauri', () => {
    expect(isBrowserDirectTransportMode('express')).toBe(false);
    expect(isBrowserDirectTransportMode('tauri')).toBe(false);
    expect(isBrowserDirectTransportMode('grpc-web')).toBe(true);
    expect(isBrowserDirectTransportMode('spring-servlet')).toBe(true);
  });

  it('transportModeLabel returns labels for all transport modes', () => {
    expect(transportModeLabel('grpc-web')).toBe('gRPC-Web');
    expect(transportModeLabel('spring-servlet')).toBe('Spring Servlet');
    expect(transportModeLabel('express')).toBe('Express Proxy');
    expect(transportModeLabel('tauri')).toBe('Tauri Native');
    expect(transportModeLabel('custom-mode' as GrpcStudioTransportMode)).toBe('custom-mode');
  });

  it('extractBrowserTransportFailure handles missing or incomplete details', () => {
    expect(extractBrowserTransportFailure(undefined)).toBeUndefined();
    expect(extractBrowserTransportFailure({ message: 'x', code: 'ERR' })).toBeUndefined();
    expect(extractBrowserTransportFailure({
      message: 'x',
      code: 'ERR',
      details: { transportMode: 'grpc-web' },
    })).toBeUndefined();
    expect(extractBrowserTransportFailure({
      message: 'x',
      code: 'ERR',
      details: { browserTransportFailure: 'cors', transportMode: 'grpc-web' },
    })).toEqual({
      browserTransportFailure: 'cors',
      transportMode: 'grpc-web',
    });
  });

  it('classifyBrowserTransportFetchFailure returns undefined for non-browser transport modes', () => {
    expect(classifyBrowserTransportFetchFailure({
      error: new TypeError('Failed to fetch'),
      transportMode: 'express',
    })).toBeUndefined();
  });

  it('classifyBrowserTransportFetchFailure treats empty message as undefined', () => {
    expect(classifyBrowserTransportFetchFailure({
      error: '',
      transportMode: 'grpc-web',
    })).toBeUndefined();
    expect(classifyBrowserTransportFetchFailure({
      error: '   ',
      transportMode: 'spring-servlet',
    })).toBeUndefined();
  });

  it('classifyBrowserTransportFetchFailure stringifies non-Error values', () => {
    expect(classifyBrowserTransportFetchFailure({
      error: { reason: 'Failed to fetch' },
      transportMode: 'grpc-web',
    })).toBe('proxy_unreachable');
  });

  it('mapBrowserTransportFetchFailure passes through GrpcApiClientError unchanged', () => {
    const original = new GrpcApiClientError('call', 'already mapped', {
      code: GRPC_ERROR_CODES.CALL_FAILED,
      category: 'call_failed',
    });
    const mapped = mapBrowserTransportFetchFailure('call', original, {
      transportMode: 'grpc-web',
    });
    expect(mapped).toBe(original);
  });

  it('assertIncompatibleBrowserTransportContentType rejects HTML responses', () => {
    const error = assertIncompatibleBrowserTransportContentType('text/html; charset=utf-8', 'spring-servlet');
    expect(error).toBeInstanceOf(GrpcApiClientError);
    const body = error!.toErrorBody();
    expect(extractBrowserTransportFailure(body)?.browserTransportFailure).toBe('protocol_mismatch');
    expect(body.message).toMatch(/Spring Servlet/i);
    expect(body.message).toMatch(/not compatible/i);
  });

  it('formatBrowserTransportFailureMessage uses fallbackMessage for proxy_unreachable', () => {
    expect(formatBrowserTransportFailureMessage('proxy_unreachable', {
      transportMode: 'grpc-web',
      fallbackMessage: 'Custom network failure',
    })).toBe('Custom network failure');
  });

  it('formatBrowserTransportFailureHint distinguishes server_status 500+ from other HTTP errors', () => {
    const serverErrorHint = formatBrowserTransportFailureHint({
      message: 'fail',
      code: GRPC_ERROR_CODES.UNREACHABLE,
      details: {
        browserTransportFailure: 'server_status',
        transportMode: 'grpc-web',
        httpStatus: 503,
      },
    });
    const clientErrorHint = formatBrowserTransportFailureHint({
      message: 'fail',
      code: GRPC_ERROR_CODES.UNREACHABLE,
      details: {
        browserTransportFailure: 'server_status',
        transportMode: 'grpc-web',
        httpStatus: 400,
      },
    });

    expect(serverErrorHint).toMatch(/server logs/i);
    expect(clientErrorHint).toMatch(/Verify path/i);
    expect(serverErrorHint).not.toEqual(clientErrorHint);
  });

  it('grpcApiErrorToBrowserExpressFallbackBody leaves ineligible errors unchanged', () => {
    const error = new GrpcApiClientError('call', 'Generic unreachable', {
      code: GRPC_ERROR_CODES.UNREACHABLE,
      category: 'unreachable',
    });
    const body = grpcApiErrorToBrowserExpressFallbackBody(error, 'grpc-web');
    expect(body).toEqual(error.toErrorBody());
    expect(isBrowserTransportExpressFallbackEligible(body)).toBe(false);
    expect(isGrpcExpressFallbackOffered(body)).toBe(false);
  });

  it('classifyBrowserTransportHttpResponse treats HTTP 406 as protocol_mismatch', () => {
    expect(classifyBrowserTransportHttpResponse({
      httpStatus: 406,
      contentType: 'application/grpc',
      bodyLength: 0,
      transportMode: 'grpc-web',
    })).toBe('protocol_mismatch');
  });

  it('resetGrpcBrowserTransportErrorMapperForTests is a no-op symmetry hook', () => {
    expect(() => resetGrpcBrowserTransportErrorMapperForTests()).not.toThrow();
  });

  it('formatBrowserTransportFailureMessage uses fallbackMessage for server_status without httpStatus', () => {
    expect(formatBrowserTransportFailureMessage('server_status', {
      transportMode: 'spring-servlet',
      fallbackMessage: 'Upstream rejected request',
    })).toBe('Upstream rejected request');
  });

  it('mapBrowserTransportFetchFailure falls back to generic unreachable for unclassified errors', () => {
    const error = mapBrowserTransportFetchFailure('call', null, {
      transportMode: 'express',
    });
    expect(error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    expect(error.message).toBe('Browser transport fetch failed');
    expect(extractBrowserTransportFailure(error.toErrorBody() as GrpcErrorBody)).toBeUndefined();
  });

  it('isBrowserTransportExpressFallbackEligible honors suggestExpressProxy without browserTransportFailure', () => {
    expect(isBrowserTransportExpressFallbackEligible({
      message: 'fail',
      code: GRPC_ERROR_CODES.UNREACHABLE,
      details: { suggestExpressProxy: true, transportMode: 'grpc-web' },
    })).toBe(true);
    expect(isBrowserTransportExpressFallbackEligible({
      message: 'fail',
      code: GRPC_ERROR_CODES.UNREACHABLE,
      details: { transportMode: 'grpc-web' },
    })).toBe(false);
  });

  it('grpcApiErrorToBrowserExpressFallbackBody uses transportMode from details or argument', () => {
    const error = buildBrowserTransportGrpcApiError('call', 'cors', {
      transportMode: 'spring-servlet',
    });
    const body = grpcApiErrorToBrowserExpressFallbackBody(error, 'grpc-web');
    expect(body.details).toEqual(expect.objectContaining({
      suggestExpressProxy: true,
      transportMode: 'spring-servlet',
    }));
  });

  it('classifyBrowserTransportHttpResponse treats JSON responses as protocol_mismatch', () => {
    expect(classifyBrowserTransportHttpResponse({
      httpStatus: 200,
      contentType: 'application/json; charset=utf-8',
      bodyLength: 128,
      transportMode: 'grpc-web',
    })).toBe('protocol_mismatch');
  });

  it('formatBrowserTransportFailureMessage covers cors, timeout, and default branches', () => {
    expect(formatBrowserTransportFailureMessage('cors', { transportMode: 'grpc-web' }))
      .toMatch(/CORS/i);
    expect(formatBrowserTransportFailureMessage('timeout', { transportMode: 'spring-servlet' }))
      .toMatch(/timed out/i);
    expect(formatBrowserTransportFailureMessage('server_status', {
      transportMode: 'grpc-web',
      fallbackMessage: 'Custom failure',
    })).toBe('Custom failure');
  });

  it('formatBrowserTransportFailureHint covers cors, timeout, and default branches', () => {
    expect(formatBrowserTransportFailureHint({
      message: 'fail',
      code: GRPC_ERROR_CODES.UNREACHABLE,
      details: { browserTransportFailure: 'cors', transportMode: 'grpc-web' },
    })).toMatch(/Allow CORS/i);
    expect(formatBrowserTransportFailureHint({
      message: 'fail',
      code: GRPC_ERROR_CODES.UNREACHABLE,
      details: { browserTransportFailure: 'timeout', transportMode: 'grpc-web' },
    })).toMatch(/Increase the call timeout/i);
    expect(formatBrowserTransportFailureHint({
      message: 'fail',
      code: GRPC_ERROR_CODES.UNREACHABLE,
      details: { browserTransportFailure: 'unexpected' as 'cors', transportMode: 'grpc-web' },
    })).toBeUndefined();
  });

  it('mapBrowserTransportDecodeFailure returns undefined for non-browser transports', () => {
    expect(mapBrowserTransportDecodeFailure('express', new Error('invalid grpc frame'))).toBeUndefined();
  });

  it('mapBrowserTransportDecodeFailure maps malformed frame errors to protocol_mismatch', () => {
    const error = mapBrowserTransportDecodeFailure('grpc-web', new Error('malformed frame header'));
    expect(error).toBeInstanceOf(GrpcApiClientError);
    expect(extractBrowserTransportFailure(error!.toErrorBody())?.browserTransportFailure)
      .toBe('protocol_mismatch');
  });

  it('assertIncompatibleBrowserTransportContentType rejects JSON responses', () => {
    const error = assertIncompatibleBrowserTransportContentType('application/json', 'grpc-web');
    expect(error).toBeInstanceOf(GrpcApiClientError);
    expect(extractBrowserTransportFailure(error!.toErrorBody())?.browserTransportFailure)
      .toBe('protocol_mismatch');
  });

  it('formatBrowserTransportFailureMessage default branch uses fallbackMessage', () => {
    expect(formatBrowserTransportFailureMessage('unexpected' as 'cors', {
      transportMode: 'grpc-web',
      fallbackMessage: 'Fallback transport failure',
    })).toBe('Fallback transport failure');
  });

  it('formatBrowserTransportFailureHint returns undefined without transport failure details', () => {
    expect(formatBrowserTransportFailureHint(undefined)).toBeUndefined();
    expect(formatBrowserTransportFailureHint({
      message: 'fail',
      code: GRPC_ERROR_CODES.UNREACHABLE,
    })).toBeUndefined();
  });

  it('mapBrowserTransportDecodeFailure returns undefined for unmatched decode errors', () => {
    expect(mapBrowserTransportDecodeFailure('grpc-web', new Error('generic decode failure')))
      .toBeUndefined();
  });

  it('buildBrowserTransportGrpcApiError maps unknown failure kinds via default category', () => {
    const error = buildBrowserTransportGrpcApiError('call', 'unexpected' as 'cors', {
      transportMode: 'grpc-web',
    });
    expect(error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    expect(error.retryable).toBe(true);
  });
});
