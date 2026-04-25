import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockedIsTauri = vi.fn(() => false);
const mockedIsNode = vi.fn(() => false);

const envHttpProxyAgentCtor = vi.hoisted(() =>
  vi.fn(function (this: unknown) {
    return { __kind: 'EnvHttpProxyAgent' };
  }),
);

vi.mock('./platform', () => ({
  isTauri: () => mockedIsTauri(),
  isNode: () => mockedIsNode(),
}));

/** Track EnvHttpProxyAgent usage; keep real ProxyAgent for fallback tests in `httpClient.proxyAgent.test.ts`. */
vi.mock('undici', async (importOriginal) => {
  const mod = await importOriginal<typeof import('undici')>();
  return { ...mod, EnvHttpProxyAgent: envHttpProxyAgentCtor };
});

const mockTFetch = vi.fn();
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: unknown[]) => mockTFetch(...args),
}));

import { httpFetch } from './httpClient';

describe('httpFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsTauri.mockReturnValue(false);
    mockedIsNode.mockReturnValue(false);
    globalThis.fetch = vi.fn();
  });

  describe('browser proxy mode', () => {
    it('sends request through proxy', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: 'ok' }),
      } as unknown as Response);

      const result = await httpFetch('http://example.com', 'GET', {});
      expect(globalThis.fetch).toHaveBeenCalledWith('/__proxy', expect.objectContaining({ method: 'POST' }));
      expect(result.status).toBe(200);
    });

    it('includes body in proxy payload', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 201, statusText: 'Created', headers: {}, body: '{}' }),
      } as unknown as Response);

      await httpFetch('http://example.com/api', 'POST', { 'Content-Type': 'application/json' }, '{"a":1}');
      const call = vi.mocked(globalThis.fetch).mock.calls[0];
      const parsed = JSON.parse(call[1].body);
      expect(parsed.url).toBe('http://example.com/api');
      expect(parsed.method).toBe('POST');
      expect(parsed.body).toBe('{"a":1}');
    });
  });

  describe('tauri mode', () => {
    beforeEach(() => {
      mockedIsTauri.mockReturnValue(true);
    });

    it('uses tauri fetch plugin', async () => {
      const mockHeaders = new Map([['content-type', 'application/json']]);
      mockTFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: { forEach: (fn: (v: string, k: string) => void) => mockHeaders.forEach((v, k) => fn(v, k)) },
        text: () => Promise.resolve('{"result":"ok"}'),
      });

      const result = await httpFetch('http://example.com', 'GET', {});
      expect(result.status).toBe(200);
      expect(result.body).toBe('{"result":"ok"}');
      expect(result.headers['content-type']).toBe('application/json');
    });

    it('does not attach body to GET requests', async () => {
      const mockHeaders = new Map();
      mockTFetch.mockResolvedValueOnce({
        status: 200, statusText: 'OK',
        headers: { forEach: (fn: (v: string, k: string) => void) => mockHeaders.forEach((v, k) => fn(v, k)) },
        text: () => Promise.resolve(''),
      });

      await httpFetch('http://example.com', 'GET', {}, 'should-be-ignored');
      expect(mockTFetch).toHaveBeenCalledWith('http://example.com', expect.not.objectContaining({ body: 'should-be-ignored' }));
    });

    it('includes body for POST requests', async () => {
      const mockHeaders = new Map();
      mockTFetch.mockResolvedValueOnce({
        status: 201, statusText: 'Created',
        headers: { forEach: (fn: (v: string, k: string) => void) => mockHeaders.forEach((v, k) => fn(v, k)) },
        text: () => Promise.resolve('ok'),
      });

      await httpFetch('http://example.com', 'POST', {}, '{"data":1}');
      expect(mockTFetch).toHaveBeenCalledWith('http://example.com', expect.objectContaining({ body: '{"data":1}' }));
    });

    it('returns error response on network failure', async () => {
      mockTFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await httpFetch('http://example.com', 'GET', {});
      expect(result.status).toBe(0);
      expect(result.error).toBe('Connection refused');
    });

    it('includes cause chain in error message', async () => {
      const cause = new Error('getaddrinfo ENOTFOUND api.example.com');
      (cause as NodeJS.ErrnoException).code = 'ENOTFOUND';
      mockTFetch.mockRejectedValueOnce(new Error('fetch failed', { cause }));

      const result = await httpFetch('http://api.example.com', 'GET', {});
      expect(result.status).toBe(0);
      expect(result.error).toBe('fetch failed — getaddrinfo ENOTFOUND api.example.com [ENOTFOUND]');
    });
  });

  describe('node mode', () => {
    let nodeHttpFetch: typeof import('./httpClient').httpFetch;

    beforeEach(async () => {
      for (const k of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy'] as const) {
        delete process.env[k];
      }
      vi.resetModules();
      mockedIsNode.mockReturnValue(true);
      mockedIsTauri.mockReturnValue(false);
      vi.clearAllMocks();
      globalThis.fetch = vi.fn();
      const mod = await import('./httpClient');
      nodeHttpFetch = mod.httpFetch;
    });

    it('uses global fetch in node mode', async () => {
      const mockHeaders = new Map([['x-custom', 'value']]);
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        status: 200, statusText: 'OK',
        headers: { forEach: (fn: (v: string, k: string) => void) => mockHeaders.forEach((v, k) => fn(v, k)) },
        text: () => Promise.resolve('node-response'),
      } as unknown as Response);

      const result = await nodeHttpFetch('http://example.com/api', 'GET', { 'Accept': 'application/json' });
      expect(result.status).toBe(200);
      expect(result.body).toBe('node-response');
    });

    it('handles node fetch errors', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('DNS lookup failed'));

      const result = await nodeHttpFetch('http://example.com', 'GET', {});
      expect(result.status).toBe(0);
      expect(result.error).toBe('DNS lookup failed');
    });

    it('includes cause chain in node fetch error', async () => {
      const cause = new Error('connect ETIMEDOUT 10.0.0.1:443');
      (cause as NodeJS.ErrnoException).code = 'ETIMEDOUT';
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('fetch failed', { cause }));

      const result = await nodeHttpFetch('http://example.com', 'GET', {});
      expect(result.status).toBe(0);
      expect(result.error).toBe('fetch failed — connect ETIMEDOUT 10.0.0.1:443 [ETIMEDOUT]');
    });

    it('uses EnvHttpProxyAgent when undici provides it and proxy env is set', async () => {
      process.env.HTTP_PROXY = 'http://proxy.local:8888';
      vi.resetModules();
      const mod = await import('./httpClient');
      const fetchSpy = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: { forEach: (_fn: (v: string, k: string) => void) => { /* empty */ } },
        text: () => Promise.resolve('via-env-agent'),
      });
      globalThis.fetch = fetchSpy;

      const result = await mod.httpFetch('https://api.example/data', 'GET', {});
      expect(envHttpProxyAgentCtor).toHaveBeenCalled();
      expect(result.body).toBe('via-env-agent');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example/data',
        expect.objectContaining({
          dispatcher: expect.objectContaining({ __kind: 'EnvHttpProxyAgent' }),
        }),
      );
    });
  });
});
