import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SSE_CONFIG_KEY, loadSseConfig, saveSseConfig } from './sseStorage';
import { createDefaultSseConfig, type SseConnectionConfig } from './sseTypes';

// In-memory backing store for the dual-mode storage layer.
const store = new Map<string, string>();

vi.mock('../../shared/utils/storage', () => ({
  readKey: (key: string) => Promise.resolve(store.has(key) ? store.get(key)! : null),
  writeKey: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
}));

describe('sseStorage', () => {
  beforeEach(() => {
    store.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when nothing is stored', async () => {
    expect(await loadSseConfig()).toBeNull();
  });

  it('round-trips a full config', async () => {
    const config: SseConnectionConfig = {
      url: 'https://example.com/events',
      headers: [{ key: 'X-Token', value: 'abc', enabled: true }],
      autoReconnect: true,
      maxRetries: 7,
      auth: { type: 'bearer', token: 'sekret' },
    };
    await saveSseConfig(config);
    expect(await loadSseConfig()).toEqual(config);
  });

  it('returns null for corrupt JSON', async () => {
    store.set(SSE_CONFIG_KEY, '{not json');
    expect(await loadSseConfig()).toBeNull();
  });

  it('returns null for a non-object payload', async () => {
    store.set(SSE_CONFIG_KEY, '42');
    expect(await loadSseConfig()).toBeNull();
  });

  it('defaults missing fields and drops invalid ones', async () => {
    const defaults = createDefaultSseConfig();
    store.set(
      SSE_CONFIG_KEY,
      JSON.stringify({ url: 123, headers: 'nope', maxRetries: -5, auth: { type: 'bogus' } }),
    );
    const loaded = await loadSseConfig();
    expect(loaded).not.toBeNull();
    expect(loaded!.url).toBe(defaults.url);
    expect(loaded!.headers).toEqual([]);
    expect(loaded!.maxRetries).toBe(0);
    expect(loaded!.auth).toBeUndefined();
  });

  it('sanitizes partial header entries', async () => {
    store.set(
      SSE_CONFIG_KEY,
      JSON.stringify({
        url: 'u',
        headers: [{ key: 'A' }, { value: 'b', enabled: false }, 'junk', null],
        autoReconnect: false,
        maxRetries: 3,
      }),
    );
    const loaded = await loadSseConfig();
    expect(loaded!.headers).toEqual([
      { key: 'A', value: '', enabled: true },
      { key: '', value: 'b', enabled: false },
    ]);
  });

  it('clamps maxRetries within bounds', async () => {
    store.set(SSE_CONFIG_KEY, JSON.stringify({ url: 'u', maxRetries: 99999 }));
    const loaded = await loadSseConfig();
    expect(loaded!.maxRetries).toBe(1000);
  });
});
