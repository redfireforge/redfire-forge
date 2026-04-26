import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./platform', () => ({
  isTauri: () => false,
  isNode: () => true,
}));

vi.mock('undici', async () => {
  throw new Error('undici unavailable');
});

describe('httpFetch when undici dynamic import fails', () => {
  beforeEach(() => {
    for (const k of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy'] as const) {
      delete process.env[k];
    }
    globalThis.fetch = vi.fn();
  });

  it('still performs fetch without a dispatcher', async () => {
    process.env.HTTP_PROXY = 'http://proxy:1';
    vi.resetModules();
    const { httpFetch } = await import('./httpClient');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { forEach: (_fn: (v: string, k: string) => void) => { /* empty */ } },
      text: () => Promise.resolve('ok'),
    });

    const result = await httpFetch('http://example.com', 'GET', {});
    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://example.com',
      expect.not.objectContaining({ dispatcher: expect.anything() }),
    );
  });
});
