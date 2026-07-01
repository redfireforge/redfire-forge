/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';

describe('GrpcOAuth2TokenService coverage gaps', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects oauth2 config missing required credentials', async () => {
    const service = new GrpcOAuth2TokenService({ fetch: vi.fn() });
    await expect(service.acquireToken({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'id',
      clientSecret: '   ',
    })).rejects.toMatchObject({ category: 'invalid_client' });
  });

  it('maps non-timeout fetch failures to endpoint_unreachable', async () => {
    const service = new GrpcOAuth2TokenService({
      fetch: vi.fn(async () => { throw new Error('ECONNREFUSED'); }),
    });
    await expect(service.acquireToken({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'id',
      clientSecret: 'secret',
    })).rejects.toMatchObject({ category: 'endpoint_unreachable' });
  });

  it('rejects malformed JSON token responses', async () => {
    const service = new GrpcOAuth2TokenService({
      fetch: vi.fn(async () => new Response('not-json', { status: 200 })),
    });
    await expect(service.acquireToken({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'id',
      clientSecret: 'secret',
    })).rejects.toMatchObject({ category: 'invalid_response' });
  });

  it('rejects JSON responses missing access_token', async () => {
    const service = new GrpcOAuth2TokenService({
      fetch: vi.fn(async () => new Response(JSON.stringify({ expires_in: 3600 }), { status: 200 })),
    });
    await expect(service.acquireToken({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'id',
      clientSecret: 'secret',
    })).rejects.toMatchObject({ category: 'invalid_response' });
  });

  it('clearCache allows a fresh fetch after tokens were cached', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'token-a',
      expires_in: 3600,
    }), { status: 200 }));
    const service = new GrpcOAuth2TokenService({ fetch });
    const oauth2 = {
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'id',
      clientSecret: 'secret',
    };

    await expect(service.acquireToken(oauth2)).resolves.toBe('token-a');
    expect(fetch).toHaveBeenCalledTimes(1);

    service.clearCache();
    await expect(service.acquireToken(oauth2)).resolves.toBe('token-a');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('uses the default global fetch port when none is injected', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'default-port-token', expires_in: 3600 }), { status: 200 }),
    );
    const service = new GrpcOAuth2TokenService();
    await expect(service.acquireToken({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'id',
      clientSecret: 'secret',
    })).resolves.toBe('default-port-token');
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
