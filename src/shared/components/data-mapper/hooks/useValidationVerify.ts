import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { ExpectedField, Assertion } from '../../../types';
import type { Mapping, MapperAdapter, MapperSource } from '../types';
import { evaluateFieldOperator, evaluateAssertions, validateFieldsUnordered } from '@engine/validator';
import { getByPath, stripJsonPathPrefix } from '../../../utils/jsonPath';
import { DSL_ASSERTION_TYPES } from '../utils/validationDsl';
import { evaluateMapperExpression } from '../utils/mapperExpressionEvaluator';

function pathsMatch(a: string, b: string): boolean {
  return stripJsonPathPrefix(a) === stripJsonPathPrefix(b);
}

// ─── Types ────────────────────────────────────────────────

export interface FieldVerifyResult {
  path: string;
  passed: boolean;
  actual?: string;
  expected?: string;
  operator?: string;
  matchContext?: string;
}

export interface AssertionVerifyResult {
  assertion: Assertion;
  index: number;
  passed: boolean;
  actual?: string;
  expected?: string;
}

export interface VerifyResult {
  status: 'idle' | 'running' | 'complete';
  fieldResults: Map<string, FieldVerifyResult>;
  assertionResults: AssertionVerifyResult[];
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  failedMappingIds: Set<string>;
  timestamp: number;
}

const EMPTY_RESULT: VerifyResult = {
  status: 'idle',
  fieldResults: new Map(),
  assertionResults: [],
  passedCount: 0,
  failedCount: 0,
  skippedCount: 0,
  failedMappingIds: new Set(),
  timestamp: 0,
};

// ─── Hook ─────────────────────────────────────────────────

interface UseValidationVerifyOptions {
  mappings: Mapping[];
  assertions: Assertion[];
  sampleResponseData: unknown;
  adapter: MapperAdapter;
  enabled: boolean;
  autoVerify?: boolean;
  unorderedArrays?: boolean;
}

