/**
 * Compute the mapped target object by evaluating all mappings
 * against source sample data. Builds a target JSON with mapped
 * values filled in and unmapped fields left as `null`.
 */

import { getByPath } from '../../../utils/jsonPath';
import { evaluateMapperExpression } from './mapperExpressionEvaluator';
import type { Mapping, MapperSource } from '../types';
import type { ExpressionFunction } from '../../../../features/workflow/utils/expressionFunctions/types';

export interface PreviewField {
  targetPath: string;
  value: unknown;
  error?: string;
  sourcePath?: string;
  hasExpression: boolean;
}

export interface PreviewResult {
  fields: PreviewField[];
  targetObject: Record<string, unknown>;
  errorCount: number;
}

/**
 * Evaluate each mapping to produce a flat list of target field results
 * and a nested target object with values set at their paths.
 */
export function computePreview(
  mappings: Mapping[],
  sources: MapperSource[],
  activeSourceId: string,
  targetSampleData: unknown,
  customFunctions?: ExpressionFunction[],
): PreviewResult {
  const fields: PreviewField[] = [];
  const rawTarget = targetSampleData != null
    ? (typeof targetSampleData === 'string' ? safeParse(targetSampleData) : targetSampleData)
    : null;
  const cloned = rawTarget != null ? deepClone(rawTarget) : {};
  const targetObject = (nullifyLeaves(cloned) ?? {}) as Record<string, unknown>;
  let errorCount = 0;

  for (const mapping of mappings) {
    const field: PreviewField = {
      targetPath: mapping.targetPath,
      sourcePath: mapping.sourcePath,
      hasExpression: !!mapping.expression,
      value: null,
    };

    try {
      if (mapping.expression) {
        const result = evaluateMapperExpression(
          mapping.expression,
          sources,
          mapping.sourceId || activeSourceId,
          customFunctions,
        );
        if (result.error) {
          field.error = result.error;
          errorCount++;
        } else {
          field.value = result.value;
        }
      } else {
        const source = sources.find((s) => s.id === (mapping.sourceId || activeSourceId));
        if (source?.sampleData != null) {
          const data = typeof source.sampleData === 'string'
            ? safeParse(source.sampleData)
            : source.sampleData;
          if (data != null) {
            const pathToResolve = mapping.sourcePath.startsWith('$.')
              ? mapping.sourcePath
              : `$.${mapping.sourcePath}`;
            field.value = getByPath(data, pathToResolve);
          }
        }
      }
    } catch (e) {
      field.error = e instanceof Error ? e.message : 'Evaluation failed';
      errorCount++;
    }

    setNestedValue(targetObject, mapping.targetPath, field.error ? null : field.value);
    fields.push(field);
  }

  return { fields, targetObject, errorCount };
}

/**
 * Parse a dot/bracket path into segments.
 * `"items[0].name"` → `["items", 0, "name"]`
 */
function parsePathSegments(path: string): (string | number)[] {
  const segments: (string | number)[] = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === '[') {
      const close = path.indexOf(']', i);
      if (close === -1) break;
      const inner = path.slice(i + 1, close);
      if (inner === '*') {
        segments.push(0);
      } else {
        const idx = Number(inner);
        segments.push(Number.isNaN(idx) ? inner : idx);
      }
      i = close + 1;
      if (path[i] === '.') i++;
    } else {
      const dot = path.indexOf('.', i);
      const bracket = path.indexOf('[', i);
      let end: number;
      if (dot === -1 && bracket === -1) end = path.length;
      else if (dot === -1) end = bracket;
      else if (bracket === -1) end = dot;
      else end = Math.min(dot, bracket);
      if (end > i) segments.push(path.slice(i, end));
      i = end;
      if (path[i] === '.') i++;
    }
  }
  return segments;
}

const UNSAFE_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const normalized = path.replace(/^\$\.?/, '');
  const segments = parsePathSegments(normalized);
  if (segments.length === 0) return;
  if (segments.some(s => typeof s === 'string' && UNSAFE_SEGMENTS.has(s))) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];
    if (current[seg] == null || typeof current[seg] !== 'object') {
      current[seg] = typeof nextSeg === 'number' ? [] : {};
    }
    current = current[seg];
  }
  current[segments[segments.length - 1]] = value;
}

function deepClone(obj: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return {};
  }
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

/**
 * Set all leaf (non-object, non-array) values to null so unmapped
 * fields show as null rather than retaining sample placeholder values.
 */
function nullifyLeaves(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => nullifyLeaves(item));
  }
  if (obj != null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = nullifyLeaves(val);
    }
    return result;
  }
  return null;
}
