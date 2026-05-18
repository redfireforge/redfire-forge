/**
 * Shared parsing/coercion helpers used across Data Mapper utils, adapters, and panels.
 * Consolidates duplicated safeParse / parseSample / path normalization patterns.
 */

import type { Mapping, MapperSource, MapperTarget } from '../types';
import { getByPath } from '../../../utils/jsonPath';

/**
 * Try to parse a JSON string, returning null on failure.
 * Replaces duplicate `safeParse` functions across arrayMapping, previewCompute,
 * typeMismatch, expressionSuggestions, and mapperExpressionEvaluator.
 */
export function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

/**
 * Coerce a sample data value (string JSON or already-parsed object) to its parsed form.
 * Returns undefined if the data is null/undefined or unparseable.
 * Replaces the identical `parseSample` in extraction, assertion, validation, and webhook adapters.
 */
export function coerceSampleData(raw?: unknown): unknown | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') return safeParse(raw) ?? undefined;
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw;
  return undefined;
}

/**
 * Normalize a mapper path to JSONPath `$.` prefix form.
 * Replaces inline `path.startsWith('$.') ? path : '$.'+path` duplicated in
 * previewCompute, typeMismatch, expressionSuggestions, and mapperExpressionEvaluator.
 */
export function toJsonPathRef(path: string): string {
  return path.startsWith('$.') ? path : `$.${path}`;
}

/**
 * Resolve a source's sample data for a given mapping.
 * Uses the mapping's sourceId (falling back to activeSourceId) to find the source,
 * then parses/coerces and returns the value at the mapping's sourcePath.
 */
export function resolveSourceValue(
  mapping: Mapping,
  sources: MapperSource[],
  activeSourceId?: string,
): unknown {
  const src = sources.find((s) => s.id === (mapping.sourceId || activeSourceId));
  if (!src?.sampleData) return undefined;
  const data = coerceSampleData(src.sampleData);
  if (data == null) return undefined;
  return getByPath(data, mapping.sourcePath);
}

/**
 * Resolve the value at a target path from the target's sample data.
 */
export function resolveTargetValue(
  targetPath: string,
  target: MapperTarget,
): unknown {
  if (!target.sampleData) return undefined;
  const data = coerceSampleData(target.sampleData);
  if (data == null) return undefined;
  return getByPath(data, targetPath);
}
