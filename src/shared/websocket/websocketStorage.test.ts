/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadWsProfiles, saveWsProfiles,
  loadWsTemplates, saveWsTemplates,
  loadWsTabState, saveWsTabState,
  loadWsHistory, saveWsHistory,
  loadWsFilterPresets, saveWsFilterPresets,
  loadWsSchemas, saveWsSchemas,
  loadMockRules, saveMockRules,
  loadMockConfig, saveMockConfig,
  WS_PROFILES_KEY, WS_TEMPLATES_KEY,
  WS_TAB_STATE_KEY, WS_HISTORY_KEY,
  WS_FILTER_PRESETS_KEY, WS_SCHEMAS_KEY,
  WS_MOCK_RULES_KEY, WS_MOCK_CONFIG_KEY,
  MAX_HISTORY_ENTRIES, MAX_FILTER_PRESETS, MAX_SCHEMAS_STORED,
} from './websocketStorage';
import type { WsPersistedTabState, WsConnectionHistoryEntry, WsFilterPreset, WsMockRule } from './types';
import * as storage from '../utils/storage';

vi.mock('../utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
}));

const mockRead = vi.mocked(storage.readKey);
const mockWrite = vi.mocked(storage.writeKey);

beforeEach(() => {
  vi.clearAllMocks();
  mockWrite.mockResolvedValue(undefined);
});

describe('websocketStorage — profiles', () => {
  it('returns empty array when no data stored', async () => {
    mockRead.mockResolvedValue(null);
    expect(await loadWsProfiles()).toEqual([]);
    expect(mockRead).toHaveBeenCalledWith(WS_PROFILES_KEY);
  });

  it('parses valid profiles', async () => {
    const profile = {
      id: 'p1', name: 'Test', url: 'wss://test.com',
      headers: [], queryParams: [], subprotocols: '',
      autoReconnect: false, maxReconnectAttempts: 5,
      reconnectIntervalMs: 3000, maxMessages: 1000,
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    mockRead.mockResolvedValue(JSON.stringify([profile]));
    const result = await loadWsProfiles();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].url).toBe('wss://test.com');
  });

  it('filters out invalid entries', async () => {
    const valid = { id: 'p1', name: 'Good', url: 'wss://ok' };
    const invalid = { id: 123, name: 'Bad' };
    mockRead.mockResolvedValue(JSON.stringify([valid, invalid, null, 'string']));
    const result = await loadWsProfiles();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Good');
  });

  it('returns empty for malformed JSON', async () => {
    mockRead.mockResolvedValue('not json');
    expect(await loadWsProfiles()).toEqual([]);
  });

  it('returns empty for non-array JSON', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ id: 'obj' }));
    expect(await loadWsProfiles()).toEqual([]);
  });

  it('saves profiles', async () => {
    const profiles = [{ id: 'p1', name: 'T', url: 'wss://t' }];
    await saveWsProfiles(profiles as never[]);
    expect(mockWrite).toHaveBeenCalledWith(WS_PROFILES_KEY, JSON.stringify(profiles));
  });

  it('normalizes a profile with invalid/missing optional fields to safe defaults', async () => {
    const profile = {
      id: 'p1', name: 'N', url: 'ws://x',
      headers: 'bad', queryParams: 42, subprotocols: 99,
      protocolMode: 'invalid', autoReconnect: 'no',
      maxReconnectAttempts: NaN, reconnectIntervalMs: 'x',
      backoffMultiplier: 99, maxMessages: Infinity,
      notes: 42,
    };
    mockRead.mockResolvedValue(JSON.stringify([profile]));
    const result = await loadWsProfiles();
    expect(result).toHaveLength(1);
    const p = result[0];
    expect(p.headers).toEqual([]);
    expect(p.queryParams).toEqual([]);
    expect(p.subprotocols).toBe('');
    expect(p.protocolMode).toBe('auto');
    expect(p.autoReconnect).toBe(false);
    // NaN is typeof 'number' → clampInt returns the fallback (5).
    expect(p.maxReconnectAttempts).toBe(5);
    // Non-number string → fallback (3000).
    expect(p.reconnectIntervalMs).toBe(3000);
    // 99 is not a valid backoff multiplier → undefined.
    expect(p.backoffMultiplier).toBeUndefined();
    // Infinity is typeof 'number' → clampInt returns the fallback (1000).
    expect(p.maxMessages).toBe(1000);
    expect(p.notes).toBe('');
    expect(typeof p.createdAt).toBe('string');
    expect(typeof p.updatedAt).toBe('string');
  });

  it('clamps out-of-range numeric profile fields into their valid ranges', async () => {
    const profile = {
      id: 'p1', name: 'N', url: 'ws://x',
      maxReconnectAttempts: 999, reconnectIntervalMs: 10, maxMessages: 99999999,
      backoffMultiplier: 1.5,
    };
    mockRead.mockResolvedValue(JSON.stringify([profile]));
    const p = (await loadWsProfiles())[0];
    expect(p.maxReconnectAttempts).toBe(50); // clamped to max
    expect(p.reconnectIntervalMs).toBe(500); // clamped to min
    expect(p.maxMessages).toBe(50000); // clamped to max
    expect(p.backoffMultiplier).toBe(1.5); // valid → preserved
  });
});

