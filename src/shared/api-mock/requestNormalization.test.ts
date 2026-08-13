import { describe, it, expect } from 'vitest';
import { normalizeRequest } from './requestNormalization';
import type { RawRequestInput } from './requestNormalization';

function raw(overrides: Partial<RawRequestInput> = {}): RawRequestInput {
  return { method: 'GET', url: '/test', headers: {}, ...overrides };
}

describe('normalizeRequest', () => {
  describe('method normalization', () => {
    it('uppercases the method', () => {
      const { captured } = normalizeRequest(raw({ method: 'get' }));
      expect(captured.method).toBe('GET');
    });

    it('preserves already-uppercase methods', () => {
      const { captured } = normalizeRequest(raw({ method: 'POST' }));
      expect(captured.method).toBe('POST');
    });

    it('handles mixed case', () => {
      const { captured } = normalizeRequest(raw({ method: 'pAtCh' }));
      expect(captured.method).toBe('PATCH');
    });
  });

  describe('URL and path parsing', () => {
    it('extracts path without query', () => {
      const { captured } = normalizeRequest(raw({ url: '/users/42' }));
      expect(captured.path).toBe('/users/42');
      expect(captured.rawPath).toBe('/users/42');
    });

    it('separates path from query string', () => {
      const { captured } = normalizeRequest(raw({ url: '/search?q=hello&page=1' }));
      expect(captured.path).toBe('/search');
      expect(captured.rawPath).toBe('/search?q=hello&page=1');
    });

    it('strips fragment from rawPath', () => {
      const { captured } = normalizeRequest(raw({ url: '/page#section' }));
      expect(captured.rawPath).toBe('/page');
      expect(captured.path).toBe('/page');
    });

    it('decodes percent-encoded path in summary', () => {
      const { summary } = normalizeRequest(raw({ url: '/hello%20world/caf%C3%A9' }));
      expect(summary.decodedPath).toBe('/hello world/café');
      expect(summary.path).toBe('/hello%20world/caf%C3%A9');
    });

    it('splits path into segments', () => {
      const { summary } = normalizeRequest(raw({ url: '/api/v1/users/42' }));
      expect(summary.pathSegments).toEqual(['api', 'v1', 'users', '42']);
    });

    it('handles root path', () => {
      const { summary } = normalizeRequest(raw({ url: '/' }));
      expect(summary.pathSegments).toEqual([]);
      expect(summary.path).toBe('/');
    });

    it('survives malformed percent encoding', () => {
      const { summary } = normalizeRequest(raw({ url: '/bad%ZZ' }));
      expect(summary.decodedPath).toBe('/bad%ZZ');
    });
  });

  describe('query string parsing', () => {
    it('parses simple query parameters', () => {
      const { captured } = normalizeRequest(raw({ url: '/s?q=hello&lang=en' }));
      expect(captured.query).toEqual({ q: ['hello'], lang: ['en'] });
    });

    it('handles repeated query keys', () => {
      const { captured } = normalizeRequest(raw({ url: '/s?tag=a&tag=b&tag=c' }));
      expect(captured.query.tag).toEqual(['a', 'b', 'c']);
    });

    it('decodes query values', () => {
      const { captured } = normalizeRequest(raw({ url: '/s?q=hello%20world' }));
      expect(captured.query.q).toEqual(['hello world']);
    });

    it('handles empty query value', () => {
      const { captured } = normalizeRequest(raw({ url: '/s?flag' }));
      expect(captured.query.flag).toEqual(['']);
    });

    it('handles empty query string', () => {
      const { captured } = normalizeRequest(raw({ url: '/s?' }));
      expect(captured.query).toEqual({});
    });

    it('returns empty query when no ? exists', () => {
      const { captured } = normalizeRequest(raw({ url: '/no-query' }));
      expect(captured.query).toEqual({});
    });
  });

  describe('header normalization', () => {
    it('lowercases header keys', () => {
      const { captured } = normalizeRequest(raw({
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'val' },
      }));
      expect(captured.headers['content-type']).toEqual(['application/json']);
      expect(captured.headers['x-custom']).toEqual(['val']);
    });

    it('preserves repeated header values', () => {
      const { captured } = normalizeRequest(raw({
        headers: { 'Accept': ['text/html', 'application/json'] },
      }));
      expect(captured.headers.accept).toEqual(['text/html', 'application/json']);
    });

    it('merges duplicate header keys with different casing', () => {
      const { captured } = normalizeRequest(raw({
        headers: { 'x-test': 'a', 'X-Test': 'b' },
      }));
      expect(captured.headers['x-test']).toEqual(['a', 'b']);
    });

    it('skips undefined header values', () => {
      const { captured } = normalizeRequest(raw({
        headers: { 'x-present': 'yes', 'x-absent': undefined },
      }));
      expect(captured.headers['x-present']).toEqual(['yes']);
      expect(captured.headers['x-absent']).toBeUndefined();
    });

    it('drops HTTP/2 pseudo-headers and maps :authority to host', () => {
      const { captured, summary } = normalizeRequest(raw({
        headers: {
          ':method': 'GET',
          ':path': '/users',
          ':scheme': 'https',
          ':authority': '127.0.0.1:4600',
          accept: 'application/json',
        },
      }));
      expect(captured.headers.host).toEqual(['127.0.0.1:4600']);
      expect(captured.headers.accept).toEqual(['application/json']);
      expect(captured.headers[':method']).toBeUndefined();
      expect(captured.headers[':authority']).toBeUndefined();
      expect(summary.headerKeys).toEqual(['accept', 'host']);
    });

    it('keeps an explicit Host header when :authority is also present', () => {
      const { captured } = normalizeRequest(raw({
        headers: { host: 'api.test', ':authority': 'ignored.example' },
      }));
      expect(captured.headers.host).toEqual(['api.test']);
    });

    it('sorts header keys in summary', () => {
      const { summary } = normalizeRequest(raw({
        headers: { 'z-header': 'z', 'a-header': 'a', 'm-header': 'm' },
      }));
      expect(summary.headerKeys).toEqual(['a-header', 'm-header', 'z-header']);
    });
  });

  describe('cookie parsing', () => {
    it('parses cookies from Cookie header', () => {
      const { captured } = normalizeRequest(raw({
        headers: { 'Cookie': 'session=abc123; theme=dark' },
      }));
      expect(captured.cookies).toEqual({ session: 'abc123', theme: 'dark' });
    });

    it('handles cookies with = in value', () => {
      const { captured } = normalizeRequest(raw({
        headers: { 'Cookie': 'data=key=value' },
      }));
      expect(captured.cookies.data).toBe('key=value');
    });

    it('returns empty cookies when no Cookie header', () => {
      const { captured } = normalizeRequest(raw());
      expect(captured.cookies).toEqual({});
    });

    it('joins multiple Cookie headers the way HTTP/2 sends them', () => {
      const { captured } = normalizeRequest(raw({
        headers: { cookie: ['session=abc', 'theme=dark'] },
      }));
      expect(captured.cookies).toEqual({ session: 'abc', theme: 'dark' });
    });

    it('skips malformed cookie pairs', () => {
      const { captured } = normalizeRequest(raw({
        headers: { 'Cookie': 'good=yes; ; =empty; valid=ok' },
      }));
      expect(captured.cookies).toEqual({ good: 'yes', valid: 'ok' });
    });

    it('sorts cookie keys in summary', () => {
      const { summary } = normalizeRequest(raw({
        headers: { 'Cookie': 'z=1; a=2' },
      }));
      expect(summary.cookieKeys).toEqual(['a', 'z']);
    });
  });

  describe('content-type extraction', () => {
    it('extracts content-type from headers', () => {
      const { captured } = normalizeRequest(raw({
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }));
      expect(captured.contentType).toBe('application/json; charset=utf-8');
    });

    it('is undefined when no content-type', () => {
      const { captured } = normalizeRequest(raw());
      expect(captured.contentType).toBeUndefined();
    });
  });

  describe('content-length', () => {
    it('parses from header', () => {
      const { captured } = normalizeRequest(raw({
        headers: { 'Content-Length': '42' },
      }));
      expect(captured.contentLength).toBe(42);
    });

    it('is undefined for non-numeric', () => {
      const { captured } = normalizeRequest(raw({
        headers: { 'Content-Length': 'invalid' },
      }));
      expect(captured.contentLength).toBeUndefined();
    });
  });

  describe('body handling', () => {
    it('captures body string', () => {
      const { captured } = normalizeRequest(raw({ body: '{"key":"value"}' }));
      expect(captured.body).toBe('{"key":"value"}');
      expect(captured.bodyTruncated).toBe(false);
    });

    it('captures null body', () => {
      const { captured } = normalizeRequest(raw({ body: null }));
      expect(captured.body).toBeNull();
      expect(captured.bodyTruncated).toBe(false);
    });

    it('captures undefined body as null', () => {
      const { captured } = normalizeRequest(raw());
      expect(captured.body).toBeNull();
    });

    it('reports body size in summary', () => {
      const { summary } = normalizeRequest(raw({ body: 'hello' }));
      expect(summary.bodySizeBytes).toBe(5);
    });

    it('reports 0 for null body', () => {
      const { summary } = normalizeRequest(raw({ body: null }));
      expect(summary.bodySizeBytes).toBe(0);
    });

    it('counts multi-byte characters correctly', () => {
      const { summary } = normalizeRequest(raw({ body: 'café' }));
      expect(summary.bodySizeBytes).toBe(5); // é is 2 bytes in UTF-8
    });
  });

  describe('metadata', () => {
    it('captures remoteAddress', () => {
      const { captured } = normalizeRequest(raw({ remoteAddress: '192.168.1.1' }));
      expect(captured.remoteAddress).toBe('192.168.1.1');
    });

    it('captures mTLS peer attributes and omits empty values', () => {
      const { captured } = normalizeRequest(raw({
        clientCertSubject: 'CN=acme-client',
        clientCertFingerprint: 'aabbcc',
      }));
      expect(captured.clientCertSubject).toBe('CN=acme-client');
      expect(captured.clientCertFingerprint).toBe('aabbcc');
      const empty = normalizeRequest(raw({ clientCertSubject: '', clientCertFingerprint: '' })).captured;
      expect(empty.clientCertSubject).toBeUndefined();
      expect(empty.clientCertFingerprint).toBeUndefined();
    });

    it('uses provided receivedAt', () => {
      const ts = '2026-08-11T10:00:00.000Z';
      const { captured } = normalizeRequest(raw({ receivedAt: ts }));
      expect(captured.receivedAt).toBe(ts);
    });

    it('generates receivedAt when not provided', () => {
      const { captured } = normalizeRequest(raw());
      expect(captured.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('determinism', () => {
    it('produces identical output for identical input', () => {
      const input = raw({
        method: 'POST',
        url: '/api/users?role=admin&role=user',
        headers: { 'Content-Type': 'application/json', 'X-Tenant': 'acme' },
        body: '{"name":"Alice"}',
        remoteAddress: '127.0.0.1',
        receivedAt: '2026-08-11T00:00:00.000Z',
      });
      const r1 = normalizeRequest(input);
      const r2 = normalizeRequest(input);
      expect(r1.captured).toEqual(r2.captured);
      expect(r1.summary).toEqual(r2.summary);
    });
  });

  describe('summary completeness', () => {
    it('includes all summary fields for a complex request', () => {
      const { summary } = normalizeRequest(raw({
        method: 'POST',
        url: '/api/v1/users?include=profile',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=abc; theme=dark',
          'Authorization': 'Bearer tok',
        },
        body: '{"name":"test"}',
      }));
      expect(summary.method).toBe('POST');
      expect(summary.path).toBe('/api/v1/users');
      expect(summary.decodedPath).toBe('/api/v1/users');
      expect(summary.pathSegments).toEqual(['api', 'v1', 'users']);
      expect(summary.query).toEqual({ include: ['profile'] });
      expect(summary.headerKeys).toEqual(['authorization', 'content-type', 'cookie']);
      expect(summary.cookieKeys).toEqual(['session', 'theme']);
      expect(summary.bodyContentType).toBe('application/json');
      expect(summary.bodySizeBytes).toBe(15);
    });
  });
});
