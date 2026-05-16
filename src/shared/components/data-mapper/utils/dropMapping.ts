import { v4 as uuidv4 } from 'uuid';
import type { Mapping } from '../types';
import { normalizeMapperPath } from './pathNormalization';

export function upsertTargetMapping(
  mappings: Mapping[],
  sourcePath: string,
  sourceId: string,
  targetPath: string,
  expression?: string,
): { next: Mapping[]; changed: boolean } {
  const normalizedTargetPath = normalizeMapperPath(targetPath);
  const existingIdx = mappings.findIndex((m) => normalizeMapperPath(m.targetPath) === normalizedTargetPath);
  if (existingIdx >= 0) {
    const existing = mappings[existingIdx];
    if (
      existing.sourcePath === sourcePath
      && existing.sourceId === sourceId
      && existing.expression === expression
    ) {
      return { next: mappings, changed: false };
    }
    const nextMapping: Mapping = expression
      ? {
        ...existing,
        sourcePath,
        sourceId,
        targetPath,
        expression,
      }
      : (() => {
        const { expression: _oldExpression, ...rest } = existing;
        return { ...rest, sourcePath, sourceId, targetPath };
      })();
    const next = [...mappings];
    next[existingIdx] = nextMapping;
    return { next, changed: true };
  }
  const newMapping: Mapping = expression
    ? { id: uuidv4(), sourcePath, sourceId, targetPath, expression }
    : { id: uuidv4(), sourcePath, sourceId, targetPath };
  return { next: [...mappings, newMapping], changed: true };
}

export interface BulkDropResult {
  nextMappings: Mapping[];
  appliedCount: number;
}

export function bulkDropMappings(
  currentMappings: Mapping[],
  selectedPaths: string[],
  primarySourcePath: string,
  primaryTargetPath: string,
  sourceId: string,
  targetLeafPaths: string[],
  suggestExpression: (sourcePath: string, sourceId: string, targetPath: string) => string | undefined,
): BulkDropResult {
  let nextMappings = [...currentMappings];
  const occupiedTargets = new Set(nextMappings.map((m) => normalizeMapperPath(m.targetPath)));

  const targetByLeaf = new Map<string, string>();
  for (const tp of targetLeafPaths) {
    const leaf = tp.split('.').pop()?.toLowerCase() ?? '';
    if (leaf && !targetByLeaf.has(leaf)) targetByLeaf.set(leaf, tp);
  }

  let appliedCount = 0;
  for (const sp of selectedPaths) {
    let tp: string;
    if (sp === primarySourcePath) {
      tp = primaryTargetPath;
    } else {
      const leaf = sp.split('.').pop()?.toLowerCase() ?? '';
      const matched = leaf ? targetByLeaf.get(leaf) : undefined;
      if (!matched) continue;
      tp = matched;
    }
    const suggestedExpression = suggestExpression(sp, sourceId, tp);
    if (sp === primarySourcePath) {
      const applied = upsertTargetMapping(nextMappings, sp, sourceId, tp, suggestedExpression);
      if (applied.changed) {
        nextMappings = applied.next;
        occupiedTargets.add(normalizeMapperPath(tp));
        appliedCount += 1;
      }
      continue;
    }
    const normalizedTargetPath = normalizeMapperPath(tp);
    if (occupiedTargets.has(normalizedTargetPath)) continue;
    const nextMapping: Mapping = suggestedExpression
      ? { id: uuidv4(), sourcePath: sp, sourceId, targetPath: tp, expression: suggestedExpression }
      : { id: uuidv4(), sourcePath: sp, sourceId, targetPath: tp };
    nextMappings = [...nextMappings, nextMapping];
    occupiedTargets.add(normalizedTargetPath);
    appliedCount += 1;
  }

  return { nextMappings, appliedCount };
}
