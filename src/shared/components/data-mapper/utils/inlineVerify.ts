import { parseDsl, dslToModel, DSL_ASSERTION_TYPES } from './validationDsl';
import { evaluateFieldOperator, evaluateAssertions } from '../../../../engine/validator';
import { getByPath } from '../../../utils/jsonPath';
import { debugExpression, type EvalStep } from './expressionStepDebugger';
import type { MapperSource } from '../types';

export interface InlineVerifyResult {
  lineNumber: number;
  passed: boolean;
  actual?: string;
  expected?: string;
  path?: string;
  expression?: string;
  debugSteps?: EvalStep[];
  inputData?: unknown;
}

/**
 * Enrich displayValue when a JSON path resolves to undefined,
 * showing available keys at the closest resolved ancestor.
 */
export function enrichUndefined(path: string, rootData: unknown): string {
  const segments = path.replace(/^\$\./, '').split('.');
  let parent: unknown = rootData;
  let resolvedSoFar = '$';
  for (let s = 0; s < segments.length - 1; s++) {
    const seg = segments[s];
    parent = getByPath(parent, seg);
    resolvedSoFar += '.' + seg;
    if (parent === undefined) break;
  }
  if (parent !== undefined && typeof parent === 'object' && parent !== null) {
    const keys = Array.isArray(parent)
      ? `Array[${(parent as unknown[]).length}]`
      : Object.keys(parent as Record<string, unknown>).slice(0, 12).join(', ');
    return `undefined  (at ${resolvedSoFar}: ${keys})`;
  }
  return 'undefined';
}

function truncateJson(value: unknown): string {
  const s = JSON.stringify(value);
  return s?.slice(0, 80) + (s.length > 80 ? '…' : '');
}

function formatResolved(value: unknown, path: string, rootData: unknown): string {
  if (value === undefined) return enrichUndefined(path, rootData);
  return typeof value === 'object' ? truncateJson(value) : String(value);
}

function buildFieldDebugSteps(
  field: { jsonPath: string; operator?: string; operatorValue?: string; expectedValue?: string; negate?: boolean },
  actualValue: unknown,
  evalResult: { pass: boolean; actual: string; expected: string },
  effectivePass: boolean,
  responseBody: unknown,
): EvalStep[] {
  /* v8 ignore next */
  const operator = field.operator ?? 'equals';
  /* v8 ignore next */
  const opDisplay = field.operatorValue ?? field.expectedValue ?? '(no value)';
  return [
    {
      label: 'Path Resolution',
      expression: field.jsonPath,
      value: actualValue,
      displayValue: formatResolved(actualValue, field.jsonPath, responseBody),
      error: actualValue === undefined ? 'path not found' : undefined,
    },
    {
      label: 'Operator',
      expression: `${field.negate ? 'NOT ' : ''}${operator}`,
      value: field.operatorValue ?? field.expectedValue,
      displayValue: opDisplay,
    },
    {
      label: 'Result',
      expression: `${evalResult.actual} ${field.negate ? 'NOT ' : ''}${operator} ${evalResult.expected}`,
      value: effectivePass,
      displayValue: effectivePass ? 'PASS' : 'FAIL',
      error: effectivePass ? undefined : 'assertion failed',
    },
  ];
}

function buildCustomAssertDebug(
  expression: string,
  responseBody: unknown,
  debugSource: MapperSource,
): { debugSteps?: EvalStep[]; inputData?: unknown } {
  const assertCtx = { body: responseBody, status: 200, headers: {} };
  let debugSteps: EvalStep[] | undefined;
  let inputData: unknown;

  try {
    const debugResult = debugExpression(expression, [debugSource], 'response-body');
    debugSteps = debugResult.steps;
    for (const step of debugSteps) {
      if (step.label === 'Path Resolution' && step.value === undefined) {
        step.displayValue = enrichUndefined(step.expression, assertCtx);
        step.error = 'path not found';
      }
    }
  } catch { /* non-critical */ }

  const pathMatches = expression.match(/\$\.[\w.[*\]-]+/g);
  if (pathMatches && pathMatches.length > 0) {
    const inputMap: Record<string, unknown> = {};
    for (const p of pathMatches) {
      inputMap[p] = getByPath(assertCtx, p);
    }
    inputData = inputMap;
  }

  return { debugSteps, inputData };
}

