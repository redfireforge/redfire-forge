import { describe, expect, it } from 'vitest';
import type { GrpcAuthConfig } from './contracts';
import { toGrpcTauriAuthConfig } from './grpcTauriAuthMapper';

describe('grpcTauriAuthMapper', () => {
  it('returns undefined for none and inherit auth modes', () => {
    expect(toGrpcTauriAuthConfig(undefined)).toBeUndefined();
    expect(toGrpcTauriAuthConfig({ type: 'none' })).toBeUndefined();
    expect(toGrpcTauriAuthConfig({ type: 'inherit', globalProfileId: 'profile-1' })).toBeUndefined();
  });

  it('passes through native-supported auth configs unchanged', () => {
    const bearer: GrpcAuthConfig = { type: 'bearer', bearerToken: 'token-1' };
    const basic: GrpcAuthConfig = {
      type: 'basic',
      basicUsername: 'user',
      basicPassword: 'pass',
    };

    expect(toGrpcTauriAuthConfig(bearer)).toEqual(bearer);
    expect(toGrpcTauriAuthConfig(basic)).toEqual(basic);
  });

  it('maps api key and oauth2 auth configs', () => {
    const apiKey: GrpcAuthConfig = {
      type: 'api_key',
      apiKeyName: 'x-api-key',
      apiKeyValue: 'secret',
    };
    const oauth2: GrpcAuthConfig = {
      type: 'oauth2',
      oauth2: {
        grantType: 'client_credentials',
        tokenUrl: 'https://example.com/oauth/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scopes: ['read'],
      },
    };

    expect(toGrpcTauriAuthConfig(apiKey)).toEqual(apiKey);
    expect(toGrpcTauriAuthConfig(oauth2)).toEqual(oauth2);
  });

  it('returns undefined for unknown auth config values', () => {
    const unknownAuth = { type: 'custom_token' } as unknown as GrpcAuthConfig;
    expect(toGrpcTauriAuthConfig(unknownAuth)).toBeUndefined();
  });
});
