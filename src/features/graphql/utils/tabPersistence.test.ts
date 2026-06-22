/**
 * @vitest-environment jsdom
 * tabPersistence.test.ts — unit tests for tab localStorage utilities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  loadTabs,
  saveTabs,
  loadActiveTabId,
  loadAuth,
  saveAuth,
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
    for (const type of ['bearer', 'basic', 'apiKey', 'oauth2', 'custom'] as const) {
      await saveAuth({ type });
      expect((await loadAuth())!.type).toBe(type);
    }
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
