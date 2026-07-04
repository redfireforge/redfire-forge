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
});
