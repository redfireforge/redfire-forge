import { readKey, writeKey } from '@shared/utils/storage';
import {
  clampInt,
  sanitizeAuthConfig,
  sanitizeKeyValueEntries,
} from '@shared/utils/persistSanitizers';
import {
  type SseConnectionConfig,
  type SseConnectionTab,
  type SsePersistedTabState,
  createDefaultSseConfig,
  createDefaultSseTab,
  SSE_MAX_TABS,
} from './sseTypes';

// ─── Legacy single-config persistence (Phase 8) ────────────────

export const SSE_CONFIG_KEY = 'redfire-sse-config-v1';

export async function loadSseConfig(): Promise<SseConnectionConfig | null> {
  try {
    const raw = await readKey(SSE_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    const defaults = createDefaultSseConfig();
    return {
      url: typeof p.url === 'string' ? p.url : defaults.url,
      headers: sanitizeKeyValueEntries(p.headers),
      autoReconnect: typeof p.autoReconnect === 'boolean' ? p.autoReconnect : defaults.autoReconnect,
      maxRetries: clampInt(p.maxRetries, 0, 1000, defaults.maxRetries),
      auth: sanitizeAuthConfig(p.auth),
    };
  } catch {
    return null;
  }
}

export async function saveSseConfig(config: SseConnectionConfig): Promise<void> {
  await writeKey(SSE_CONFIG_KEY, JSON.stringify(config));
}

// ─── Multi-tab persistence (Phase 2) ───────────────────────────

export const SSE_TAB_STATE_KEY = 'redfire-sse-tab-state-v1';

function sanitizeTab(raw: Record<string, unknown>): SseConnectionTab | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  const defaults = createDefaultSseTab(id);
  return {
    id,
    label: typeof raw.label === 'string' ? raw.label : defaults.label,
    labelManual: typeof raw.labelManual === 'boolean' ? raw.labelManual : undefined,
    url: typeof raw.url === 'string' ? raw.url : defaults.url,
    headers: sanitizeKeyValueEntries(raw.headers),
    auth: sanitizeAuthConfig(raw.auth),
    autoReconnect: typeof raw.autoReconnect === 'boolean' ? raw.autoReconnect : defaults.autoReconnect,
    maxRetries: clampInt(raw.maxRetries, 0, 1000, defaults.maxRetries),
    leftTab: raw.leftTab === 'connect' || raw.leftTab === 'auth' ? raw.leftTab : 'connect',
    rightTab: raw.rightTab === 'events' || raw.rightTab === 'console' ? raw.rightTab : 'events',
  };
}

export async function loadSseTabState(): Promise<SsePersistedTabState | null> {
  try {
    const raw = await readKey(SSE_TAB_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (!Array.isArray(p.tabs)) return null;

    const tabs = (p.tabs as unknown[])
      .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
      .map(sanitizeTab)
      .filter((t): t is SseConnectionTab => t !== null)
      .slice(0, SSE_MAX_TABS);

    if (tabs.length === 0) return null;

    const activeTabId = typeof p.activeTabId === 'string' && tabs.some(t => t.id === p.activeTabId)
      ? (p.activeTabId as string)
      : tabs[0].id;

    return { tabs, activeTabId };
  } catch {
    return null;
  }
}

export async function saveSseTabState(state: SsePersistedTabState): Promise<void> {
  await writeKey(SSE_TAB_STATE_KEY, JSON.stringify(state));
}

export function deriveSseTabLabel(url: string): string {
  if (!url) return 'New Connection';
  try {
    const u = new URL(url);
    return u.hostname || 'New Connection';
  } catch {
    return url.slice(0, 30) || 'New Connection';
  }
}

export async function migrateLegacySseConfig(): Promise<SsePersistedTabState | null> {
  const legacy = await loadSseConfig();
  if (!legacy) return null;
  const tab: SseConnectionTab = {
    ...createDefaultSseTab('sse-tab-1'),
    url: legacy.url,
    headers: legacy.headers,
    auth: legacy.auth,
    autoReconnect: legacy.autoReconnect,
    maxRetries: legacy.maxRetries,
    label: deriveSseTabLabel(legacy.url),
  };
  return { tabs: [tab], activeTabId: tab.id };
}
