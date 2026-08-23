import { readKey, writeKey } from '@shared/utils/storage';
import { ENGINE_TARGETS, type ConvertEngine, type ConvertTarget } from './swaggerToOpenApi';

/** Persisted last-used engine/target choice for the Convert-to-OpenAPI modal. */
export interface ConvertPref {
  engine: ConvertEngine;
  target: ConvertTarget;
}

/** localStorage / Tauri-store key (dual-mode via storage abstraction). */
export const CATALOG_CONVERT_PREF_KEY = 'perf-test-catalog-convert-pref';

/** Default when nothing is persisted or the stored value is invalid. */
export const DEFAULT_CONVERT_PREF: ConvertPref = { engine: 'swagger2openapi', target: '3.0' };

/** True when `engine` is a known engine and `target` is one it can emit. */
function isValidPref(engine: unknown, target: unknown): engine is ConvertEngine {
  if (typeof engine !== 'string' || !(engine in ENGINE_TARGETS)) return false;
  const targets = ENGINE_TARGETS[engine as ConvertEngine];
  return typeof target === 'string' && targets.includes(target as ConvertTarget);
}

/**
 * Load the persisted engine/target choice. Always resolves to a valid pref —
 * falls back to {@link DEFAULT_CONVERT_PREF} on missing / malformed / stale values.
 */
export async function loadConvertPref(): Promise<ConvertPref> {
  try {
    const raw = await readKey(CATALOG_CONVERT_PREF_KEY);
    if (!raw) return DEFAULT_CONVERT_PREF;
    const parsed = JSON.parse(raw) as { engine?: unknown; target?: unknown };
    if (isValidPref(parsed.engine, parsed.target)) {
      return { engine: parsed.engine, target: parsed.target as ConvertTarget };
    }
  } catch {
    /* unreadable / not JSON — fall through to default */
  }
  return DEFAULT_CONVERT_PREF;
}

/**
 * Persist the engine/target choice. Silently no-ops when the pref is invalid or
 * the write fails (persistence is a convenience, never blocks conversion).
 */
export async function saveConvertPref(pref: ConvertPref): Promise<void> {
  if (!isValidPref(pref.engine, pref.target)) return;
  try {
    await writeKey(CATALOG_CONVERT_PREF_KEY, JSON.stringify(pref), { notifyOnQuotaExhausted: false });
  } catch {
    /* best-effort */
  }
}

/** localStorage / Tauri-store key for the "prettify converted YAML" toggle. */
export const CATALOG_CONVERT_PRETTY_KEY = 'perf-test-catalog-convert-pretty';

/** Default: prettify on (canonical, diff-friendly YAML is the better default). */
export const DEFAULT_CONVERT_PRETTY = true;

/** Load the persisted "prettify" toggle; defaults to `true` on missing/malformed values. */
export async function loadPrettyPref(): Promise<boolean> {
  try {
    const raw = await readKey(CATALOG_CONVERT_PRETTY_KEY);
    if (raw === null || raw === undefined) return DEFAULT_CONVERT_PRETTY;
    return raw === 'true' ? true : raw === 'false' ? false : DEFAULT_CONVERT_PRETTY;
  } catch {
    return DEFAULT_CONVERT_PRETTY;
  }
}

/** Persist the "prettify" toggle. Best-effort; never blocks conversion. */
export async function savePrettyPref(pretty: boolean): Promise<void> {
  try {
    await writeKey(CATALOG_CONVERT_PRETTY_KEY, pretty ? 'true' : 'false', { notifyOnQuotaExhausted: false });
  } catch {
    /* best-effort */
  }
}
