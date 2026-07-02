/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_ECHO_PROTO } from '../../src/shared/grpc/contractFixtures.js';
import { fetchProtoFromUrl, MAX_PROTO_FETCH_BYTES } from './protoFetchGateway.js';
import {
  configureGrpcOutboundDnsPolicy,
  resetGrpcOutboundDnsPolicyForTests,
} from './grpcOutboundDnsPolicy.js';

describe('protoFetchGateway coverage gaps', () => {
  const dnsOptions = {
    resolveHostname: async () => ['93.184.216.34'],
  };

  it('rejects 304 without cached etag', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => new Response(null, { status: 304 })),
    };
    await expect(fetchProtoFromUrl('https://example.com/echo.proto', { fetchPort, ...dnsOptions }))
      .rejects.toThrow(/304 without a cached etag/i);
  });

  it('rejects empty proto bodies and oversized buffers', async () => {
    const fetchPortEmpty = {
      fetch: vi.fn(async () => new Response('   ', { status: 200 })),
    };
    await expect(fetchProtoFromUrl('https://example.com/empty.proto', { fetchPort: fetchPortEmpty, ...dnsOptions }))
      .rejects.toThrow(/empty content/i);

    const huge = Buffer.alloc(MAX_PROTO_FETCH_BYTES + 1, 97);
    const fetchPortHuge = {
      fetch: vi.fn(async () => new Response(huge, { status: 200 })),
    };
    await expect(fetchProtoFromUrl('https://example.com/huge.proto', { fetchPort: fetchPortHuge, ...dnsOptions }))
      .rejects.toThrow(/byte limit/i);
  });

  it('wraps policy validation and timeout failures', async () => {
    await expect(fetchProtoFromUrl('ftp://example.com/echo.proto'))
      .rejects.toThrow(/Outbound fetch URL must use http or https/i);

    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    await expect(fetchProtoFromUrl('https://example.com/echo.proto', {
      fetchPort: { fetch: vi.fn(async () => { throw abortError; }) },
      timeoutMs: 10,
      ...dnsOptions,
    })).rejects.toThrow(/timed out after 10ms/i);
  });

  it('rejects DNS-resolved private addresses before fetch', async () => {
    const fetchPort = { fetch: vi.fn(async () => new Response(FIXTURE_ECHO_PROTO, { status: 200 })) };
    await expect(fetchProtoFromUrl('https://schemas.example.com/echo.proto', {
      fetchPort,
      resolveHostname: async () => ['10.20.30.40'],
    })).rejects.toThrow(/private network address/i);
    expect(fetchPort.fetch).not.toHaveBeenCalled();
  });

  it('fetches localhost over HTTP when explicitly allowed', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => new Response(FIXTURE_ECHO_PROTO, { status: 200 })),
    };
    const result = await fetchProtoFromUrl('http://localhost:8080/echo.proto', {
      fetchPort,
      allowHttpLocalhost: true,
      ...dnsOptions,
    });
    expect(result.content).toContain('EchoService');
  });

  it('returns notModified for HTTP 304 with cached etag', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => new Response(null, { status: 304 })),
    };
    const result = await fetchProtoFromUrl('https://example.com/echo.proto', {
      fetchPort,
      ifNoneMatch: 'cached-etag',
      ...dnsOptions,
    });
    expect(result.notModified).toBe(true);
    expect(result.etag).toBe('cached-etag');
    expect(result.content).toBe('');
  });

  it('rejects redirect responses and oversized content-length headers', async () => {
    const redirectPort = {
      fetch: vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://other.example/x.proto' } })),
    };
    await expect(fetchProtoFromUrl('https://example.com/echo.proto', { fetchPort: redirectPort, ...dnsOptions }))
      .rejects.toThrow(/redirects are not allowed/i);

    const oversizedPort = {
      fetch: vi.fn(async () => new Response('x', {
        status: 200,
        headers: { 'content-length': String(MAX_PROTO_FETCH_BYTES + 1) },
      })),
    };
    await expect(fetchProtoFromUrl('https://example.com/huge.proto', { fetchPort: oversizedPort, ...dnsOptions }))
      .rejects.toThrow(/byte limit/i);
  });

  it('wraps non-AbortError fetch failures with gateway message', async () => {
    await expect(fetchProtoFromUrl('https://example.com/echo.proto', {
      fetchPort: { fetch: vi.fn(async () => { throw 'socket hang up'; }) },
      ...dnsOptions,
    })).rejects.toThrow(/Proto fetch failed: socket hang up/);
  });

  it('quotes bare if-none-match values before sending', async () => {
    const fetchPort = {
      fetch: vi.fn(async (_url, init) => {
        expect((init?.headers as Record<string, string>)['if-none-match']).toBe('"bare-etag"');
        return new Response(FIXTURE_ECHO_PROTO, { status: 200, headers: { etag: '"server-etag"' } });
      }),
    };
    const result = await fetchProtoFromUrl('https://example.com/echo.proto', {
      fetchPort,
      ifNoneMatch: 'bare-etag',
      ...dnsOptions,
    });
    expect(result.etag).toBe('server-etag');
  });

  it('uses the default global fetch port when fetchPort is omitted', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(FIXTURE_ECHO_PROTO, { status: 200 }),
    );
    const result = await fetchProtoFromUrl('https://example.com/echo.proto', dnsOptions);
    expect(result.content).toContain('EchoService');
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('fires the default timeout timer when fetch hangs', async () => {
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
      const promise = fetchProtoFromUrl('https://example.com/echo.proto', {
        fetchPort,
        timeoutMs: 500,
        ...dnsOptions,
      });
      const assertion = expect(promise).rejects.toThrow(/timed out after 500ms/i);
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('honors central DNS strictness toggle when resolver is omitted', async () => {
    configureGrpcOutboundDnsPolicy({ strictDnsResolution: false });
    const fetchPort = {
      fetch: vi.fn(async () => new Response(FIXTURE_ECHO_PROTO, { status: 200 })),
    };
    try {
      const result = await fetchProtoFromUrl('https://example.invalid/echo.proto', {
        fetchPort,
      });
      expect(result.content).toContain('EchoService');
      expect(fetchPort.fetch).toHaveBeenCalledTimes(1);
    } finally {
      resetGrpcOutboundDnsPolicyForTests();
    }
  });
});
