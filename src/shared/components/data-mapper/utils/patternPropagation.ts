import type { Mapping } from '../types';
import { normalizeMapperPath } from './pathNormalization';

const INDEX_PATTERN = /\[(\d+)\]/g;

export type PropagationAction = 'new' | 'update' | 'unchanged' | 'missing-source';

export interface PatternPropagationRow {
  targetPath: string;
  sourcePath: string;
  action: PropagationAction;
  existingSourcePath?: string;
  existingExpression?: string;
  projectedExpression?: string;
}

export interface PatternPropagationPreview {
  anchorMappingId: string;
  anchorSourcePath: string;
  anchorTargetPath: string;
  sourceId: string;
  rows: PatternPropagationRow[];
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  missingSourceCount: number;
}

function wildcardIndexPath(path: string): string {
  return normalizeMapperPath(path).replace(/\[\d+\]/g, '[*]');
}

function extractIndices(path: string): string[] {
  const indices: string[] = [];
  const normalized = normalizeMapperPath(path);
  normalized.replace(INDEX_PATTERN, (_, index) => {
    indices.push(index);
    return `[${index}]`;
  });
  return indices;
}

function buildIndexedTemplate(path: string): { template: string; indexCount: number } {
  let indexCount = 0;
  const template = normalizeMapperPath(path).replace(INDEX_PATTERN, () => `[#${indexCount++}]`);
  return { template, indexCount };
}

function applyIndexedTemplate(template: string, indices: string[]): string {
  return template.replace(/\[#(\d+)\]/g, (_, idxText: string) => {
    const idx = Number(idxText);
    if (!Number.isFinite(idx) || indices[idx] == null) return '';
    return `[${indices[idx]}]`;
  });
}

export function projectPatternExpression(
  expression: string | undefined,
  anchorSourcePath: string,
  nextSourcePath: string,
): string | undefined {
  if (!expression) return expression;
  const anchorNormalized = normalizeMapperPath(anchorSourcePath);
  const nextNormalized = normalizeMapperPath(nextSourcePath);
  const anchorWithDollar = `$.${anchorNormalized}`;
  const nextWithDollar = `$.${nextNormalized}`;

  const directReplacement = anchorSourcePath.trim().startsWith('$.') ? nextWithDollar : nextSourcePath;
  let projected = expression.split(anchorSourcePath).join(directReplacement);
  projected = projected.split(anchorWithDollar).join(nextWithDollar);
  if (anchorNormalized !== anchorSourcePath) {
    projected = projected.split(anchorNormalized).join(nextNormalized);
  }
  return projected;
}

function countActions(rows: PatternPropagationRow[]): {
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  missingSourceCount: number;
} {
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let missingSourceCount = 0;
  for (const row of rows) {
    if (row.action === 'new') insertedCount += 1;
    else if (row.action === 'update') updatedCount += 1;
    else if (row.action === 'unchanged') unchangedCount += 1;
    else if (row.action === 'missing-source') missingSourceCount += 1;
  }
  return { insertedCount, updatedCount, unchangedCount, missingSourceCount };
}

export function buildPatternPropagationPreview(
  anchorMapping: Mapping,
  currentMappings: Mapping[],
  sourceLeafPaths: string[],
  targetLeafPaths: string[],
  activeSourceId: string,
): PatternPropagationPreview | null {
  const anchorSourcePath = normalizeMapperPath(anchorMapping.sourcePath);
  const anchorTargetPath = normalizeMapperPath(anchorMapping.targetPath);
  const sourceId = anchorMapping.sourceId || activeSourceId;

  const sourceTemplate = buildIndexedTemplate(anchorSourcePath);
  const targetTemplate = buildIndexedTemplate(anchorTargetPath);
  if (sourceTemplate.indexCount === 0 || targetTemplate.indexCount === 0) {
    return null;
  }

  const normalizedSourceLeaves = sourceLeafPaths.map(normalizeMapperPath);
  const normalizedTargetLeaves = targetLeafPaths.map(normalizeMapperPath);
  const sourceLeafSet = new Set(normalizedSourceLeaves);
  const targetWildcard = wildcardIndexPath(anchorTargetPath);
  const existingByTarget = new Map<string, Mapping>();
  for (const mapping of currentMappings) {
    existingByTarget.set(normalizeMapperPath(mapping.targetPath), mapping);
  }

  const rows: PatternPropagationRow[] = [];
  for (const targetPath of normalizedTargetLeaves) {
    if (wildcardIndexPath(targetPath) !== targetWildcard) continue;
    const indices = extractIndices(targetPath);
    if (indices.length !== sourceTemplate.indexCount) continue;
    const sourcePath = applyIndexedTemplate(sourceTemplate.template, indices);
    if (!sourcePath) continue;

    const projectedExpression = projectPatternExpression(
      anchorMapping.expression,
      anchorSourcePath,
      sourcePath,
    );
    const existing = existingByTarget.get(targetPath);
    if (!sourceLeafSet.has(sourcePath)) {
      rows.push({
        targetPath,
        sourcePath,
        action: 'missing-source',
        existingSourcePath: existing?.sourcePath,
        existingExpression: existing?.expression,
        projectedExpression,
      });
      continue;
    }

    if (!existing) {
      rows.push({
        targetPath,
        sourcePath,
        action: 'new',
        projectedExpression,
      });
      continue;
    }

    const existingSourcePath = normalizeMapperPath(existing.sourcePath);
    const existingExpression = existing.expression;
    const expectedExpression = projectedExpression;
    const sameMapping =
      existingSourcePath === sourcePath
      && (existing.sourceId || activeSourceId) === sourceId
      && (existingExpression ?? undefined) === (expectedExpression ?? undefined);

    rows.push({
      targetPath,
      sourcePath,
      action: sameMapping ? 'unchanged' : 'update',
      existingSourcePath: existing.sourcePath,
      existingExpression,
      projectedExpression,
    });
  }

  if (rows.length === 0) return null;
  const counts = countActions(rows);
  return {
    anchorMappingId: anchorMapping.id,
    anchorSourcePath,
    anchorTargetPath,
    sourceId,
    rows: rows.sort((left, right) => left.targetPath.localeCompare(right.targetPath)),
    ...counts,
  };
}
