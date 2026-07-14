import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockedIsTauri = vi.fn(() => false);
const mockedIsNode = vi.fn(() => true);

const proxyAgentCtor = vi.hoisted(() =>
  vi.fn(function (this: unknown, url: string) {
    return { __kind: 'ProxyAgent', url };
  }),
);

vi.mock('./platform', () => ({
  isTauri: () => mockedIsTauri(),
  isNode: () => mockedIsNode(),
}));

/** Force `new ProxyAgent(proxy)` branch in getNodeDispatcher (no EnvHttpProxyAgent). */
vi.mock('undici', async (importOriginal) => {
  const mod = await importOriginal<typeof import('undici')>();
  return { ...mod, EnvHttpProxyAgent: undefined, ProxyAgent: proxyAgentCtor };
});

describe('httpFetch node dispatcher (ProxyAgent fallback)', () => {
  beforeEach(() => {
    for (const k of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy'] as const) {
      delete process.env[k];
    }
    resetAllMocks();
    globalThis.fetch = vi.fn();
  });

  it('uses ProxyAgent when EnvHttpProxyAgent is absent but proxy env is set', async () => {
    process.env.HTTP_PROXY = 'http://proxy.local:8888';
    vi.resetModules();
    const { httpFetch } = await import('./httpClient');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { forEach: (_fn: (v: string, k: string) => void) => { /* empty */ } },
      text: () => Promise.resolve('via-proxy'),
    });

    const result = await httpFetch('https://api.example/data', 'GET', {});
    expect(proxyAgentCtor).toHaveBeenCalledWith('http://proxy.local:8888');
    expect(result.body).toBe('via-proxy');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example/data',
      expect.objectContaining({
        dispatcher: expect.objectContaining({ __kind: 'ProxyAgent', url: 'http://proxy.local:8888' }),
      }),
    );
  });
});
