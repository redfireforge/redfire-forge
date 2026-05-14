import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { ExpectedField, Assertion } from '../../../types';
import type { Mapping, MapperAdapter } from '../types';
import { evaluateFieldOperator, validateFieldsUnordered } from '../../../../engine/validator';
import { evaluateAssertions } from '../../../../engine/validator';
import type { AssertionContext } from '../../../../engine/validator';
import { getByPath } from '../../../utils/jsonPath';

function stripDollarPrefix(p: string): string {
  return p.startsWith('$.') ? p.slice(2) : p;
}

function pathsMatch(a: string, b: string): boolean {
  return stripDollarPrefix(a) === stripDollarPrefix(b);
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
  const lastRunRef = useRef(0);
  const verifyTimestampRef = useRef(0);

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

    if (expectedFields.length === 0 && assertions.length === 0) {
      setResult(EMPTY_RESULT);
      return;
    }

    // 2. Evaluate field operators against sample data
    const fieldResults = new Map<string, FieldVerifyResult>();
    const failedMappingIds = new Set<string>();
    let passedCount = 0;
    let failedCount = 0;

    const responseBody = parseSampleData(sampleResponseData);

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
        const actualValue = getByPath(responseBody, field.jsonPath);
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
          const mapping = mappings.find(m => pathsMatch(m.targetPath, field.jsonPath) || pathsMatch(m.sourcePath, field.jsonPath));
          if (mapping) failedMappingIds.add(mapping.id);
        }
      }
    }

    // 3. Evaluate standalone assertions against sample data
    // Skip HTTP-level assertions (status, header, responseTime) that cannot be
    // meaningfully evaluated against sample body data alone.
    const HTTP_ONLY_TYPES = new Set(['status', 'responseTime', 'header']);
    const assertionResults: AssertionVerifyResult[] = [];
    let skippedCount = 0;

    if (assertions.length > 0) {
      if (responseBody === undefined) {
        // No sample body — mark all assertions as skipped
        assertions.forEach((assertion, index) => {
          assertionResults.push({
            assertion,
            index,
            passed: true,
            actual: 'skipped (no sample data)',
          });
          skippedCount++;
        });
      } else {
        const bodyAssertions = assertions.filter(a => !HTTP_ONLY_TYPES.has(a.type));
        const httpAssertions = assertions.filter(a => HTTP_ONLY_TYPES.has(a.type));

        // Mark HTTP-only assertions as skipped
        httpAssertions.forEach((assertion) => {
          const originalIndex = assertions.indexOf(assertion);
          assertionResults.push({
            assertion,
            index: originalIndex,
            passed: true,
            actual: 'skipped (no HTTP context)',
          });
          skippedCount++;
        });

        if (bodyAssertions.length > 0) {
          const ctx: AssertionContext = {
            httpStatus: 200,
            responseTimeMs: 0,
            responseHeaders: {},
            responseBody,
          };

          for (const assertion of bodyAssertions) {
            const originalIndex = assertions.indexOf(assertion);
            const { failures: af } = evaluateAssertions([assertion], ctx);
            const passed = af.length === 0;

            assertionResults.push({
              assertion,
              index: originalIndex,
              passed,
              actual: af[0]?.actual,
              expected: af[0]?.expected,
            });

            if (passed) {
              passedCount++;
            } else {
              failedCount++;
              const assertionPath = getAssertionPath(assertion);
              const mapping = mappings.find(m =>
                pathsMatch(m.targetPath, assertionPath) ||
                pathsMatch(m.sourcePath, assertionPath),
              );
              if (mapping) failedMappingIds.add(mapping.id);
            }
          }
        }
      }
    }

    const now = Date.now();
    lastRunRef.current = now;
    verifyTimestampRef.current = now;

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

  // NOTE: Invalidation of stale verify results when inputs change is not needed here because
  // verifyTimestampRef tracks when the last verify ran, and components consuming nodeStatusMap
  // should prompt re-verification via the toolbar button. Automatic invalidation caused
  // issues with React's batched updates.

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
      // Also register by targetPath so TargetTreeNode can resolve status
      // when sourcePath differs from targetPath
      const mapping = mappings.find(m =>
        pathsMatch(m.sourcePath, path) || pathsMatch(m.targetPath, path),
      );
      if (mapping) {
        map.set(mapping.targetPath, status);
        const strippedTarget = stripDollarPrefix(mapping.targetPath);
        if (strippedTarget) map.set(strippedTarget, status);
      }
    }
    return map;
  }, [result.fieldResults, mappings]);

  return {
    result,
    verifyAll,
    reset,
    getNodeStatus,
    nodeStatusMap,
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

function getAssertionPath(assertion: Assertion): string {
  const a = assertion as Record<string, unknown>;
  return (typeof a.jsonPath === 'string' && a.jsonPath)
    || (typeof a.name === 'string' && a.name)
    || assertion.type;
}

