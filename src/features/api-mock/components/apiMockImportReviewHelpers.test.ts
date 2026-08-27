import { describe, expect, it } from 'vitest';
import {
  IMPORT_SOURCES,
  parseCurlToSource,
  responseStatusMeta,
  splitPathParams,
} from './apiMockImportReviewHelpers';

describe('apiMockImportReviewHelpers', () => {
  it('lists all import sources including HAR', () => {
    expect(IMPORT_SOURCES.map(s => s.id)).toContain('har');
    expect(IMPORT_SOURCES.length).toBe(7);
  });

  it('parses curl method, url, headers, and body', () => {
    const src = parseCurlToSource(
      "curl -X POST https://api.example.com/users?x=1 -H 'Content-Type: application/json' -H 'X-Tenant: acme' -d 'hello'",
    );
    expect(src.method).toBe('POST');
    expect(src.path).toBe('/users');
    expect(src.headers['Content-Type']).toBe('application/json');
    expect(src.headers['X-Tenant']).toBe('acme');
    expect(src.body).toBe('hello');
    expect(src.contentType).toBe('application/json');
  });

  it('defaults method to GET and falls back for relative paths', () => {
    const src = parseCurlToSource("curl '/orders/42'");
    expect(src.method).toBe('GET');
    expect(src.path).toBe('/orders/42');
  });

  it('handles unparseable absolute-looking URL via catch path', () => {
    const src = parseCurlToSource('curl http://[bad');
    expect(src.path).toBeTruthy();
  });

  it('supports --data-raw body and content-type header casing', () => {
    const src = parseCurlToSource("curl https://api.example.com/x -H 'content-type: text/plain' --data-raw 'abc'");
    expect(src.body).toBe('abc');
    expect(src.contentType).toBe('text/plain');
  });

  it('skips empty header keys and defaults missing url to /', () => {
    const src = parseCurlToSource("curl -H ':novalue' -H 'Ok: yes'");
    expect(src.path).toBe('/');
    expect(src.headers.Ok).toBe('yes');
  });

  it('classifies response status metadata', () => {
    expect(responseStatusMeta(200)).toEqual({ statusClass: 'success', statusText: 'OK' });
    expect(responseStatusMeta(301)).toEqual({ statusClass: 'warning', statusText: 'Redirect' });
    expect(responseStatusMeta(404)).toEqual({ statusClass: 'warning', statusText: 'Client Error' });
    expect(responseStatusMeta(500)).toEqual({ statusClass: 'danger', statusText: 'Server Error' });
  });

  it('splits path param tokens', () => {
    expect(splitPathParams('/users/{id}/orders')).toEqual(['/users/', '{id}', '/orders']);
  });
});
