/**
 * Schema Repair Engine — suggests fixes for broken mappings caused by
 * schema drift (field removed/renamed).
 *
 * Strategies:
 * 1. Levenshtein edit distance — find fields with similar names
 * 2. Renamed candidate — same type, same parent, different name
 * 3. Manual fix marker — mark mapping for user review
 */

import type { Mapping } from '../types';
import type { SchemaSnapshot } from './schemaSnapshot';
import type { ClassifiedDrift } from './schemaDrift';

// ─── Types ────────────────────────────────────────────────

export type RepairStrategy = 'similar-name' | 'renamed-candidate' | 'manual';

export interface RepairSuggestion {
  /** The drift entry that triggered this suggestion */
  driftPath: string;
  /** The mapping ID that needs repair */
  mappingId: string;
  /** Suggested new source path */
  suggestedPath: string;
  /** Human-readable description of why this suggestion was made */
  reason: string;
  /** Strategy used to find this suggestion */
  strategy: RepairStrategy;
  /** Confidence score 0–100 */
  confidence: number;
}

export interface RepairResult {
  mappingId: string;
  driftPath: string;
  suggestions: RepairSuggestion[];
}

// ─── Levenshtein Edit Distance ────────────────────────────

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

function lastSegment(path: string): string {
  const parts = path.split('.');
  const last = parts[parts.length - 1] ?? path;
  return last === '[*]' && parts.length > 1
    ? parts[parts.length - 2] ?? path
    : last;
}

function parentPath(path: string): string {
  const parts = path.split('.');
  if (parts.length <= 1) return '';
  parts.pop();
  return parts.join('.');
}

// ─── Suggestion Engine ────────────────────────────────────

const MAX_EDIT_DISTANCE = 3;
const MAX_SUGGESTIONS_PER_MAPPING = 5;

/**
 * Generate repair suggestions for a single broken mapping.
 *
 * @param driftPath - The path that was removed/changed
 * @param mappingId - The affected mapping's ID
 * @param currentSnapshot - Current schema snapshot (what's available now)
 * @param savedSnapshot - Saved schema snapshot (what was available before)
 */
export function suggestRepairs(
  driftPath: string,
  mappingId: string,
  currentSnapshot: SchemaSnapshot,
  savedSnapshot: SchemaSnapshot,
): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = [];
  const removedName = lastSegment(driftPath);
  const removedParent = parentPath(driftPath);
  const savedField = savedSnapshot.fields.find((f) => f.path === driftPath);
  const removedType = savedField?.type;

  const currentPaths = new Set(currentSnapshot.fields.map((f) => f.path));
  const savedPaths = new Set(savedSnapshot.fields.map((f) => f.path));

  // Strategy 1: Similar name (Levenshtein)
  for (const field of currentSnapshot.fields) {
    const fieldName = lastSegment(field.path);
    const dist = levenshtein(removedName.toLowerCase(), fieldName.toLowerCase());
    if (dist > 0 && dist <= MAX_EDIT_DISTANCE) {
      const confidence = Math.max(10, 90 - dist * 20 - (field.type !== removedType ? 10 : 0));
      suggestions.push({
        driftPath,
        mappingId,
        suggestedPath: field.path,
        reason: `Similar name "${fieldName}" (edit distance: ${dist})`,
        strategy: 'similar-name',
        confidence,
      });
    }
  }

  // Strategy 2: Renamed candidate — same parent, same type, new field (not in saved)
  if (removedType) {
    for (const field of currentSnapshot.fields) {
      if (field.type !== removedType) continue;
      const fieldParent = parentPath(field.path);
      if (fieldParent !== removedParent) continue;
      if (savedPaths.has(field.path)) continue; // existed before — not a rename
      if (!currentPaths.has(field.path)) continue;
      // Skip if already suggested via similar name with high confidence
      const alreadySuggested = suggestions.find(
        (s) => s.suggestedPath === field.path && s.confidence > 60,
      );
      if (alreadySuggested) {
        alreadySuggested.confidence = Math.min(95, alreadySuggested.confidence + 15);
        alreadySuggested.reason += ' (likely rename)';
        continue;
      }
      suggestions.push({
        driftPath,
        mappingId,
        suggestedPath: field.path,
        reason: `New field "${lastSegment(field.path)}" with same type (${removedType}) under same parent — likely rename`,
        strategy: 'renamed-candidate',
        confidence: 70,
      });
    }
  }

  // Sort by confidence (highest first) and limit
  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions.slice(0, MAX_SUGGESTIONS_PER_MAPPING);
}

/**
 * Generate repair results for all broken mappings across classified drifts.
 */
export function generateRepairResults(
  classifiedDrifts: ClassifiedDrift[],
  currentSnapshot: SchemaSnapshot,
  savedSnapshot: SchemaSnapshot,
): RepairResult[] {
  const results: RepairResult[] = [];

  const breakingDrifts = classifiedDrifts.filter(
    (d) => d.severity === 'breaking' && d.affectedMappingIds.length > 0,
  );

  for (const drift of breakingDrifts) {
    for (const mappingId of drift.affectedMappingIds) {
      const existing = results.find(
        (r) => r.mappingId === mappingId && r.driftPath === drift.path,
      );
      if (existing) continue;

      const suggestions = suggestRepairs(
        drift.path,
        mappingId,
        currentSnapshot,
        savedSnapshot,
      );

      results.push({
        mappingId,
        driftPath: drift.path,
        suggestions,
      });
    }
  }

  return results;
}

/**
 * Apply a repair suggestion to a mapping by updating its sourcePath
 * and rewriting any references to the old path inside the expression.
 * Returns a new Mapping with the updated path(s).
 */
export function applyRepair(
  mapping: Mapping,
  suggestion: RepairSuggestion,
): Mapping {
  const oldPath = mapping.sourcePath;
  const newPath = suggestion.suggestedPath;
  const result: Mapping = {
    ...mapping,
    sourcePath: newPath,
  };
  if (result.expression && oldPath !== newPath) {
    const oldPathDollar = oldPath.startsWith('$.') ? oldPath : `$.${oldPath}`;
    const newPathDollar = newPath.startsWith('$.') ? newPath : `$.${newPath}`;
    result.expression = result.expression
      .replaceAll(oldPathDollar, newPathDollar)
      .replaceAll(oldPath, newPath);
  }
  return result;
}
