import { readKey, writeKey } from '../../shared/utils/storage';
import {
  clampInt,
  sanitizeAuthConfig,
  sanitizeKeyValueEntries,
} from '../../shared/utils/persistSanitizers';
import { type SseConnectionConfig, createDefaultSseConfig } from './sseTypes';

/**
 * Phase 8 — persistence for the full SSE connection config (url, headers,
 * reconnect settings, auth). Mirrors `websocketStorage`:
 * a single JSON string key over the dual-mode storage layer, validated and
 * defaulted on load so corrupt/legacy blobs degrade gracefully.
 */
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
