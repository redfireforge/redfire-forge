import { describe, expect, it } from 'vitest';
import type { GlobalAuthProfile } from '@shared/types';
import {
  buildGrpcAuthPreviewWithProfiles,
  getGrpcCompatibleGlobalAuthProfiles,
  resolveEffectiveGrpcAuth,
} from './grpcAuthProfileResolve';

function makeProfile(id: string, name: string, auth: GlobalAuthProfile['auth']): GlobalAuthProfile {
  return { id, name, auth };
}

describe('grpcAuthProfileResolve', () => {
  it('filters profiles to grpc-compatible auth modes', () => {
    const profiles: GlobalAuthProfile[] = [
      makeProfile('none', 'None', { type: 'none' }),
      makeProfile('inherit', 'Inherit', { type: 'inherit', globalProfileId: 'none' }),
      makeProfile('bearer-ok', 'Bearer', { type: 'bearer', token: 'token', prefix: 'Bearer' }),
      makeProfile('bearer-bad', 'Bad Bearer', { type: 'bearer', token: 'token', prefix: 'Token' }),
      makeProfile('basic', 'Basic', { type: 'basic', username: 'alice', password: 'secret' }),
      makeProfile('apikey-ok', 'Header Key', { type: 'apikey', apiKeyIn: 'header', apiKeyName: 'x-api-key', apiKeyValue: 'value' }),
      makeProfile('apikey-bad', 'Query Key', { type: 'apikey', apiKeyIn: 'query', apiKeyName: 'api_key', apiKeyValue: 'value' }),
      makeProfile('oauth2', 'OAuth2', { type: 'oauth2', tokenUrl: 'https://issuer/token', clientId: 'client', clientSecret: 'secret', scope: 'read' }),
      makeProfile('digest', 'Digest', { type: 'digest', username: 'alice', password: 'secret' }),
    ];

    expect(getGrpcCompatibleGlobalAuthProfiles(profiles).map((profile) => profile.id)).toEqual([
      'none',
      'inherit',
      'bearer-ok',
      'basic',
      'apikey-ok',
      'oauth2',
    ]);
  });

  it('resolves inherited basic auth and falls back to default profile id', () => {
    const profiles: GlobalAuthProfile[] = [
      makeProfile('basic', 'Basic Profile', { type: 'basic', username: 'alice', password: 'secret' }),
    ];

    expect(resolveEffectiveGrpcAuth({ type: 'inherit' }, profiles, 'basic')).toEqual({
      auth: {
        type: 'basic',
        basicUsername: 'alice',
        basicPassword: 'secret',
      },
      profileName: 'Basic Profile',
    });
  });

  it('returns actionable issues for missing selection, missing profile, invalid inherit target, unsupported mode, and loops', () => {
    const invalidBearer = makeProfile('bearer-bad', 'Bad Bearer', { type: 'bearer', token: 'token', prefix: 'Token' });
    const inheritMissingTarget = makeProfile('inherit-empty', 'Empty Inherit', { type: 'inherit', globalProfileId: '   ' });
    const loopA = makeProfile('loop-a', 'Loop A', { type: 'inherit', globalProfileId: 'loop-b' });
    const loopB = makeProfile('loop-b', 'Loop B', { type: 'inherit', globalProfileId: 'loop-a' });
    const profiles = [invalidBearer, inheritMissingTarget, loopA, loopB];

    expect(resolveEffectiveGrpcAuth({ type: 'inherit' }, profiles)).toMatchObject({
      auth: undefined,
      profileName: null,
      issue: 'Select an auth profile to inherit credentials.',
    });

    expect(resolveEffectiveGrpcAuth({ type: 'inherit', globalProfileId: 'missing' }, profiles)).toMatchObject({
      auth: undefined,
      profileName: null,
      issue: 'Selected auth profile was not found.',
    });

    expect(resolveEffectiveGrpcAuth({ type: 'inherit', globalProfileId: 'inherit-empty' }, profiles)).toMatchObject({
      auth: undefined,
      profileName: 'Empty Inherit',
      issue: 'Auth profile "Empty Inherit" does not point to another profile.',
    });

    expect(resolveEffectiveGrpcAuth({ type: 'inherit', globalProfileId: 'bearer-bad' }, profiles)).toMatchObject({
      auth: undefined,
      profileName: 'Bad Bearer',
      issue: 'Auth profile "Bad Bearer" uses an auth mode not supported by gRPC Studio.',
    });

    expect(resolveEffectiveGrpcAuth({ type: 'inherit', globalProfileId: 'loop-a' }, profiles)).toMatchObject({
      auth: undefined,
      profileName: null,
      issue: 'Auth profile inheritance loop detected.',
    });
  });

  it('builds grpc auth preview with resolved oauth2 and surfaces preview issues when inheritance fails', () => {
    const oauthProfile = makeProfile('oauth', 'OAuth Profile', {
      type: 'oauth2',
      tokenUrl: 'https://issuer/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      scope: 'read write',
    });

    const success = buildGrpcAuthPreviewWithProfiles(
      { existing: 'value' },
      { type: 'inherit', globalProfileId: 'oauth' },
      [oauthProfile],
      null,
    );
    expect(success.profileName).toBe('OAuth Profile');
    expect(success.resolvedAuth).toEqual({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://issuer/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      },
    });
    expect(success.preview.ok).toBe(true);

    const failed = buildGrpcAuthPreviewWithProfiles({}, { type: 'inherit' }, [], null);
    expect(failed.resolvedAuth).toBeUndefined();
    expect(failed.preview.ok).toBe(false);
    expect(failed.preview.issues[0]).toMatchObject({
      field: 'auth.globalProfileId',
      message: 'Select an auth profile to inherit credentials.',
    });
  });

  it('resolves inherited none profiles and returns direct auth unchanged for none and non-inherit modes', () => {
    const noneProfile = makeProfile('none-profile', 'None Profile', { type: 'none' });

    expect(resolveEffectiveGrpcAuth({ type: 'inherit', globalProfileId: 'none-profile' }, [noneProfile])).toEqual({
      auth: undefined,
      profileName: 'None Profile',
    });

    expect(resolveEffectiveGrpcAuth({ type: 'none' }, [noneProfile])).toEqual({
      auth: { type: 'none' },
      profileName: null,
    });

    expect(resolveEffectiveGrpcAuth({ type: 'basic', basicUsername: 'user', basicPassword: 'pass' }, [noneProfile])).toEqual({
      auth: { type: 'basic', basicUsername: 'user', basicPassword: 'pass' },
      profileName: null,
    });
  });
});