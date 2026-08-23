/**
 * @vitest-environment jsdom
 * tabPersistence.test.ts — unit tests for tab localStorage utilities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GraphqlAuth } from '@shared/types/graphql';

// monacoGraphqlSetup transitively loads Monaco which requires `window`. Mock it.
vi.mock('./monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql-vars/${id}`,
  extractOperations: vi.fn(() => []),
  deriveTabLabel: vi.fn(() => 'Untitled'),
  deriveOperationType: vi.fn(() => undefined),
  registerGraphqlLanguage: vi.fn(),
  getOrInitGraphqlMode: vi.fn(),
}));

import {
  generateTabId,
  advanceSeqPastRestoredIds,
  makeBlankTab,
  makeDemoTab,
  countUserTabs,
  isDemoTab,
  normalizeTab,
  normalizeGraphqlAuth,
  graphqlAuthEquals,
  computeTabAuthStoredValue,
  loadTabs,
  saveTabs,
  loadActiveTabId,
  loadAuth,
  saveAuth,
  capturePageAuthSnapshot,
  restorePageAuthSnapshot,
  stripDemoTabAuthOverride,
  normalizePageAuthSnapshot,
  saveDemoPriorPageAuthBackup,
  loadDemoPriorPageAuthBackup,
  clearDemoPriorPageAuthBackup,
  _DEMO_PRIOR_PAGE_AUTH_KEY,
  loadTlsCerts,
  saveTlsCerts,
  normalizeTlsCertsStorage,
  TLS_CERTS_STORAGE_KEY,
  MAX_TABS,
  STORAGE_KEY,
  AUTH_STORAGE_KEY,
  DEFAULT_QUERY,
  DEFAULT_VARS,
  disposeTabModels,
} from './tabPersistence';
import type { GqlStudioTab } from './tabPersistence';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTab(id: string, overrides: Partial<GqlStudioTab> = {}): GqlStudioTab {
  return {
    id,
    label: 'Test',
    modelUri: `inmemory://graphql/${id}`,
    query: DEFAULT_QUERY,
    variables: DEFAULT_VARS,
    headers: [],
    operationType: 'query',
    unsavedChanges: false,
    connectionId: undefined,
    ...overrides,
  };
}

// ─── generateTabId ────────────────────────────────────────────────────────────

describe('generateTabId', () => {
  it('returns a string starting with gql-tab-', () => {
    const id = generateTabId();
    expect(id).toMatch(/^gql-tab-\d+$/);
  });

  it('generates unique IDs on successive calls', () => {
    const ids = Array.from({ length: 5 }, () => generateTabId());
    const unique = new Set(ids);
    expect(unique.size).toBe(5);
  });
});

// ─── advanceSeqPastRestoredIds ────────────────────────────────────────────────

describe('advanceSeqPastRestoredIds', () => {
  it('does not crash on empty array', () => {
    expect(() => advanceSeqPastRestoredIds([])).not.toThrow();
  });

  it('advances the counter past non-matching IDs', () => {
    const tabs = [makeTab('other-id-1'), makeTab('other-id-2')];
    expect(() => advanceSeqPastRestoredIds(tabs)).not.toThrow();
    const nextId = generateTabId();
    expect(nextId).toMatch(/^gql-tab-\d+$/);
  });

  it('advances past restored gql-tab-N IDs so no collisions occur', () => {
    const highId = `gql-tab-999999`;
    advanceSeqPastRestoredIds([makeTab(highId)]);
    const nextId = generateTabId();
    const n = parseInt(nextId.replace('gql-tab-', ''), 10);
    expect(n).toBeGreaterThan(999999);
  });
});

// ─── makeBlankTab ─────────────────────────────────────────────────────────────

describe('makeBlankTab', () => {
  it('returns a tab with default values', () => {
    const tab = makeBlankTab();
    expect(tab.id).toMatch(/^gql-tab-\d+$/);
    expect(tab.label).toBe('Untitled');
    expect(tab.query).toBe(DEFAULT_QUERY);
    expect(tab.variables).toBe(DEFAULT_VARS);
    expect(tab.headers).toEqual([]);
    expect(tab.operationType).toBe('query');
    expect(tab.unsavedChanges).toBe(false);
    expect(tab.endpoint).toBeUndefined();
    expect(tab.skipTlsVerify).toBeUndefined();
  });

  it('returns unique IDs on each call', () => {
    const a = makeBlankTab();
    const b = makeBlankTab();
    expect(a.id).not.toBe(b.id);
  });

  it('builds modelUri from id', () => {
    const tab = makeBlankTab();
    expect(tab.modelUri).toBe(`inmemory://graphql/${tab.id}`);
  });
});

// ─── normalizeTab ─────────────────────────────────────────────────────────────

describe('normalizeTab', () => {
  it('returns null for non-objects', () => {
    expect(normalizeTab(null)).toBeNull();
    expect(normalizeTab(undefined)).toBeNull();
    expect(normalizeTab(42)).toBeNull();
    expect(normalizeTab('string')).toBeNull();
    expect(normalizeTab([])).toBeNull();
  });

  it('returns null when id is missing or empty', () => {
    expect(normalizeTab({})).toBeNull();
    expect(normalizeTab({ id: '' })).toBeNull();
    expect(normalizeTab({ id: 42 })).toBeNull();
  });

  it('returns a valid GqlStudioTab for a minimal object with id', () => {
    const result = normalizeTab({ id: 'tab-1' });
    expect(result).not.toBeNull();
    expect(result!.id).toBe('tab-1');
    expect(result!.label).toBe('Untitled');
    expect(result!.query).toBe(DEFAULT_QUERY);
    expect(result!.variables).toBe(DEFAULT_VARS);
    expect(result!.headers).toEqual([]);
    expect(result!.unsavedChanges).toBe(false);
  });

  it('preserves valid fields from the raw object', () => {
    const raw = {
      id: 'tab-2',
      label: 'GetUser',
      query: 'query { user }',
      variables: '{"id": "1"}',
      operationType: 'query',
      connectionId: 'conn-1',
      selectedOperation: 'GetUser',
    };
    const result = normalizeTab(raw);
    expect(result!.label).toBe('GetUser');
    expect(result!.query).toBe('query { user }');
    expect(result!.variables).toBe('{"id": "1"}');
    expect(result!.operationType).toBe('query');
    expect(result!.connectionId).toBe('conn-1');
    expect(result!.selectedOperation).toBe('GetUser');
  });

  it('normalizes invalid operationType to undefined', () => {
    const result = normalizeTab({ id: 't', operationType: 'invalid' });
    expect(result!.operationType).toBeUndefined();
  });

  it('accepts mutation and subscription as operationType', () => {
    expect(normalizeTab({ id: 't', operationType: 'mutation' })!.operationType).toBe('mutation');
    expect(normalizeTab({ id: 't', operationType: 'subscription' })!.operationType).toBe('subscription');
  });

  it('adds missing ids to header rows', () => {
    const raw = {
      id: 'tab-3',
      headers: [
        { key: 'Authorization', value: 'Bearer abc', enabled: true },
      ],
    };
    const result = normalizeTab(raw);
    expect(result!.headers[0].id).toBeTruthy();
    expect(result!.headers[0].key).toBe('Authorization');
  });

  it('always resets unsavedChanges to false', () => {
    const result = normalizeTab({ id: 't', unsavedChanges: true });
    expect(result!.unsavedChanges).toBe(false);
  });

  it('preserves responseSubTab when valid', () => {
    expect(normalizeTab({ id: 't', responseSubTab: 'metadata' })!.responseSubTab).toBe('metadata');
    expect(normalizeTab({ id: 't', responseSubTab: 'invalid' })!.responseSubTab).toBeUndefined();
  });

  // ── Phase 6: per-tab endpoint + TLS ─────────────────────────────────────────
  it('normalizes missing endpoint and skipTlsVerify to undefined (legacy tabs)', () => {
    const result = normalizeTab({ id: 'legacy-tab' });
    expect(result!.endpoint).toBeUndefined();
    expect(result!.skipTlsVerify).toBeUndefined();
  });

  it('preserves per-tab TLS PEM certificate fields', () => {
    const result = normalizeTab({
      id: 't',
      endpoint: 'https://localhost:4443/graphql',
      skipTlsVerify: true,
      tlsCaCert: '-----BEGIN CERTIFICATE-----\nabc',
      tlsClientCert: 'client-pem',
      tlsClientKey: 'client-key',
    });
    expect(result!.endpoint).toBe('https://localhost:4443/graphql');
    expect(result!.skipTlsVerify).toBe(true);
    expect(result!.tlsCaCert).toBe('-----BEGIN CERTIFICATE-----\nabc');
    expect(result!.tlsClientCert).toBe('client-pem');
    expect(result!.tlsClientKey).toBe('client-key');
  });

  it('strips blank TLS PEM fields on normalize', () => {
    const result = normalizeTab({ id: 't', tlsCaCert: '   ', tlsClientCert: '', tlsClientKey: '  ' });
    expect(result!.tlsCaCert).toBeUndefined();
    expect(result!.tlsClientCert).toBeUndefined();
    expect(result!.tlsClientKey).toBeUndefined();
  });

  it('preserves valid endpoint and skipTlsVerify overrides', () => {
    const result = normalizeTab({
      id: 't',
      endpoint: '  https://api.example.com/graphql  ',
      skipTlsVerify: true,
    });
    expect(result!.endpoint).toBe('https://api.example.com/graphql');
    expect(result!.skipTlsVerify).toBe(true);
  });

  it('preserves skipTlsVerify=false as an explicit override', () => {
    const result = normalizeTab({ id: 't', skipTlsVerify: false });
    expect(result!.skipTlsVerify).toBe(false);
  });

  it('normalizes blank endpoint string to undefined', () => {
    expect(normalizeTab({ id: 't', endpoint: '' })!.endpoint).toBeUndefined();
    expect(normalizeTab({ id: 't', endpoint: '   ' })!.endpoint).toBeUndefined();
  });

  it('ignores invalid endpoint and skipTlsVerify types', () => {
    const result = normalizeTab({
      id: 't',
      endpoint: 42,
      skipTlsVerify: 'true',
    });
    expect(result!.endpoint).toBeUndefined();
    expect(result!.skipTlsVerify).toBeUndefined();
  });

  it('normalizes polling overrides (Phase 6F)', () => {
    const result = normalizeTab({
      id: 't',
      pollingEnabled: true,
      pollingIntervalSeconds: 45,
    });
    expect(result!.pollingEnabled).toBe(true);
    expect(result!.pollingIntervalSeconds).toBe(45);
  });

  it('clamps pollingIntervalSeconds to 10–3600 on load (Phase 6F)', () => {
    expect(normalizeTab({ id: 't', pollingIntervalSeconds: 5 })!.pollingIntervalSeconds).toBe(10);
    expect(normalizeTab({ id: 't', pollingIntervalSeconds: 9999 })!.pollingIntervalSeconds).toBe(3600);
  });

  it('ignores invalid polling field types (Phase 6F)', () => {
    const result = normalizeTab({
      id: 't',
      pollingEnabled: 'true',
      pollingIntervalSeconds: '30',
    });
    expect(result!.pollingEnabled).toBeUndefined();
    expect(result!.pollingIntervalSeconds).toBeUndefined();
  });

  // ── subscriptionAssertions normalization ──────────────────────────────────
  it('normalizes undefined subscriptionAssertions to undefined', () => {
    const result = normalizeTab({ id: 't' });
    expect(result!.subscriptionAssertions).toBeUndefined();
  });

  it('normalizes an empty subscriptionAssertions array to empty array', () => {
    const result = normalizeTab({ id: 't', subscriptionAssertions: [] });
    expect(result!.subscriptionAssertions).toEqual([]);
  });

  it('preserves valid assertion objects', () => {
    const raw = {
      id: 't',
      subscriptionAssertions: [
        { id: 'a1', jsonPath: '$.user.name', operator: 'equals', expected: 'Alice', description: 'name check' },
      ],
    };
    const result = normalizeTab(raw);
    expect(result!.subscriptionAssertions).toEqual([
      { id: 'a1', jsonPath: '$.user.name', operator: 'equals', expected: 'Alice', description: 'name check' },
    ]);
  });

  it('filters out assertion entries missing id or jsonPath', () => {
    const raw = {
      id: 't',
      subscriptionAssertions: [
        { id: 'a1', jsonPath: '$.x', operator: 'equals', expected: '1', description: '' },
        { jsonPath: '$.y', operator: 'equals', expected: '2', description: '' },  // missing id
        { id: 'a3', operator: 'equals', expected: '3', description: '' },          // missing jsonPath
        null,
      ],
    };
    const result = normalizeTab(raw);
    expect(result!.subscriptionAssertions).toHaveLength(1);
    expect(result!.subscriptionAssertions![0].id).toBe('a1');
  });

  it('applies default operator when operator is missing or empty', () => {
    const raw = {
      id: 't',
      subscriptionAssertions: [
        { id: 'a1', jsonPath: '$.x', operator: '', expected: '', description: '' },
        { id: 'a2', jsonPath: '$.y', expected: '', description: '' },
      ],
    };
    const result = normalizeTab(raw);
    expect(result!.subscriptionAssertions![0].operator).toBe('is_not_null');
    expect(result!.subscriptionAssertions![1].operator).toBe('is_not_null');
  });

  it('defaults missing expected/description to empty string', () => {
    const raw = {
      id: 't',
      subscriptionAssertions: [
        { id: 'a1', jsonPath: '$.x', operator: 'equals' },
      ],
    };
    const result = normalizeTab(raw);
    expect(result!.subscriptionAssertions![0].expected).toBe('');
    expect(result!.subscriptionAssertions![0].description).toBe('');
  });

  it('preserves non-string expected values (typed as unknown)', () => {
    const raw = {
      id: 't',
      subscriptionAssertions: [
        { id: 'a1', jsonPath: '$.x', operator: 'equals', expected: 42 },
      ],
    };
    const result = normalizeTab(raw);
    // expected is typed as unknown — numeric value is preserved as-is
    expect(result!.subscriptionAssertions![0].expected).toBe(42);
  });
});

// ─── loadTabs / saveTabs ──────────────────────────────────────────────────────

describe('loadTabs / saveTabs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadTabs returns [] when localStorage is empty', async () => {
    expect(await loadTabs()).toEqual([]);
  });

  it('round-trips tabs through save/load', async () => {
    const tab = makeTab('tab-1');
    await saveTabs([tab], 'tab-1');
    const loaded = await loadTabs();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('tab-1');
  });

  it('round-trips Phase 6 endpoint and skipTlsVerify fields through save/load', async () => {
    const tab = makeTab('tab-1', {
      endpoint: 'https://staging.example.com/graphql',
      skipTlsVerify: true,
    });
    await saveTabs([tab], 'tab-1');
    const loaded = await loadTabs();
    expect(loaded[0].endpoint).toBe('https://staging.example.com/graphql');
    expect(loaded[0].skipTlsVerify).toBe(true);
  });

  it('legacy tabs without endpoint fields load with undefined overrides', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'legacy-1', label: 'Old' }]));
    const loaded = await loadTabs();
    expect(loaded[0].endpoint).toBeUndefined();
    expect(loaded[0].skipTlsVerify).toBeUndefined();
  });

  it('caps to MAX_TABS on load', async () => {
    const tooMany = Array.from({ length: MAX_TABS + 3 }, (_, i) => makeTab(`tab-${i + 1}`));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tooMany));
    const loaded = await loadTabs();
    expect(loaded).toHaveLength(MAX_TABS);
  });

  it('returns [] when JSON is malformed', async () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(await loadTabs()).toEqual([]);
  });

  it('returns [] when stored value is not an array', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'x' }));
    expect(await loadTabs()).toEqual([]);
  });

  it('filters out invalid tabs', async () => {
    const data = [{ id: 'good' }, { noId: true }, null, 42];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const loaded = await loadTabs();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('good');
  });
});

// ─── loadActiveTabId ─────────────────────────────────────────────────────────

describe('loadActiveTabId', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty string when not set', async () => {
    expect(await loadActiveTabId()).toBe('');
  });

  it('returns stored active tab id', async () => {
    await saveTabs([makeTab('tab-42')], 'tab-42');
    expect(await loadActiveTabId()).toBe('tab-42');
  });
});

// ─── loadAuth / saveAuth ──────────────────────────────────────────────────────

describe('loadAuth / saveAuth', () => {
  beforeEach(() => localStorage.clear());

  it('loadAuth returns null when nothing stored', async () => {
    expect(await loadAuth()).toBeNull();
  });

  it('round-trips bearer auth', async () => {
    await saveAuth({ type: 'bearer', token: 'my-token' });
    const auth = await loadAuth();
    expect(auth).not.toBeNull();
    expect(auth!.type).toBe('bearer');
    expect(auth!.token).toBe('my-token');
  });

  it('returns null for unknown auth type', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ type: 'unknown' }));
    expect(await loadAuth()).toBeNull();
  });

  it('saveAuth(null) removes stored auth', async () => {
    await saveAuth({ type: 'basic', username: 'u' });
    await saveAuth(null);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(await loadAuth()).toBeNull();
  });

  it('returns null for malformed JSON', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{bad json');
    expect(await loadAuth()).toBeNull();
  });

  it('returns null for non-object JSON values', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '"just-a-string"');
    expect(await loadAuth()).toBeNull();
  });

  it('accepts all valid auth types', async () => {
    for (const type of ['inherit', 'bearer', 'basic', 'apiKey', 'oauth2', 'custom'] as const) {
      await saveAuth({ type });
      expect((await loadAuth())!.type).toBe(type);
    }
  });

  it('round-trips inherit auth with globalProfileId', async () => {
    await saveAuth({ type: 'inherit', globalProfileId: 'prof-env-1' });
    expect(await loadAuth()).toEqual({ type: 'inherit', globalProfileId: 'prof-env-1' });
  });
});

describe('capturePageAuthSnapshot / restorePageAuthSnapshot (Phase 6H Slice 6)', () => {
  beforeEach(async () => {
    await saveAuth(null);
  });

  it('capturePageAuthSnapshot returns stored:false when key absent', async () => {
    expect(await capturePageAuthSnapshot()).toEqual({ stored: false });
  });

  it('capturePageAuthSnapshot captures bearer auth', async () => {
    await saveAuth({ type: 'bearer', token: 'before-lesson' });
    expect(await capturePageAuthSnapshot()).toEqual({
      stored: true,
      auth: { type: 'bearer', token: 'before-lesson' },
    });
  });

  it('restorePageAuthSnapshot restores prior bearer and clears when absent', async () => {
    const snapshot = { stored: true as const, auth: { type: 'bearer' as const, token: 'orig' } };
    await saveAuth({ type: 'apiKey', headerName: 'X', headerValue: 'lesson' });
    await restorePageAuthSnapshot(snapshot);
    expect(await loadAuth()).toEqual({ type: 'bearer', token: 'orig' });

    await restorePageAuthSnapshot({ stored: false });
    expect(await loadAuth()).toBeNull();
  });

  it('restorePageAuthSnapshot is a no-op when snapshot is undefined', async () => {
    await saveAuth({ type: 'bearer', token: 'keep-me' });
    await restorePageAuthSnapshot(undefined);
    expect(await loadAuth()).toEqual({ type: 'bearer', token: 'keep-me' });
  });
});

describe('normalizePageAuthSnapshot / demo prior-page-auth backup', () => {
  beforeEach(async () => {
    await clearDemoPriorPageAuthBackup();
    await saveAuth(null);
  });

  it('normalizePageAuthSnapshot accepts stored:false and bearer auth', () => {
    expect(normalizePageAuthSnapshot({ stored: false })).toEqual({ stored: false });
    expect(
      normalizePageAuthSnapshot({ stored: true, auth: { type: 'bearer', token: 'x' } }),
    ).toEqual({ stored: true, auth: { type: 'bearer', token: 'x' } });
    expect(normalizePageAuthSnapshot({ stored: true, auth: null })).toEqual({
      stored: true,
      auth: null,
    });
    expect(normalizePageAuthSnapshot({ stored: true })).toBeUndefined();
  });

  it('round-trips demo prior-page-auth backup', async () => {
    const snapshot = { stored: true as const, auth: { type: 'inherit' as const, globalProfileId: 'p1' } };
    await saveDemoPriorPageAuthBackup(snapshot);
    expect(await loadDemoPriorPageAuthBackup()).toEqual(snapshot);
    await clearDemoPriorPageAuthBackup();
    expect(await loadDemoPriorPageAuthBackup()).toBeUndefined();
  });
});

describe('stripDemoTabAuthOverride (Phase 6H Slice 6)', () => {
  it('strips auth from demo tabs only when override is set', () => {
    const demo = makeDemoTab('gql-multi-tab', 'Demo: Multi');
    const withAuth = { ...demo, auth: { type: 'bearer' as const, token: 'x' } };
    expect(stripDemoTabAuthOverride(withAuth).auth).toBeUndefined();
    expect(stripDemoTabAuthOverride(demo)).toBe(demo);
    expect(stripDemoTabAuthOverride(makeTab('user-1', {
      auth: { type: 'bearer', token: 'x' },
    })).auth).toEqual({ type: 'bearer', token: 'x' });
  });
});

describe('graphqlAuthEquals / computeTabAuthStoredValue (Phase 6H Slice 2)', () => {
  it('graphqlAuthEquals treats null and matching bearer as equal', () => {
    expect(graphqlAuthEquals(null, null)).toBe(true);
    expect(graphqlAuthEquals({ type: 'bearer', token: 'x' }, { type: 'bearer', token: 'x' })).toBe(true);
    expect(graphqlAuthEquals({ type: 'bearer', token: 'x' }, { type: 'bearer', token: 'y' })).toBe(false);
  });

  it('graphqlAuthEquals compares basic, apiKey, inherit, and oauth2 configs', () => {
    const bearer = { type: 'bearer' as const, token: 't' };
    expect(graphqlAuthEquals(bearer, bearer)).toBe(true);

    expect(graphqlAuthEquals(
      { type: 'basic', username: 'u', password: 'p' },
      { type: 'basic', username: 'u', password: 'p' },
    )).toBe(true);
    expect(graphqlAuthEquals(
      { type: 'basic', username: 'u', password: 'p' },
      { type: 'basic', username: 'u', password: 'x' },
    )).toBe(false);

    expect(graphqlAuthEquals(
      { type: 'apiKey', headerName: 'X-Key', headerValue: 'v' },
      { type: 'apiKey', headerName: 'X-Key', headerValue: 'v' },
    )).toBe(true);
    expect(graphqlAuthEquals(
      { type: 'apiKey', headerName: 'X-Key', headerValue: 'v' },
      { type: 'apiKey', headerName: 'X-Other', headerValue: 'v' },
    )).toBe(false);

    expect(graphqlAuthEquals(
      { type: 'inherit', globalProfileId: 'p1' },
      { type: 'inherit', globalProfileId: 'p1' },
    )).toBe(true);
    expect(graphqlAuthEquals(
      { type: 'inherit', globalProfileId: 'p1' },
      { type: 'inherit', globalProfileId: 'p2' },
    )).toBe(false);

    const oauth = {
      type: 'oauth2' as const,
      oauth2: { tokenUrl: 'https://auth/token', clientId: 'id', clientSecret: 'sec' },
    };
    expect(graphqlAuthEquals(oauth, { ...oauth })).toBe(true);
    expect(graphqlAuthEquals(oauth, {
      ...oauth,
      oauth2: { ...oauth.oauth2, clientSecret: 'other' },
    })).toBe(false);

    expect(graphqlAuthEquals(null, { type: 'bearer', token: 'x' })).toBe(false);
    expect(graphqlAuthEquals({ type: 'bearer', token: 'x' }, null)).toBe(false);
    expect(graphqlAuthEquals(
      { type: 'bearer', token: 'x' },
      { type: 'basic', username: 'u', password: 'p' },
    )).toBe(false);
  });

  it('computeTabAuthStoredValue omits field when auth matches page default', () => {
    const page = { type: 'bearer' as const, token: 'page' };
    expect(computeTabAuthStoredValue(page, page)).toBeUndefined();
  });

  it('computeTabAuthStoredValue stores null when page has bearer (explicit No Auth)', () => {
    expect(computeTabAuthStoredValue(null, { type: 'bearer', token: 'page' })).toBeNull();
  });

  it('computeTabAuthStoredValue stores null when page is also null (explicit tab override)', () => {
    expect(computeTabAuthStoredValue(null, null)).toBeNull();
  });

  it('computeTabAuthStoredValue omits bare inherit (inherit workspace)', () => {
    expect(computeTabAuthStoredValue({ type: 'inherit' }, { type: 'bearer', token: 'p' })).toBeUndefined();
  });

  it('computeTabAuthStoredValue stores inherit-global override', () => {
    expect(
      computeTabAuthStoredValue(
        { type: 'inherit', globalProfileId: 'prof-1' },
        { type: 'bearer', token: 'p' },
      ),
    ).toEqual({ type: 'inherit', globalProfileId: 'prof-1' });
  });
});

describe('normalizeGraphqlAuth (Phase 6H)', () => {
  it('returns null for explicit null', () => {
    expect(normalizeGraphqlAuth(null)).toBeNull();
  });

  it('returns undefined for invalid type', () => {
    expect(normalizeGraphqlAuth({ type: 'unknown' })).toBeUndefined();
    expect(normalizeGraphqlAuth('string')).toBeUndefined();
  });

  it('normalizes inherit with optional globalProfileId', () => {
    expect(normalizeGraphqlAuth({ type: 'inherit' })).toEqual({ type: 'inherit' });
    expect(normalizeGraphqlAuth({ type: 'inherit', globalProfileId: '  p1  ' })).toEqual({
      type: 'inherit',
      globalProfileId: 'p1',
    });
  });

  it('normalizes bearer token fields', () => {
    expect(normalizeGraphqlAuth({ type: 'bearer', token: 'tok' })).toEqual({
      type: 'bearer',
      token: 'tok',
    });
  });

  it('ignores non-string optional auth fields and normalizes oauth2 defaults', () => {
    expect(normalizeGraphqlAuth({
      type: 'bearer',
      token: 123,
      username: null,
      headerName: undefined,
    } as unknown as GraphqlAuth)).toEqual({ type: 'bearer' });

    expect(normalizeGraphqlAuth({
      type: 'oauth2',
      oauth2: { tokenUrl: 1, clientId: null, clientSecret: 'sec', scope: 42, audience: true },
    } as unknown as GraphqlAuth)).toEqual({
      type: 'oauth2',
      oauth2: { tokenUrl: '', clientId: '', clientSecret: 'sec' },
    });
  });
});

describe('normalizeTab auth (Phase 6H)', () => {
  it('omits auth when field absent (inherit workspace)', () => {
    expect(normalizeTab({ id: 't1' })!.auth).toBeUndefined();
  });

  it('preserves explicit null No Auth override', () => {
    expect(normalizeTab({ id: 't1', auth: null })!.auth).toBeNull();
  });

  it('round-trips tab bearer auth through loadTabs', async () => {
    const tab = makeTab('t-auth', { auth: { type: 'bearer', token: 'tab-tok' } });
    await saveTabs([tab], 't-auth');
    const loaded = await loadTabs();
    expect(loaded[0].auth).toEqual({ type: 'bearer', token: 'tab-tok' });
  });

  it('round-trips tab auth null through loadTabs', async () => {
    const tab = makeTab('t-noauth', { auth: null });
    await saveTabs([tab], 't-noauth');
    expect((await loadTabs())[0].auth).toBeNull();
  });

  it('strips bare inherit on tab through loadTabs round-trip', async () => {
    const tab = makeTab('t-inherit', { auth: { type: 'inherit' } });
    await saveTabs([tab], 't-inherit');
    expect((await loadTabs())[0].auth).toBeUndefined();
  });

  it('drops invalid auth object (falls back to inherit workspace)', () => {
    expect(normalizeTab({ id: 't1', auth: { type: 'bogus' } })!.auth).toBeUndefined();
  });

  it('drops bare inherit on tab (inherit workspace — not a tab override)', () => {
    expect(normalizeTab({ id: 't1', auth: { type: 'inherit' } })!.auth).toBeUndefined();
  });

  it('preserves inherit-global on tab when globalProfileId set', () => {
    expect(normalizeTab({ id: 't1', auth: { type: 'inherit', globalProfileId: 'p1' } })!.auth).toEqual({
      type: 'inherit',
      globalProfileId: 'p1',
    });
  });
});

// ─── disposeTabModels ─────────────────────────────────────────────────────────

describe('disposeTabModels', () => {
  it('calls dispose on both query and vars models', () => {
    const disposeQuery = vi.fn();
    const disposeVars = vi.fn();
    const mc = {
      Uri: { parse: (s: string) => s },
      editor: {
        getModel: (uri: string) =>
          uri.includes('graphql-vars') ? { dispose: disposeVars } : { dispose: disposeQuery },
      },
    } as unknown as Parameters<typeof disposeTabModels>[0];

    const tab = makeTab('tab-x');
    disposeTabModels(mc, tab);
    expect(disposeQuery).toHaveBeenCalled();
    expect(disposeVars).toHaveBeenCalled();
  });

  it('does not throw when models do not exist', () => {
    const mc = {
      Uri: { parse: (s: string) => s },
      editor: { getModel: () => null },
    } as unknown as Parameters<typeof disposeTabModels>[0];
    expect(() => disposeTabModels(mc, makeTab('tab-y'))).not.toThrow();
  });

  it('does not throw when Monaco Uri.parse throws', () => {
    const mc = {
      Uri: { parse: () => { throw new Error('invalid URI'); } },
      editor: { getModel: vi.fn() },
    } as unknown as Parameters<typeof disposeTabModels>[0];
    expect(() => disposeTabModels(mc, makeTab('tab-z'))).not.toThrow();
  });
});

// ─── Demo tab helpers (§11.0) ─────────────────────────────────────────────────

describe('makeDemoTab', () => {
  it('creates a tab tagged with demoLessonId and manual label', () => {
    const tab = makeDemoTab('gql-first-query', 'Demo: First Query');
    expect(tab.demoLessonId).toBe('gql-first-query');
    expect(tab.label).toBe('Demo: First Query');
    expect(tab.labelManual).toBe(true);
    expect(tab.unsavedChanges).toBe(false);
  });
});

describe('countUserTabs / isDemoTab', () => {
  it('counts only non-demo tabs', () => {
    const user = makeTab('u1');
    const demo = makeTab('d1', { demoLessonId: 'lesson-a' });
    expect(isDemoTab(demo)).toBe(true);
    expect(isDemoTab(user)).toBe(false);
    expect(countUserTabs([user, demo])).toBe(1);
  });
});

describe('normalizeTab demoLessonId', () => {
  it('preserves demoLessonId when valid', () => {
    const tab = normalizeTab({ ...makeTab('x'), demoLessonId: 'gql-first-query' });
    expect(tab.demoLessonId).toBe('gql-first-query');
  });

  it('drops empty demoLessonId', () => {
    const tab = normalizeTab({ ...makeTab('x'), demoLessonId: '  ' });
    expect(tab.demoLessonId).toBeUndefined();
  });
});

describe('page-level TLS cert persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizeTlsCertsStorage trims PEM fields', () => {
    expect(normalizeTlsCertsStorage({
      caCert: '  pem  ',
      clientCert: '',
      clientKey: '   ',
    })).toEqual({ caCert: 'pem' });
  });

  it('round-trips CA and mTLS PEM via saveTlsCerts/loadTlsCerts', async () => {
    await saveTlsCerts({
      caCert: '-----BEGIN CERTIFICATE-----\nca',
      clientCert: '-----BEGIN CERTIFICATE-----\nclient',
      clientKey: '-----BEGIN PRIVATE KEY-----\nkey',
    });
    const loaded = await loadTlsCerts();
    expect(loaded.caCert).toContain('BEGIN CERTIFICATE');
    expect(loaded.clientCert).toContain('BEGIN CERTIFICATE');
    expect(loaded.clientKey).toContain('BEGIN PRIVATE KEY');
    expect(localStorage.getItem(TLS_CERTS_STORAGE_KEY)).toBeTruthy();
  });

  it('saveTlsCerts removes storage key when all fields cleared', async () => {
    await saveTlsCerts({ caCert: 'pem' });
    await saveTlsCerts({});
    expect(localStorage.getItem(TLS_CERTS_STORAGE_KEY)).toBeNull();
  });
});
