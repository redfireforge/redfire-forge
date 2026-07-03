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
