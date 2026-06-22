import { describe, it, expect } from 'vitest';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { ConnectionProfile } from './connectionProfileStorage';
import type { GqlStudioTab } from './tabPersistence';
import {
  findProfileById,
  isTabProfileLinked,
  isTabProfileLinkPending,
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

  it('treats blank tab.endpoint as inherit page default', () => {
    const tab = makeTab({ endpoint: '   ' });
    expect(resolveTabRawEndpoint(tab, [], PAGE_DEFAULTS.endpoint))
      .toBe('https://page.example/graphql');
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
