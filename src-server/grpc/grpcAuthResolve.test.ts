/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { resolveGrpcExecuteAuthMetadata, mapGrpcAuthResolveErrorForEnvelope } from './grpcAuthResolve.js';
import { GrpcOAuth2TokenError, type GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';

describe('grpcAuthResolve (Phase 4D)', () => {
  it('resolves oauth2 auth to bearer authorization metadata', async () => {
    const tokenService = {
      acquireToken: vi.fn(async () => 'resolved-token'),
    } as unknown as GrpcOAuth2TokenService;

    const metadata = await resolveGrpcExecuteAuthMetadata(
      { 'x-trace': '1', authorization: 'Bearer manual' },
      {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'id',
          clientSecret: 'secret',
        },
      },
      tokenService,
    );

    expect(metadata.authorization).toBe('Bearer resolved-token');
    expect(metadata['x-trace']).toBe('1');
    expect(tokenService.acquireToken).toHaveBeenCalledTimes(1);
  });

  it('surfaces oauth2 token errors without merging metadata', async () => {
    const tokenService = {
      acquireToken: vi.fn(async () => {
        throw new GrpcOAuth2TokenError('invalid_scope', 'OAuth2 token request failed: invalid_scope');
      }),
    } as unknown as GrpcOAuth2TokenService;

    await expect(resolveGrpcExecuteAuthMetadata(
      {},
      {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'id',
          clientSecret: 'secret',
        },
      },
      tokenService,
    )).rejects.toThrow(/invalid_scope/i);
  });

  it('sanitizes auth resolve error messages before envelope mapping', () => {
    const mapped = mapGrpcAuthResolveErrorForEnvelope(
      new Error('client_secret=super-secret access_token=abc123'),
    );
    expect(mapped.message).not.toContain('super-secret');
    expect(mapped.message).toContain('[REDACTED]');
  });
});
