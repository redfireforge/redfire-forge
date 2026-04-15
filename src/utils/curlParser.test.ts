import { describe, it, expect, vi } from 'vitest';

vi.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000001' }));

import { parseCurl } from './curlParser';

describe('parseCurl', () => {
  it('parses a simple GET with URL only', () => {
    const s = parseCurl('curl http://example.com/api');
    expect(s.method).toBe('GET');
    expect(s.url).toBe('http://example.com/api');
    expect(s.body).toBe('');
    expect(s.name).toBe('api');
  });

  it('parses explicit method with -X POST', () => {
    const s = parseCurl('curl -X POST http://example.com/api');
    expect(s.method).toBe('POST');
    expect(s.url).toBe('http://example.com/api');
  });

  it('parses multiple -H headers', () => {
    const s = parseCurl(
      "curl -H 'Content-Type: application/json' -H 'Accept: text/html' http://example.com",
    );
    expect(s.headers).toEqual([
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Accept', value: 'text/html' },
    ]);
  });

  it('infers POST when body is set via -d', () => {
    const s = parseCurl(`curl -d '{"key":"value"}' http://example.com`);
    expect(s.method).toBe('POST');
    expect(s.body).toBe('{"key":"value"}');
  });

  it('parses --data-raw body', () => {
    const s = parseCurl("curl --data-raw 'raw=payload' http://example.com/x");
    expect(s.method).toBe('POST');
    expect(s.body).toBe('raw=payload');
  });

  it('parses URL after --url', () => {
    const s = parseCurl('curl --url http://example.com/api');
    expect(s.url).toBe('http://example.com/api');
    expect(s.method).toBe('GET');
  });

  it('parses basic auth from -u', () => {
    const s = parseCurl('curl -u admin:password http://example.com');
    expect(s.auth).toEqual({ type: 'basic', username: 'admin', password: 'password' });
  });

  it('parses basic auth from Authorization: Basic header', () => {
    const s = parseCurl("curl -H 'Authorization: Basic dXNlcjpwYXNz' http://example.com");
    expect(s.auth).toEqual({ type: 'basic', username: 'user', password: 'pass' });
    expect(s.headers?.filter((h) => h.key.toLowerCase() === 'authorization')).toHaveLength(0);
  });

  it('joins line continuations and parses POST', () => {
    const s = parseCurl(`curl \\
  -X POST \\
  http://example.com`);
    expect(s.method).toBe('POST');
    expect(s.url).toBe('http://example.com');
  });

  it('respects single- and double-quoted strings', () => {
    const s = parseCurl('curl -H "Content-Type: application/json" \'http://example.com/path\'');
    expect(s.url).toBe('http://example.com/path');
    expect(s.headers?.some((h) => h.key === 'Content-Type' && h.value === 'application/json')).toBe(true);
  });

  it('derives name from last two path segments', () => {
    const s = parseCurl('curl http://example.com/api/v1/users');
    expect(s.name).toBe('v1/users');
  });

  it('skips unknown flags and their argument', () => {
    const s = parseCurl('curl -unknown-flag argvalue http://example.com/z');
    expect(s.url).toBe('http://example.com/z');
    expect(s.method).toBe('GET');
  });

  it('ignores known no-arg flags', () => {
    const s = parseCurl('curl -k -s --compressed -L http://example.com/secure');
    expect(s.url).toBe('http://example.com/secure');
    expect(s.method).toBe('GET');
  });

  it('uses the last -X when multiple methods are given', () => {
    const s = parseCurl('curl -X GET -X PUT http://example.com/r');
    expect(s.method).toBe('PUT');
  });

  it('defaults to GET without body and POST with body', () => {
    expect(parseCurl('curl http://a.com').method).toBe('GET');
    expect(parseCurl('curl -d x http://a.com').method).toBe('POST');
  });

  it('always includes at least one header row', () => {
    const s = parseCurl('curl http://example.com');
    expect(s.headers).toEqual([{ key: '', value: '' }]);
  });

  it('assigns a stable mocked id', () => {
    const s = parseCurl('curl http://example.com');
    expect(s.id).toBe('00000000-0000-4000-8000-000000000001');
  });
});