function buildCollectionDebugSteps(
  a: Record<string, unknown>,
  jp: string,
  resolvedValue: unknown,
  passed: boolean,
  failures: { actual?: string }[],
  responseBody: unknown,
): EvalStep[] {
  const steps: EvalStep[] = [{
    label: 'Path Resolution',
    expression: jp,
    value: resolvedValue,
    displayValue: formatResolved(resolvedValue, jp, responseBody),
    error: resolvedValue === undefined ? 'path not found' : undefined,
  }];

  if (a.type === 'arrayLength') {
    const arr = Array.isArray(resolvedValue) ? resolvedValue : [];
    steps.push({
      label: 'Array Length', expression: `${jp}.length`,
      value: arr.length, displayValue: String(arr.length),
    });
    steps.push({
      label: 'Comparison',
      /* v8 ignore next */
      expression: `${arr.length} ${(a.operator as string) ?? '?'} ${a.value ?? '?'}`,
      value: passed, displayValue: passed ? 'PASS' : 'FAIL',
      error: passed ? undefined : 'assertion failed',
    });
  } else if (a.type === 'each') {
    const arr = Array.isArray(resolvedValue) ? resolvedValue : [];
    const fieldPath = (a.fieldPath as string) || '';
    /* v8 ignore next */
    const eachOp = (a.operator as string) ?? '';
    const eachVal = a.value as string | undefined;
    const extractedValues = arr.map((item: unknown) => fieldPath ? getByPath(item, fieldPath) : item);
    steps.push({
      label: 'Array Items',
      expression: `${jp}[*]${fieldPath ? '.' + fieldPath : ''}`,
      value: extractedValues,
      displayValue: truncateJson(extractedValues),
    });
    if (!passed) {
      const failedItems = extractedValues
        .map((val: unknown, idx: number) => ({ idx, val }))
        .filter(({ val }: { val: unknown }) => {
          try {
            /* v8 ignore next */
            const r = evaluateFieldOperator(val, eachOp as never, eachVal ?? '', eachVal ?? '');
            return !r.pass;
          } catch { /* v8 ignore next */ return true; }
        });
      if (failedItems.length > 0) {
        steps.push({
          label: 'Failed Items',
          expression: failedItems.slice(0, 5).map((fi: { idx: number; val: unknown }) => `[${fi.idx}]=${JSON.stringify(fi.val)}`).join(', ') + (failedItems.length > 5 ? ` +${failedItems.length - 5} more` : ''),
          value: failedItems.length,
          displayValue: `${failedItems.length} of ${arr.length} items failed`,
          error: 'items failed check',
        });
      }
    }
    /* v8 ignore next */
    const eachDisplay = passed ? `PASS — all ${arr.length} items match` : `FAIL — ${failures[0]?.actual ?? 'some items do not match'}`;
    steps.push({
      label: 'Each Check',
      expression: `each ${eachOp}${eachVal ? ' ' + eachVal : ''}`,
      value: passed, displayValue: eachDisplay,
      error: passed ? undefined : 'assertion failed',
    });
  } else if (a.type === 'arrayContains' || a.type === 'containsSubset') {
    /* v8 ignore start */
    const expectedItems = 'items' in a ? (a.items as unknown[]) : undefined;
    if (expectedItems) {
      steps.push({
        label: 'Expected',
        expression: a.type === 'containsSubset' ? 'subset' : 'contains',
        value: expectedItems, displayValue: truncateJson(expectedItems),
      });
      /* v8 ignore stop */
    }
    /* v8 ignore next 3 */
    const containsExpr = a.type === 'containsSubset'
      ? 'subset match'
      : `contains_${(a.mode as string) ?? 'any'}`;
    /* v8 ignore next */
    const containsActual = passed ? 'PASS' : `FAIL — ${failures[0]?.actual ?? 'not found in array'}`;
    steps.push({
      label: 'Contains Check',
      expression: containsExpr,
      value: passed, displayValue: containsActual,
      error: passed ? undefined : 'assertion failed',
    });
  }

  return steps;
}

