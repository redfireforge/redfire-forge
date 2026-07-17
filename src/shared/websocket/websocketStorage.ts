import { readKey, writeKey } from '../utils/storage';
import { clampInt, sanitizeAuthConfig, sanitizeKeyValueEntries } from '../utils/persistSanitizers';
import type {
  WsConnectionHistoryEntry,
  WsConnectionProfile,
  WsFilterPreset,
  WsMessageTemplate,
  WsMockRule,
  WsPersistedTab,
  WsPersistedTabState,
} from './types';
import {
  isWsStudioMode,
  isWsLeftTab,
  isWsRightTab,
  mapViewTabToStudioLocation,
} from './types';

export const WS_PROFILES_KEY = 'redfire-ws-profiles-v1';
export const WS_TEMPLATES_KEY = 'redfire-ws-templates-v1';
export const WS_TAB_STATE_KEY = 'redfire-ws-tab-state-v1';
export const WS_HISTORY_KEY = 'redfire-ws-history-v1';
export const WS_FILTER_PRESETS_KEY = 'redfire-ws-filter-presets-v1';

export const MAX_HISTORY_ENTRIES = 20;
export const MAX_FILTER_PRESETS = 20;

function isValidProfile(entry: unknown): entry is WsConnectionProfile {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.url === 'string'
  );
}

const VALID_PROTOCOL_MODES = new Set(['auto', 'raw', 'socket-io', 'stomp', 'graphql-ws']);
const VALID_BACKOFF_MULTIPLIERS = new Set([1, 1.5, 2]);
const VALID_TEMPLATE_FORMATS = new Set(['text', 'json', 'binary']);

function normalizeProfile(p: WsConnectionProfile): WsConnectionProfile {
  const rawBackoff = (p as unknown as Record<string, unknown>).backoffMultiplier;
  return {
    ...p,
    headers: Array.isArray(p.headers) ? p.headers : [],
    queryParams: Array.isArray(p.queryParams) ? p.queryParams : [],
    subprotocols: typeof p.subprotocols === 'string' ? p.subprotocols : '',
    protocolMode: typeof p.protocolMode === 'string' && VALID_PROTOCOL_MODES.has(p.protocolMode)
      ? p.protocolMode : 'auto',
    autoReconnect: typeof p.autoReconnect === 'boolean' ? p.autoReconnect : false,
    maxReconnectAttempts: typeof p.maxReconnectAttempts === 'number'
      ? clampInt(p.maxReconnectAttempts, 1, 50, 5) : 5,
    reconnectIntervalMs: typeof p.reconnectIntervalMs === 'number'
      ? clampInt(p.reconnectIntervalMs, 500, 60000, 3000) : 3000,
    backoffMultiplier: typeof rawBackoff === 'number' && VALID_BACKOFF_MULTIPLIERS.has(rawBackoff)
      ? rawBackoff as WsConnectionProfile['backoffMultiplier'] : undefined,
    maxMessages: typeof p.maxMessages === 'number'
      ? clampInt(p.maxMessages, 100, 50000, 1000) : 1000,
    notes: typeof p.notes === 'string' ? p.notes : '',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString(),
  };
}

function isValidTemplate(entry: unknown): entry is WsMessageTemplate {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.body === 'string'
  );
}

function normalizeTemplate(t: WsMessageTemplate): WsMessageTemplate {
  return {
    ...t,
    format: typeof t.format === 'string' && VALID_TEMPLATE_FORMATS.has(t.format)
      ? t.format : 'text',
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
    updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString(),
  };
}

function parseArray<T>(raw: string, validator: (v: unknown) => v is T): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validator);
  } catch {
    return [];
  }
}

export async function loadWsProfiles(): Promise<WsConnectionProfile[]> {
  const raw = await readKey(WS_PROFILES_KEY);
  if (!raw) return [];
  return parseArray(raw, isValidProfile).map(normalizeProfile);
}

