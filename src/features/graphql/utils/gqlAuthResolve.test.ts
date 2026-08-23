import { describe, it, expect } from 'vitest';
import type { GlobalAuthProfile } from '@shared/types';
import {
  authConfigToGraphqlAuth,
  resolveEffectiveGqlAuth,
  describeResolvedGqlAuth,
  describeAuthSentMetadata,
  authSentSourceLabel,
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

  it('returns null for unknown auth config types', () => {
    expect(authConfigToGraphqlAuth({ type: 'custom' } as never)).toBeNull();
  });

  it('defaults oauth2 optional fields to empty strings', () => {
    expect(authConfigToGraphqlAuth({ type: 'oauth2' })).toEqual({
      type: 'oauth2',
      oauth2: { tokenUrl: '', clientId: '', clientSecret: '' },
    });
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

  it('returns null for null/undefined auth', () => {
    expect(resolveEffectiveGqlAuth(null, profiles)).toBeNull();
    expect(resolveEffectiveGqlAuth(undefined, profiles)).toBeNull();
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

  it('masks short apiKey values and shows empty value placeholder', () => {
    expect(
      describeResolvedGqlAuth({ type: 'apiKey', headerName: 'X-Key', headerValue: 'short' }, profiles),
    ).toContain('X-Key: ••••');
    expect(
      describeResolvedGqlAuth({ type: 'apiKey', headerName: 'X-Key', headerValue: '' }, profiles),
    ).toContain('(empty value)');
  });

  it('masks basic credentials via safe btoa fallback for non-Latin1 usernames', () => {
    const text = describeResolvedGqlAuth(
      { type: 'basic', username: '用户', password: 'pw' },
      profiles,
    );
    expect(text).toContain('Authorization: Basic ••••');
  });

  it('falls back to default for unknown GraphqlAuth type', () => {
    expect(describeResolvedGqlAuth({ type: 'unknown' } as never, profiles)).toBe(
      'No authentication headers will be added',
    );
  });
});

describe('describeAuthSentMetadata', () => {
  it('masks bearer token from request headers with source label', () => {
    const meta = describeAuthSentMetadata(
      { type: 'bearer', token: 'demo-token-secret' },
      'tab',
      profiles,
      { Authorization: 'Bearer demo-token-secret', 'Content-Type': 'application/json' },
    );
    expect(meta.sourceLabel).toBe('tab override');
    expect(meta.lines[0]).toContain('Authorization: Bearer demo-token');
    expect(meta.lines[0]).toContain('••••');
  });

  it('returns empty lines when no auth headers were sent', () => {
    const meta = describeAuthSentMetadata(null, 'page', profiles, {
      'Content-Type': 'application/json',
    });
    expect(meta.source).toBe('page');
    expect(meta.lines).toEqual([]);
  });

  it('falls back to masked stored auth preview when headers omit auth keys', () => {
    const meta = describeAuthSentMetadata(
      { type: 'bearer', token: 'page-session' },
      'page',
      profiles,
    );
    expect(meta.lines[0]).toContain('Authorization: Bearer page-session');
    expect(meta.lines[0]).toContain('••••');
    expect(meta.lines[0]).not.toBe('Authorization: Bearer page-session');
  });

  it('reads Authorization case-insensitively from request headers', () => {
    const meta = describeAuthSentMetadata(
      { type: 'bearer', token: 'secret' },
      'page',
      profiles,
      { authorization: 'Bearer secret-token-value' },
    );
    expect(meta.lines[0]).toContain('Authorization: Bearer secret-token');
    expect(meta.lines[0]).toContain('••••');
  });

  it('formats bearer scheme case-insensitively', () => {
    const meta = describeAuthSentMetadata(
      { type: 'bearer', token: 'secret' },
      'page',
      profiles,
      { Authorization: 'bearer secret-token-value' },
    );
    expect(meta.lines[0]).toContain('Authorization: Bearer secret-token');
    expect(meta.lines[0]).toContain('••••');
  });

  it('does not show inherit placeholder text when no auth headers were sent', () => {
    const meta = describeAuthSentMetadata({ type: 'inherit' }, 'page', profiles, {
      'Content-Type': 'application/json',
    });
    expect(meta.lines).toEqual([]);
  });

  it('does not show custom-auth placeholder when headers omit auth keys', () => {
    const meta = describeAuthSentMetadata({ type: 'custom' }, 'tab', profiles);
    expect(meta.lines).toEqual([]);
  });

  it('formats Basic authorization from request headers', () => {
    const meta = describeAuthSentMetadata(
      { type: 'basic', username: 'alice', password: 'secret' },
      'page',
      profiles,
      { Authorization: 'Basic dXNlcjpwYXNz' },
    );
    expect(meta.lines[0]).toBe('Authorization: Basic ••••');
  });

  it('masks bare Bearer scheme without a token as generic Authorization', () => {
    const meta = describeAuthSentMetadata(
      { type: 'bearer', token: 'x' },
      'page',
      profiles,
      { Authorization: 'Bearer' },
    );
    expect(meta.lines[0]).toBe('Authorization: ••••');
  });

  it('adds apiKey header line from request headers when not duplicated', () => {
    const meta = describeAuthSentMetadata(
      { type: 'apiKey', headerName: 'X-Api-Key', headerValue: 'secret-key-value' },
      'profile',
      profiles,
      { 'X-Api-Key': 'secret-key-value' },
    );
    expect(meta.sourceLabel).toBe('from connection profile');
    expect(meta.lines[0]).toContain('X-Api-Key:');
    expect(meta.lines[0]).not.toContain('secret-key-value');
  });

  it('falls back to masked basic auth from stored credentials', () => {
    const meta = describeAuthSentMetadata(
      { type: 'basic', username: 'alice', password: 'secret' },
      'tab',
      profiles,
    );
    expect(meta.lines[0]).toBe('Authorization: Basic ••••');
  });

  it('falls back to apiKey preview with empty value when header name is set', () => {
    const meta = describeAuthSentMetadata(
      { type: 'apiKey', headerName: 'X-Key', headerValue: '' },
      'page',
      profiles,
    );
    expect(meta.lines[0]).toBe('X-Key: (empty value)');
  });

  it('falls back to masked bearer when stored token is whitespace-only', () => {
    const meta = describeAuthSentMetadata({ type: 'bearer', token: '   ' }, 'page', profiles);
    expect(meta.lines).toEqual([]);
  });

  it('falls back to inherited profile bearer when request headers omit auth', () => {
    const meta = describeAuthSentMetadata(
      { type: 'inherit', globalProfileId: 'prof1' },
      'profile',
      profiles,
    );
    expect(meta.lines[0]).toContain('Authorization: Bearer staging');
    expect(meta.lines[0]).toContain('••••');
  });

  it('falls back to null for inherit profile with empty basic credentials', () => {
    const weak: GlobalAuthProfile[] = [
      { id: 'basic-empty', name: 'Empty Basic', auth: { type: 'basic', username: '  ', password: 'x' } },
    ];
    const meta = describeAuthSentMetadata(
      { type: 'inherit', globalProfileId: 'basic-empty' },
      'page',
      weak,
    );
    expect(meta.lines).toEqual([]);
  });

  it('shows empty apiKey value from request headers', () => {
    const meta = describeAuthSentMetadata(
      { type: 'apiKey', headerName: 'X-Key', headerValue: '' },
      'tab',
      profiles,
      { 'X-Key': '' },
    );
    expect(meta.lines[0]).toBe('X-Key: (empty value)');
  });

  it('skips apiKey header line when request omits the custom header', () => {
    const meta = describeAuthSentMetadata(
      { type: 'apiKey', headerName: 'X-Key', headerValue: 'secret' },
      'tab',
      profiles,
      { Authorization: 'Bearer other-token-value' },
    );
    expect(meta.lines).toHaveLength(1);
    expect(meta.lines[0]).toContain('Authorization: Bearer other-token');
  });

  it('returns no lines for oauth2 and empty bearer stored auth fallbacks', () => {
    expect(
      describeAuthSentMetadata(
        { type: 'oauth2', oauth2: { tokenUrl: 'https://auth/token', clientId: 'c', clientSecret: 's' } },
        'page',
        profiles,
      ).lines,
    ).toEqual([]);
    expect(describeAuthSentMetadata({ type: 'bearer', token: '' }, 'page', profiles).lines).toEqual([]);
    expect(
      describeAuthSentMetadata({ type: 'basic', username: '', password: 'pw' }, 'page', profiles).lines,
    ).toEqual([]);
    expect(
      describeAuthSentMetadata({ type: 'apiKey', headerName: '  ', headerValue: 'v' }, 'page', profiles).lines,
    ).toEqual([]);
  });

  it('masks non-bearer Authorization schemes generically', () => {
    const meta = describeAuthSentMetadata(
      { type: 'bearer', token: 'x' },
      'page',
      profiles,
      { Authorization: 'Digest realm="api"' },
    );
    expect(meta.lines[0]).toMatch(/^Authorization: Digest realm.*••••$/);
  });
});

describe('authSentSourceLabel', () => {
  it('maps all source kinds', () => {
    expect(authSentSourceLabel('page')).toBe('from page default');
    expect(authSentSourceLabel('tab')).toBe('tab override');
    expect(authSentSourceLabel('profile')).toBe('from connection profile');
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

  it('returns null when inherit profile id is missing or unknown', () => {
    expect(inheritAuthProfileLabel({ type: 'inherit' }, profiles)).toBeNull();
    expect(
      inheritAuthProfileLabel({ type: 'inherit', globalProfileId: 'missing' }, profiles),
    ).toBeNull();
  });
});
