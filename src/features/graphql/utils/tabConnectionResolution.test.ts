import { describe, it, expect } from 'vitest';
import type { GraphqlAuth } from '@shared/types/graphql';
import type { ConnectionProfile } from './connectionProfileStorage';
import type { GqlStudioTab } from './tabPersistence';
import {
  findProfileById,
  isTabProfileLinked,
  isTabProfileLinkPending,
  isTabAuthOverridden,
  resolveTabAuth,
  resolveTabAuthSentSource,
  resolveProfileAuthContribution,
  resolveTabConnection,
  resolveTabRawEndpoint,
  resolveTabLabelEndpoint,
} from './tabConnectionResolution';

const PAGE_DEFAULTS = {
  endpoint: 'https://page.example/graphql',
  auth: { type: 'bearer', token: 'page-token' } as GraphqlAuth,
  skipTlsVerify: false,
  tlsCaCert: 'page-ca',
  tlsClientCert: 'page-client',
  tlsClientKey: 'page-key',
  pollingEnabled: false,
  pollingIntervalSeconds: 30,
};

function makeTab(overrides: Partial<GqlStudioTab> = {}): GqlStudioTab {
  return {
    id: 'tab-1',
    label: 'Query',
    modelUri: 'gql://tab-1',
    query: 'query { x }',
    variables: '{}',
    headers: [],
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ConnectionProfile> = {}): ConnectionProfile {
  return {
    id: 'prof-staging',
    name: 'Staging',
    endpoint: 'https://staging.example/graphql',
    auth: { type: 'bearer', token: 'staging-token' } as GraphqlAuth,
    createdAt: 1,
    ...overrides,
  };
}

describe('findProfileById', () => {
  it('returns profile when id matches', () => {
    const profiles = [makeProfile()];
    expect(findProfileById(profiles, 'prof-staging')?.name).toBe('Staging');
  });

  it('returns undefined when id missing or not found', () => {
    expect(findProfileById([], 'prof-staging')).toBeUndefined();
    expect(findProfileById([makeProfile()], undefined)).toBeUndefined();
    expect(findProfileById([makeProfile()], 'missing')).toBeUndefined();
  });
});

describe('resolveTabRawEndpoint', () => {
  it('prefers tab.endpoint over profile and page default', () => {
    const tab = makeTab({
      connectionId: 'prof-staging',
      endpoint: 'https://override.example/graphql',
    });
    expect(resolveTabRawEndpoint(tab, [makeProfile()], PAGE_DEFAULTS.endpoint))
      .toBe('https://override.example/graphql');
  });

  it('uses profile endpoint when tab has connectionId but no endpoint override', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    expect(resolveTabRawEndpoint(tab, [makeProfile()], PAGE_DEFAULTS.endpoint))
      .toBe('https://staging.example/graphql');
  });

  it('falls back to page default when no override or profile', () => {
    expect(resolveTabRawEndpoint(makeTab(), [], PAGE_DEFAULTS.endpoint))
      .toBe('https://page.example/graphql');
  });

  it('falls back to page default when profile is missing (deleted)', () => {
    const tab = makeTab({ connectionId: 'deleted-profile' });
    expect(resolveTabRawEndpoint(tab, [makeProfile()], PAGE_DEFAULTS.endpoint))
      .toBe('https://page.example/graphql');
  });

  it('falls back to page default when tab.endpoint is explicitly blank', () => {
    const tab = makeTab({ endpoint: '' });
    expect(resolveTabRawEndpoint(tab, [], PAGE_DEFAULTS.endpoint))
      .toBe(PAGE_DEFAULTS.endpoint);
  });

  it('treats whitespace-only tab.endpoint as page default inherit', () => {
    const tab = makeTab({ endpoint: '   ' });
    expect(resolveTabRawEndpoint(tab, [], PAGE_DEFAULTS.endpoint))
      .toBe(PAGE_DEFAULTS.endpoint);
  });
});

describe('resolveTabLabelEndpoint', () => {
  it('uses env-resolved page default when tab inherits page URL', () => {
    const tab = makeTab({ query: 'query { }' });
    expect(
      resolveTabLabelEndpoint(
        tab,
        [],
        '{{graphqlUrl}}',
        'http://localhost:4010/graphql',
      ),
    ).toBe('http://127.0.0.1:4010/graphql');
  });

  it('trims whitespace from tab override endpoint', () => {
    const tab = makeTab({ endpoint: ' http://localhost:4010/graphql ' });
    expect(resolveTabLabelEndpoint(tab, [], '', '')).toBe('http://127.0.0.1:4010/graphql');
  });
});