export async function saveWsProfiles(profiles: WsConnectionProfile[]): Promise<void> {
  await writeKey(WS_PROFILES_KEY, JSON.stringify(profiles));
}

export async function loadWsTemplates(): Promise<WsMessageTemplate[]> {
  const raw = await readKey(WS_TEMPLATES_KEY);
  if (!raw) return [];
  return parseArray(raw, isValidTemplate).map(normalizeTemplate);
}

export async function saveWsTemplates(templates: WsMessageTemplate[]): Promise<void> {
  await writeKey(WS_TEMPLATES_KEY, JSON.stringify(templates));
}

// ── Tab State Persistence ────────────────────────────────────────────

const VALID_VIEW_TABS = new Set(['connect', 'messages', 'saved', 'mock']);

function isValidPersistedTab(entry: unknown): entry is WsPersistedTab {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.label === 'string' &&
    typeof e.url === 'string' &&
    typeof e.viewTab === 'string' &&
    VALID_VIEW_TABS.has(e.viewTab)
  );
}

/**
 * Normalizes a valid persisted tab so its Phase 1 studio-layout fields
 * (`mode`/`leftTab`/`rightTab`) are always populated. Present-and-valid values
 * are kept; anything missing or invalid is derived from the legacy `viewTab`
 * via `mapViewTabToStudioLocation`, so legacy blobs migrate transparently.
 *
 * Phase 8 also normalizes the persisted draft fields
 * (`subprotocols`/`headers`/`queryParams`/`auth`); older blobs that lack them
 * default to `''`/`[]`/`undefined`.
 */
function normalizePersistedTab(tab: WsPersistedTab): WsPersistedTab {
  const derived = mapViewTabToStudioLocation(tab.viewTab);
  return {
    ...tab,
    mode: isWsStudioMode(tab.mode) ? tab.mode : derived.mode,
    leftTab: isWsLeftTab(tab.leftTab) ? tab.leftTab : derived.leftTab,
    rightTab: isWsRightTab(tab.rightTab) ? tab.rightTab : derived.rightTab,
    subprotocols: typeof tab.subprotocols === 'string' ? tab.subprotocols : '',
    headers: sanitizeKeyValueEntries(tab.headers),
    queryParams: sanitizeKeyValueEntries(tab.queryParams),
    auth: sanitizeAuthConfig(tab.auth),
  };
}

export async function loadWsTabState(): Promise<WsPersistedTabState | null> {
  const raw = await readKey(WS_TAB_STATE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.tabs) || typeof obj.activeTabId !== 'string') return null;
    const validTabs = (obj.tabs as unknown[]).filter(isValidPersistedTab).map(normalizePersistedTab);
    if (validTabs.length === 0) return null;
    const renamedTabIds = Array.isArray(obj.renamedTabIds)
      ? (obj.renamedTabIds as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    const activeTabId = validTabs.some((t) => t.id === obj.activeTabId)
      ? (obj.activeTabId as string)
      : validTabs[0].id;
    return { tabs: validTabs, activeTabId, renamedTabIds };
  } catch {
    return null;
  }
}

export async function saveWsTabState(state: WsPersistedTabState): Promise<void> {
  await writeKey(WS_TAB_STATE_KEY, JSON.stringify(state));
}

// ── Connection History ───────────────────────────────────────────────

function isValidHistoryEntry(entry: unknown): entry is WsConnectionHistoryEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.url === 'string' &&
    typeof e.protocol === 'string' &&
    typeof e.lastUsed === 'string' &&
    typeof e.connectCount === 'number'
  );
}

export async function loadWsHistory(): Promise<WsConnectionHistoryEntry[]> {
  const raw = await readKey(WS_HISTORY_KEY);
  if (!raw) return [];
  return parseArray(raw, isValidHistoryEntry);
}

export async function saveWsHistory(history: WsConnectionHistoryEntry[]): Promise<void> {
  const trimmed = history.slice(0, MAX_HISTORY_ENTRIES);
  await writeKey(WS_HISTORY_KEY, JSON.stringify(trimmed));
}

