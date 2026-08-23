/**
 * Helpers for GraphQL workflow config panel "Test extraction" / "Run test" actions.
 */
import { getByPath } from '@shared/utils/jsonPath';
import { evaluateFieldOperator } from '@engine/core/fieldOperatorEvaluation';
import type { NodeRunStatus } from '@workflow/types/workflow';
import type { GraphqlExtractionRule, GraphqlWorkflowAssertion } from '@workflow/types/workflow';

export interface GraphqlRunSnapshot {
  data?: unknown;
  errors?: unknown[];
  httpStatus?: number;
  latencyMs?: number;
  /** Inner `data` of the last subscription message — used for extraction preview. */
  subscriptionLastData?: unknown;
}

export interface ExtractionTestResult {
  variableName: string;
  jsonPath: string;
  ok: boolean;
  value?: string;
  error?: string;
}

export interface AssertionTestResult {
  id: string;
  jsonPath: string;
  operator: string;
  ok: boolean;
  actual?: string;
  message?: string;
}

export function buildGraphqlRunSnapshot(snapshot: GraphqlRunSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseGraphqlRunSnapshot(
  status: NodeRunStatus | null | undefined,
): GraphqlRunSnapshot | null {
  if (!status?.responseDetail?.trim()) return null;
  try {
    return JSON.parse(status.responseDetail) as GraphqlRunSnapshot;
  } catch {
    return null;
  }
}

export function hasGraphqlRunData(status: NodeRunStatus | null | undefined): boolean {
  if (!status || status.state === 'idle' || status.state === 'pending') return false;
  const snap = parseGraphqlRunSnapshot(status);
  if (snap?.data !== undefined || snap?.subscriptionLastData !== undefined) return true;
  return !!(status.extracted && Object.keys(status.extracted).length > 0);
}

export function getExtractionTestRoot(
  snapshot: GraphqlRunSnapshot | null,
  mode: 'query' | 'subscription',
): unknown {
  if (!snapshot) return undefined;
  return mode === 'subscription'
    ? (snapshot.subscriptionLastData ?? snapshot.data)
    : snapshot.data;
}

export function buildExtractedVariableMap(
  rules: GraphqlExtractionRule[],
  dataRoot: unknown,
): Record<string, string> {
  const extracted: Record<string, string> = {};
  for (const rule of rules) {
    if (!rule.variableName?.trim() || !rule.jsonPath?.trim()) continue;
    const val = getByPath(dataRoot, rule.jsonPath);
    extracted[rule.variableName] = val === undefined ? '' : JSON.stringify(val);
  }
  return extracted;
}

export function testGraphqlExtractionRules(
  rules: GraphqlExtractionRule[],
  dataRoot: unknown,
): ExtractionTestResult[] {
  return rules.map((rule) => {
    const variableName = rule.variableName?.trim() ?? '';
    const jsonPath = rule.jsonPath?.trim() ?? '';
    if (!jsonPath) {
      return { variableName, jsonPath, ok: false, error: 'JSONPath is required' };
    }
    if (!variableName) {
      return { variableName, jsonPath, ok: false, error: 'Variable name is required' };
    }
    try {
      const val = getByPath(dataRoot, jsonPath);
      if (val === undefined) {
        return { variableName, jsonPath, ok: false, error: 'Path not found in response data' };
      }
      return {
        variableName,
        jsonPath,
        ok: true,
        value: JSON.stringify(val),
      };
    } catch (err) {
      return {
        variableName,
        jsonPath,
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid JSONPath',
      };
    }
  });
}

/** Strip optional `{{ }}` wrapper from a workflow variable reference. */
export function normalizeWorkflowVarRef(name: string): string {
  const trimmed = name.trim();
  const m = trimmed.match(/^\{\{(.+)\}\}$/);
  return (m ? m[1] : trimmed).trim();
}

export function resolveRuntimeVariableValue(
  sourceVariable: string | undefined,
  runtimeVariables: Record<string, string> | undefined,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const key = normalizeWorkflowVarRef(sourceVariable ?? '');
  if (!key) {
    return { ok: false, error: 'Source variable is required' };
  }
  if (!runtimeVariables || !(key in runtimeVariables)) {
    return { ok: false, error: 'No data — run the workflow first.' };
  }
  const raw = runtimeVariables[key];
  if (raw === undefined || raw === '') {
    return { ok: false, error: `Variable "${key}" is empty` };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: true, value: raw };
  }
}

export function testGraphqlAssertions(
  assertions: GraphqlWorkflowAssertion[],
  sourceValue: unknown,
): AssertionTestResult[] {
  return assertions.map((assertion) => {
    const jsonPath = assertion.jsonPath?.trim() ?? '';
    if (!jsonPath) {
      return {
        id: assertion.id,
        jsonPath,
        operator: assertion.operator,
        ok: false,
        message: 'JSONPath is required',
      };
    }
    const actual = getByPath(sourceValue, jsonPath);
    const result = evaluateFieldOperator(
      actual,
      assertion.operator,
      undefined,
      assertion.expectedValue ?? '',
    );
    return {
      id: assertion.id,
      jsonPath,
      operator: assertion.operator,
      ok: result.pass,
      actual: actual === undefined ? 'undefined' : JSON.stringify(actual),
      message: result.pass
        ? undefined
        : (assertion.description
          || `${jsonPath} ${assertion.operator} ${assertion.expectedValue ?? ''}: got ${JSON.stringify(actual)}`),
    };
  });
}
