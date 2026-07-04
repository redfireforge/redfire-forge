/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import {
  BsrFetchGatewayError,
  buildBsrDescriptorUrl,
  fetchBsrDescriptorSet,
  parseBsrModuleReference,
} from './bsrFetchGateway.js';

describe('bsrFetchGateway coverage gaps', () => {
  it('rejects invalid module references', () => {
    expect(() => parseBsrModuleReference('acme-only')).toThrow(BsrFetchGatewayError);
  });

  it('parses owner/repo without buf.build prefix', () => {
    expect(parseBsrModuleReference('acme/echo').fullName).toBe('buf.build/acme/echo');
  });

  it('fetches JSON protoset payloads and bearer tokens', async () => {
    const fetchPort = {
      fetch: vi.fn(async (_url, init) => {
        expect(init?.headers).toMatchObject({ authorization: 'Bearer secret' });
        return new Response(JSON.stringify({ protosetBase64: 'abc123' }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'x-bsr-digest': '"digest-json"' },
        });
      }),
    };

    const result = await fetchBsrDescriptorSet({
      module: 'acme/echo',
      token: 'secret',
      digest: 'pinned-digest',
    }, { fetchPort });

    expect(result.protosetBase64).toBe('abc123');
    expect(result.digest).toBe('pinned-digest');
  });

  it('surfaces HTTP, empty payload, and missing JSON field errors', async () => {
    await expect(fetchBsrDescriptorSet({ module: 'acme/echo' }, {
      fetchPort: { fetch: vi.fn(async () => new Response('', { status: 500 })) },
    })).rejects.toThrow(/HTTP 500/);

    await expect(fetchBsrDescriptorSet({ module: 'acme/echo' }, {
      fetchPort: { fetch: vi.fn(async () => new Response('', { status: 200 })) },
    })).rejects.toThrow(/empty descriptor/i);

    await expect(fetchBsrDescriptorSet({ module: 'acme/echo' }, {
      fetchPort: { fetch: vi.fn(async () => new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) },
    })).rejects.toThrow(/missing protosetBase64/i);
  });

  it('accepts octet-stream payloads and strips quoted digest headers', async () => {
    const payload = Buffer.from('binary-protoset');
    const fetchPort = {
      fetch: vi.fn(async () => new Response(payload, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream', etag: '"etag-123"' },
      })),
    };

    const result = await fetchBsrDescriptorSet({ module: 'acme/echo' }, { fetchPort });
    expect(result.protosetBase64).toBe(payload.toString('base64'));
    expect(result.digest).toBe('etag-123');
  });

  it('buildBsrDescriptorUrl encodes version ref query param', () => {
    const url = buildBsrDescriptorUrl(
      { owner: 'acme', repo: 'echo', fullName: 'buf.build/acme/echo' },
      'v1.2.0',
    );
    expect(url).toContain('/acme/echo/descriptor/v1.2.0');
  });

  it('rejects HTML responses to avoid decoding rewritten portal pages as protosets', async () => {
    await expect(fetchBsrDescriptorSet({ module: 'acme/echo' }, {
      fetchPort: {
        fetch: vi.fn(async () => new Response('<!doctype html><html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=UTF-8' },
        })),
      },
    })).rejects.toThrow(/returned HTML instead of descriptor bytes/i);
  });

  it('accepts descriptorBase64 alias in JSON responses', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => new Response(JSON.stringify({ descriptorBase64: 'alias123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })),
    };
    const result = await fetchBsrDescriptorSet({ module: 'acme/echo' }, { fetchPort });
    expect(result.protosetBase64).toBe('alias123');
  });

  it('wraps abort and unknown fetch failures', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    await expect(fetchBsrDescriptorSet({ module: 'acme/echo', version: 'main' }, {
      fetchPort: { fetch: vi.fn(async () => { throw abortError; }) },
      timeoutMs: 5,
    })).rejects.toThrow(/timed out after 5ms/i);

    await expect(fetchBsrDescriptorSet({ module: 'acme/echo' }, {
      fetchPort: { fetch: vi.fn(async () => { throw 'network down'; }) },
    })).rejects.toThrow(/BSR fetch failed for buf\.build\/acme\/echo@main: network down/);
  });

  it('includes nested network cause details when fetch throws generic TypeError', async () => {
    const lowLevel = Object.assign(new Error('getaddrinfo ENOTFOUND buf.build'), { code: 'ENOTFOUND' });
    const wrapped = new TypeError('fetch failed', { cause: lowLevel });
    await expect(fetchBsrDescriptorSet({ module: 'acme/echo' }, {
      fetchPort: { fetch: vi.fn(async () => { throw wrapped; }) },
    })).rejects.toThrow(/ENOTFOUND/);
  });

  it('adds timeout network hint when error chain contains ETIMEDOUT', async () => {
    await expect(fetchBsrDescriptorSet({ module: 'acme/echo' }, {
      fetchPort: { fetch: vi.fn(async () => { throw new Error('socket ETIMEDOUT'); }) },
    })).rejects.toThrow(/Connection to buf\.build timed out/i);
  });

  it('adds TLS network hint when error chain contains certificate failures', async () => {
    await expect(fetchBsrDescriptorSet({ module: 'acme/echo' }, {
      fetchPort: { fetch: vi.fn(async () => { throw new Error('SELF_SIGNED_CERT_IN_CHAIN'); }) },
    })).rejects.toThrow(/TLS certificate validation failed/i);
  });

  it('adds proxy network hint when error chain contains PROXY', async () => {
    await expect(fetchBsrDescriptorSet({ module: 'acme/echo' }, {
      fetchPort: { fetch: vi.fn(async () => { throw new Error('PROXY CONNECT FAILED'); }) },
    })).rejects.toThrow(/Proxy configuration blocked the request to buf\.build/i);
  });

  it('adds unreachable network hint for ECONNREFUSED-style errors', async () => {
    await expect(fetchBsrDescriptorSet({ module: 'acme/echo' }, {
      fetchPort: { fetch: vi.fn(async () => { throw new Error('ECONNREFUSED 127.0.0.1:443'); }) },
    })).rejects.toThrow(/Network path to buf\.build was refused\/unreachable/i);
  });

  it('default fetch path omits dispatcher when no proxy env is configured', async () => {
    const prevHttps = process.env.HTTPS_PROXY;
    const prevHttp = process.env.HTTP_PROXY;
    const prevHttpsLower = process.env.https_proxy;
    const prevHttpLower = process.env.http_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
    delete process.env.https_proxy;
    delete process.env.http_proxy;
    vi.resetModules();
    try {
      const payload = Buffer.from('plain');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(payload, { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
      );
      const mod = await import('./bsrFetchGateway.js');
      await mod.fetchBsrDescriptorSet({ module: 'acme/echo' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      fetchSpy.mockRestore();
    } finally {
      process.env.HTTPS_PROXY = prevHttps;
      process.env.HTTP_PROXY = prevHttp;
      process.env.https_proxy = prevHttpsLower;
      process.env.http_proxy = prevHttpLower;
      vi.doUnmock('node:module');
      vi.resetModules();
    }
  });

  it('default fetch path uses undici ProxyAgent when proxy env is configured', async () => {
    const prevHttps = process.env.HTTPS_PROXY;
    const prevHttpsLower = process.env.https_proxy;
    process.env.HTTPS_PROXY = 'http://proxy.local:8080';
    delete process.env.https_proxy;
    vi.resetModules();
    vi.doMock('node:module', () => ({
      createRequire: () => () => ({
        ProxyAgent: class {
          constructor(public proxyUrl: string) {}
        },
      }),
    }));

    try {
      const payload = Buffer.from('with-proxy');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(payload, { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
      );
      const mod = await import('./bsrFetchGateway.js');
      await mod.fetchBsrDescriptorSet({ module: 'acme/echo' });
      const init = fetchSpy.mock.calls[0]?.[1] as RequestInit & { dispatcher?: { proxyUrl?: string } };
      expect(init?.dispatcher).toBeTruthy();
      fetchSpy.mockRestore();
    } finally {
      process.env.HTTPS_PROXY = prevHttps;
      process.env.https_proxy = prevHttpsLower;
      vi.doUnmock('node:module');
      vi.resetModules();
    }
  });

  it('falls back to regular fetch when proxy env is set but undici cannot be required', async () => {
    const prevHttps = process.env.HTTPS_PROXY;
    const prevHttpsLower = process.env.https_proxy;
    process.env.HTTPS_PROXY = 'http://proxy.local:8080';
    delete process.env.https_proxy;
    vi.resetModules();
    vi.doMock('node:module', () => ({
      createRequire: () => () => {
        throw new Error('undici missing');
      },
    }));

    try {
      const payload = Buffer.from('fallback');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(payload, { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
      );
      const mod = await import('./bsrFetchGateway.js');
      await mod.fetchBsrDescriptorSet({ module: 'acme/echo' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      fetchSpy.mockRestore();
    } finally {
      process.env.HTTPS_PROXY = prevHttps;
      process.env.https_proxy = prevHttpsLower;
      vi.doUnmock('node:module');
      vi.resetModules();
    }
  });

  it('uses the default global fetch port when fetchPort is omitted', async () => {
    const payload = Buffer.from('binary-protoset');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(payload, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    );
    const result = await fetchBsrDescriptorSet({ module: 'acme/echo' });
    expect(result.protosetBase64).toBe(payload.toString('base64'));
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('fires the default timeout timer when BSR fetch hangs', async () => {
    vi.useFakeTimers();
    try {
      const fetchPort = {
        fetch: vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })),
      };
      const promise = fetchBsrDescriptorSet({ module: 'acme/echo' }, {
        fetchPort,
        timeoutMs: 500,
      });
      const assertion = expect(promise).rejects.toThrow(/timed out after 500ms/i);
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
