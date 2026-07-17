/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import {
  mapGrpcAuthResolveErrorForEnvelope,
  mapGrpcOAuth2TokenErrorForEnvelope,
  resolveGrpcExecuteAuthMetadata,
  resolveGrpcExecuteAuthMetadataSync,
} from './grpcAuthResolve.js';
import { GrpcOAuth2TokenError, type GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';

describe('grpcAuthResolve coverage gaps', () => {
  it('resolveGrpcExecuteAuthMetadataSync merges bearer auth without token service', () => {
    const metadata = resolveGrpcExecuteAuthMetadataSync(
      { 'x-trace': '1' },
      { type: 'bearer', bearerToken: 'panel-token' },
    );
    expect(metadata.authorization).toBe('Bearer panel-token');
    expect(metadata['x-trace']).toBe('1');
  });

  it('resolveGrpcExecuteAuthMetadataSync throws when auth merge fails', () => {
    expect(() => resolveGrpcExecuteAuthMetadataSync(
      {},
      { type: 'basic', basicUsername: '', basicPassword: '' },
    )).toThrow();
  });

  it('resolveGrpcExecuteAuthMetadata rejects oauth2 without oauth2 config', async () => {
    const tokenService = {
      acquireToken: vi.fn(),
    } as unknown as GrpcOAuth2TokenService;

    await expect(resolveGrpcExecuteAuthMetadata(
      {},
      { type: 'oauth2' },
      tokenService,
    )).rejects.toThrow(/OAuth2 configuration is required/i);
    expect(tokenService.acquireToken).not.toHaveBeenCalled();
  });

  it('mapGrpcOAuth2TokenErrorForEnvelope sanitizes token errors', () => {
    const mapped = mapGrpcOAuth2TokenErrorForEnvelope(
      new GrpcOAuth2TokenError('invalid_client', 'client_secret=leaked'),
    );
    expect(mapped.field).toBe('auth.oauth2');
    expect(mapped.message).not.toContain('leaked');
  });

  it('mapGrpcAuthResolveErrorForEnvelope routes GrpcOAuth2TokenError', () => {
    const mapped = mapGrpcAuthResolveErrorForEnvelope(
      new GrpcOAuth2TokenError('invalid_scope', 'scope denied'),
    );
    expect(mapped.field).toBe('auth.oauth2');
    expect(mapped.message).toMatch(/scope denied/i);
  });

  it('resolveGrpcExecuteAuthMetadata uses sync path for non-oauth2 auth', async () => {
    const tokenService = {
      acquireToken: vi.fn(),
    } as unknown as GrpcOAuth2TokenService;

    const metadata = await resolveGrpcExecuteAuthMetadata(
      {},
      { type: 'bearer', bearerToken: 'direct-bearer' },
      tokenService,
    );
    expect(metadata.authorization).toBe('Bearer direct-bearer');
    expect(tokenService.acquireToken).not.toHaveBeenCalled();
  });
});