// ── Filter Presets ───────────────────────────────────────────────────

const VALID_SEARCH_MODES = new Set(['text', 'regex', 'jsonpath']);

function isValidFilterPreset(entry: unknown): entry is WsFilterPreset {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.searchMode === 'string' &&
    VALID_SEARCH_MODES.has(e.searchMode) &&
    typeof e.searchQuery === 'string' &&
    typeof e.createdAt === 'string'
  );
}

export async function loadWsFilterPresets(): Promise<WsFilterPreset[]> {
  const raw = await readKey(WS_FILTER_PRESETS_KEY);
  if (!raw) return [];
  return parseArray(raw, isValidFilterPreset);
}

export async function saveWsFilterPresets(presets: WsFilterPreset[]): Promise<void> {
  const trimmed = presets.slice(0, MAX_FILTER_PRESETS);
  await writeKey(WS_FILTER_PRESETS_KEY, JSON.stringify(trimmed));
}

// ── Schema Definitions ──────────────────────────────────────────────

export const WS_SCHEMAS_KEY = 'redfire-ws-schemas-v1';

export const MAX_SCHEMAS_STORED = 20;

interface WsSchemaStoredEntry {
  id: string;
  name: string;
  schema: string;
  direction: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function isValidSchemaEntry(entry: unknown): entry is WsSchemaStoredEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.schema === 'string' &&
    typeof e.direction === 'string' &&
    typeof e.enabled === 'boolean'
  );
}

export async function loadWsSchemas(): Promise<WsSchemaStoredEntry[]> {
  const raw = await readKey(WS_SCHEMAS_KEY);
  if (!raw) return [];
  return parseArray(raw, isValidSchemaEntry);
}

export async function saveWsSchemas(schemas: WsSchemaStoredEntry[]): Promise<void> {
  const trimmed = schemas.slice(0, MAX_SCHEMAS_STORED);
  await writeKey(WS_SCHEMAS_KEY, JSON.stringify(trimmed));
}

// ── Mock Server Rules & Config ──────────────────────────────────────

/** Per-port storage key for mock rules. Each tab's mock server stores its rules
 *  independently so tabs remain isolated. */
export const mockRulesKey = (port: number) => `redfire-ws-mock-rules-v2-${port}`;
/** Per-port storage key for mock config (fallback mode). */
export const mockConfigKey = (port: number) => `redfire-ws-mock-config-v2-${port}`;

// Legacy single-server keys kept for reference only (no longer written).
export const WS_MOCK_RULES_KEY = 'redfire-ws-mock-rules-v1';
export const WS_MOCK_CONFIG_KEY = 'redfire-ws-mock-config-v1';

export interface MockConfigStored {
  port: number;
  fallback: string;
}

const VALID_FALLBACKS = new Set(['echo', 'ignore', 'close']);

function isValidMockRule(entry: unknown): entry is WsMockRule {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.enabled === 'boolean' &&
    typeof e.match === 'object' && e.match !== null &&
    typeof e.response === 'object' && e.response !== null
  );
}

export async function loadMockRules(port: number): Promise<WsMockRule[]> {
  const raw = await readKey(mockRulesKey(port));
  if (!raw) return [];
  return parseArray(raw, isValidMockRule);
}

export async function saveMockRules(port: number, rules: WsMockRule[]): Promise<void> {
  await writeKey(mockRulesKey(port), JSON.stringify(rules));
}

export async function loadMockConfig(port: number): Promise<MockConfigStored | null> {
  const raw = await readKey(mockConfigKey(port));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MockConfigStored;
    if (typeof parsed.port !== 'number') return null;
    if (typeof parsed.fallback !== 'string' || !VALID_FALLBACKS.has(parsed.fallback)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveMockConfig(port: number, config: MockConfigStored): Promise<void> {
  await writeKey(mockConfigKey(port), JSON.stringify(config));
}
