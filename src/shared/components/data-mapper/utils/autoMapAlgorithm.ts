/**
 * Auto-mapping algorithm for the Data Mapper.
 *
 * Matches source leaf fields to target leaf fields using a priority cascade:
 * 1. Exact name match (highest priority)
 * 2. Case-insensitive match
 * 3. Normalized match (camelCase ↔ snake_case ↔ kebab-case)
 *
 * Each target field is matched to at most one source field (first match wins).
 * Existing mappings are preserved — only unmapped targets are considered.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Mapping } from '../types';
import type { JsonTreeNode } from '../../../utils/jsonTreeModel';
import { getAllLeafPaths } from '../../../utils/jsonTreeModel';

export interface AutoMapCandidate {
  sourcePath: string;
  targetPath: string;
  confidence: 'exact' | 'case-insensitive' | 'normalized';
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

/**
 * Run auto-mapping and return candidate matches.
 * Does not create Mapping objects — the caller decides whether to accept them.
 */
export function computeAutoMapCandidates(
  sourceTree: JsonTreeNode,
  targetTree: JsonTreeNode,
  existingMappings: Mapping[],
): AutoMapCandidate[] {
  // Filter out empty-string root paths (scalar roots) — auto-map only works
  // with named fields, not bare scalar values
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

    // Priority 1: exact match
    for (const sourcePath of sourceLeafs) {
      if (claimedSources.has(sourcePath)) continue;
      const sourceName = lastSegment(sourcePath);
      if (sourceName === targetName) {
        candidates.push({ sourcePath, targetPath, confidence: 'exact' });
        claimedSources.add(sourcePath);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Priority 2: case-insensitive
    const targetLower = targetName.toLowerCase();
    for (const sourcePath of sourceLeafs) {
      if (claimedSources.has(sourcePath)) continue;
      const sourceName = lastSegment(sourcePath);
      if (sourceName.toLowerCase() === targetLower) {
        candidates.push({ sourcePath, targetPath, confidence: 'case-insensitive' });
        claimedSources.add(sourcePath);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Priority 3: normalized (camel/snake/kebab)
    const targetNorm = normalizeFieldName(targetName);
    for (const sourcePath of sourceLeafs) {
      if (claimedSources.has(sourcePath)) continue;
      const sourceName = lastSegment(sourcePath);
      if (normalizeFieldName(sourceName) === targetNorm) {
        candidates.push({ sourcePath, targetPath, confidence: 'normalized' });
        claimedSources.add(sourcePath);
        break;
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
