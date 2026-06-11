import { readKey, writeKey } from '../../shared/utils/storage';
import type { WsKeyValueEntry } from '../../shared/websocket/types';
import type { AuthConfig } from '../../shared/types';
import { type SseConnectionConfig, createDefaultSseConfig } from './sseTypes';

/**
 * Phase 8 — persistence for the full SSE connection config (url, headers,
 * reconnect settings, auth). Mirrors `websocketStorage`:
 * a single JSON string key over the dual-mode storage layer, validated and
 * defaulted on load so corrupt/legacy blobs degrade gracefully.
 */
export const SSE_CONFIG_KEY = 'redfire-sse-config-v1';

const VALID_AUTH_TYPES = new Set(['none', 'inherit', 'basic', 'bearer', 'apikey', 'digest', 'oauth2']);

function sanitizeKeyValueEntries(value: unknown): WsKeyValueEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map((e) => ({
      key: typeof e.key === 'string' ? e.key : '',
      value: typeof e.value === 'string' ? e.value : '',
      enabled: typeof e.enabled === 'boolean' ? e.enabled : true,
    }));
}

function sanitizeAuthConfig(value: unknown): AuthConfig | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== 'string' || !VALID_AUTH_TYPES.has(v.type)) return undefined;
  return value as AuthConfig;
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}

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
