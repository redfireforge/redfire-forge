/**
 * Unit tests for grpcBrowserTransportMetadataNorm — Phase 10F.
 */
import { describe, it, expect } from 'vitest';
import {
  buildBrowserTransportUserMetadataHeaders,
  GRPC_AUTH_HEADER_KEYS,
} from './grpcBrowserTransportMetadataNorm';
import { GRPC_WEB_RESERVED_HEADERS } from './grpcWebTransportContracts';
import { SPRING_SERVLET_RESERVED_HEADERS } from './grpcSpringServletTransportContracts';

describe('buildBrowserTransportUserMetadataHeaders', () => {
  describe('basic passthrough', () => {
    it('passes through user metadata keys', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'x-custom': 'trace-1', 'x-request-id': 'req-abc' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['x-custom']).toBe('trace-1');
      expect(headers['x-request-id']).toBe('req-abc');
    });

    it('returns empty headers for undefined metadata', () => {
      const { headers, binaryKeyCount } = buildBrowserTransportUserMetadataHeaders(
        undefined,
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers).toEqual({});
      expect(binaryKeyCount).toBe(0);
    });

    it('returns empty headers for empty metadata record', () => {
      const { headers, binaryKeyCount } = buildBrowserTransportUserMetadataHeaders(
        {},
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers).toEqual({});
      expect(binaryKeyCount).toBe(0);
    });
  });

  describe('reserved header filtering — grpc-web', () => {
    it('filters out accept (grpc-web reserved)', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { accept: 'text/plain', 'x-custom': 'ok' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['accept']).toBeUndefined();
      expect(headers['x-custom']).toBe('ok');
    });

    it('filters out content-type (grpc-web reserved)', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'content-type': 'text/plain', 'x-custom': 'ok' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['content-type']).toBeUndefined();
    });

    it('filters out x-grpc-web (grpc-web reserved)', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'x-grpc-web': '0', 'x-custom': 'ok' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['x-grpc-web']).toBeUndefined();
    });

    it('filters out grpc-timeout (grpc-web reserved)', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'grpc-timeout': '5000m', 'x-custom': 'ok' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['grpc-timeout']).toBeUndefined();
    });

    it('filters reserved headers regardless of key casing', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'Content-Type': 'text/plain', Accept: 'application/json' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['Content-Type']).toBeUndefined();
      expect(headers['Accept']).toBeUndefined();
    });

    it('passes through all grpc-web reserved keys are in GRPC_WEB_RESERVED_HEADERS', () => {
      expect(GRPC_WEB_RESERVED_HEADERS.has('accept')).toBe(true);
      expect(GRPC_WEB_RESERVED_HEADERS.has('content-type')).toBe(true);
      expect(GRPC_WEB_RESERVED_HEADERS.has('x-grpc-web')).toBe(true);
      expect(GRPC_WEB_RESERVED_HEADERS.has('grpc-timeout')).toBe(true);
    });
  });

  describe('reserved header filtering — spring-servlet', () => {
    it('filters out accept (spring-servlet reserved)', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { accept: 'application/json', 'x-custom': 'ok' },
        SPRING_SERVLET_RESERVED_HEADERS,
      );
      expect(headers['accept']).toBeUndefined();
      expect(headers['x-custom']).toBe('ok');
    });

    it('filters out content-type (spring-servlet reserved)', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'content-type': 'application/json', 'x-custom': 'ok' },
        SPRING_SERVLET_RESERVED_HEADERS,
      );
      expect(headers['content-type']).toBeUndefined();
    });

    it('filters out te (spring-servlet reserved)', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { te: 'compress', 'x-custom': 'ok' },
        SPRING_SERVLET_RESERVED_HEADERS,
      );
      expect(headers['te']).toBeUndefined();
    });

    it('filters out grpc-timeout (spring-servlet reserved)', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'grpc-timeout': '1000m', 'x-custom': 'ok' },
        SPRING_SERVLET_RESERVED_HEADERS,
      );
      expect(headers['grpc-timeout']).toBeUndefined();
    });
  });

  describe('binary (-bin) key passthrough', () => {
    it('passes -bin key through with base64 value intact', () => {
      const base64Value = btoa('binary-payload');
      const { headers, binaryKeyCount } = buildBrowserTransportUserMetadataHeaders(
        { 'custom-data-bin': base64Value, 'x-custom': 'text' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['custom-data-bin']).toBe(base64Value);
      expect(headers['x-custom']).toBe('text');
      expect(binaryKeyCount).toBe(1);
    });

    it('counts multiple -bin keys correctly', () => {
      const { binaryKeyCount } = buildBrowserTransportUserMetadataHeaders(
        {
          'key1-bin': btoa('a'),
          'key2-bin': btoa('b'),
          'x-text': 'hello',
        },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(binaryKeyCount).toBe(2);
    });

    it('does not re-encode -bin values', () => {
      const originalBase64 = 'aGVsbG8='; // base64 of "hello"
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'payload-bin': originalBase64 },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['payload-bin']).toBe(originalBase64);
    });

    it('binaryKeyCount is 0 when no -bin keys present', () => {
      const { binaryKeyCount } = buildBrowserTransportUserMetadataHeaders(
        { 'x-custom': 'value' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(binaryKeyCount).toBe(0);
    });
  });

  describe('auth header passthrough', () => {
    it('passes authorization header through (already merged upstream)', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { authorization: 'Bearer tok123', 'x-custom': 'ok' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['authorization']).toBe('Bearer tok123');
    });

    it('passes x-api-key through', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'x-api-key': 'apikey123' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['x-api-key']).toBe('apikey123');
    });

    it('GRPC_AUTH_HEADER_KEYS contains expected keys', () => {
      expect(GRPC_AUTH_HEADER_KEYS.has('authorization')).toBe(true);
      expect(GRPC_AUTH_HEADER_KEYS.has('x-api-key')).toBe(true);
    });
  });

  describe('compression header passthrough', () => {
    it('passes grpc-encoding through (injected by prepareGrpcCallMetadata upstream)', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'grpc-encoding': 'gzip', 'grpc-accept-encoding': 'gzip,identity' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['grpc-encoding']).toBe('gzip');
      expect(headers['grpc-accept-encoding']).toBe('gzip,identity');
    });
  });

  describe('custom reserved set', () => {
    it('respects an arbitrary reserved set', () => {
      const customReserved: ReadonlySet<string> = new Set(['x-blocked', 'blocked-also']);
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'x-blocked': 'should-be-removed', 'x-allowed': 'should-pass' },
        customReserved,
      );
      expect(headers['x-blocked']).toBeUndefined();
      expect(headers['x-allowed']).toBe('should-pass');
    });
  });
});