describe('isTabProfileLinked / isTabProfileLinkPending', () => {
  it('isTabProfileLinked is true when connectionId resolves', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    expect(isTabProfileLinked(tab, [makeProfile()])).toBe(true);
    expect(isTabProfileLinkPending(tab, [makeProfile()])).toBe(false);
  });

  it('isTabProfileLinkPending is true when connectionId is set but profile missing', () => {
    const tab = makeTab({ connectionId: 'prof-staging', endpoint: 'https://x/graphql' });
    expect(isTabProfileLinked(tab, [])).toBe(false);
    expect(isTabProfileLinkPending(tab, [])).toBe(true);
  });

  it('both false when tab has no connectionId', () => {
    expect(isTabProfileLinked(makeTab(), [makeProfile()])).toBe(false);
    expect(isTabProfileLinkPending(makeTab(), [makeProfile()])).toBe(false);
  });
});

describe('isTabAuthOverridden / resolveTabAuth (Phase 6H)', () => {
  const profile = makeProfile();

  it('isTabAuthOverridden is false when auth field absent', () => {
    expect(isTabAuthOverridden(makeTab())).toBe(false);
  });

  it('isTabAuthOverridden is true for explicit null (No Auth override)', () => {
    expect(isTabAuthOverridden(makeTab({ auth: null }))).toBe(true);
  });

  it('isTabAuthOverridden is true for explicit bearer override', () => {
    expect(isTabAuthOverridden(makeTab({ auth: { type: 'bearer', token: 'x' } }))).toBe(true);
  });

  it('isTabAuthOverridden is false for bare inherit without globalProfileId', () => {
    expect(isTabAuthOverridden(makeTab({ auth: { type: 'inherit' } }))).toBe(false);
  });

  it('isTabAuthOverridden is true for inherit with globalProfileId', () => {
    expect(isTabAuthOverridden(makeTab({ auth: { type: 'inherit', globalProfileId: 'p1' } }))).toBe(true);
  });

  it('resolveTabAuth falls through bare tab inherit to profile auth', () => {
    const tab = makeTab({ connectionId: 'prof-staging', auth: { type: 'inherit' } });
    expect(resolveTabAuth(tab, profile, PAGE_DEFAULTS.auth)).toEqual(profile.auth);
  });

  it('resolveTabAuth falls through bare tab inherit to page when no profile', () => {
    const tab = makeTab({ auth: { type: 'inherit' } });
    expect(resolveTabAuth(tab, undefined, PAGE_DEFAULTS.auth)).toEqual(PAGE_DEFAULTS.auth);
  });

  it('resolveTabAuth uses tab explicit bearer over profile and page', () => {
    const tab = makeTab({
      connectionId: 'prof-staging',
      auth: { type: 'bearer', token: 'tab-token' },
    });
    expect(resolveTabAuth(tab, profile, PAGE_DEFAULTS.auth)).toEqual({
      type: 'bearer',
      token: 'tab-token',
    });
  });

  it('resolveTabAuth uses tab explicit null over profile auth', () => {
    const tab = makeTab({ connectionId: 'prof-staging', auth: null });
    expect(resolveTabAuth(tab, profile, PAGE_DEFAULTS.auth)).toBeNull();
  });

  it('resolveTabAuth uses tab inherit-global over page default', () => {
    const tab = makeTab({
      auth: { type: 'inherit', globalProfileId: 'catalog-1' },
    });
    expect(resolveTabAuth(tab, undefined, PAGE_DEFAULTS.auth)).toEqual({
      type: 'inherit',
      globalProfileId: 'catalog-1',
    });
  });

  it('resolveTabAuth falls through to profile when tab inherits workspace', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    expect(resolveTabAuth(tab, profile, PAGE_DEFAULTS.auth)).toEqual(profile.auth);
  });

  it('resolveTabAuth falls through to page when no tab override or profile', () => {
    expect(resolveTabAuth(makeTab(), undefined, PAGE_DEFAULTS.auth)).toEqual(PAGE_DEFAULTS.auth);
  });

  it('resolveTabAuth uses page when profile link is pending (profile undefined)', () => {
    const tab = makeTab({ connectionId: 'gone' });
    expect(resolveTabAuth(tab, undefined, PAGE_DEFAULTS.auth)).toEqual(PAGE_DEFAULTS.auth);
  });

  it('resolveTabAuth uses page when linked profile has missing auth field', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    const profile = makeProfile({ auth: undefined as unknown as GraphqlAuth | null });
    expect(resolveTabAuth(tab, profile, PAGE_DEFAULTS.auth)).toEqual(PAGE_DEFAULTS.auth);
  });

  it('resolveTabAuth preserves profile explicit null (No Auth)', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    const profile = makeProfile({ auth: null });
    expect(resolveTabAuth(tab, profile, PAGE_DEFAULTS.auth)).toBeNull();
  });

  it('resolveTabAuth falls through bare profile inherit to page default', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    const profile = makeProfile({ auth: { type: 'inherit' } });
    expect(resolveTabAuth(tab, profile, PAGE_DEFAULTS.auth)).toEqual(PAGE_DEFAULTS.auth);
  });

  it('resolveProfileAuthContribution falls through bare inherit and missing auth', () => {
    expect(resolveProfileAuthContribution(undefined, PAGE_DEFAULTS.auth)).toEqual(PAGE_DEFAULTS.auth);
    expect(
      resolveProfileAuthContribution(
        makeProfile({ auth: undefined as unknown as GraphqlAuth | null }),
        PAGE_DEFAULTS.auth,
      ),
    ).toEqual(PAGE_DEFAULTS.auth);
    expect(resolveProfileAuthContribution(makeProfile({ auth: null }), PAGE_DEFAULTS.auth)).toBeNull();
    expect(
      resolveProfileAuthContribution(makeProfile({ auth: { type: 'inherit' } }), PAGE_DEFAULTS.auth),
    ).toEqual(PAGE_DEFAULTS.auth);
    expect(
      resolveProfileAuthContribution(
        makeProfile({ auth: { type: 'inherit', globalProfileId: 'p1' } }),
        PAGE_DEFAULTS.auth,
      ),
    ).toEqual({ type: 'inherit', globalProfileId: 'p1' });
  });
});

