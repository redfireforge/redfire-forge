/**
 * Auto-mapping algorithm for the Data Mapper.
 *
 * Matches source leaf fields to target leaf fields using a priority cascade:
 * 1. Exact name match  (score 100)
 * 2. Case-insensitive   (score 90)
 * 3. Normalized match   (score 80) — camelCase ↔ snake_case ↔ kebab-case
 * 4. Suffix match       (score 75) — `userEmail` matches target `email`
 * 5. Synonym match      (score 60) — `qty` ↔ `quantity`, `fname` ↔ `firstName`
 * 6. Semantic value match (score 50) — both values look like emails, phones, etc.
 *
 * Each target field is matched to at most one source field (first match wins).
 * Existing mappings are preserved — only unmapped targets are considered.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Mapping } from '../types';
import type { JsonTreeNode } from '../../../utils/jsonTreeModel';
import { getAllLeafPaths } from '../../../utils/jsonTreeModel';
import { areSynonyms } from './synonymDictionary';
import { inferSemanticType } from './smartAutoMap';
import type { SemanticType } from './smartAutoMap';

export type MatchTier =
  | 'exact'
  | 'case-insensitive'
  | 'normalized'
  | 'suffix'
  | 'synonym'
  | 'semantic-value';

export const MATCH_SCORES: Record<MatchTier, number> = {
  'exact': 100,
  'case-insensitive': 90,
  'normalized': 80,
  'suffix': 75,
  'synonym': 60,
  'semantic-value': 50,
};

export interface AutoMapCandidate {
  sourcePath: string;
  targetPath: string;
  /** @deprecated Use `tier` + `score` instead. Kept for backwards compat. */
  confidence: MatchTier;
  /** Which matching tier produced this candidate. */
  tier: MatchTier;
  /** Numeric confidence score (0–100). */
  score: number;
  /** Semantic type tag when matched via value inference. */
  semanticType?: SemanticType;
}

/**
 * Normalize a field name by converting camelCase, snake_case, kebab-case,
 * and PascalCase to a canonical lowercase form without separators.
 */
export function normalizeFieldName(name: string): string {
  return name
    .replace(/[-_]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1$2')
    .toLowerCase();
}

/** Extract the last segment of a dot/bracket path as the field name. */
function lastSegment(path: string): string {
  const parts = path.split('.');
  const last = parts[parts.length - 1] ?? path;
  return last.replace(/\[\d+\]|\[\*\]$/g, '');
}

/** Check if `longer` ends with `shorter` (both normalized). */
function isSuffixMatch(longerNorm: string, shorterNorm: string): boolean {
  if (shorterNorm.length === 0 || longerNorm.length <= shorterNorm.length) return false;
  return longerNorm.endsWith(shorterNorm);
}

/** Resolve a value from sample data given a dot-bracket path. */
function resolveValue(data: unknown, path: string): unknown {
  if (data == null || path === '') return data;
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  const segments = normalized.split('.').filter((s) => s !== '');
  let current: unknown = data;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

export interface AutoMapOptions {
  /** Source sample data for value-based inference. */
  sourceData?: unknown;
  /** Target sample data for value-based inference. */
  targetData?: unknown;
}

/**
 * Run auto-mapping and return candidate matches with scores.
 * Does not create Mapping objects — the caller decides whether to accept them.
 */
export function computeAutoMapCandidates(
  sourceTree: JsonTreeNode,
  targetTree: JsonTreeNode,
  existingMappings: Mapping[],
  options?: AutoMapOptions,
): AutoMapCandidate[] {
  const sourceLeafs = getAllLeafPaths(sourceTree).filter((p) => p !== '');
  const targetLeafs = getAllLeafPaths(targetTree).filter((p) => p !== '');

  const alreadyMappedTargets = new Set(existingMappings.map((m) => m.targetPath));
  const unmappedTargets = targetLeafs.filter((t) => !alreadyMappedTargets.has(t));

  const candidates: AutoMapCandidate[] = [];
  const claimedSources = new Set<string>();
  for (const m of existingMappings) {
    claimedSources.add(m.sourcePath);
  }

  for (const targetPath of unmappedTargets) {
    const targetName = lastSegment(targetPath);
    let matched = false;

    // Tier 1: exact match (score 100)
    for (const sourcePath of sourceLeafs) {
      if (claimedSources.has(sourcePath)) continue;
      const sourceName = lastSegment(sourcePath);
      if (sourceName === targetName) {
        candidates.push({ sourcePath, targetPath, confidence: 'exact', tier: 'exact', score: 100 });
        claimedSources.add(sourcePath);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Tier 2: case-insensitive (score 90)
    const targetLower = targetName.toLowerCase();
    for (const sourcePath of sourceLeafs) {
      if (claimedSources.has(sourcePath)) continue;
      const sourceName = lastSegment(sourcePath);
      if (sourceName.toLowerCase() === targetLower) {
        candidates.push({ sourcePath, targetPath, confidence: 'case-insensitive', tier: 'case-insensitive', score: 90 });
        claimedSources.add(sourcePath);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Tier 3: normalized — camel/snake/kebab (score 80)
    const targetNorm = normalizeFieldName(targetName);
    for (const sourcePath of sourceLeafs) {
      if (claimedSources.has(sourcePath)) continue;
      const sourceName = lastSegment(sourcePath);
      if (normalizeFieldName(sourceName) === targetNorm) {
        candidates.push({ sourcePath, targetPath, confidence: 'normalized', tier: 'normalized', score: 80 });
        claimedSources.add(sourcePath);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Tier 4: suffix match (score 75)
    for (const sourcePath of sourceLeafs) {
      if (claimedSources.has(sourcePath)) continue;
      const sourceNorm = normalizeFieldName(lastSegment(sourcePath));
      if (isSuffixMatch(sourceNorm, targetNorm) || isSuffixMatch(targetNorm, sourceNorm)) {
        candidates.push({ sourcePath, targetPath, confidence: 'suffix', tier: 'suffix', score: 75 });
        claimedSources.add(sourcePath);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Tier 5: synonym match (score 60)
    for (const sourcePath of sourceLeafs) {
      if (claimedSources.has(sourcePath)) continue;
      const sourceNorm = normalizeFieldName(lastSegment(sourcePath));
      if (areSynonyms(sourceNorm, targetNorm)) {
        candidates.push({ sourcePath, targetPath, confidence: 'synonym', tier: 'synonym', score: 60 });
        claimedSources.add(sourcePath);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Tier 6: semantic value match (score 50)
    if (options?.sourceData != null && options?.targetData != null) {
      for (const sourcePath of sourceLeafs) {
        if (claimedSources.has(sourcePath)) continue;
        const sourceVal = resolveValue(options.sourceData, sourcePath);
        const targetVal = resolveValue(options.targetData, targetPath);
        const srcType = inferSemanticType(sourceVal);
        const tgtType = inferSemanticType(targetVal);
        if (srcType !== 'unknown' && srcType === tgtType) {
          candidates.push({
            sourcePath, targetPath,
            confidence: 'semantic-value', tier: 'semantic-value', score: 50,
            semanticType: srcType,
          });
          claimedSources.add(sourcePath);
          break;
        }
      }
    }
  }

  return candidates;
}

/**
 * Convert auto-map candidates into Mapping objects, ready to be added to state.
 */
export function candidatesToMappings(
  candidates: AutoMapCandidate[],
  sourceId: string,
): Mapping[] {
  return candidates.map((c) => ({
    id: uuidv4(),
    sourcePath: c.sourcePath,
    sourceId,
    targetPath: c.targetPath,
    isAutoMapped: true,
  }));
}
