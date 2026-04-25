import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockedIsTauri = vi.fn(() => false);
const mockedIsNode = vi.fn(() => true);

const agentCtor = vi.hoisted(() =>
  vi.fn(function (this: unknown) {
    return { __kind: 'Agent', close: vi.fn().mockResolvedValue(undefined) };
  }),
);
const envProxyCtor = vi.hoisted(() =>
  vi.fn(function (this: unknown) {
    return { __kind: 'EnvHttpProxyAgent', close: vi.fn().mockResolvedValue(undefined) };
  }),
);

vi.mock('./platform', () => ({
  isTauri: () => mockedIsTauri(),
  isNode: () => mockedIsNode(),
}));

vi.mock('undici', () => ({
  Agent: agentCtor,
  EnvHttpProxyAgent: envProxyCtor,
  ProxyAgent: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

describe('httpClient connection pooling', () => {
  let httpFetch: typeof import('./httpClient').httpFetch;
  let closeNodePool: typeof import('./httpClient').closeNodePool;

  beforeEach(async () => {
    for (const k of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy'] as const) {
      delete process.env[k];
    }
    vi.resetModules();
    vi.clearAllMocks();
    mockedIsNode.mockReturnValue(true);
    mockedIsTauri.mockReturnValue(false);
    globalThis.fetch = vi.fn();
    const mod = await import('./httpClient');
    httpFetch = mod.httpFetch;
    closeNodePool = mod.closeNodePool;
  });

  function mockFetchResponse(body = 'ok', status = 200) {
    const mockHeaders = new Map<string, string>();
    vi.mocked(globalThis.fetch).mockResolvedValue({
      status,
      statusText: 'OK',
      headers: { forEach: (fn: (v: string, k: string) => void) => mockHeaders.forEach((v, k) => fn(v, k)) },
      text: () => Promise.resolve(body),
    });
  }

  describe('pooled Agent (no proxy)', () => {
    it('creates an undici.Agent with keep-alive settings', async () => {
      mockFetchResponse();
      await httpFetch('http://example.com', 'GET', {});
      expect(agentCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          keepAliveTimeout: 30_000,
          keepAliveMaxTimeout: 60_000,
          connections: 128,
          pipelining: 1,
        }),
      );
    });

    it('reuses the same Agent across multiple requests', async () => {
      mockFetchResponse();
      await httpFetch('http://example.com/a', 'GET', {});
      await httpFetch('http://example.com/b', 'GET', {});
      await httpFetch('http://example.com/c', 'POST', {}, 'data');
      expect(agentCtor).toHaveBeenCalledTimes(1);
    });

    it('passes the Agent as dispatcher to fetch()', async () => {
      mockFetchResponse();
      await httpFetch('http://example.com', 'GET', {});
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://example.com',
        expect.objectContaining({
          dispatcher: expect.objectContaining({ __kind: 'Agent' }),
        }),
      );
    });
  });

  describe('Connection: keep-alive header', () => {
    it('injects Connection: keep-alive into outbound requests', async () => {
      mockFetchResponse();
      await httpFetch('http://example.com', 'GET', { 'Accept': 'application/json' });
      const callOpts = vi.mocked(globalThis.fetch).mock.calls[0][1];
      expect(callOpts.headers).toEqual(
        expect.objectContaining({
          'Connection': 'keep-alive',
          'Accept': 'application/json',
        }),
      );
    });

    it('does not overwrite existing Connection header from user', async () => {
      mockFetchResponse();
      await httpFetch('http://example.com', 'GET', { 'Connection': 'close' });
      const callOpts = vi.mocked(globalThis.fetch).mock.calls[0][1];
      expect(callOpts.headers['Connection']).toBe('keep-alive');
    });
  });

  describe('proxy mode', () => {
    it('uses EnvHttpProxyAgent when proxy env is set', async () => {
      process.env.HTTP_PROXY = 'http://proxy:8080';
      vi.resetModules();
      vi.clearAllMocks();
      globalThis.fetch = vi.fn();
      mockFetchResponse();
      const mod = await import('./httpClient');

      await mod.httpFetch('http://example.com', 'GET', {});
      expect(envProxyCtor).toHaveBeenCalled();
      expect(agentCtor).not.toHaveBeenCalled();
    });
  });

  describe('closeNodePool', () => {
    it('closes the pooled dispatcher', async () => {
      mockFetchResponse();
      await httpFetch('http://example.com', 'GET', {});
      expect(agentCtor).toHaveBeenCalledTimes(1);

      await closeNodePool();

      const agentInstance = agentCtor.mock.results[0].value;
      expect(agentInstance.close).toHaveBeenCalled();
    });

    it('allows creating a new pool after close', async () => {
      mockFetchResponse();
      await httpFetch('http://example.com', 'GET', {});
      expect(agentCtor).toHaveBeenCalledTimes(1);

      await closeNodePool();

      await httpFetch('http://example.com/again', 'GET', {});
      expect(agentCtor).toHaveBeenCalledTimes(2);
    });

    it('is safe to call when no pool exists', async () => {
      await expect(closeNodePool()).resolves.toBeUndefined();
    });
  });
});