describe('resolveTabConnection', () => {
  it('resolves auth from linked profile', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    const result = resolveTabConnection(tab, [makeProfile()], PAGE_DEFAULTS);
    expect(result.endpoint).toBe('https://staging.example/graphql');
    expect(result.auth).toEqual({ type: 'bearer', token: 'staging-token' });
    expect(result.profileName).toBe('Staging');
    expect(result.connectionId).toBe('prof-staging');
  });

  it('uses page auth when tab has no profile link', () => {
    const result = resolveTabConnection(makeTab(), [makeProfile()], PAGE_DEFAULTS);
    expect(result.auth).toEqual(PAGE_DEFAULTS.auth);
    expect(result.profileName).toBeUndefined();
  });

  it('uses page auth when profile link exists but profile was deleted', () => {
    const tab = makeTab({ connectionId: 'gone' });
    const result = resolveTabConnection(tab, [makeProfile()], PAGE_DEFAULTS);
    expect(result.auth).toEqual(PAGE_DEFAULTS.auth);
    expect(result.profileName).toBeUndefined();
    expect(result.connectionId).toBeUndefined();
  });

  it('Phase 6H: tab explicit bearer overrides linked profile auth', () => {
    const tab = makeTab({
      connectionId: 'prof-staging',
      auth: { type: 'bearer', token: 'tab-only' },
    });
    const result = resolveTabConnection(tab, [makeProfile()], PAGE_DEFAULTS);
    expect(result.auth).toEqual({ type: 'bearer', token: 'tab-only' });
    expect(result.profileName).toBe('Staging');
  });

  it('Phase 6H: tab explicit null overrides linked profile auth', () => {
    const tab = makeTab({ connectionId: 'prof-staging', auth: null });
    expect(resolveTabConnection(tab, [makeProfile()], PAGE_DEFAULTS).auth).toBeNull();
  });

  it('Phase 6H: profile explicit null overrides page auth when tab inherits workspace', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    const profile = makeProfile({ auth: null });
    expect(resolveTabConnection(tab, [profile], PAGE_DEFAULTS).auth).toBeNull();
  });

  it('Phase 6H: tab inherit-global overrides page default', () => {
    const tab = makeTab({ auth: { type: 'inherit', globalProfileId: 'env-prof' } });
    expect(resolveTabConnection(tab, [], PAGE_DEFAULTS).auth).toEqual({
      type: 'inherit',
      globalProfileId: 'env-prof',
    });
  });

  it('Phase 6H: bare tab inherit falls through to profile auth', () => {
    const tab = makeTab({ connectionId: 'prof-staging', auth: { type: 'inherit' } });
    expect(resolveTabConnection(tab, [makeProfile()], PAGE_DEFAULTS).auth).toEqual({
      type: 'bearer',
      token: 'staging-token',
    });
  });

  it('Phase 6H: bare profile inherit falls through to page auth in resolveTabConnection', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    const profile = makeProfile({ auth: { type: 'inherit' } });
    expect(resolveTabConnection(tab, [profile], PAGE_DEFAULTS).auth).toEqual(PAGE_DEFAULTS.auth);
  });

  it('inherits skipTlsVerify from tab override', () => {
    const tab = makeTab({ skipTlsVerify: true });
    expect(resolveTabConnection(tab, [], PAGE_DEFAULTS).skipTlsVerify).toBe(true);
  });

  it('computes pollingIntervalMs from page defaults when tab has no polling override', () => {
    const result = resolveTabConnection(makeTab(), [], {
      ...PAGE_DEFAULTS,
      pollingEnabled: true,
      pollingIntervalSeconds: 45,
    });
    expect(result.pollingEnabled).toBe(true);
    expect(result.pollingIntervalSeconds).toBe(45);
    expect(result.pollingIntervalMs).toBe(45000);
  });

  it('returns pollingIntervalMs 0 when polling disabled', () => {
    const result = resolveTabConnection(makeTab(), [], PAGE_DEFAULTS);
    expect(result.pollingIntervalMs).toBe(0);
  });

  it('uses tab polling overrides when set (Phase 6F)', () => {
    const tab = makeTab({ pollingEnabled: true, pollingIntervalSeconds: 15 });
    const result = resolveTabConnection(tab, [], PAGE_DEFAULTS);
    expect(result.pollingEnabled).toBe(true);
    expect(result.pollingIntervalSeconds).toBe(15);
    expect(result.pollingIntervalMs).toBe(15000);
  });

  it('tab pollingEnabled false overrides page polling on (Phase 6F)', () => {
    const tab = makeTab({ pollingEnabled: false });
    const result = resolveTabConnection(tab, [], {
      ...PAGE_DEFAULTS,
      pollingEnabled: true,
      pollingIntervalSeconds: 30,
    });
    expect(result.pollingEnabled).toBe(false);
    expect(result.pollingIntervalMs).toBe(0);
  });

  it('inherits page-level TLS PEM fields when tab has no cert override', () => {
    const result = resolveTabConnection(makeTab(), [], PAGE_DEFAULTS);
    expect(result.tlsCaCert).toBe('page-ca');
    expect(result.tlsClientCert).toBe('page-client');
    expect(result.tlsClientKey).toBe('page-key');
  });

  it('prefers tab TLS PEM overrides over page defaults', () => {
    const tab = makeTab({ tlsCaCert: 'tab-ca' });
    const result = resolveTabConnection(tab, [], PAGE_DEFAULTS);
    expect(result.tlsCaCert).toBe('tab-ca');
    expect(result.tlsClientCert).toBe('page-client');
  });
});

