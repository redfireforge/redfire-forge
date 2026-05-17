/**
 * Expression Step-Through Debugger — Phase 9C
 *
 * Breaks a mapper expression into intermediate evaluation steps,
 * resolving each sub-expression in order so the user can see how
 * `$.price` → `29.99` → `$multiply(29.99, 100)` → `2999`.
 *
 * Uses string-aware scanning (skips quoted strings and `{{…}}` blocks)
 * to match the same surface that the evaluator sees.
 */

import type { MapperSource } from '../types';
import type { ExpressionFunction } from '../../../../features/workflow/utils/expressionFunctions/types';
import { evaluateMapperExpression, buildMapperResolveVariable, formatExpressionResult } from './mapperExpressionEvaluator';

export interface EvalStep {
  label: string;
  expression: string;
  value: unknown;
  displayValue: string;
  error?: string;
}

export interface StepDebugResult {
  steps: EvalStep[];
  finalValue: unknown;
  finalDisplay: string;
  error?: string;
}

/**
 * Break an expression into step-by-step evaluation results.
 *
 * Strategy:
 *  1. Identify sub-expressions (path refs, function calls, nested calls).
 *  2. Evaluate innermost-first, recording each step.
 *  3. Build a linear list of steps from leaves → root.
 */
export function debugExpression(
  expression: string,
  sources: MapperSource[],
  activeSourceId: string,
  customFunctions?: ExpressionFunction[],
): StepDebugResult {
  const steps: EvalStep[] = [];
  const resolve = buildMapperResolveVariable(sources, activeSourceId);

  const pathRefs = extractPathRefs(expression);
  for (const ref of pathRefs) {
    const resolved = resolve(ref);
    steps.push({
      label: 'Path Resolution',
      expression: ref,
      value: resolved,
      displayValue: resolved !== undefined ? String(resolved) : 'undefined',
    });
  }

  const fnCalls = extractFunctionCalls(expression);
  for (const call of fnCalls) {
    if (call === expression.trim()) continue;
    const result = evaluateMapperExpression(call, sources, activeSourceId, customFunctions);
    const isHof = HOF_FUNCTIONS.some(name => call.startsWith(name + '('));
    steps.push({
      label: isHof ? 'Lambda Application' : 'Function Evaluation',
      expression: call,
      value: result.value,
      displayValue: result.error ? `Error: ${result.error}` : formatExpressionResult(result.value),
      error: result.error,
    });
  }

  const finalResult = evaluateMapperExpression(expression, sources, activeSourceId, customFunctions);
  steps.push({
    label: 'Final Result',
    expression: expression.trim(),
    value: finalResult.value,
    displayValue: finalResult.error ? `Error: ${finalResult.error}` : formatExpressionResult(finalResult.value),
    error: finalResult.error,
  });

  return {
    steps,
    finalValue: finalResult.value,
    finalDisplay: finalResult.error ? `Error: ${finalResult.error}` : formatExpressionResult(finalResult.value),
    error: finalResult.error,
  };
}

const HOF_FUNCTIONS = [
  '$map', '$filter', '$reduce', '$sortBy', '$minBy', '$maxBy', '$distinctBy', '$zip',
  '$find', '$findAll',
  '$mapValues', '$mapKeys', '$withEntries',
];

const PATH_CHAR = /[\w.[*\]-]/;

/**
 * Skip a quoted string starting at position `i` (the opening quote char).
 * Returns the index after the closing quote.
 */
function skipQuoted(s: string, i: number): number {
  const q = s[i];
  let j = i + 1;
  while (j < s.length && s[j] !== q) {
    if (s[j] === '\\' && j + 1 < s.length) j += 2;
    else j++;
  }
  return j < s.length ? j + 1 : j;
}

/**
 * Skip a `{{…}}` block starting at position `i`.
 * Returns the index after the closing `}}`.
 */
function skipBraces(s: string, i: number): number {
  let depth = 1;
  let j = i + 2;
  while (j < s.length && depth > 0) {
    if (s[j] === '{' && j + 1 < s.length && s[j + 1] === '{') { depth++; j += 2; }
    else if (s[j] === '}' && j + 1 < s.length && s[j + 1] === '}') { depth--; j += 2; }
    else j++;
  }
  return j;
}

/**
 * Extract `$.path` references from the expression, skipping string literals
 * and `{{…}}` blocks to match evaluator behavior.
 */
function extractPathRefs(expr: string): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === '"' || expr[i] === "'") { i = skipQuoted(expr, i); continue; }
    if (expr[i] === '{' && i + 1 < expr.length && expr[i + 1] === '{') { i = skipBraces(expr, i); continue; }
    if (expr[i] === '$' && i + 1 < expr.length && expr[i + 1] === '.') {
      let path = '$.';
      let j = i + 2;
      while (j < expr.length && PATH_CHAR.test(expr[j])) { path += expr[j]; j++; }
      if (path.length > 2 && !seen.has(path)) {
        seen.add(path);
        refs.push(path);
      }
      i = j;
      continue;
    }
    i++;
  }
  return refs;
}

/**
 * Extract nested function calls, innermost first. Skips string literals
 * and `{{…}}` blocks during scanning and parenthesis balancing.
 *
 * For `$multiply($toNumber($.price), 100)`, returns:
 *   ['$toNumber($.price)', '$multiply($toNumber($.price), 100)']
 */
function extractFunctionCalls(expr: string): string[] {
  const calls: string[] = [];
  const seen = new Set<string>();

  function findCalls(s: string): void {
    let i = 0;
    while (i < s.length) {
      if (s[i] === '"' || s[i] === "'") { i = skipQuoted(s, i); continue; }
      if (s[i] === '{' && i + 1 < s.length && s[i + 1] === '{') { i = skipBraces(s, i); continue; }

      if (s[i] === '$' && /[a-zA-Z0-9_]/.test(s[i + 1] ?? '')) {
        const startIdx = i;
        i++;
        while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) i++;
        while (i < s.length && /\s/.test(s[i])) i++;
        if (i >= s.length || s[i] !== '(') continue;

        const parenStart = i;
        let depth = 1;
        let j = parenStart + 1;
        while (j < s.length && depth > 0) {
          if (s[j] === '"' || s[j] === "'") { j = skipQuoted(s, j); continue; }
          if (s[j] === '{' && j + 1 < s.length && s[j + 1] === '{') { j = skipBraces(s, j); continue; }
          if (s[j] === '(') depth++;
          else if (s[j] === ')') depth--;
          j++;
        }
        if (depth !== 0) continue;

        const fullCall = s.slice(startIdx, j).trim();
        const inner = s.slice(parenStart + 1, j - 1);
        findCalls(inner);

        if (!seen.has(fullCall)) {
          seen.add(fullCall);
          calls.push(fullCall);
        }
        i = j;
        continue;
      }
      i++;
    }
  }

  findCalls(expr);
  return calls;
}
