import type { AuthConfig } from '../types';
import type { WsKeyValueEntry } from '../websocket/types';

export const VALID_AUTH_TYPES = new Set([
  'none',
  'inherit',
  'basic',
  'bearer',
  'apikey',
  'digest',
  'oauth2',
]);

/** Corrupt-safe sanitizer for a persisted WsKeyValueEntry[] (headers/params). */
export function sanitizeKeyValueEntries(value: unknown): WsKeyValueEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map((e) => ({
      key: typeof e.key === 'string' ? e.key : '',
      value: typeof e.value === 'string' ? e.value : '',
      enabled: typeof e.enabled === 'boolean' ? e.enabled : true,
    }));
}

/** Corrupt-safe sanitizer for a persisted AuthConfig. Returns undefined for
 * missing/invalid data so an absent auth stays absent. */
export function sanitizeAuthConfig(value: unknown): AuthConfig | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== 'string' || !VALID_AUTH_TYPES.has(v.type)) return undefined;
  return value as AuthConfig;
}

export function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}
