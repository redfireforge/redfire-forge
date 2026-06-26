/**
 * gqlFetch.test.ts — direct unit tests for the GraphQL HTTP transport helper.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gqlFetch, gqlUpload } from './gqlFetch';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('./tauriGqlNativeFetch', () => ({
  tauriGqlNativeFetch: vi.fn(),
}));

vi.mock('./tauriGqlNativeUpload', () => ({
  tauriGqlNativeUpload: vi.fn(),
}));

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { isTauri } from '../../../shared/utils/platform';
import { httpFetch } from '../../../shared/utils/httpClient';
import { tauriGqlNativeFetch } from './tauriGqlNativeFetch';
import { tauriGqlNativeUpload } from './tauriGqlNativeUpload';
const mockIsTauri = vi.mocked(isTauri);
const mockHttpFetch = vi.mocked(httpFetch);
const mockTauriGqlNativeFetch = vi.mocked(tauriGqlNativeFetch);
const mockTauriGqlNativeUpload = vi.mocked(tauriGqlNativeUpload);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUCCESS_RESPONSE = {
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json' },
  body: '{"data":{"hello":"world"}}',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('gqlFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockHttpFetch.mockResolvedValue(SUCCESS_RESPONSE);
    mockTauriGqlNativeFetch.mockResolvedValue(SUCCESS_RESPONSE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockHttpFetch.mockResolvedValue(SUCCESS_RESPONSE);
  });

  // ── Standard (non-TLS-skip) path ────────────────────────────────────────────

  it('calls httpFetch with correct params when skipTlsVerify is false', async () => {
    await gqlFetch('https://api.example.com/graphql', 'POST', { 'X-Custom': 'value' }, '{"query":"{ hello }"}');
    expect(mockHttpFetch).toHaveBeenCalledOnce();
    const [url, method, headers, body] = mockHttpFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/graphql');
    expect(method).toBe('POST');
    expect(headers).toEqual({ 'X-Custom': 'value' });
    expect(body).toBe('{"query":"{ hello }"}');
  });

  it('calls httpFetch (not fetch) when skipTlsVerify is falsy', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('returns httpFetch result directly', async () => {
    mockHttpFetch.mockResolvedValue(SUCCESS_RESPONSE);
    const result = await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}');
    expect(result).toEqual(SUCCESS_RESPONSE);
  });

  it('forwards AbortSignal to httpFetch', async () => {
    const ctrl = new AbortController();
    await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}', ctrl.signal);
    expect(mockHttpFetch.mock.calls[0][4]).toBe(ctrl.signal);
  });

  it('returns Aborted sentinel immediately when signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}', ctrl.signal);
    expect(result.error).toBe('Aborted');
    expect(result.status).toBe(0);
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  // ── Tauri path ───────────────────────────────────────────────────────────────

  it('routes Tauri POST with skipTlsVerify through native gql_http_fetch', async () => {
    mockIsTauri.mockReturnValue(true);

    await gqlFetch('https://api.example.com/graphql', 'POST', { 'X-Auth': 'tok' }, '{"query":"{ h }"}', undefined, true);
    expect(mockHttpFetch).not.toHaveBeenCalled();
    expect(mockTauriGqlNativeFetch).toHaveBeenCalledOnce();
    expect(mockTauriGqlNativeFetch.mock.calls[0][0]).toBe('https://api.example.com/graphql');
    expect(mockTauriGqlNativeFetch.mock.calls[0][5]).toEqual({ skipTlsVerify: true });
  });

  it('routes Tauri mTLS introspect through native gql_http_fetch with PEM fields', async () => {
    mockIsTauri.mockReturnValue(true);
    const mtls = {
      caCert: '-----BEGIN CERTIFICATE-----\nca',
      clientCert: '-----BEGIN CERTIFICATE-----\nclient',
      clientKey: '-----BEGIN PRIVATE KEY-----\nkey',
    };

    await gqlFetch(
      'https://localhost:4445/graphql',
      'POST',
      { 'Content-Type': 'application/json' },
      '{"query":"{ __schema { queryType { name } } }"}',
      undefined,
      mtls,
    );

    expect(mockTauriGqlNativeFetch).toHaveBeenCalledOnce();
    expect(mockTauriGqlNativeFetch.mock.calls[0][5]).toEqual(mtls);
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  it('routes Tauri loopback POST without TLS through Node /api/graphql/query proxy', async () => {
    mockIsTauri.mockReturnValue(true);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: vi.fn().mockResolvedValue('{"data":{"health":"ok"}}'),
    } as unknown as Response);

    await gqlFetch('http://localhost:4010/graphql', 'POST', {}, '{"query":"{ health }"}');
    expect(mockHttpFetch).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledOnce();
    const bodyParsed = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(bodyParsed.endpoint).toBe('http://localhost:4010/graphql');
    expect(bodyParsed.query).toBe('{ health }');

    fetchSpy.mockRestore();
  });

  it('does not route Tauri mock endpoint POST through /api/graphql/query proxy', async () => {
    mockIsTauri.mockReturnValue(true);
    await gqlFetch(
      'http://localhost:3001/api/graphql/mock',
      'POST',
      {},
      '{"query":"{ health }"}',
    );
    expect(mockHttpFetch).toHaveBeenCalledOnce();
    expect(mockHttpFetch.mock.calls[0][0]).toBe('http://localhost:3001/api/graphql/mock');
  });

  it('routes Tauri GET with CA cert through native gql_http_fetch', async () => {
    mockIsTauri.mockReturnValue(true);
    await gqlFetch(
      'https://api.example.com/graphql',
      'GET',
      {},
      undefined,
      undefined,
      { caCert: '-----BEGIN CERTIFICATE-----\nabc' },
    );
    expect(mockTauriGqlNativeFetch).toHaveBeenCalledOnce();
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  it('prefixes relative /api paths with Node proxy base on Tauri', async () => {
    mockIsTauri.mockReturnValue(true);
    await gqlFetch('/api/graphql/query?endpoint=https%3A%2F%2Fex.com', 'GET', {});
    expect(mockHttpFetch).toHaveBeenCalledOnce();
    expect(mockHttpFetch.mock.calls[0][0]).toBe(
      'http://localhost:3001/api/graphql/query?endpoint=https%3A%2F%2Fex.com',
    );
  });

  // ── TLS skip web path ────────────────────────────────────────────────────────

  it('calls fetch(/__proxy) when skipTlsVerify is true in web mode', async () => {
    const fakeProxyResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(SUCCESS_RESPONSE),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeProxyResponse as unknown as Response);

    const result = await gqlFetch('https://api.example.com/graphql', 'POST', { 'X-Auth': 'tok' }, '{"q":"{ h }"}', undefined, true);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [proxyUrl, init] = fetchSpy.mock.calls[0];
    expect(proxyUrl).toBe('/__proxy');
    expect((init as RequestInit).method).toBe('POST');
    const bodyParsed = JSON.parse((init as RequestInit).body as string);
    expect(bodyParsed.url).toBe('https://api.example.com/graphql');
    expect(bodyParsed.skipTlsVerify).toBe(true);
    expect(result).toEqual(SUCCESS_RESPONSE);

    fetchSpy.mockRestore();
  });

  it('returns error object when proxy fetch fails (non-ok response)', async () => {
    const fakeProxyResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Proxy error'),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeProxyResponse as unknown as Response);

    const result = await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}', undefined, true);
    expect(result.status).toBe(0);
    expect(result.error).toMatch(/500/);
    fetchSpy.mockRestore();
  });

  it('omits error detail text when proxy non-ok response body is empty', async () => {
    const fakeProxyResponse = {
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue(''),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeProxyResponse as unknown as Response);

    const result = await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}', undefined, true);
    expect(result.error).toBe('Vite HTTP proxy returned 503');
    fetchSpy.mockRestore();
  });

  it('falls back to empty string when resp.text() itself throws', async () => {
    const fakeProxyResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockRejectedValue(new Error('Body read error')),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeProxyResponse as unknown as Response);

    const result = await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}', undefined, true);
    // text() rejection is caught — error omits the body detail
    expect(result.error).toBe('Vite HTTP proxy returned 500');
    fetchSpy.mockRestore();
  });

  it('returns Aborted error when fetch throws with AbortError name', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('Abort'), { name: 'AbortError' }),
    );

    const result = await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}', undefined, true);
    expect(result.error).toBe('Aborted');
    fetchSpy.mockRestore();
  });

  it('returns generic error when fetch throws (non-abort)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

    const result = await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}', undefined, true);
    expect(result.error).toBe('Network failure');
    fetchSpy.mockRestore();
  });

  it('returns generic error for non-Error throws in web path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue('not-an-error');

    const result = await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}', undefined, true);
    expect(result.error).toBe('Network error');
    fetchSpy.mockRestore();
  });

  it('forwards signal to fetch in web path', async () => {
    const ctrl = new AbortController();
    const fakeProxyResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(SUCCESS_RESPONSE),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeProxyResponse as unknown as Response);

    await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}', ctrl.signal, true);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(ctrl.signal);
    fetchSpy.mockRestore();
  });

  it('returns generic proxy error when Tauri loopback POST fetch throws non-Error', async () => {
    mockIsTauri.mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue('proxy-down');

    const result = await gqlFetch(
      'http://localhost:4010/graphql',
      'POST',
      {},
      '{"query":"{ health }"}',
    );
    expect(result.error).toContain('Network error');
    expect(result.status).toBe(0);
  });

  it('Tauri without TLS resolves relative /api/ paths through proxy base', async () => {
    mockIsTauri.mockReturnValue(true);
    await gqlFetch('/api/graphql/query?endpoint=https%3A%2F%2Fex.com', 'GET', {}, undefined, undefined, false);
    expect(mockHttpFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/graphql/query?endpoint=https%3A%2F%2Fex.com',
      'GET',
      {},
      undefined,
      undefined,
    );
  });

  it('Tauri GET APQ with skipTlsVerify uses native transport', async () => {
    mockIsTauri.mockReturnValue(true);
    await gqlFetch(
      'https://api.example.com/graphql?query=%7Bhealth%7D&variables=%7B%7D',
      'GET',
      {},
      undefined,
      undefined,
      true,
    );
    expect(mockTauriGqlNativeFetch).toHaveBeenCalledOnce();
    expect(mockTauriGqlNativeFetch.mock.calls[0][0]).toContain('https://api.example.com/graphql');
  });

  it('returns error for invalid JSON in Tauri loopback proxy POST', async () => {
    mockIsTauri.mockReturnValue(true);
    const result = await gqlFetch('http://localhost:4010/graphql', 'POST', {}, 'not-json');
    expect(result.error).toContain('Invalid JSON body');
    expect(result.status).toBe(0);
  });

  it('returns Aborted from Tauri loopback proxy when fetch throws AbortError', async () => {
    mockIsTauri.mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('Abort'), { name: 'AbortError' }),
    );
    const result = await gqlFetch('http://localhost:4010/graphql', 'POST', {}, '{"query":"{ h }"}');
    expect(result.error).toBe('Aborted');
  });

  it('forwards variables and operationName through Tauri loopback proxy POST', async () => {
    mockIsTauri.mockReturnValue(true);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('{}'),
    } as unknown as Response);

    await gqlFetch(
      'http://localhost:4010/graphql',
      'POST',
      {},
      JSON.stringify({ query: '{ h }', variables: { id: 1 }, operationName: 'H' }),
    );
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body.variables).toEqual({ id: 1 });
    expect(body.operationName).toBe('H');
  });

  it('returns proxy hint error when Tauri loopback POST fetch throws Error', async () => {
    mockIsTauri.mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));

    const result = await gqlFetch(
      'http://localhost:4010/graphql',
      'POST',
      {},
      '{"query":"{ health }"}',
    );
    expect(result.error).toContain('connection refused');
    expect(result.error).toContain('Node proxy running');
  });

  it('Tauri TLS fallback resolves /api/ paths through proxy base when POST has no body', async () => {
    mockIsTauri.mockReturnValue(true);
    await gqlFetch('/api/graphql/query?endpoint=https%3A%2F%2Fex.com', 'POST', {}, undefined, undefined, true);
    expect(mockTauriGqlNativeFetch).toHaveBeenCalledOnce();
  });

  it('collects response headers from Tauri loopback proxy fetch', async () => {
    mockIsTauri.mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        forEach: (cb: (v: string, k: string) => void) => {
          cb('header-val', 'x-custom');
        },
      },
      text: vi.fn().mockResolvedValue('{}'),
    } as unknown as Response);

    const result = await gqlFetch('http://127.0.0.1:4010/graphql', 'POST', {}, '{"query":"{ h }"}');
    expect(result.headers['x-custom']).toBe('header-val');
  });
});

// ─── gqlUpload ────────────────────────────────────────────────────────────────

describe('gqlUpload', () => {
  beforeEach(() => {
    mockIsTauri.mockReturnValue(false);
    mockTauriGqlNativeUpload.mockClear();
    mockTauriGqlNativeUpload.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockIsTauri.mockReturnValue(false);
  });

  it('returns aborted sentinel when signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const form = new FormData();
    const result = await gqlUpload('https://api.example.com/graphql', form, {}, ctrl.signal);
    expect(result.error).toBe('Aborted');
  });

  it('sends formData to /api/graphql/upload with x-graphql-endpoint header', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { forEach: vi.fn() },
      text: vi.fn().mockResolvedValue('{"data":{"upload":"ok"}}'),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

    const form = new FormData();
    form.append('operations', '{"query":"mutation {m}"}');
    await gqlUpload('https://upstream.com/graphql', form, { 'Authorization': 'Bearer token' });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/graphql/upload');
    expect((init.headers as Record<string, string>)['x-graphql-endpoint']).toBe('https://upstream.com/graphql');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer token');
    expect(init.body).toBe(form);
    fetchSpy.mockRestore();
  });

  it('forwards TLS config header when skipTlsVerify is set', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { forEach: vi.fn() },
      text: vi.fn().mockResolvedValue('{}'),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

    await gqlUpload('https://upstream.com/graphql', new FormData(), {}, undefined, undefined, { skipTlsVerify: true });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const tlsHeader = (init.headers as Record<string, string>)['x-gql-tls-config'];
    expect(tlsHeader).toBeTruthy();
    const parsed = JSON.parse(atob(tlsHeader));
    expect(parsed.skipTlsVerify).toBe(true);

    fetchSpy.mockRestore();
  });

  it('forwards full mTLS PEM fields in x-gql-tls-config header', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { forEach: vi.fn() },
      text: vi.fn().mockResolvedValue('{}'),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

    await gqlUpload('https://localhost:4445/graphql', new FormData(), {}, undefined, undefined, {
      caCert: '-----BEGIN CERTIFICATE-----\nca',
      clientCert: '-----BEGIN CERTIFICATE-----\nclient',
      clientKey: '-----BEGIN PRIVATE KEY-----\nkey',
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const tlsHeader = (init.headers as Record<string, string>)['x-gql-tls-config'];
    const parsed = JSON.parse(atob(tlsHeader));
    expect(parsed.caCert).toContain('BEGIN CERTIFICATE');
    expect(parsed.clientCert).toContain('BEGIN CERTIFICATE');
    expect(parsed.clientKey).toContain('BEGIN PRIVATE KEY');

    fetchSpy.mockRestore();
  });

  it('uses native rustls upload on Tauri when custom TLS is active', async () => {
    mockIsTauri.mockReturnValue(true);

    await gqlUpload('https://upstream.com/graphql', new FormData(), { Authorization: 'Bearer t' }, undefined, undefined, { skipTlsVerify: true });

    expect(mockTauriGqlNativeUpload).toHaveBeenCalledWith(
      'https://upstream.com/graphql',
      expect.any(FormData),
      { Authorization: 'Bearer t' },
      undefined,
      { skipTlsVerify: true },
    );
    mockIsTauri.mockReturnValue(false);
  });

  it('uses absolute upload proxy URL on Tauri without custom TLS', async () => {
    mockIsTauri.mockReturnValue(true);
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { forEach: vi.fn() },
      text: vi.fn().mockResolvedValue('{}'),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

    await gqlUpload('https://upstream.com/graphql', new FormData(), {});

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('http://localhost:3001/api/graphql/upload');
    expect(mockTauriGqlNativeUpload).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    mockIsTauri.mockReturnValue(false);
  });

  it('does not set x-gql-tls-config when TLS options are default', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { forEach: vi.fn() },
      text: vi.fn().mockResolvedValue('{}'),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

    await gqlUpload('https://api.example.com/graphql', new FormData(), {});

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-gql-tls-config']).toBeUndefined();
    fetchSpy.mockRestore();
  });

  it('does not set Content-Type header (let browser set it for FormData)', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { forEach: vi.fn() },
      text: vi.fn().mockResolvedValue('{}'),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

    const form = new FormData();
    await gqlUpload('https://api.example.com/graphql', form, { 'content-type': 'application/json' });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['content-type']).toBeUndefined();
    fetchSpy.mockRestore();
  });

  it('handles fetch network error gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await gqlUpload('https://api.example.com/graphql', new FormData(), {});
    expect(result.error).toMatch(/Network error/);
  });

  it('handles AbortError from fetch', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortErr);

    const result = await gqlUpload('https://api.example.com/graphql', new FormData(), {});
    expect(result.error).toBe('Aborted');
  });

  it('handles non-Error rejection from fetch (uses fallback message)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue('network failure string');

    const result = await gqlUpload('https://api.example.com/graphql', new FormData(), {});
    expect(result.error).toBe('Network error during file upload');
  });

  it('reads response headers via forEach callback', async () => {
    const mockForEach = (cb: (val: string, key: string) => void) => {
      cb('application/json', 'content-type');
      cb('42', 'content-length');
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { forEach: mockForEach },
      text: vi.fn().mockResolvedValue('{"data":{}}'),
    } as unknown as Response);
    const result = await gqlUpload('https://api.example.com/graphql', new FormData(), {});
    expect(result.headers['content-type']).toBe('application/json');
    expect(result.headers['content-length']).toBe('42');
  });

  it('handles resp.text() failure gracefully returning empty body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { forEach: vi.fn() },
      text: vi.fn().mockRejectedValue(new Error('body stream error')),
    } as unknown as Response);
    const result = await gqlUpload('https://api.example.com/graphql', new FormData(), {});
    expect(result.body).toBe('');
    expect(result.status).toBe(200);
  });

  it('removes Content-Type regardless of casing (case-insensitive)', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { forEach: vi.fn() },
      text: vi.fn().mockResolvedValue('{}'),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

    const form = new FormData();
    await gqlUpload('https://api.example.com/graphql', form, { 'Content-type': 'text/plain' });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-type']).toBeUndefined();
    fetchSpy.mockRestore();
  });

  it('encodeGqlTlsConfigHeader uses Buffer when btoa is unavailable', async () => {
    const originalBtoa = globalThis.btoa;
    try {
      // @ts-expect-error test override
      globalThis.btoa = undefined;
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { forEach: vi.fn() },
        text: vi.fn().mockResolvedValue('{}'),
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      await gqlUpload('https://api.example.com/graphql', new FormData(), {}, undefined, undefined, {
        skipTlsVerify: true,
      });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const tlsHeader = (init.headers as Record<string, string>)['x-gql-tls-config'];
      expect(JSON.parse(Buffer.from(tlsHeader, 'base64').toString('utf8')).skipTlsVerify).toBe(true);

      fetchSpy.mockRestore();
    } finally {
      globalThis.btoa = originalBtoa;
    }
  });
});

// ─── gqlUpload — XHR path (onProgress callback) ──────────────────────────────

describe('gqlUpload — XHR path', () => {
  let xhrInstance: {
    open: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    setRequestHeader: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
    getAllResponseHeaders: ReturnType<typeof vi.fn>;
    status: number;
    statusText: string;
    responseText: string;
    upload: { onprogress: ((e: { loaded: number; total: number }) => void) | null };
    onload: (() => void) | null;
    onerror: (() => void) | null;
    onabort: (() => void) | null;
  };

  beforeEach(() => {
    xhrInstance = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      abort: vi.fn(),
      getAllResponseHeaders: vi.fn().mockReturnValue('content-type: application/json\r\nx-request-id: abc-123'),
      status: 200,
      statusText: 'OK',
      responseText: '{"data":{"upload":"ok"}}',
      upload: { onprogress: null },
      onload: null,
      onerror: null,
      onabort: null,
    };
    vi.stubGlobal('XMLHttpRequest', function XHRMock() { return xhrInstance; } as unknown as typeof XMLHttpRequest);
  });

  it('uses XHR when onProgress callback is provided', async () => {
    const progress = vi.fn();
    const promise = gqlUpload('https://api.example.com/graphql', new FormData(), {}, undefined, progress);
    xhrInstance.upload.onprogress!({ loaded: 500, total: 1000 });
    xhrInstance.onload!();
    const result = await promise;
    expect(progress).toHaveBeenCalledWith(500, 1000);
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"data":{"upload":"ok"}}');
  });

  it('sets custom headers via setRequestHeader', async () => {
    const promise = gqlUpload(
      'https://api.example.com/graphql',
      new FormData(),
      { 'Authorization': 'Bearer tok', 'X-Custom': 'val' },
      undefined,
      vi.fn(),
    );
    xhrInstance.onload!();
    await promise;
    expect(xhrInstance.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer tok');
    expect(xhrInstance.setRequestHeader).toHaveBeenCalledWith('X-Custom', 'val');
    expect(xhrInstance.setRequestHeader).toHaveBeenCalledWith('x-graphql-endpoint', 'https://api.example.com/graphql');
  });

  it('skips Content-Type header in XHR path (case-insensitive)', async () => {
    const promise = gqlUpload(
      'https://api.example.com/graphql',
      new FormData(),
      { 'Content-type': 'text/plain' },
      undefined,
      vi.fn(),
    );
    xhrInstance.onload!();
    await promise;
    for (const call of xhrInstance.setRequestHeader.mock.calls) {
      expect((call[0] as string).toLowerCase()).not.toBe('content-type');
    }
  });

  it('parses response headers from getAllResponseHeaders', async () => {
    const promise = gqlUpload('https://api.example.com/graphql', new FormData(), {}, undefined, vi.fn());
    xhrInstance.onload!();
    const result = await promise;
    expect(result.headers['content-type']).toBe('application/json');
    expect(result.headers['x-request-id']).toBe('abc-123');
  });

  it('resolves with network error on onerror', async () => {
    const promise = gqlUpload('https://api.example.com/graphql', new FormData(), {}, undefined, vi.fn());
    xhrInstance.onerror!();
    const result = await promise;
    expect(result.error).toBe('Network error during file upload');
    expect(result.status).toBe(0);
  });

  it('resolves with Aborted on onabort', async () => {
    const promise = gqlUpload('https://api.example.com/graphql', new FormData(), {}, undefined, vi.fn());
    xhrInstance.onabort!();
    const result = await promise;
    expect(result.error).toBe('Aborted');
  });

  it('wires AbortSignal to xhr.abort', async () => {
    const ctrl = new AbortController();
    const promise = gqlUpload('https://api.example.com/graphql', new FormData(), {}, ctrl.signal, vi.fn());
    ctrl.abort();
    xhrInstance.onabort!();
    await promise;
    expect(xhrInstance.abort).toHaveBeenCalled();
  });

  it('cleans up abort listener on successful load', async () => {
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, 'removeEventListener');
    const promise = gqlUpload('https://api.example.com/graphql', new FormData(), {}, ctrl.signal, vi.fn());
    xhrInstance.onload!();
    await promise;
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('skips restricted headers in XHR setRequestHeader', async () => {
    xhrInstance.setRequestHeader = vi.fn().mockImplementation((name: string) => {
      if (name.toLowerCase() === 'restricted-header') {
        throw new Error('Refused to set unsafe header');
      }
    });
    const promise = gqlUpload(
      'https://api.example.com/graphql',
      new FormData(),
      { 'Restricted-Header': 'blocked', Authorization: 'Bearer ok' },
      undefined,
      vi.fn(),
    );
    xhrInstance.onload!();
    await promise;
    expect(xhrInstance.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer ok');
  });

  it('ignores malformed header lines without colon in XHR onload', async () => {
    xhrInstance.getAllResponseHeaders = vi.fn().mockReturnValue(
      'content-type: application/json\r\nmalformed-line\r\nx-id: 42',
    );
    const promise = gqlUpload('https://api.example.com/graphql', new FormData(), {}, undefined, vi.fn());
    xhrInstance.onload!();
    const result = await promise;
    expect(result.headers['content-type']).toBe('application/json');
    expect(result.headers['x-id']).toBe('42');
    expect(result.headers['malformed-line']).toBeUndefined();
  });

  it('invokes abortHandler when AbortSignal fires during XHR upload', async () => {
    const ctrl = new AbortController();
    const promise = gqlUpload('https://api.example.com/graphql', new FormData(), {}, ctrl.signal, vi.fn());
    ctrl.abort();
    expect(xhrInstance.abort).toHaveBeenCalled();
    xhrInstance.onabort!();
    const result = await promise;
    expect(result.error).toBe('Aborted');
  });
});

// ─── gqlFetch error-path text() failure ───────────────────────────────────────

describe('gqlFetch — resp.text() failure in error path', () => {
  it('returns error without body text when resp.text() rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockRejectedValue(new Error('body read failed')),
    } as unknown as Response);
    const result = await gqlFetch('https://api.example.com/graphql', 'POST', {}, '{}', undefined, true);
    expect(result.error).toContain('500');
    expect(result.status).toBe(0);
  });
});