export function useValidationVerify({
  mappings,
  assertions,
  sampleResponseData,
  adapter,
  enabled,
  autoVerify = false,
  unorderedArrays = false,
}: UseValidationVerifyOptions) {
  const [result, setResult] = useState<VerifyResult>(EMPTY_RESULT);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeVerification = useCallback(() => {
    setResult(prev => ({ ...prev, status: 'running' }));

    // 1. Serialize mappings to ExpectedField[] using adapter
    let expectedFields: ExpectedField[] = [];
    try {
      if (adapter.serialize) {
        const output = adapter.serialize(mappings);
        if (output && typeof output === 'object' && 'expectedFields' in output) {
          expectedFields = (output as { expectedFields?: ExpectedField[] }).expectedFields ?? [];
        }
      }
    } catch { /* ignore serialization errors */ }

    // Filter out fields pointing to arrays/objects — only allow operators
    // that genuinely apply to container types (is_empty, is_type, etc.).
    // Other operators (equals, exists, contains, etc.) on array/object
    // nodes produce confusing "Expected: object Got: array" errors.
    const CONTAINER_ALLOWED_OPS = new Set([
      'is_empty', 'is_not_empty', 'is_type', 'is_null', 'is_not_null',
    ]);
    const responseBody = parseSampleData(sampleResponseData);
    if (responseBody !== undefined) {
      expectedFields = expectedFields.filter(f => {
        const p = f.jsonPath;
        if (!p || p === '$' || p === '$.') return true;
        const val = getByPath(responseBody, p);
        if (val === undefined || val === null || typeof val !== 'object') return true;
        return CONTAINER_ALLOWED_OPS.has(f.operator ?? 'equals');
      });
    }

    const dslAssertions = assertions.filter(a => DSL_ASSERTION_TYPES.has(a.type));

    if (expectedFields.length === 0 && dslAssertions.length === 0) {
      setResult(EMPTY_RESULT);
      return;
    }

    // 2. Evaluate field operators against sample data
    const fieldResults = new Map<string, FieldVerifyResult>();
    const failedMappingIds = new Set<string>();
    let passedCount = 0;
    let failedCount = 0;

    if (unorderedArrays && expectedFields.length > 0 && responseBody !== undefined) {
      const failures = validateFieldsUnordered(expectedFields, responseBody);
      const failedPaths = new Set(failures.map(f => f.path));

      for (const field of expectedFields) {
        const failure = failures.find(f => f.path === field.jsonPath);
        const passed = !failedPaths.has(field.jsonPath);
        const operator = field.operator ?? 'equals';
        const negPrefix = field.negate ? 'NOT ' : '';
        const stripped = stripMatchContext(failure?.actual);

        fieldResults.set(field.jsonPath, {
          path: field.jsonPath,
          passed,
          actual: failure ? stripped.value : String(getByPath(responseBody, field.jsonPath) ?? 'undefined'),
          expected: failure ? `${negPrefix}${failure.expected}` : `${negPrefix}(match)`,
          operator,
          matchContext: stripped.context,
        });

        if (passed) {
          passedCount++;
        } else {
          failedCount++;
          const mapping = mappings.find(m => pathsMatch(m.targetPath, field.jsonPath) || pathsMatch(m.sourcePath, field.jsonPath));
          if (mapping) failedMappingIds.add(mapping.id);
        }
      }
    } else {
      for (const field of expectedFields) {
        const mapping = mappings.find(m => pathsMatch(m.targetPath, field.jsonPath) || pathsMatch(m.sourcePath, field.jsonPath));
        let actualValue: unknown = getByPath(responseBody, field.jsonPath);

        if (mapping?.expression && responseBody !== undefined) {
          const src: MapperSource = { id: mapping.sourceId || 'response-body', label: '', sampleData: responseBody, format: 'json' };
          const exprResult = evaluateMapperExpression(mapping.expression, [src], src.id);
          if (!exprResult.error && exprResult.value !== undefined) {
            const sv = typeof exprResult.value === 'string' ? exprResult.value : JSON.stringify(exprResult.value);
            if (!sv.startsWith('{{')) actualValue = exprResult.value;
          }
        }

        const operator = field.operator ?? 'equals';
        const evalResult = evaluateFieldOperator(
          actualValue,
          operator,
          field.operatorValue,
          field.expectedValue,
        );

        const effectivePass = field.negate ? !evalResult.pass : evalResult.pass;
        const negPrefix = field.negate ? 'NOT ' : '';
        const verifyResult: FieldVerifyResult = {
          path: field.jsonPath,
          passed: effectivePass,
          actual: evalResult.actual,
          expected: `${negPrefix}${evalResult.expected}`,
          operator,
        };
        fieldResults.set(field.jsonPath, verifyResult);

        if (effectivePass) {
          passedCount++;
        } else {
          failedCount++;
          if (mapping) failedMappingIds.add(mapping.id);
        }
      }
    }

    // Evaluate DSL-originated assertions (arrayLength, typeCheck, existence, etc.)
    // so the verify count matches the total DSL rule count visible to the user.
    // Non-DSL assertions (status, responseTime, header) are skipped — they belong
    // to the Test Editor's own verify flow.
    const assertionResults: AssertionVerifyResult[] = [];
    let skippedCount = 0;

    if (dslAssertions.length > 0 && responseBody !== undefined) {
      const ctx = { httpStatus: 200, responseTimeMs: 0, responseHeaders: {}, responseBody };

      for (let i = 0; i < dslAssertions.length; i++) {
        const a = dslAssertions[i];
        const { failures: af } = evaluateAssertions([a], ctx);
        const passed = af.length === 0;

        assertionResults.push({
          assertion: a,
          index: i,
          passed,
          actual: af[0]?.actual,
          expected: af[0]?.expected,
        });

        if (passed) {
          passedCount++;
        } else {
          failedCount++;
        }
      }
    } else if (dslAssertions.length > 0) {
      skippedCount = dslAssertions.length;
    }

    const now = Date.now();

    setResult({
      status: 'complete',
      fieldResults,
      assertionResults,
      passedCount,
      failedCount,
      skippedCount,
      failedMappingIds,
      timestamp: now,
    });
  }, [mappings, assertions, sampleResponseData, adapter, unorderedArrays]);

  // Auto-verify with debounce
  useEffect(() => {
    if (!enabled || !autoVerify) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      executeVerification();
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [enabled, autoVerify, mappings, assertions, sampleResponseData, executeVerification]);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      setResult(EMPTY_RESULT);
    }
  }, [enabled]);

  const verifyAll = useCallback(() => {
    executeVerification();
  }, [executeVerification]);

  const reset = useCallback(() => {
    setResult(EMPTY_RESULT);
  }, []);

  const getNodeStatus = useCallback((path: string): 'pass' | 'fail' | undefined => {
    if (result.status !== 'complete') return undefined;
    const normalizedPath = path.startsWith('$.') ? path : `$.${path}`;
    const fieldResult = result.fieldResults.get(normalizedPath) ?? result.fieldResults.get(path);
    if (!fieldResult) return undefined;
    return fieldResult.passed ? 'pass' : 'fail';
  }, [result]);

  const nodeStatusMap = useMemo(() => {
    const map = new Map<string, 'pass' | 'fail'>();
    for (const [path, r] of result.fieldResults) {
      const status = r.passed ? 'pass' : 'fail';
      map.set(path, status);
      const stripped = path.replace(/^\$\.?/, '');
      if (stripped) map.set(stripped, status);
      const mapping = mappings.find(m =>
        pathsMatch(m.sourcePath, path) || pathsMatch(m.targetPath, path),
      );
      if (mapping) {
        map.set(mapping.targetPath, status);
        const strippedTarget = stripJsonPathPrefix(mapping.targetPath);
        if (strippedTarget) map.set(strippedTarget, status);
      }
    }
    for (const ar of result.assertionResults) {
      if (!('jsonPath' in ar.assertion)) continue;
      const aPath = (ar.assertion as { jsonPath: string }).jsonPath;
      const status = ar.passed ? 'pass' : 'fail';
      if (!map.has(aPath) || status === 'fail') map.set(aPath, status);
      const stripped = aPath.replace(/^\$\.?/, '');
      if (stripped && (!map.has(stripped) || status === 'fail')) map.set(stripped, status);
    }
    return map;
  }, [result.fieldResults, result.assertionResults, mappings]);

  const mergedFieldResults = useMemo(() => {
    const map = new Map<string, { passed: boolean; actual?: string; expected?: string; matchContext?: string }>();
    for (const [path, r] of result.fieldResults) {
      map.set(path, r);
    }
    for (const ar of result.assertionResults) {
      if (!('jsonPath' in ar.assertion)) continue;
      const aPath = (ar.assertion as { jsonPath: string }).jsonPath;
      const entry = { passed: ar.passed, actual: ar.actual, expected: ar.expected };
      const existing = map.get(aPath);
      if (!existing || (!ar.passed && existing.passed)) map.set(aPath, entry);
      const stripped = aPath.replace(/^\$\.?/, '');
      if (stripped) {
        const existingStripped = map.get(stripped);
        if (!existingStripped || (!ar.passed && existingStripped.passed)) map.set(stripped, entry);
      }
    }
    return map;
  }, [result.fieldResults, result.assertionResults]);

  return {
    result,
    verifyAll,
    reset,
    getNodeStatus,
    nodeStatusMap,
    mergedFieldResults,
  };
}

// ─── Helpers ──────────────────────────────────────────────

function parseSampleData(data: unknown): unknown {
  if (data === null || data === undefined) return undefined;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return data; }
  }
  return data;
}

function stripMatchContext(actual: string | undefined): { value: string; context?: string } {
  if (!actual) return { value: 'undefined' };
  const idx = actual.indexOf(' (matched by ');
  if (idx === -1) return { value: actual };
  return { value: actual.slice(0, idx), context: actual.slice(idx + 1) };
}


