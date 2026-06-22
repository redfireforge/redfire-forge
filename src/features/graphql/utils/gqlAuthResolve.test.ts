import { describe, it, expect } from 'vitest';
import type { GlobalAuthProfile } from '../../../shared/types';
import {
  authConfigToGraphqlAuth,
  resolveEffectiveGqlAuth,
  describeResolvedGqlAuth,
  inheritAuthProfileLabel,
} from './gqlAuthResolve';

const profiles: GlobalAuthProfile[] = [
  {
    id: 'prof1',
    name: 'Staging Bearer',
    auth: { type: 'bearer', token: 'staging-token' },
  },
  {
    id: 'prof2',
    name: 'Basic Corp',
    auth: { type: 'basic', username: 'alice', password: 'secret' },
  },
];

describe('authConfigToGraphqlAuth', () => {
  it('maps bearer auth config', () => {
    expect(authConfigToGraphqlAuth({ type: 'bearer', token: 'tok' })).toEqual({
      type: 'bearer',
      token: 'tok',
    });
  });

  it('maps basic and digest auth config', () => {
    const creds = { username: 'alice', password: 'secret' };
    expect(authConfigToGraphqlAuth({ type: 'basic', ...creds })).toEqual({
      type: 'basic',
      ...creds,
    });
    expect(authConfigToGraphqlAuth({ type: 'digest', ...creds })).toEqual({
      type: 'basic',
      ...creds,
    });
  });

  it('maps apikey auth config to apiKey GraphqlAuth', () => {
    expect(
      authConfigToGraphqlAuth({ type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'val' }),
    ).toEqual({ type: 'apiKey', headerName: 'X-Key', headerValue: 'val' });
  });

  it('maps oauth2 auth config', () => {
    expect(
      authConfigToGraphqlAuth({
        type: 'oauth2',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'cid',
        clientSecret: 'sec',
      }),
    ).toEqual({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'cid',
        clientSecret: 'sec',
      },
    });
  });

  it('returns null for none and inherit', () => {
    expect(authConfigToGraphqlAuth({ type: 'none' })).toBeNull();
    expect(authConfigToGraphqlAuth({ type: 'inherit' })).toBeNull();
  });
});

describe('resolveEffectiveGqlAuth', () => {
  it('returns direct bearer auth unchanged', () => {
    const auth = { type: 'bearer' as const, token: 'direct' };
    expect(resolveEffectiveGqlAuth(auth, profiles)).toEqual(auth);
  });

  it('resolves inherit auth from global profile', () => {
    expect(
      resolveEffectiveGqlAuth({ type: 'inherit', globalProfileId: 'prof1' }, profiles),
    ).toEqual({ type: 'bearer', token: 'staging-token' });
  });

  it('returns null for inherit without profile id', () => {
    expect(resolveEffectiveGqlAuth({ type: 'inherit' }, profiles)).toBeNull();
  });

  it('returns null for missing profile', () => {
    expect(
      resolveEffectiveGqlAuth({ type: 'inherit', globalProfileId: 'missing' }, profiles),
    ).toBeNull();
  });

  it('returns null when inherited profile has none/inherit auth', () => {
    const weakProfiles: GlobalAuthProfile[] = [
      { id: 'none-prof', name: 'Empty', auth: { type: 'none' } },
      { id: 'inherit-prof', name: 'Loop', auth: { type: 'inherit' } },
    ];
    expect(
      resolveEffectiveGqlAuth({ type: 'inherit', globalProfileId: 'none-prof' }, weakProfiles),
    ).toBeNull();
    expect(
      resolveEffectiveGqlAuth({ type: 'inherit', globalProfileId: 'inherit-prof' }, weakProfiles),
    ).toBeNull();
  });
});

describe('describeResolvedGqlAuth', () => {
  it('returns default when auth is null', () => {
    expect(describeResolvedGqlAuth(null, profiles)).toBe('No authentication headers will be added');
  });

  it('shows inherit hint when no profile selected', () => {
    expect(describeResolvedGqlAuth({ type: 'inherit' }, profiles)).toBe(
      'Inherit — no profile selected',
    );
  });

  it('shows profile-not-found for missing inherit target', () => {
    expect(
      describeResolvedGqlAuth({ type: 'inherit', globalProfileId: 'missing' }, profiles),
    ).toBe('Inherit — profile not found');
  });

  it('shows masked bearer preview for inherited profile', () => {
    const text = describeResolvedGqlAuth(
      { type: 'inherit', globalProfileId: 'prof1' },
      profiles,
    );
    expect(text).toContain('Staging Bearer');
    expect(text).toContain('Authorization: Bearer');
  });

  it('describes direct bearer, basic, apiKey, oauth2, and custom auth', () => {
    expect(describeResolvedGqlAuth({ type: 'bearer', token: 'short' }, profiles)).toContain(
      'Authorization: Bearer short',
    );
    expect(describeResolvedGqlAuth({ type: 'bearer', token: '' }, profiles)).toContain(
      'Token not set',
    );
    expect(
      describeResolvedGqlAuth({ type: 'basic', username: 'alice', password: 'pw' }, profiles),
    ).toContain('Authorization: Basic');
    expect(
      describeResolvedGqlAuth(
        { type: 'apiKey', headerName: 'X-Api-Key', headerValue: 'secret-value' },
        profiles,
      ),
    ).toContain('X-Api-Key:');
    expect(
      describeResolvedGqlAuth(
        { type: 'oauth2', oauth2: { tokenUrl: 'https://auth/token', clientId: 'c', clientSecret: 's' } },
        profiles,
      ),
    ).toContain('token from https://auth/token');
    expect(describeResolvedGqlAuth({ type: 'custom' }, profiles)).toContain('Custom headers');
  });

  it('shows inherit unusable-auth message for profile with none auth', () => {
    const weak: GlobalAuthProfile[] = [
      { id: 'empty', name: 'Empty Profile', auth: { type: 'none' } },
    ];
    expect(
      describeResolvedGqlAuth({ type: 'inherit', globalProfileId: 'empty' }, weak),
    ).toContain('no usable auth');
  });

  it('truncates long bearer tokens in preview', () => {
    const long = 'a'.repeat(30);
    const text = describeResolvedGqlAuth({ type: 'bearer', token: long }, profiles);
    expect(text).toContain('…');
  });

  it('handles oauth2 without tokenUrl', () => {
    expect(describeResolvedGqlAuth({ type: 'oauth2', oauth2: { tokenUrl: '', clientId: 'c', clientSecret: 's' } }, profiles))
      .toContain('Phase 3');
  });

  it('handles apiKey with empty header name', () => {
    expect(describeResolvedGqlAuth({ type: 'apiKey', headerName: '', headerValue: 'x' }, profiles))
      .toContain('Header name not set');
  });

  it('handles basic auth with empty username', () => {
    expect(describeResolvedGqlAuth({ type: 'basic', username: '', password: 'p' }, profiles))
      .toContain('Username not set');
  });
});

describe('inheritAuthProfileLabel', () => {
  it('returns profile name when bound', () => {
    expect(
      inheritAuthProfileLabel({ type: 'inherit', globalProfileId: 'prof1' }, profiles),
    ).toBe('Staging Bearer');
  });

  it('returns null for non-inherit auth', () => {
    expect(inheritAuthProfileLabel({ type: 'bearer', token: 'x' }, profiles)).toBeNull();
  });
});
