/**
 * Pattern learning — remembers user mapping decisions per source/target schema pair.
 *
 * Stored in localStorage keyed by `contextId + sourceSchemaHash + targetSchemaHash`.
 * When the same schema pair is encountered again, previously used mappings
 * are suggested with a "Previously mapped" badge.
 */

import type { Mapping } from '../types';

export interface PatternEntry {
  sourcePath: string;
  targetPath: string;
  expression?: string;
}

export interface StoredPattern {
  entries: PatternEntry[];
  savedAt: number;
}

const STORAGE_PREFIX = 'dm-patterns:';
const MAX_PATTERNS = 100;

/**
 * Simple hash of an array of field paths, producing a stable string.
 * Used to fingerprint a schema shape.
 */
export function hashSchemaPaths(paths: string[]): string {
  const sorted = [...paths].sort();
  let hash = 0;
  const str = sorted.join('|');
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Build a storage key from context + schema fingerprints.
 */
export function buildPatternKey(contextId: string, sourcePaths: string[], targetPaths: string[]): string {
  const srcHash = hashSchemaPaths(sourcePaths);
  const tgtHash = hashSchemaPaths(targetPaths);
  return `${STORAGE_PREFIX}${contextId}:${srcHash}:${tgtHash}`;
}

/**
 * Save the current mappings as a pattern for the given schema pair.
 */
export function savePattern(
  contextId: string,
  sourcePaths: string[],
  targetPaths: string[],
  mappings: Mapping[],
): void {
  if (mappings.length === 0) return;
  const key = buildPatternKey(contextId, sourcePaths, targetPaths);
  const entries: PatternEntry[] = mappings.map((m) => ({
    sourcePath: m.sourcePath,
    targetPath: m.targetPath,
    ...(m.expression ? { expression: m.expression } : {}),
  }));
  const pattern: StoredPattern = { entries, savedAt: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify(pattern));
    pruneOldPatterns();
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Load a previously saved pattern for the given schema pair.
 * Returns null if no pattern exists.
 */
export function loadPattern(
  contextId: string,
  sourcePaths: string[],
  targetPaths: string[],
): StoredPattern | null {
  const key = buildPatternKey(contextId, sourcePaths, targetPaths);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPattern;
    if (!Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Convert a stored pattern into Mapping-like suggestions, filtered to
 * only include entries where both source and target paths still exist
 * in the current schema.
 */
export function patternToSuggestions(
  pattern: StoredPattern,
  currentSourcePaths: Set<string>,
  currentTargetPaths: Set<string>,
  existingMappings: Mapping[],
): PatternEntry[] {
  const mappedTargets = new Set(existingMappings.map((m) => m.targetPath));
  return pattern.entries.filter((e) =>
    currentSourcePaths.has(e.sourcePath)
    && currentTargetPaths.has(e.targetPath)
    && !mappedTargets.has(e.targetPath),
  );
}

/**
 * Remove oldest patterns if we exceed the max count.
 */
function pruneOldPatterns(): void {
  try {
    const keys: { key: string; savedAt: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const p = JSON.parse(raw) as StoredPattern;
            keys.push({ key, savedAt: p.savedAt || 0 });
          }
        } catch { /* skip corrupt entries */ }
      }
    }
    if (keys.length > MAX_PATTERNS) {
      keys.sort((a, b) => a.savedAt - b.savedAt);
      const toRemove = keys.length - MAX_PATTERNS;
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(keys[i].key);
      }
    }
  } catch { /* ignore */ }
}

/**
 * Delete a specific pattern.
 */
export function deletePattern(contextId: string, sourcePaths: string[], targetPaths: string[]): void {
  const key = buildPatternKey(contextId, sourcePaths, targetPaths);
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}
