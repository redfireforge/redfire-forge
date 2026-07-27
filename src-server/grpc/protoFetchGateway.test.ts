/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_ECHO_PROTO } from '../../src/shared/grpc/contractFixtures.js';
import { fetchProtoFromUrl } from './protoFetchGateway.js';

describe('protoFetchGateway', () => {
  it('fetches proto content and captures etag', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => new Response(FIXTURE_ECHO_PROTO, {
        status: 200,
        headers: { etag: '"abc123"' },
      })),
    };

    const result = await fetchProtoFromUrl('https://example.com/echo.proto', { fetchPort });
    expect(result.content).toContain('EchoService');
    expect(result.etag).toBe('abc123');
    expect(result.protoPath).toBe('echo.proto');
  });

  it('surfaces HTTP failures', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => new Response('not found', { status: 404 })),
    };

    await expect(fetchProtoFromUrl('https://example.com/missing.proto', { fetchPort }))
      .rejects.toThrow(/HTTP 404/);
  });

  it('rejects HTTP redirects to prevent SSRF bypass', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => new Response('', {
        status: 302,
        headers: { location: 'https://192.168.0.10/internal.proto' },
      })),
    };

    await expect(fetchProtoFromUrl('https://example.com/echo.proto', { fetchPort }))
      .rejects.toThrow(/redirects are not allowed/);
  });

  it('rejects responses larger than the byte limit', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => new Response('x'.repeat(32), {
        status: 200,
        headers: { 'content-length': String(6 * 1024 * 1024) },
      })),
    };

    await expect(fetchProtoFromUrl('https://example.com/huge.proto', { fetchPort }))
      .rejects.toThrow(/exceeds .* byte limit/);
  });

  it('returns notModified on HTTP 304 when If-None-Match was sent', async () => {
    const fetchPort = {
      fetch: vi.fn(async (_url, init) => {
        expect(init?.headers).toMatchObject({ 'if-none-match': '"etag-1"' });
        return new Response(null, { status: 304 });
      }),
    };

    const result = await fetchProtoFromUrl('https://example.com/echo.proto', {
      fetchPort,
      ifNoneMatch: 'etag-1',
    });
    expect(result.notModified).toBe(true);
    expect(result.etag).toBe('etag-1');
  });

  it('passes through a quoted If-None-Match value without double quoting', async () => {
    const fetchPort = {
      fetch: vi.fn(async (_url, init) => {
        expect(init?.headers).toMatchObject({ 'if-none-match': '"etag-2"' });
        return new Response(FIXTURE_ECHO_PROTO, { status: 200 });
      }),
    };

    const result = await fetchProtoFromUrl('https://example.com/echo.proto', {
      fetchPort,
      ifNoneMatch: '"etag-2"',
    });

    expect(result.content).toContain('EchoService');
  });

  it('rejects a 304 response when no cached etag was provided', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => new Response(null, { status: 304 })),
    };

    await expect(fetchProtoFromUrl('https://example.com/echo.proto', { fetchPort }))
      .rejects.toThrow(/304 without a cached etag/);
  });

  it('rejects empty content response', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => new Response('   ', { status: 200 })),
    };

    await expect(fetchProtoFromUrl('https://example.com/empty.proto', { fetchPort }))
      .rejects.toThrow(/empty content/);
  });

  it('times out and throws AbortError as gateway error', async () => {
    const fetchPort = {
      fetch: vi.fn(async (_url, _init) => {
        // Simulate abort
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }),
    };

    await expect(fetchProtoFromUrl('https://example.com/slow.proto', { fetchPort, timeoutMs: 1 }))
      .rejects.toThrow(/timed out/);
  });

  it('wraps generic fetch errors in gateway error', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => { throw new Error('network failure'); }),
    };

    await expect(fetchProtoFromUrl('https://example.com/echo.proto', { fetchPort }))
      .rejects.toThrow(/Proto fetch failed: network failure/);
  });

  it('wraps non-Error throws in gateway error', async () => {
    const fetchPort = {
      fetch: vi.fn(async () => { throw 'raw string error'; }),
    };

    await expect(fetchProtoFromUrl('https://example.com/echo.proto', { fetchPort }))
      .rejects.toThrow(/Proto fetch failed: raw string error/);
  });

  it('rejects body exceeding limit when content-length header is absent', async () => {
    const bigBody = 'x'.repeat(6 * 1024 * 1024);
    const fetchPort = {
      fetch: vi.fn(async () => new Response(bigBody, { status: 200 })),
    };

    await expect(fetchProtoFromUrl('https://example.com/big.proto', { fetchPort }))
      .rejects.toThrow(/exceeds .* byte limit/);
  });

  it('ignores whitespace-only ifNoneMatch', async () => {
    const fetchPort = {
      fetch: vi.fn(async (_url, init) => {
        expect(init?.headers).not.toHaveProperty('if-none-match');
        return new Response(FIXTURE_ECHO_PROTO, { status: 200 });
      }),
    };

    const result = await fetchProtoFromUrl('https://example.com/echo.proto', {
      fetchPort,
      ifNoneMatch: '   ',
    });
    expect(result.content).toContain('EchoService');
  });
});
