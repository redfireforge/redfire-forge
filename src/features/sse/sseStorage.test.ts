import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadSseConfig,
  loadSseTabState,
  saveSseTabState,
  saveSseConfig,
  migrateLegacySseConfig,
  deriveSseTabLabel,
} from './sseStorage';
import type { SsePersistedTabState } from './sseTypes';
import { createDefaultSseTab } from './sseTypes';

const { mockReadKey, mockWriteKey } = vi.hoisted(() => ({
  mockReadKey: vi.fn<(k: string) => Promise<string | null>>(() => Promise.resolve(null)),
  mockWriteKey: vi.fn<(k: string, v: string) => Promise<void>>(() => Promise.resolve()),
}));

vi.mock('../../shared/utils/storage', () => ({
  readKey: mockReadKey,
  writeKey: mockWriteKey,
}));

beforeEach(() => {
  mockReadKey.mockReset();
  mockWriteKey.mockReset();
});

describe('loadSseTabState', () => {
  it('returns null when storage is empty', async () => {
    mockReadKey.mockResolvedValueOnce(null);
    expect(await loadSseTabState()).toBeNull();
  });

  it('returns null when JSON is invalid', async () => {
    mockReadKey.mockResolvedValueOnce('not json');
    expect(await loadSseTabState()).toBeNull();
  });

  it('returns null when tabs array is missing', async () => {
    mockReadKey.mockResolvedValueOnce(JSON.stringify({ activeTabId: 'x' }));
    expect(await loadSseTabState()).toBeNull();
  });

  it('returns null when tabs array is empty', async () => {
    mockReadKey.mockResolvedValueOnce(JSON.stringify({ tabs: [], activeTabId: 'x' }));
    expect(await loadSseTabState()).toBeNull();
  });

  it('loads valid tab state', async () => {
    const tab = createDefaultSseTab('sse-tab-1', 'My Tab');
    tab.url = 'https://example.com/sse';
    const state: SsePersistedTabState = { tabs: [tab], activeTabId: 'sse-tab-1' };
    mockReadKey.mockResolvedValueOnce(JSON.stringify(state));
    const result = await loadSseTabState();
    expect(result).not.toBeNull();
    expect(result!.tabs).toHaveLength(1);
    expect(result!.tabs[0].url).toBe('https://example.com/sse');
    expect(result!.activeTabId).toBe('sse-tab-1');
  });

  it('sanitizes invalid tab fields with defaults', async () => {
    const raw = {
      tabs: [{ id: 'sse-tab-1', url: 123, autoReconnect: 'yes', leftTab: 'invalid', rightTab: 'invalid' }],
      activeTabId: 'sse-tab-1',
    };
    mockReadKey.mockResolvedValueOnce(JSON.stringify(raw));
    const result = await loadSseTabState();
    expect(result).not.toBeNull();
    expect(result!.tabs[0].url).toBe('');
    expect(result!.tabs[0].autoReconnect).toBe(true);
    expect(result!.tabs[0].leftTab).toBe('connect');
    expect(result!.tabs[0].rightTab).toBe('events');
  });

  it('falls back activeTabId when stale', async () => {
    const tab = createDefaultSseTab('sse-tab-2');
    const state = { tabs: [tab], activeTabId: 'sse-tab-99' };
    mockReadKey.mockResolvedValueOnce(JSON.stringify(state));
    const result = await loadSseTabState();
    expect(result!.activeTabId).toBe('sse-tab-2');
  });

  it('filters out tabs without id', async () => {
    const raw = {
      tabs: [{ url: 'no-id' }, { id: 'sse-tab-1', url: 'ok' }],
      activeTabId: 'sse-tab-1',
    };
    mockReadKey.mockResolvedValueOnce(JSON.stringify(raw));
    const result = await loadSseTabState();
    expect(result!.tabs).toHaveLength(1);
    expect(result!.tabs[0].id).toBe('sse-tab-1');
  });

  it('caps tabs at SSE_MAX_TABS', async () => {
    const tabs = Array.from({ length: 12 }, (_, i) => createDefaultSseTab(`t-${i}`));
    mockReadKey.mockResolvedValueOnce(JSON.stringify({ tabs, activeTabId: 't-0' }));
    const result = await loadSseTabState();
    expect(result!.tabs).toHaveLength(8);
  });
});