describe('resolveTabAuthSentSource', () => {
  it('returns tab when tab auth is overridden', () => {
    const tab = makeTab({ auth: { type: 'bearer', token: 'tab-only' } });
    expect(resolveTabAuthSentSource(tab, undefined, PAGE_DEFAULTS.auth)).toBe('tab');
  });

  it('returns profile when linked profile supplies explicit auth', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    expect(resolveTabAuthSentSource(tab, makeProfile(), PAGE_DEFAULTS.auth)).toBe('profile');
  });

  it('returns page when profile inherits workspace default', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    const profile = makeProfile({ auth: { type: 'inherit' } });
    expect(resolveTabAuthSentSource(tab, profile, PAGE_DEFAULTS.auth)).toBe('page');
  });

  it('returns profile when profile inherits a global auth profile', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    const profile = makeProfile({
      auth: { type: 'inherit', globalProfileId: 'global-1' },
    });
    expect(resolveTabAuthSentSource(tab, profile, PAGE_DEFAULTS.auth)).toBe('profile');
  });

  it('returns tab when tab inherits a global auth profile explicitly', () => {
    const tab = makeTab({
      auth: { type: 'inherit', globalProfileId: 'global-1' },
    });
    expect(resolveTabAuthSentSource(tab, undefined, PAGE_DEFAULTS.auth)).toBe('tab');
  });

  it('returns profile when profile explicitly disables auth', () => {
    const tab = makeTab({ connectionId: 'prof-staging' });
    const profile = makeProfile({ auth: null });
    expect(resolveTabAuthSentSource(tab, profile, PAGE_DEFAULTS.auth)).toBe('profile');
  });
});
