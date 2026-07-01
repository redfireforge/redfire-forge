/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GrpcOAuth2TokenError, GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';

function makeJwt(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('GrpcOAuth2TokenService (Phase 4D)', () => {
  const oauth2 = {
    tokenUrl: 'https://auth.example.com/token',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    scope: 'grpc.read',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('acquires and caches access tokens', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'token-1',
      expires_in: 3600,
    }), { status: 200 }));
    const service = new GrpcOAuth2TokenService({ fetch });

    await expect(service.acquireToken(oauth2)).resolves.toBe('token-1');
    await expect(service.acquireToken(oauth2)).resolves.toBe('token-1');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1]?.body).toContain('grant_type=client_credentials');
    expect(fetch.mock.calls[0]?.[1]?.body).toContain('scope=grpc.read');
  });

  it('refreshes expired cached tokens using JWT exp', async () => {
    vi.useFakeTimers();
    const exp = Math.floor(Date.now() / 1000) + 120;
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: makeJwt(exp),
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'token-2',
        expires_in: 3600,
      }), { status: 200 }));
    const service = new GrpcOAuth2TokenService({ fetch });

    await expect(service.acquireToken(oauth2)).resolves.toMatch(/^eyJ/);
    await vi.advanceTimersByTimeAsync(100_000);
    await expect(service.acquireToken(oauth2)).resolves.toBe('token-2');
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('maps invalid_client without leaking client secret', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      error: 'invalid_client',
      error_description: 'bad credentials',
    }), { status: 401 }));
    const service = new GrpcOAuth2TokenService({ fetch });

    await expect(service.acquireToken(oauth2)).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(GrpcOAuth2TokenError);
      const tokenError = error as GrpcOAuth2TokenError;
      expect(tokenError.category).toBe('invalid_client');
      expect(tokenError.message).not.toContain('client-secret');
      return true;
    });
  });

  it('maps timeout failures', async () => {
    const fetch = vi.fn(async () => {
      const error = new Error('The operation was aborted');
      error.name = 'TimeoutError';
      throw error;
    });
    const service = new GrpcOAuth2TokenService({ fetch });

    await expect(service.acquireToken(oauth2)).rejects.toMatchObject({
      category: 'timeout',
    });
  });

  it('maps AbortError from fetch timeout as timeout', async () => {
    const fetch = vi.fn(async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    });
    const service = new GrpcOAuth2TokenService({ fetch });

    await expect(service.acquireToken(oauth2)).rejects.toMatchObject({
      category: 'timeout',
    });
  });

  it('deduplicates inflight token requests for the same cache key', async () => {
    let resolveFetch!: (value: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    const service = new GrpcOAuth2TokenService({ fetch });

    const first = service.acquireToken(oauth2);
    const second = service.acquireToken(oauth2);
    expect(fetch).toHaveBeenCalledTimes(1);

    resolveFetch(new Response(JSON.stringify({
      access_token: 'shared-token',
      expires_in: 3600,
    }), { status: 200 }));

    await expect(Promise.all([first, second])).resolves.toEqual(['shared-token', 'shared-token']);
  });

  it('accepts string expires_in from token endpoint responses', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'token-string-exp',
      expires_in: '7200',
    }), { status: 200 }));
    const service = new GrpcOAuth2TokenService({ fetch });

    await expect(service.acquireToken(oauth2)).resolves.toBe('token-string-exp');
    await expect(service.acquireToken(oauth2)).resolves.toBe('token-string-exp');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores JWT exp in the past and falls back to expires_in for cache TTL', async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      access_token: makeJwt(pastExp),
      expires_in: 3600,
    }), { status: 200 }));
    const service = new GrpcOAuth2TokenService({ fetch });

    await expect(service.acquireToken(oauth2)).resolves.toMatch(/^eyJ/);
    await expect(service.acquireToken(oauth2)).resolves.toMatch(/^eyJ/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('clears expired cache entries when refresh fails', async () => {
    vi.useFakeTimers();
    const exp = Math.floor(Date.now() / 1000) + 120;
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: makeJwt(exp),
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'invalid_client',
      }), { status: 401 }));
    const service = new GrpcOAuth2TokenService({ fetch });

    await expect(service.acquireToken(oauth2)).resolves.toMatch(/^eyJ/);
    await vi.advanceTimersByTimeAsync(100_000);
    await expect(service.acquireToken(oauth2)).rejects.toMatchObject({ category: 'invalid_client' });
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
