/**
 * Mapper expression evaluator — bridges the existing workflow expression engine
 * with mapper-specific `$.path` JSONPath resolution against source sample data.
 *
 * Reuses:
 *  - evaluateExpression / formatExpressionResult from expressionEvaluator.ts
 *  - EXPRESSION_FUNCTION_MAP from expressionFunctions/
 *  - getByPath from shared/utils/jsonPath.ts
 *
 * Does NOT duplicate any evaluator, tokenizer, parser, or function registry logic.
 */

import { evaluateExpression, formatExpressionResult } from '../../../../features/workflow/utils/expressionEvaluator';
import type { EvalContext } from '../../../../features/workflow/utils/expressionEvaluator';
import { EXPRESSION_FUNCTION_MAP } from '../../../../features/workflow/utils/expressionFunctions';
import type { ExpressionFunction } from '../../../../features/workflow/utils/expressionFunctions/types';
import { getByPath } from '../../../utils/jsonPath';
import type { MapperSource } from '../types';

export { formatExpressionResult } from '../../../../features/workflow/utils/expressionEvaluator';

export interface MapperEvalResult {
  value: unknown;
  preview: string;
  error?: string;
}

/**
 * Build a resolveVariable callback that resolves `$.path` references
 * against source sample data using the canonical JSONPath engine.
 *
 * Resolution order:
 *  1. `$.path` → getByPath(activeSourceData, "path")
 *  2. `sourceId.path` → getByPath(that source's data, "path")
 *  3. `{{varName}}` style → falls through to the evaluator's default handling
 */
export function buildMapperResolveVariable(
  sources: MapperSource[],
  activeSourceId: string,
): (name: string) => string | undefined {
  const sourceDataMap = new Map<string, unknown>();
  for (const src of sources) {
    if (src.sampleData != null) {
      const data = typeof src.sampleData === 'string'
        ? safeJsonParse(src.sampleData)
        : src.sampleData;
      if (data != null) sourceDataMap.set(src.id, data);
    }
  }

  return (name: string): string | undefined => {
    // $.path → resolve against active source
    if (name.startsWith('$.') || name === '$') {
      const path = name === '$' ? '$' : name;
      const data = sourceDataMap.get(activeSourceId);
      if (data === undefined) return undefined;
      const val = getByPath(data, path);
      return val === undefined ? undefined : formatValue(val);
    }

    // sourceId.path → resolve against specific source
    for (const [sid, data] of sourceDataMap) {
      if (name.startsWith(`${sid}.`)) {
        const path = name.slice(sid.length + 1);
        const val = getByPath(data, path);
        return val === undefined ? undefined : formatValue(val);
      }
    }

    // Bare name → try active source first (direct field access)
    const activeData = sourceDataMap.get(activeSourceId);
    if (activeData !== undefined) {
      const val = getByPath(activeData, name);
      if (val !== undefined) return formatValue(val);
    }

    return undefined;
  };
}

/**
 * Pre-process expression to convert `$.path` references into `{{$.path}}`
 * so the existing tokenizer treats them as variable references, not function calls.
 *
 * Walks the string character-by-character to skip quoted strings (single/double)
 * and already-wrapped `{{ }}` blocks, avoiding false positives.
 * Supports hyphenated keys (e.g. `$.Content-Type`), brackets, and wildcards.
 */
function wrapDollarPaths(expr: string): string {
  const PATH_CHAR = /[\w.[*\]-]/;
  let result = '';
  let i = 0;

  while (i < expr.length) {
    // Skip quoted strings
    if (expr[i] === '"' || expr[i] === "'") {
      const q = expr[i];
      result += q;
      i++;
      while (i < expr.length && expr[i] !== q) {
        if (expr[i] === '\\' && i + 1 < expr.length) { result += expr[i] + expr[i + 1]; i += 2; }
        else { result += expr[i]; i++; }
      }
      if (i < expr.length) { result += expr[i]; i++; }
      continue;
    }

    // Skip already-wrapped {{...}}
    if (expr[i] === '{' && expr[i + 1] === '{') {
      let depth = 1;
      result += '{{';
      i += 2;
      while (i < expr.length && depth > 0) {
        if (expr[i] === '{' && expr[i + 1] === '{') { depth++; result += '{{'; i += 2; }
        else if (expr[i] === '}' && expr[i + 1] === '}') { depth--; result += '}}'; i += 2; }
        else { result += expr[i]; i++; }
      }
      continue;
    }

    // Match $.path pattern
    if (expr[i] === '$' && expr[i + 1] === '.') {
      let path = '$.';
      let j = i + 2;
      while (j < expr.length && PATH_CHAR.test(expr[j])) { path += expr[j]; j++; }
      if (path.length > 2) {
        result += `{{${path}}}`;
        i = j;
        continue;
      }
    }

    result += expr[i];
    i++;
  }

  return result;
}

/**
 * Evaluate a mapper expression against source sample data.
 *
 * Supports all existing expression syntax: `$fn()`, `{{var}}`, literals, nesting.
 * Adds `$.path` JSONPath resolution for mapper-specific source data access.
 */
export function evaluateMapperExpression(
  expression: string,
  sources: MapperSource[],
  activeSourceId: string,
  customFunctions?: ExpressionFunction[],
): MapperEvalResult {
  const saved = customFunctions?.length ? registerCustomFunctions(customFunctions) : null;

  try {
    const ctx: EvalContext = {
      resolveVariable: buildMapperResolveVariable(sources, activeSourceId),
    };

    const processed = wrapDollarPaths(expression);
    const result = evaluateExpression(processed, ctx);

    return {
      value: result.value,
      preview: result.error ? '' : formatExpressionResult(result.value),
      error: result.error,
    };
  } catch (e) {
    return {
      value: undefined,
      preview: '',
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    if (saved) restoreCustomFunctions(saved);
  }
}

/**
 * Evaluate a simple path (no expression) — just resolve `$.path` against source data.
 * Used for direct drag-and-drop mappings that have no expression.
 */
export function resolveMapperPath(
  sourcePath: string,
  sources: MapperSource[],
  activeSourceId: string,
): unknown {
  const resolve = buildMapperResolveVariable(sources, activeSourceId);
  const pathRef = sourcePath.startsWith('$.') ? sourcePath : `$.${sourcePath}`;
  const result = resolve(pathRef);
  if (result === undefined) return undefined;
  try { return JSON.parse(result); } catch { return result; }
}

// ── Helpers ──

function formatValue(val: unknown): string {
  if (val === undefined) return '';
  if (val === null) return 'null';
  if (typeof val === 'object') {
    try { return JSON.stringify(val); } catch { return '[Object]'; }
  }
  return String(val);
}

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

/**
 * Register custom functions, saving previous values so they can be restored.
 * Returns a snapshot for restoreCustomFunctions — guarantees safe cleanup
 * even if multiple evaluations interleave.
 */
function registerCustomFunctions(
  fns: ExpressionFunction[],
): Map<string, ExpressionFunction | undefined> {
  const snapshot = new Map<string, ExpressionFunction | undefined>();
  for (const fn of fns) {
    snapshot.set(fn.name, EXPRESSION_FUNCTION_MAP.get(fn.name));
    EXPRESSION_FUNCTION_MAP.set(fn.name, fn);
  }
  return snapshot;
}

function restoreCustomFunctions(
  snapshot: Map<string, ExpressionFunction | undefined>,
): void {
  for (const [name, prev] of snapshot) {
    if (prev) EXPRESSION_FUNCTION_MAP.set(name, prev);
    else EXPRESSION_FUNCTION_MAP.delete(name);
  }
}