function normalizeRulePath(path: string): string {
  return path.replace(/^\$\.?/, '');
}

/**
 * Pure function: runs inline verification of DSL rules against sample response data.
 * Extracted from ValidationRulesModal for testability.
 */
export function runInlineVerify(dslText: string, sampleResponseData: unknown): InlineVerifyResult[] {
  const responseBody = sampleResponseData != null
    ? (typeof sampleResponseData === 'string'
      ? (() => { try { return JSON.parse(sampleResponseData); } catch { return undefined; } })()
      : sampleResponseData)
    : undefined;

  if (responseBody === undefined) return [];

  const { rules } = parseDsl(dslText);
  const model = dslToModel(rules);
  const results: InlineVerifyResult[] = [];

  // Field assertions
  for (const field of model.fields) {
    const fieldKey = normalizeRulePath(field.jsonPath);
    const rule = rules.find((r) => {
      if (!r.path || r.path === '(custom)') return false;
      const ruleKey = normalizeRulePath(r.path);
      return ruleKey === fieldKey
        || `$.${ruleKey}` === field.jsonPath
        || r.path === field.jsonPath;
    });
    /* v8 ignore next 2 */
    const lineNumber = rule?.lineNumber ?? 0;
    if (!lineNumber) continue;

    const actualValue = getByPath(responseBody, field.jsonPath);
    /* v8 ignore next */
    const operator = field.operator ?? 'equals';
    const evalResult = evaluateFieldOperator(actualValue, operator, field.operatorValue, field.expectedValue);
    const effectivePass = field.negate ? !evalResult.pass : evalResult.pass;

    results.push({
      lineNumber,
      passed: effectivePass,
      actual: evalResult.actual,
      expected: evalResult.expected,
      path: field.jsonPath,
      inputData: { [field.jsonPath]: actualValue },
      debugSteps: buildFieldDebugSteps(field, actualValue, evalResult, effectivePass, responseBody),
    });
  }

  // DSL assertions (arrayLength, each, contains, custom)
  const dslAssertions = model.assertions.filter(a => DSL_ASSERTION_TYPES.has(a.type));
  if (dslAssertions.length > 0) {
    const ctx = { httpStatus: 200, responseTimeMs: 0, responseHeaders: {}, responseBody };
    const assertionRules = rules.filter(r => r.kind === 'each' || r.kind === 'length' || r.kind === 'contains_item' || r.kind === 'subset' || r.kind === 'custom');

    const debugSource: MapperSource = {
      id: 'response-body',
      label: 'Response Body',
      sampleData: { body: responseBody, status: 200, headers: {} },
      format: 'json',
    };

    let assertionIdx = 0;
    for (const a of dslAssertions) {
      const rule = assertionRules[assertionIdx];
      assertionIdx++;
      /* v8 ignore next */
      const lineNumber = rule?.lineNumber ?? 0;
      if (!lineNumber) continue;

      const { failures } = evaluateAssertions([a], ctx);
      const passed = failures.length === 0;

      let debugSteps: EvalStep[] | undefined;
      let inputData: unknown;

      if (a.type === 'custom' && a.expression) {
        const debug = buildCustomAssertDebug(a.expression, responseBody, debugSource);
        debugSteps = debug.debugSteps;
        inputData = debug.inputData;
      /* v8 ignore next */
      } else if ('jsonPath' in a) {
        const jp = (a as { jsonPath: string }).jsonPath;
        const resolvedValue = getByPath(responseBody, jp);
        inputData = { [jp]: resolvedValue };
        debugSteps = buildCollectionDebugSteps(a as Record<string, unknown>, jp, resolvedValue, passed, failures, responseBody);
      }

      results.push({
        lineNumber,
        passed,
        actual: failures[0]?.actual,
        expected: failures[0]?.expected,
        expression: a.type === 'custom' ? (a as { expression?: string }).expression : undefined,
        path: 'jsonPath' in a ? (a as { jsonPath: string }).jsonPath : undefined,
        debugSteps,
        inputData,
      });
    }
  }

  return results;
}
