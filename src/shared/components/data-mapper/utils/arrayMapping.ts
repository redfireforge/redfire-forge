/**
 * Array mapping utilities — detect array-to-array mappings,
 * infer loop/aggregate patterns, and suggest array expressions.
 */

import type { Mapping, MapperSource, MapperTarget } from '../types';
import { getByPath } from '../../../utils/jsonPath';

export type ArrayMappingKind =
  | 'loop'       // array → array (iterate each element)
  | 'aggregate'  // array → scalar (reduce to single value)
  | 'spread'     // scalar → array (uncommon, usually via $split)
  | 'direct';    // scalar → scalar (default)

export interface ArrayMappingInfo {
  mappingId: string;
  kind: ArrayMappingKind;
  sourceType: string;
  targetType: string;
  suggestedExpression?: string;
  label?: string;
}

const AGGREGATE_SUGGESTIONS: Record<string, { expr: string; label: string }> = {
  number: { expr: '$count($.PATH)', label: 'Σ $count' },
  string: { expr: '$join($.PATH, ", ")', label: 'Σ $join' },
  object: { expr: '$count($.PATH)', label: 'Σ $count' },
};

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function getSourceSample(mapping: Mapping, sources: MapperSource[], activeSourceId?: string): unknown {
  const src = sources.find((s) => s.id === (mapping.sourceId || activeSourceId));
  if (!src?.sampleData) return undefined;
  const data = typeof src.sampleData === 'string' ? safeParse(src.sampleData) : src.sampleData;
  if (data == null) return undefined;
  return getByPath(data, mapping.sourcePath);
}

function getTargetSample(targetPath: string, target: MapperTarget): unknown {
  if (!target.sampleData) return undefined;
  const data = typeof target.sampleData === 'string' ? safeParse(target.sampleData) : target.sampleData;
  if (data == null) return undefined;
  return getByPath(data, targetPath);
}

/**
 * Infer the array element type from a sample array value.
 */
export function inferArrayElementType(arr: unknown[]): string {
  if (arr.length === 0) return 'unknown';
  return inferType(arr[0]);
}

/**
 * Detect array mapping kind for a single mapping.
 */
export function classifyArrayMapping(
  mapping: Mapping,
  sources: MapperSource[],
  target: MapperTarget,
  activeSourceId?: string,
): ArrayMappingInfo {
  if (mapping.expression) {
    return { mappingId: mapping.id, kind: 'direct', sourceType: 'unknown', targetType: 'unknown' };
  }

  const sourceVal = getSourceSample(mapping, sources, activeSourceId);
  const targetVal = getTargetSample(mapping.targetPath, target);
  if (sourceVal === undefined || targetVal === undefined) {
    return { mappingId: mapping.id, kind: 'direct', sourceType: 'unknown', targetType: 'unknown' };
  }
  const sourceType = inferType(sourceVal);
  const targetType = inferType(targetVal);

  if (sourceType === 'array' && targetType === 'array') {
    return {
      mappingId: mapping.id,
      kind: 'loop',
      sourceType,
      targetType,
      label: '∞ for each',
    };
  }

  if (sourceType === 'array' && targetType !== 'array') {
    const elemType = Array.isArray(sourceVal) ? inferArrayElementType(sourceVal) : 'unknown';
    const elemMatchesTarget = elemType === targetType;
    const suggestion = elemMatchesTarget
      ? AGGREGATE_SUGGESTIONS[targetType]
      : AGGREGATE_SUGGESTIONS[elemType] ?? AGGREGATE_SUGGESTIONS[targetType];
    const normalizedPath = mapping.sourcePath.startsWith('$.') ? mapping.sourcePath : `$.${mapping.sourcePath}`;

    return {
      mappingId: mapping.id,
      kind: 'aggregate',
      sourceType,
      targetType,
      suggestedExpression: suggestion?.expr.replace('$.PATH', normalizedPath),
      label: suggestion?.label ?? 'Σ aggregate',
    };
  }

  if (sourceType !== 'array' && targetType === 'array') {
    return {
      mappingId: mapping.id,
      kind: 'spread',
      sourceType,
      targetType,
      label: '⤑ spread',
    };
  }

  return { mappingId: mapping.id, kind: 'direct', sourceType, targetType };
}

/**
 * Detect array mapping info for all mappings at once.
 */
export function detectArrayMappings(
  mappings: Mapping[],
  sources: MapperSource[],
  target: MapperTarget,
  activeSourceId?: string,
): ArrayMappingInfo[] {
  return mappings
    .map((m) => classifyArrayMapping(m, sources, target, activeSourceId))
    .filter((info) => info.kind !== 'direct');
}

/**
 * Check if a JSON path contains array wildcards like `[*]` or `[]`.
 */
export function isArrayWildcardPath(path: string): boolean {
  return /\[\*\]|\[\]/.test(path);
}

/**
 * Generate a loop expression for array-to-array mapping.
 * Uses $flatten for identity pass-through, or $jsonpath for element extraction.
 */
export function generateForEachExpression(sourcePath: string, innerPath?: string): string {
  const normalized = sourcePath.startsWith('$.') ? sourcePath : `$.${sourcePath}`;
  if (innerPath) {
    return `$jsonpath(${normalized}, "$[*].${innerPath}")`;
  }
  return `$flatten(${normalized})`;
}
