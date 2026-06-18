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
  normalizeTab,
  loadTabs,
  saveTabs,
  loadActiveTabId,
  loadAuth,
  saveAuth,
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
});

// ─── loadTabs / saveTabs ──────────────────────────────────────────────────────

describe('loadTabs / saveTabs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadTabs returns [] when localStorage is empty', () => {
    expect(loadTabs()).toEqual([]);
  });

  it('round-trips tabs through save/load', () => {
    const tab = makeTab('tab-1');
    saveTabs([tab], 'tab-1');
    const loaded = loadTabs();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('tab-1');
  });

  it('caps to MAX_TABS on load', () => {
    const tooMany = Array.from({ length: MAX_TABS + 3 }, (_, i) => makeTab(`tab-${i + 1}`));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tooMany));
    const loaded = loadTabs();
    expect(loaded).toHaveLength(MAX_TABS);
  });

  it('returns [] when JSON is malformed', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadTabs()).toEqual([]);
  });

  it('returns [] when stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'x' }));
    expect(loadTabs()).toEqual([]);
  });

  it('filters out invalid tabs', () => {
    const data = [{ id: 'good' }, { noId: true }, null, 42];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const loaded = loadTabs();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('good');
  });
});

// ─── loadActiveTabId ─────────────────────────────────────────────────────────

describe('loadActiveTabId', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty string when not set', () => {
    expect(loadActiveTabId()).toBe('');
  });

  it('returns stored active tab id', () => {
    saveTabs([makeTab('tab-42')], 'tab-42');
    expect(loadActiveTabId()).toBe('tab-42');
  });
});

// ─── loadAuth / saveAuth ──────────────────────────────────────────────────────

describe('loadAuth / saveAuth', () => {
  beforeEach(() => localStorage.clear());

  it('loadAuth returns null when nothing stored', () => {
    expect(loadAuth()).toBeNull();
  });

  it('round-trips bearer auth', () => {
    saveAuth({ type: 'bearer', token: 'my-token' });
    const auth = loadAuth();
    expect(auth).not.toBeNull();
    expect(auth!.type).toBe('bearer');
    expect(auth!.token).toBe('my-token');
  });

  it('returns null for unknown auth type', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ type: 'unknown' }));
    expect(loadAuth()).toBeNull();
  });

  it('saveAuth(null) removes stored auth', () => {
    saveAuth({ type: 'basic', username: 'u' });
    saveAuth(null);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(loadAuth()).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{bad json');
    expect(loadAuth()).toBeNull();
  });

  it('returns null for non-object JSON values', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '"just-a-string"');
    expect(loadAuth()).toBeNull();
  });

  it('accepts all valid auth types', () => {
    for (const type of ['bearer', 'basic', 'apiKey', 'oauth2', 'custom'] as const) {
      saveAuth({ type });
      expect(loadAuth()!.type).toBe(type);
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
