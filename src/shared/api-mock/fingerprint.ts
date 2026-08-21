/**
 * API Mock Studio — deterministic fingerprints and canonical ordering (Phase 1A).
 */
import type { ApiMockServerDefinitionV1, ApiMockRouteV1 } from './contracts';
import { sha256HexSync } from './sha256Sync';

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for environments without WebCrypto subtle.
  return sha256HexSync(text);
}

function canonicalJson(obj: unknown, exclude: Set<string>): string {
  return JSON.stringify(sortObjectKeys(obj), (key, value) => (exclude.has(key) ? undefined : value));
}

const DEFINITION_EXCLUDE = new Set(['createdAt', 'updatedAt', 'source']);
const ROUTE_EXCLUDE = new Set(['createdAt', 'updatedAt', 'tags', 'operationId']);

export async function computeDefinitionFingerprint(def: ApiMockServerDefinitionV1): Promise<string> {
  return sha256Hex(canonicalJson(def, DEFINITION_EXCLUDE));
}

export async function computeRouteFingerprint(route: ApiMockRouteV1): Promise<string> {
  return sha256Hex(canonicalJson(route, ROUTE_EXCLUDE));
}

/** Sort for deterministic export: servers/routes/samples by id, variables by key. */
export function canonicalExportOrder<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

export function canonicalVariableOrder<T extends { key: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.key.localeCompare(b.key));
}