describe('websocketStorage — templates', () => {
  it('returns empty array when no data stored', async () => {
    mockRead.mockResolvedValue(null);
    expect(await loadWsTemplates()).toEqual([]);
    expect(mockRead).toHaveBeenCalledWith(WS_TEMPLATES_KEY);
  });

  it('parses valid templates', async () => {
    const template = {
      id: 't1', name: 'Hello', body: '{"msg":"hi"}', format: 'json',
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    mockRead.mockResolvedValue(JSON.stringify([template]));
    const result = await loadWsTemplates();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Hello');
  });

  it('filters out invalid template entries', async () => {
    const valid = { id: 't1', name: 'ok', body: 'test' };
    const missing = { id: 't2', name: 'missing body' };
    mockRead.mockResolvedValue(JSON.stringify([valid, missing]));
    const result = await loadWsTemplates();
    expect(result).toHaveLength(1);
  });

  it('saves templates', async () => {
    const templates = [{ id: 't1', name: 'T', body: 'hi' }];
    await saveWsTemplates(templates as never[]);
    expect(mockWrite).toHaveBeenCalledWith(WS_TEMPLATES_KEY, JSON.stringify(templates));
  });
});

describe('websocketStorage — tab state', () => {
  it('returns null when no data stored', async () => {
    mockRead.mockResolvedValue(null);
    expect(await loadWsTabState()).toBeNull();
    expect(mockRead).toHaveBeenCalledWith(WS_TAB_STATE_KEY);
  });

  it('returns null for malformed JSON', async () => {
    mockRead.mockResolvedValue('not-json');
    expect(await loadWsTabState()).toBeNull();
  });

  it('returns null for non-object JSON', async () => {
    mockRead.mockResolvedValue('"string"');
    expect(await loadWsTabState()).toBeNull();
  });

  it('returns null when tabs array is empty after validation', async () => {
    mockRead.mockResolvedValue(JSON.stringify({
      tabs: [{ id: 123, label: 'bad' }],
      activeTabId: 'x',
    }));
    expect(await loadWsTabState()).toBeNull();
  });

  it('parses valid tab state', async () => {
    const state: WsPersistedTabState = {
      tabs: [
        { id: 'ws-tab-1', label: 'Tab 1', url: 'ws://localhost:8765', viewTab: 'connect' },
        { id: 'ws-tab-2', label: 'Tab 2', url: 'wss://echo.ws.org', viewTab: 'messages' },
      ],
      activeTabId: 'ws-tab-2',
      renamedTabIds: ['ws-tab-1'],
    };
    mockRead.mockResolvedValue(JSON.stringify(state));
    const result = await loadWsTabState();
    expect(result).not.toBeNull();
    expect(result!.tabs).toHaveLength(2);
    expect(result!.activeTabId).toBe('ws-tab-2');
    expect(result!.renamedTabIds).toEqual(['ws-tab-1']);
  });

  it('falls back to first tab when activeTabId is not in tabs', async () => {
    const state = {
      tabs: [{ id: 'ws-tab-1', label: 'A', url: '', viewTab: 'connect' }],
      activeTabId: 'nonexistent',
      renamedTabIds: [],
    };
    mockRead.mockResolvedValue(JSON.stringify(state));
    const result = await loadWsTabState();
    expect(result!.activeTabId).toBe('ws-tab-1');
  });

  it('filters out tabs with invalid viewTab', async () => {
    const state = {
      tabs: [
        { id: 'ws-tab-1', label: 'OK', url: '', viewTab: 'connect' },
        { id: 'ws-tab-2', label: 'Bad', url: '', viewTab: 'invalid' },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    };
    mockRead.mockResolvedValue(JSON.stringify(state));
    const result = await loadWsTabState();
    expect(result!.tabs).toHaveLength(1);
    expect(result!.tabs[0].id).toBe('ws-tab-1');
  });

  it('saves tab state', async () => {
    const state: WsPersistedTabState = {
      tabs: [{ id: 'ws-tab-1', label: 'T', url: 'ws://x', viewTab: 'connect' }],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    };
    await saveWsTabState(state);
    expect(mockWrite).toHaveBeenCalledWith(WS_TAB_STATE_KEY, JSON.stringify(state));
  });

  // ── Phase 1 studio-layout migration ──────────────────────────────
  it('derives studio-layout fields from a legacy viewTab-only blob', async () => {
    const state = {
      tabs: [
        { id: 'ws-tab-1', label: 'Connect', url: '', viewTab: 'connect' },
        { id: 'ws-tab-2', label: 'Messages', url: '', viewTab: 'messages' },
        { id: 'ws-tab-3', label: 'Saved', url: '', viewTab: 'saved' },
        { id: 'ws-tab-4', label: 'Mock', url: '', viewTab: 'mock' },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    };
    mockRead.mockResolvedValue(JSON.stringify(state));
    const result = await loadWsTabState();
    expect(result!.tabs[0]).toMatchObject({ mode: 'client', leftTab: 'connect', rightTab: 'events' });
    expect(result!.tabs[1]).toMatchObject({ mode: 'client', leftTab: 'compose', rightTab: 'events' });
    expect(result!.tabs[2]).toMatchObject({ mode: 'saved', leftTab: 'compose', rightTab: 'events' });
    expect(result!.tabs[3]).toMatchObject({ mode: 'mock', leftTab: 'compose', rightTab: 'events' });
  });

  it('preserves present-and-valid studio-layout fields', async () => {
    const state = {
      tabs: [
        { id: 'ws-tab-1', label: 'T', url: '', viewTab: 'connect', mode: 'mock', leftTab: 'auth', rightTab: 'stats' },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    };
    mockRead.mockResolvedValue(JSON.stringify(state));
    const result = await loadWsTabState();
    expect(result!.tabs[0]).toMatchObject({ mode: 'mock', leftTab: 'auth', rightTab: 'stats' });
  });

  it('falls back to derived values when a studio-layout field is invalid', async () => {
    const state = {
      tabs: [
        { id: 'ws-tab-1', label: 'T', url: '', viewTab: 'messages', mode: 'bogus', leftTab: 42, rightTab: 'stats' },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    };
    mockRead.mockResolvedValue(JSON.stringify(state));
    const result = await loadWsTabState();
    // invalid mode/leftTab derive from viewTab 'messages'; valid rightTab kept
    expect(result!.tabs[0]).toMatchObject({ mode: 'client', leftTab: 'compose', rightTab: 'stats' });
  });

  it('round-trips studio-layout fields through save + load', async () => {
    const state: WsPersistedTabState = {
      tabs: [
        { id: 'ws-tab-1', label: 'T', url: 'ws://x', viewTab: 'mock', mode: 'mock', leftTab: 'connect', rightTab: 'schema' },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    };
    await saveWsTabState(state);
    const written = mockWrite.mock.calls.at(-1)![1] as string;
    mockRead.mockResolvedValue(written);
    const result = await loadWsTabState();
    expect(result!.tabs[0]).toMatchObject({ viewTab: 'mock', mode: 'mock', leftTab: 'connect', rightTab: 'schema' });
  });

  // ── Phase 8 draft-field sanitization ─────────────────────────────
  it('sanitizes persisted headers/queryParams: drops non-objects and coerces bad fields', async () => {
    const state = {
      tabs: [
        {
          id: 'ws-tab-1', label: 'T', url: 'ws://x', viewTab: 'connect',
          headers: [
            { key: 'Authorization', value: 'Bearer t', enabled: false },
            { key: 123, value: 456, enabled: 'yes' },
            'not-an-object',
            null,
          ],
          queryParams: [{ key: 'q', value: '1', enabled: true }],
        },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    };
    mockRead.mockResolvedValue(JSON.stringify(state));
    const result = await loadWsTabState();
    // Two object entries survive the filter; the string + null are dropped.
    expect(result!.tabs[0].headers).toEqual([
      { key: 'Authorization', value: 'Bearer t', enabled: false },
      { key: '', value: '', enabled: true },
    ]);
    expect(result!.tabs[0].queryParams).toEqual([{ key: 'q', value: '1', enabled: true }]);
  });

  it('defaults non-array headers/queryParams to empty arrays', async () => {
    const state = {
      tabs: [
        { id: 'ws-tab-1', label: 'T', url: 'ws://x', viewTab: 'connect', headers: 'bad', queryParams: 42 },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    };
    mockRead.mockResolvedValue(JSON.stringify(state));
    const result = await loadWsTabState();
    expect(result!.tabs[0].headers).toEqual([]);
    expect(result!.tabs[0].queryParams).toEqual([]);
  });

  it('keeps a valid persisted auth config and drops invalid ones', async () => {
    const state = {
      tabs: [
        { id: 'ws-tab-1', label: 'Good', url: 'ws://x', viewTab: 'connect', auth: { type: 'bearer', token: 't' } },
        { id: 'ws-tab-2', label: 'BadType', url: 'ws://x', viewTab: 'connect', auth: { type: 'weird' } },
        { id: 'ws-tab-3', label: 'NotObj', url: 'ws://x', viewTab: 'connect', auth: 'nope' },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    };
    mockRead.mockResolvedValue(JSON.stringify(state));
    const result = await loadWsTabState();
    expect(result!.tabs[0].auth).toEqual({ type: 'bearer', token: 't' });
    expect(result!.tabs[1].auth).toBeUndefined();
    expect(result!.tabs[2].auth).toBeUndefined();
  });

  it('defaults non-string subprotocols to an empty string', async () => {
    const state = {
      tabs: [
        { id: 'ws-tab-1', label: 'T', url: 'ws://x', viewTab: 'connect', subprotocols: 123 },
      ],
      activeTabId: 'ws-tab-1',
      renamedTabIds: [],
    };
    mockRead.mockResolvedValue(JSON.stringify(state));
    const result = await loadWsTabState();
    expect(result!.tabs[0].subprotocols).toBe('');
  });
});

describe('websocketStorage — history', () => {
  it('returns empty array when no data stored', async () => {
    mockRead.mockResolvedValue(null);
    expect(await loadWsHistory()).toEqual([]);
    expect(mockRead).toHaveBeenCalledWith(WS_HISTORY_KEY);
  });

  it('parses valid history entries', async () => {
    const entry: WsConnectionHistoryEntry = {
      url: 'ws://localhost:8765',
      protocol: 'auto',
      lastUsed: '2025-01-01T00:00:00Z',
      connectCount: 3,
    };
    mockRead.mockResolvedValue(JSON.stringify([entry]));
    const result = await loadWsHistory();
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('ws://localhost:8765');
    expect(result[0].connectCount).toBe(3);
  });

  it('filters out invalid entries', async () => {
    const valid: WsConnectionHistoryEntry = {
      url: 'ws://ok', protocol: 'auto', lastUsed: '2025-01-01', connectCount: 1,
    };
    const invalid = { url: 'ws://bad' };
    mockRead.mockResolvedValue(JSON.stringify([valid, invalid, null]));
    const result = await loadWsHistory();
    expect(result).toHaveLength(1);
  });

  it('saves history and trims to max entries', async () => {
    const entries: WsConnectionHistoryEntry[] = Array.from({ length: 25 }, (_, i) => ({
      url: `ws://host${i}`, protocol: 'auto', lastUsed: '2025-01-01', connectCount: 1,
    }));
    await saveWsHistory(entries);
    const savedArg = JSON.parse(mockWrite.mock.calls[0][1]);
    expect(savedArg).toHaveLength(MAX_HISTORY_ENTRIES);
  });
});

// ── Filter Presets ─────────────────────────────────────────────────

describe('websocketStorage — filter presets', () => {
  it('returns empty array when no data stored', async () => {
    mockRead.mockResolvedValue(null);
    expect(await loadWsFilterPresets()).toEqual([]);
    expect(mockRead).toHaveBeenCalledWith(WS_FILTER_PRESETS_KEY);
  });

  it('parses valid filter presets', async () => {
    const preset: WsFilterPreset = {
      id: 'fp1', name: 'JSON only', searchMode: 'text',
      searchQuery: 'json', createdAt: '2025-01-01',
    };
    mockRead.mockResolvedValue(JSON.stringify([preset]));
    const result = await loadWsFilterPresets();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('JSON only');
  });

  it('filters presets with invalid searchMode', async () => {
    const valid: WsFilterPreset = {
      id: 'fp1', name: 'ok', searchMode: 'regex',
      searchQuery: '.*', createdAt: '2025-01-01',
    };
    const invalidMode = {
      id: 'fp2', name: 'bad', searchMode: 'xpath',
      searchQuery: '//x', createdAt: '2025-01-01',
    };
    mockRead.mockResolvedValue(JSON.stringify([valid, invalidMode]));
    const result = await loadWsFilterPresets();
    expect(result).toHaveLength(1);
    expect(result[0].searchMode).toBe('regex');
  });

  it('accepts all valid search modes: text, regex, jsonpath', async () => {
    const presets = ['text', 'regex', 'jsonpath'].map((mode, i) => ({
      id: `fp${i}`, name: `mode-${mode}`, searchMode: mode,
      searchQuery: 'q', createdAt: '2025-01-01',
    }));
    mockRead.mockResolvedValue(JSON.stringify(presets));
    const result = await loadWsFilterPresets();
    expect(result).toHaveLength(3);
  });

  it('filters out entries missing required fields', async () => {
    const missingName = { id: 'fp1', searchMode: 'text', searchQuery: 'q', createdAt: '2025-01-01' };
    const missingQuery = { id: 'fp2', name: 'x', searchMode: 'text', createdAt: '2025-01-01' };
    mockRead.mockResolvedValue(JSON.stringify([missingName, missingQuery]));
    expect(await loadWsFilterPresets()).toEqual([]);
  });

  it('returns empty for malformed JSON', async () => {
    mockRead.mockResolvedValue('broken{');
    expect(await loadWsFilterPresets()).toEqual([]);
  });

  it('saves presets and trims to max', async () => {
    const presets = Array.from({ length: 25 }, (_, i) => ({
      id: `fp${i}`, name: `P${i}`, searchMode: 'text',
      searchQuery: 'q', createdAt: '2025-01-01',
    })) as WsFilterPreset[];
    await saveWsFilterPresets(presets);
    const savedArg = JSON.parse(mockWrite.mock.calls[0][1]);
    expect(savedArg).toHaveLength(MAX_FILTER_PRESETS);
  });
});

// ── Schema Definitions ────────────────────────────────────────────

describe('websocketStorage — schemas', () => {
  it('returns empty array when no data stored', async () => {
    mockRead.mockResolvedValue(null);
    expect(await loadWsSchemas()).toEqual([]);
    expect(mockRead).toHaveBeenCalledWith(WS_SCHEMAS_KEY);
  });

  it('parses valid schema entries', async () => {
    const schema = {
      id: 's1', name: 'UserMsg', schema: '{"type":"object"}',
      direction: 'inbound', enabled: true,
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    mockRead.mockResolvedValue(JSON.stringify([schema]));
    const result = await loadWsSchemas();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('UserMsg');
    expect(result[0].direction).toBe('inbound');
  });

  it('filters entries missing required boolean enabled', async () => {
    const noEnabled = { id: 's1', name: 'x', schema: '{}', direction: 'in' };
    mockRead.mockResolvedValue(JSON.stringify([noEnabled]));
    expect(await loadWsSchemas()).toEqual([]);
  });

  it('accepts both inbound and outbound directions', async () => {
    const schemas = ['inbound', 'outbound', 'both'].map((dir, i) => ({
      id: `s${i}`, name: `S${i}`, schema: '{}', direction: dir, enabled: true,
    }));
    mockRead.mockResolvedValue(JSON.stringify(schemas));
    expect(await loadWsSchemas()).toHaveLength(3);
  });

  it('saves schemas and trims to max', async () => {
    const schemas = Array.from({ length: 25 }, (_, i) => ({
      id: `s${i}`, name: `S${i}`, schema: '{}', direction: 'in', enabled: true,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveWsSchemas(schemas as any[]);
    const savedArg = JSON.parse(mockWrite.mock.calls[0][1]);
    expect(savedArg).toHaveLength(MAX_SCHEMAS_STORED);
  });

  it('returns empty for non-array JSON', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ id: 'obj' }));
    expect(await loadWsSchemas()).toEqual([]);
  });
});

// ── Mock Rules ────────────────────────────────────────────────────

describe('websocketStorage — mock rules', () => {
  it('returns empty array when no data stored', async () => {
    mockRead.mockResolvedValue(null);
    expect(await loadMockRules()).toEqual([]);
    expect(mockRead).toHaveBeenCalledWith(WS_MOCK_RULES_KEY);
  });

  it('parses valid mock rules', async () => {
    const rule: WsMockRule = {
      id: 'r1', name: 'Echo', enabled: true, priority: 1,
      match: { type: 'exact', value: 'hello' },
      response: { type: 'static', body: 'world', delay: 0 },
    };
    mockRead.mockResolvedValue(JSON.stringify([rule]));
    const result = await loadMockRules();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Echo');
  });

  it('filters rules with missing match or response objects', async () => {
    const noMatch = { id: 'r1', name: 'bad', enabled: true, response: { type: 'static' } };
    const noResponse = { id: 'r2', name: 'bad', enabled: true, match: { type: 'exact' } };
    const matchNull = { id: 'r3', name: 'bad', enabled: true, match: null, response: { type: 'static' } };
    mockRead.mockResolvedValue(JSON.stringify([noMatch, noResponse, matchNull]));
    expect(await loadMockRules()).toEqual([]);
  });

  it('filters rules missing enabled boolean', async () => {
    const noEnabled = {
      id: 'r1', name: 'x',
      match: { type: 'exact', value: 'a' },
      response: { type: 'static', body: 'b' },
    };
    mockRead.mockResolvedValue(JSON.stringify([noEnabled]));
    expect(await loadMockRules()).toEqual([]);
  });

  it('saves mock rules', async () => {
    const rules = [{ id: 'r1', name: 'T', enabled: true, match: {}, response: {} }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveMockRules(rules as any[]);
    expect(mockWrite).toHaveBeenCalledWith(WS_MOCK_RULES_KEY, JSON.stringify(rules));
  });
});

// ── Mock Config ───────────────────────────────────────────────────

describe('websocketStorage — mock config', () => {
  it('returns null when no data stored', async () => {
    mockRead.mockResolvedValue(null);
    expect(await loadMockConfig()).toBeNull();
    expect(mockRead).toHaveBeenCalledWith(WS_MOCK_CONFIG_KEY);
  });

  it('parses valid config', async () => {
    const config = { port: 8080, fallback: 'echo' };
    mockRead.mockResolvedValue(JSON.stringify(config));
    const result = await loadMockConfig();
    expect(result).toEqual({ port: 8080, fallback: 'echo' });
  });

  it('accepts all valid fallback values: echo, ignore, close', async () => {
    for (const fallback of ['echo', 'ignore', 'close']) {
      mockRead.mockResolvedValue(JSON.stringify({ port: 3000, fallback }));
      const result = await loadMockConfig();
      expect(result?.fallback).toBe(fallback);
    }
  });

  it('returns null for invalid fallback', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ port: 3000, fallback: 'reject' }));
    expect(await loadMockConfig()).toBeNull();
  });

  it('returns null when port is not a number', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ port: '3000', fallback: 'echo' }));
    expect(await loadMockConfig()).toBeNull();
  });

  it('returns null for missing fallback', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ port: 3000 }));
    expect(await loadMockConfig()).toBeNull();
  });

  it('returns null for malformed JSON', async () => {
    mockRead.mockResolvedValue('not-json');
    expect(await loadMockConfig()).toBeNull();
  });

  it('saves mock config', async () => {
    const config = { port: 9090, fallback: 'close' as const };
    await saveMockConfig(config);
    expect(mockWrite).toHaveBeenCalledWith(WS_MOCK_CONFIG_KEY, JSON.stringify(config));
  });
});