describe('loadSseConfig', () => {
  it('returns null when storage is empty or invalid', async () => {
    mockReadKey.mockResolvedValueOnce(null);
    await expect(loadSseConfig()).resolves.toBeNull();

    mockReadKey.mockResolvedValueOnce('not json');
    await expect(loadSseConfig()).resolves.toBeNull();
  });

  it('loads and sanitizes a persisted config', async () => {
    mockReadKey.mockResolvedValueOnce(
      JSON.stringify({
        url: 'https://example.com/events',
        headers: [{ key: 'Auth', value: 'Bearer x', enabled: true }],
        autoReconnect: false,
        maxRetries: 7,
        auth: { type: 'basic', username: 'alice', password: 'secret' },
      }),
    );

    const result = await loadSseConfig();

    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://example.com/events');
    expect(result!.headers).toHaveLength(1);
    expect(result!.autoReconnect).toBe(false);
    expect(result!.maxRetries).toBe(7);
    expect(result!.auth).toMatchObject({ type: 'basic' });
  });

  it('falls back to defaults for missing legacy config fields', async () => {
    mockReadKey.mockResolvedValueOnce(
      JSON.stringify({
        headers: 'invalid',
        autoReconnect: 'yes',
        maxRetries: -10,
        auth: { mode: 'none' },
      }),
    );

    const result = await loadSseConfig();

    expect(result).not.toBeNull();
    expect(result!.url).toBe('');
    expect(result!.headers).toEqual([]);
    expect(result!.autoReconnect).toBe(true);
    expect(result!.maxRetries).toBeGreaterThanOrEqual(0);
  });
});

describe('saveSseTabState', () => {
  it('writes JSON to storage', async () => {
    const tab = createDefaultSseTab('t1');
    await saveSseTabState({ tabs: [tab], activeTabId: 't1' });
    expect(mockWriteKey).toHaveBeenCalledWith('redfire-sse-tab-state-v1', expect.any(String));
    const saved = JSON.parse(mockWriteKey.mock.calls[0][1]);
    expect(saved.tabs).toHaveLength(1);
    expect(saved.activeTabId).toBe('t1');
  });
});

describe('saveSseConfig', () => {
  it('writes the legacy config payload as JSON', async () => {
    const config = {
      url: 'https://example.com',
      headers: [],
      autoReconnect: true,
      maxRetries: 3,
      auth: { mode: 'none' as const },
    };

    await saveSseConfig(config);

    expect(mockWriteKey).toHaveBeenCalledWith('redfire-sse-config-v1', JSON.stringify(config));
  });
});

describe('migrateLegacySseConfig', () => {
  it('returns null when legacy config is absent', async () => {
    mockReadKey.mockResolvedValueOnce(null);
    expect(await migrateLegacySseConfig()).toBeNull();
  });

  it('converts legacy config into a single tab', async () => {
    const legacyConfig = {
      url: 'https://legacy.example/events',
      headers: [{ key: 'Auth', value: 'Bearer x', enabled: true }],
      autoReconnect: false,
      maxRetries: 5,
    };
    mockReadKey.mockResolvedValueOnce(JSON.stringify(legacyConfig));
    const result = await migrateLegacySseConfig();
    expect(result).not.toBeNull();
    expect(result!.tabs).toHaveLength(1);
    expect(result!.tabs[0].url).toBe('https://legacy.example/events');
    expect(result!.tabs[0].autoReconnect).toBe(false);
    expect(result!.tabs[0].maxRetries).toBe(5);
    expect(result!.tabs[0].label).toBe('legacy.example');
    expect(result!.activeTabId).toBe('sse-tab-1');
  });

  it('uses a default label when the legacy config URL is empty', async () => {
    mockReadKey.mockResolvedValueOnce(JSON.stringify({ url: '', headers: [], autoReconnect: true, maxRetries: 0 }));

    const result = await migrateLegacySseConfig();

    expect(result).not.toBeNull();
    expect(result!.tabs[0].label).toBe('New Connection');
  });
});

describe('deriveSseTabLabel', () => {
  it('returns hostname for valid URL', () => {
    expect(deriveSseTabLabel('https://api.example.com/events')).toBe('api.example.com');
  });

  it('returns "New Connection" for empty string', () => {
    expect(deriveSseTabLabel('')).toBe('New Connection');
  });

  it('returns truncated string for invalid URL', () => {
    expect(deriveSseTabLabel('not a url')).toBe('not a url');
  });
});
