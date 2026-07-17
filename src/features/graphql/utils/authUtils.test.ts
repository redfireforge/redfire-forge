/**
 * authUtils.test.ts — unit tests for GraphQL auth utilities.
 */

import { describe, it, expect } from 'vitest';
import { buildAuthHeaders, authBadgeLabel, isAuthConfigured, buildConnectionParams, stampAuthHeaders, resolveGqlAuthBadgePresentation, resolveTabAuthDotKind } from './authUtils';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { GqlStudioTab } from './tabPersistence';

// ─── buildAuthHeaders ─────────────────────────────────────────────────────────

describe('buildAuthHeaders', () => {
  it('returns empty object for null/undefined', () => {
    expect(buildAuthHeaders(null)).toEqual({});
    expect(buildAuthHeaders(undefined)).toEqual({});
  });

  it('returns Authorization: Bearer <token> for bearer type', () => {
    const headers = buildAuthHeaders({ type: 'bearer', token: 'my-secret-token' });
    expect(headers).toEqual({ Authorization: 'Bearer my-secret-token' });
  });

  it('trims bearer token before building header', () => {
    const headers = buildAuthHeaders({ type: 'bearer', token: '  tok  ' });
    expect(headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('returns empty object for bearer with missing/empty token', () => {
    expect(buildAuthHeaders({ type: 'bearer' })).toEqual({});
    expect(buildAuthHeaders({ type: 'bearer', token: '' })).toEqual({});
    expect(buildAuthHeaders({ type: 'bearer', token: '  ' })).toEqual({});
  });

  it('builds Basic auth header correctly', () => {
    const headers = buildAuthHeaders({ type: 'basic', username: 'alice', password: 'pass123' });
    expect(headers.Authorization).toMatch(/^Basic /);
    const decoded = atob(headers.Authorization.replace('Basic ', ''));
    expect(decoded).toBe('alice:pass123');
  });

  it('returns empty object for basic with missing username', () => {
    expect(buildAuthHeaders({ type: 'basic', password: 'x' })).toEqual({});
    expect(buildAuthHeaders({ type: 'basic', username: '  ' })).toEqual({});
  });

  it('handles empty password for basic auth', () => {
    const headers = buildAuthHeaders({ type: 'basic', username: 'user', password: '' });
    const decoded = atob(headers.Authorization.replace('Basic ', ''));
    expect(decoded).toBe('user:');
  });

  it('builds apiKey header correctly', () => {
    const headers = buildAuthHeaders({ type: 'apiKey', headerName: 'X-API-Key', headerValue: 'key123' });
    expect(headers).toEqual({ 'X-API-Key': 'key123' });
  });

  it('returns empty for apiKey with missing headerName', () => {
    expect(buildAuthHeaders({ type: 'apiKey', headerValue: 'val' })).toEqual({});
    expect(buildAuthHeaders({ type: 'apiKey', headerName: '' })).toEqual({});
  });

  it('returns empty for oauth2 and custom types', () => {
    expect(buildAuthHeaders({ type: 'oauth2' })).toEqual({});
    expect(buildAuthHeaders({ type: 'custom' })).toEqual({});
  });

  it('resolves inherit auth from global profile', () => {
    const profiles = [
      { id: 'p1', name: 'Corp', auth: { type: 'bearer' as const, token: 'from-profile' } },
    ];
    const headers = buildAuthHeaders({ type: 'inherit', globalProfileId: 'p1' }, profiles);
    expect(headers).toEqual({ Authorization: 'Bearer from-profile' });
  });

  it('returns empty for inherit without profile binding', () => {
    expect(buildAuthHeaders({ type: 'inherit' }, [])).toEqual({});
  });
});

describe('stampAuthHeaders (Phase 6F)', () => {
  it('overwrites stale Authorization with profile-scoped auth', () => {
    const result = stampAuthHeaders(
      { Authorization: 'Bearer stale', 'X-Custom': 'keep' },
      { type: 'bearer', token: 'profile-token' },
    );
    expect(result).toEqual({
      Authorization: 'Bearer profile-token',
      'X-Custom': 'keep',
    });
  });

  it('returns auth headers when existing map is undefined', () => {
    expect(stampAuthHeaders(undefined, { type: 'bearer', token: 't' })).toEqual({
      Authorization: 'Bearer t',
    });
  });

  it('passes headers through unchanged when auth is null', () => {
    expect(stampAuthHeaders({ Authorization: 'Bearer keep' }, null)).toEqual({
      Authorization: 'Bearer keep',
    });
  });
});

// ─── authBadgeLabel ───────────────────────────────────────────────────────────

describe('authBadgeLabel', () => {
  it('returns "No Auth" for null/undefined', () => {
    expect(authBadgeLabel(null)).toBe('No Auth');
    expect(authBadgeLabel(undefined)).toBe('No Auth');
  });

  const cases: [GraphqlAuth['type'], string][] = [
    ['bearer', 'Bearer'],
    ['basic', 'Basic'],
    ['apiKey', 'API Key'],
    ['oauth2', 'OAuth 2.0'],
    ['custom', 'Custom'],
  ];

  it.each(cases)('returns %s label for %s auth type', (type, expected) => {
    expect(authBadgeLabel({ type })).toBe(expected);
  });

  it('returns Inherit label for inherit type', () => {
    expect(authBadgeLabel({ type: 'inherit' })).toBe('Inherit');
  });

  it('returns Inherit (name) when profile is bound', () => {
    const profiles = [{ id: 'p1', name: 'Staging', auth: { type: 'bearer' as const, token: 't' } }];
    expect(authBadgeLabel({ type: 'inherit', globalProfileId: 'p1' }, profiles)).toBe(
      'Inherit (Staging)',
    );
  });
});

// ─── isAuthConfigured ─────────────────────────────────────────────────────────

describe('isAuthConfigured', () => {
  it('returns false for null/undefined', () => {
    expect(isAuthConfigured(null)).toBe(false);
    expect(isAuthConfigured(undefined)).toBe(false);
  });

  it('returns true for bearer with non-empty token', () => {
    expect(isAuthConfigured({ type: 'bearer', token: 'abc' })).toBe(true);
  });

  it('returns false for bearer with empty/missing token', () => {
    expect(isAuthConfigured({ type: 'bearer' })).toBe(false);
    expect(isAuthConfigured({ type: 'bearer', token: '' })).toBe(false);
    expect(isAuthConfigured({ type: 'bearer', token: '  ' })).toBe(false);
  });

  it('returns true for basic with non-empty username', () => {
    expect(isAuthConfigured({ type: 'basic', username: 'alice' })).toBe(true);
  });

  it('returns false for basic with empty username', () => {
    expect(isAuthConfigured({ type: 'basic' })).toBe(false);
    expect(isAuthConfigured({ type: 'basic', username: '' })).toBe(false);
  });

  it('returns true for apiKey with non-empty headerName', () => {
    expect(isAuthConfigured({ type: 'apiKey', headerName: 'X-Api-Key' })).toBe(true);
  });

  it('returns false for apiKey with empty headerName', () => {
    expect(isAuthConfigured({ type: 'apiKey' })).toBe(false);
    expect(isAuthConfigured({ type: 'apiKey', headerName: '' })).toBe(false);
  });

  it('returns true for oauth2 and custom (user explicitly chose a type)', () => {
    expect(isAuthConfigured({ type: 'oauth2' })).toBe(true);
    expect(isAuthConfigured({ type: 'custom' })).toBe(true);
  });

  it('returns true for inherit when profiles exist or profile id is set', () => {
    expect(isAuthConfigured({ type: 'inherit' }, [{ id: 'p1', name: 'X', auth: { type: 'none' } }])).toBe(true);
    expect(isAuthConfigured({ type: 'inherit', globalProfileId: 'p1' })).toBe(true);
  });
});

// ─── buildConnectionParams ────────────────────────────────────────────────────

describe('buildConnectionParams', () => {
  it('returns empty object for null/undefined', () => {
    expect(buildConnectionParams(null)).toEqual({});
    expect(buildConnectionParams(undefined)).toEqual({});
  });

  it('returns Authorization: Bearer <token> for bearer type', () => {
    expect(buildConnectionParams({ type: 'bearer', token: 'my-token' }))
      .toEqual({ Authorization: 'Bearer my-token' });
  });

  it('trims bearer token', () => {
    expect(buildConnectionParams({ type: 'bearer', token: '  tok  ' }))
      .toEqual({ Authorization: 'Bearer tok' });
  });

  it('returns empty object for bearer with empty token', () => {
    expect(buildConnectionParams({ type: 'bearer' })).toEqual({});
    expect(buildConnectionParams({ type: 'bearer', token: '' })).toEqual({});
    expect(buildConnectionParams({ type: 'bearer', token: '   ' })).toEqual({});
  });

  it('returns Authorization: Basic <base64> for basic type', () => {
    const result = buildConnectionParams({ type: 'basic', username: 'alice', password: 'secret' });
    expect(result).toHaveProperty('Authorization');
    expect((result.Authorization as string).startsWith('Basic ')).toBe(true);
    const decoded = atob((result.Authorization as string).slice(6));
    expect(decoded).toBe('alice:secret');
  });

  it('returns empty object for basic with empty username', () => {
    expect(buildConnectionParams({ type: 'basic' })).toEqual({});
    expect(buildConnectionParams({ type: 'basic', username: '' })).toEqual({});
  });

  it('returns { [headerName]: headerValue } for apiKey type', () => {
    expect(buildConnectionParams({ type: 'apiKey', headerName: 'X-Api-Key', headerValue: 'my-key' }))
      .toEqual({ 'X-Api-Key': 'my-key' });
  });

  it('returns empty object for apiKey with missing headerName', () => {
    expect(buildConnectionParams({ type: 'apiKey' })).toEqual({});
    expect(buildConnectionParams({ type: 'apiKey', headerName: '' })).toEqual({});
  });

  it('returns empty object for oauth2 (token pre-fetch handled elsewhere)', () => {
    expect(buildConnectionParams({ type: 'oauth2' })).toEqual({});
  });

  it('returns empty object for custom (headers injected via Headers panel)', () => {
    expect(buildConnectionParams({ type: 'custom' })).toEqual({});
  });
});

// ─── resolveGqlAuthBadgePresentation (Phase 6H Slice 4) ───────────────────────

describe('resolveGqlAuthBadgePresentation', () => {
  const profiles = [{ id: 'p1', name: 'Staging', auth: { type: 'bearer' as const, token: 't' } }];

  it('single tab page bearer uses default variant without scope pill', () => {
    const p = resolveGqlAuthBadgePresentation({
      resolvedAuth: { type: 'bearer', token: 'page' },
      hasTabAuthOverride: false,
      hasProfileLink: false,
      usesPageDefaultAuth: true,
      tabsLength: 1,
    });
    expect(p.label).toBe('Bearer');
    expect(p.variant).toBe('default');
    expect(p.scope).toBeNull();
    expect(p.configured).toBe(true);
  });

  it('single tab page No Auth uses default variant with plain label (not Inherit prefix)', () => {
    const p = resolveGqlAuthBadgePresentation({
      resolvedAuth: null,
      hasTabAuthOverride: false,
      hasProfileLink: false,
      usesPageDefaultAuth: true,
      tabsLength: 1,
    });
    expect(p.label).toBe('No Auth');
    expect(p.variant).toBe('default');
    expect(p.scope).toBeNull();
    expect(p.configured).toBe(false);
  });

  it('multi-tab inheriting tab shows dashed inherit label and tab scope pill', () => {
    const p = resolveGqlAuthBadgePresentation({
      resolvedAuth: { type: 'bearer', token: 'page' },
      hasTabAuthOverride: false,
      hasProfileLink: false,
      usesPageDefaultAuth: false,
      tabsLength: 2,
    });
    expect(p.label).toBe('Inherit (Bearer)');
    expect(p.variant).toBe('inherit');
    expect(p.scope).toBe('tab');
    expect(p.configured).toBe(false);
  });

  it('tab bearer override shows override variant with tab scope pill', () => {
    const p = resolveGqlAuthBadgePresentation({
      resolvedAuth: { type: 'bearer', token: 'tab-only' },
      hasTabAuthOverride: true,
      hasProfileLink: false,
      usesPageDefaultAuth: false,
      tabsLength: 2,
    });
    expect(p.label).toBe('Bearer');
    expect(p.variant).toBe('override');
    expect(p.scope).toBe('tab');
    expect(p.configured).toBe(true);
  });

  it('profile-linked tab without override shows profile variant and inherit label', () => {
    const p = resolveGqlAuthBadgePresentation({
      resolvedAuth: { type: 'bearer', token: 'staging' },
      hasTabAuthOverride: false,
      hasProfileLink: true,
      usesPageDefaultAuth: false,
      linkedProfileName: 'Staging',
      tabsLength: 2,
    });
    expect(p.label).toBe('Inherit (Staging)');
    expect(p.variant).toBe('profile');
    expect(p.scope).toBe('profile');
    expect(p.configured).toBe(true);
  });

  it('tab explicit null override shows No Auth with override variant', () => {
    const p = resolveGqlAuthBadgePresentation({
      resolvedAuth: null,
      hasTabAuthOverride: true,
      hasProfileLink: false,
      usesPageDefaultAuth: false,
      tabsLength: 2,
    });
    expect(p.label).toBe('No Auth');
    expect(p.variant).toBe('override');
    expect(p.configured).toBe(false);
  });

  it('tab inherit-global override uses catalog profile name in label', () => {
    const p = resolveGqlAuthBadgePresentation({
      resolvedAuth: { type: 'inherit', globalProfileId: 'p1' },
      hasTabAuthOverride: true,
      hasProfileLink: false,
      usesPageDefaultAuth: false,
      globalAuthProfiles: profiles,
      tabsLength: 2,
    });
    expect(p.label).toBe('Inherit (Staging)');
    expect(p.variant).toBe('override');
  });

  it('does not use profile variant while profile link is still pending', () => {
    const p = resolveGqlAuthBadgePresentation({
      resolvedAuth: { type: 'bearer', token: 'page' },
      hasTabAuthOverride: false,
      hasProfileLink: false,
      usesPageDefaultAuth: false,
      tabsLength: 1,
    });
    expect(p.variant).toBe('inherit');
    expect(p.label).toBe('Inherit (Bearer)');
    expect(p.scope).toBeNull();
  });
});

// ─── resolveTabAuthDotKind (Phase 6H Slice 4) ─────────────────────────────────

describe('resolveTabAuthDotKind', () => {
  const makeTab = (over: Partial<GqlStudioTab> = {}): GqlStudioTab => ({
    id: 'tab-1',
    label: 'Tab',
    modelUri: 'inmemory://tab-1',
    query: '',
    variables: '{}',
    headers: [],
    unsavedChanges: false,
    ...over,
  });

  const profiles = [{
    id: 'prof-staging',
    name: 'Staging',
    endpoint: 'https://staging.example/graphql',
    auth: { type: 'bearer' as const, token: 'x' },
    createdAt: 1,
  }];

  it('returns inherit when tab has no auth override', () => {
    expect(resolveTabAuthDotKind(makeTab(), profiles)).toBe('inherit');
  });

  it('returns profile when tab is profile-linked without auth override', () => {
    expect(resolveTabAuthDotKind(
      makeTab({ connectionId: 'prof-staging' }),
      profiles,
    )).toBe('profile');
  });

  it('returns override when tab stores bearer override', () => {
    expect(resolveTabAuthDotKind(
      makeTab({ auth: { type: 'bearer', token: 'tab-only' } }),
      profiles,
    )).toBe('override');
  });

  it('returns none when tab stores explicit null No Auth', () => {
    expect(resolveTabAuthDotKind(makeTab({ auth: null }), profiles)).toBe('none');
  });

  it('returns override for bearer override even when token is empty', () => {
    expect(resolveTabAuthDotKind(
      makeTab({ auth: { type: 'bearer', token: '' } }),
      profiles,
    )).toBe('override');
  });
});
