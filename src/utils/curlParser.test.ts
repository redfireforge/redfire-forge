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

  it('treats repeated spaces as a single token boundary', () => {
    const s = parseCurl('curl   http://example.com/api');
    expect(s.url).toBe('http://example.com/api');
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

  it('keeps Authorization as header for bearer values', () => {
    const s = parseCurl("curl -H 'Authorization: Bearer tok123' http://example.com");
    const authHeader = s.headers?.find(h => h.key === 'Authorization');
    expect(authHeader?.value).toBe('Bearer tok123');
  });

  it('keeps Authorization as header for unknown schemes', () => {
    const s = parseCurl("curl -H 'Authorization: CustomScheme abc' http://example.com");
    const authHeader = s.headers?.find(h => h.key === 'Authorization');
    expect(authHeader?.value).toBe('CustomScheme abc');
  });

  it('handles --data-urlencode with key=value pairs', () => {
    const s = parseCurl("curl --data-urlencode 'name=John' --data-urlencode 'city=NYC' http://example.com");
    expect(s.method).toBe('POST');
    expect(s.bodyType).toBe('form-urlencoded');
    expect(s.bodyForm).toEqual([
      { key: 'name', value: 'John' },
      { key: 'city', value: 'NYC' },
    ]);
  });

  it('handles --data-urlencode without = as body data', () => {
    const s = parseCurl("curl --data-urlencode 'rawdata' http://example.com");
    expect(s.body).toContain('rawdata');
  });

  it('handles -F / --form for form-data fields', () => {
    const s = parseCurl("curl -F 'field1=value1' -F 'field2=value2' http://example.com");
    expect(s.bodyType).toBe('form-data');
    expect(s.bodyForm).toEqual([
      { key: 'field1', value: 'value1' },
      { key: 'field2', value: 'value2' },
    ]);
  });

  it('handles -u without colon (username only)', () => {
    const s = parseCurl('curl -u onlyuser http://example.com');
    expect(s.auth).toEqual({ type: 'basic', username: 'onlyuser', password: '' });
  });

  it('handles --data-binary body', () => {
    const s = parseCurl("curl --data-binary 'binarydata' http://example.com/upload");
    expect(s.body).toBe('binarydata');
  });

  it('sets bodyType xml when content-type is xml', () => {
    const s = parseCurl("curl -H 'Content-Type: application/xml' -d '<root/>' http://example.com");
    expect(s.bodyType).toBe('xml');
  });

  it('sets bodyType xml when content-type is text/xml', () => {
    const s = parseCurl("curl -H 'Content-Type: text/xml; charset=utf-8' -d '<r/>' http://example.com");
    expect(s.bodyType).toBe('xml');
  });

  it('sets bodyType text when content-type is text/plain', () => {
    const s = parseCurl("curl -H 'Content-Type: text/plain' -d 'hello' http://example.com");
    expect(s.bodyType).toBe('text');
  });

  it('sets bodyType form-urlencoded with matching content-type', () => {
    const s = parseCurl("curl -H 'Content-Type: application/x-www-form-urlencoded' -d 'a=1&b=2' http://example.com");
    expect(s.bodyType).toBe('form-urlencoded');
    expect(s.bodyForm).toBeDefined();
  });

  it('sets bodyType form-data with multipart content-type', () => {
    const s = parseCurl("curl -H 'Content-Type: multipart/form-data' -d 'data' http://example.com");
    expect(s.bodyType).toBe('form-data');
  });

  it('maps unsupported methods to GET', () => {
    const s = parseCurl('curl -X OPTIONS http://example.com');
    expect(s.method).toBe('GET');
  });

  it('handles escaped characters in quoted strings', () => {
    const s = parseCurl('curl -d "key=val\\"ue" http://example.com');
    expect(s.body).toContain('val"ue');
  });

  it('uses hostname as name for root URL', () => {
    const s = parseCurl('curl http://example.com/');
    expect(s.name).toBe('example.com');
  });

  it('handles invalid Authorization: Basic base64 gracefully', () => {
    const s = parseCurl("curl -H 'Authorization: Basic not!valid!base64~' http://example.com");
    const authHeaders = s.headers?.filter(h => h.key === 'Authorization');
    expect(authHeaders?.length).toBeGreaterThanOrEqual(1);
  });

  it('handles --request as alias for -X', () => {
    const s = parseCurl('curl --request DELETE http://example.com/item');
    expect(s.method).toBe('DELETE');
  });

  it('handles --user as alias for -u', () => {
    const s = parseCurl('curl --user admin:pass http://example.com');
    expect(s.auth).toEqual({ type: 'basic', username: 'admin', password: 'pass' });
  });

  it('names scenario "Imported Scenario" for invalid URL', () => {
    const s = parseCurl('curl not-a-valid-url');
    expect(s.name).toBe('Imported Scenario');
  });
});
