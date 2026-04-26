import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./platform', () => ({
  isTauri: vi.fn(() => false),
  isNode: vi.fn(() => false),
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { httpFetch, setHttpTransport, type HttpResponse } from './httpClient';

describe('setHttpTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHttpTransport(null);
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: 'proxy' }),
    });
  });

  afterEach(() => {
    setHttpTransport(null);
  });

  it('uses default transport when no override is set', async () => {
    const result = await httpFetch('http://example.com', 'GET', {});
    expect(result.status).toBe(200);
    expect(result.body).toBe('proxy');
    expect(globalThis.fetch).toHaveBeenCalledWith('/__proxy', expect.any(Object));
  });

  it('uses overridden transport when set', async () => {
    const custom: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse> = vi.fn().mockResolvedValue({
      status: 201, statusText: 'Created', headers: {}, body: 'custom',
    });

    setHttpTransport(custom);
    const result = await httpFetch('http://api.test', 'POST', { 'X-Key': 'val' }, 'body');

    expect(custom).toHaveBeenCalledWith('http://api.test', 'POST', { 'X-Key': 'val' }, 'body');
    expect(result.status).toBe(201);
    expect(result.body).toBe('custom');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('restores default transport when set to null', async () => {
    const custom = vi.fn().mockResolvedValue({ status: 200, statusText: '', headers: {}, body: '' });
    setHttpTransport(custom);

    await httpFetch('http://a.com', 'GET', {});
    expect(custom).toHaveBeenCalledTimes(1);

    setHttpTransport(null);
    await httpFetch('http://b.com', 'GET', {});
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(custom).toHaveBeenCalledTimes(1);
  });

  it('override receives all arguments including optional body', async () => {
    const spy = vi.fn().mockResolvedValue({ status: 200, statusText: '', headers: {}, body: '' });
    setHttpTransport(spy);

    await httpFetch('http://test.com', 'DELETE', { Auth: 'tok' }, undefined);
    expect(spy).toHaveBeenCalledWith('http://test.com', 'DELETE', { Auth: 'tok' }, undefined);
  });

  it('propagates errors from overridden transport', async () => {
    setHttpTransport(() => Promise.reject(new Error('transport error')));
    await expect(httpFetch('http://x.com', 'GET', {})).rejects.toThrow('transport error');
  });
});
