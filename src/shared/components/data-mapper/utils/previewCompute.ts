/**
 * Compute the mapped target object by evaluating all mappings
 * against source sample data. Builds a target JSON containing
 * only the mapped fields — unmapped fields are omitted entirely.
 */

import { getByPath } from '../../../utils/jsonPath';
import { evaluateMapperExpression, formatExpressionResult } from './mapperExpressionEvaluator';
import { isLambda } from '@workflow/utils/lambdaUtils';
import type { Mapping, MapperSource } from '../types';
import type { ExpressionFunction } from '@workflow/utils/expressionFunctions/types';
import { coerceSampleData, toJsonPathRef } from './mapperParsing';

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
  _targetSampleData: unknown,
  customFunctions?: ExpressionFunction[],
): PreviewResult {
  const fields: PreviewField[] = [];
  const targetObject: Record<string, unknown> = {};
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
          field.value = isLambda(result.value)
            ? formatExpressionResult(result.value)
            : result.value;
        }
      } else {
        const source = sources.find((s) => s.id === (mapping.sourceId || activeSourceId));
        if (source?.sampleData != null) {
          const data = coerceSampleData(source.sampleData);
          if (data != null) {
            field.value = getByPath(data, toJsonPathRef(mapping.sourcePath));
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

