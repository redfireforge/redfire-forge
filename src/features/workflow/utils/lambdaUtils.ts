/**
 * Lambda runtime types and utilities.
 * Extracted to avoid circular dependency between expressionEvaluator and expressionFunctions.
 */

import type { ASTNode } from './expressionEvaluator';

export interface EvalContext {
  resolveVariable?: (name: string) => unknown;
}

/** Runtime representation of a lambda closure */
export interface LambdaValue {
  __type: 'lambda';
  params: string[];
  body: ASTNode;
  closureCtx: EvalContext;
}

export function isLambda(v: unknown): v is LambdaValue {
  return v != null && typeof v === 'object' && (v as LambdaValue).__type === 'lambda';
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj == null || !path) return obj;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    const bracketIdx = part.indexOf('[');
    if (bracketIdx >= 0) {
      const key = part.slice(0, bracketIdx);
      if (key) current = (current as Record<string, unknown>)[key];
      let rest = part.slice(bracketIdx);
      while (rest.startsWith('[')) {
        const closeIdx = rest.indexOf(']');
        if (closeIdx < 0) break;
        const idxStr = rest.slice(1, closeIdx);
        if (current == null) return undefined;
        current = (current as unknown[])[parseInt(idxStr, 10)];
        rest = rest.slice(closeIdx + 1);
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

/** Evaluate a lambda's body node within a child context */
let _evalNode: ((node: ASTNode, ctx: EvalContext) => unknown) | null = null;

export function registerEvalNode(fn: (node: ASTNode, ctx: EvalContext) => unknown): void {
  _evalNode = fn;
}

/**
 * Apply a lambda to a set of arguments.
 * Creates a child evaluation context where lambda params are bound to the provided args.
 */
export function applyLambda(lambda: LambdaValue, args: unknown[]): unknown {
  if (!_evalNode) throw new Error('Lambda evaluator not initialized');
  const childCtx: EvalContext = {
    resolveVariable: (name) => {
      const paramIdx = lambda.params.indexOf(name);
      if (paramIdx >= 0) return args[paramIdx] as string | undefined;

      const dotIdx = name.indexOf('.');
      if (dotIdx > 0) {
        const paramName = name.slice(0, dotIdx);
        const restPath = name.slice(dotIdx + 1);
        const pIdx = lambda.params.indexOf(paramName);
        if (pIdx >= 0) {
          return getNestedValue(args[pIdx], restPath) as string | undefined;
        }
      }

      const bracketIdx = name.indexOf('[');
      if (bracketIdx > 0) {
        const paramName = name.slice(0, bracketIdx);
        const pIdx = lambda.params.indexOf(paramName);
        if (pIdx >= 0) {
          const restPath = name.slice(bracketIdx);
          return getNestedValue(args[pIdx], restPath) as string | undefined;
        }
      }

      return lambda.closureCtx.resolveVariable?.(name);
    },
  };
  return _evalNode(lambda.body, childCtx);
}
