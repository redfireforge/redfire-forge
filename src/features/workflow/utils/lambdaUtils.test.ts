import { describe, it, expect } from 'vitest';
import { isLambda, applyLambda, registerEvalNode, type LambdaValue, type EvalContext } from './lambdaUtils';
import type { ASTNode } from './expressionEvaluator';

function mockEvalNode(node: ASTNode, ctx: EvalContext): unknown {
  if (node.kind === 'literal') return node.value;
  if (node.kind === 'variable') return ctx.resolveVariable?.(node.varName ?? '');
  return undefined;
}

describe('lambdaUtils', () => {
  describe('isLambda', () => {
    it('returns true for valid LambdaValue', () => {
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'literal', value: 1 },
        closureCtx: {},
      };
      expect(isLambda(lambda)).toBe(true);
    });

    it('returns false for null/undefined', () => {
      expect(isLambda(null)).toBe(false);
      expect(isLambda(undefined)).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(isLambda(42)).toBe(false);
      expect(isLambda('hello')).toBe(false);
      expect(isLambda(true)).toBe(false);
    });

    it('returns false for objects without __type', () => {
      expect(isLambda({ params: ['x'] })).toBe(false);
      expect(isLambda({ __type: 'other' })).toBe(false);
    });
  });

  describe('applyLambda', () => {
    it('throws if evalNode not registered', () => {
      registerEvalNode(null as unknown as (node: ASTNode, ctx: EvalContext) => unknown);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x' },
        closureCtx: {},
      };
      expect(() => applyLambda(lambda, [42])).toThrow('Lambda evaluator not initialized');
    });

    it('binds parameters to args', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [42])).toBe(42);
    });

    it('resolves dot-path on parameter (e.g., x.name)', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x.name' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [{ name: 'Alice' }])).toBe('Alice');
    });

    it('resolves deep dot-path (x.a.b.c)', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x.a.b.c' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [{ a: { b: { c: 'deep' } } }])).toBe('deep');
    });

    it('returns undefined for missing dot-path', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x.missing' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [{ name: 'Alice' }])).toBeUndefined();
    });

    it('resolves bracket notation on parameter (x[0])', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x[0]' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [[10, 20, 30]])).toBe(10);
    });

    it('resolves nested bracket notation (x[0][1])', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x[0][1]' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [[[1, 2, 3], [4, 5, 6]]])).toBe(2);
    });

    it('resolves mixed bracket and dot (x.items[0])', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x.items[0]' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [{ items: ['first', 'second'] }])).toBe('first');
    });

    it('falls back to closure context for unbound names', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'outerVar' },
        closureCtx: { resolveVariable: (name) => name === 'outerVar' ? 'fromClosure' : undefined },
      };
      expect(applyLambda(lambda, [42])).toBe('fromClosure');
    });

    it('handles multi-param lambda', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['a', 'b'],
        body: { kind: 'variable', varName: 'b' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [1, 2])).toBe(2);
    });

    it('returns undefined when navigating into null', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x.a.b' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [{ a: null }])).toBeUndefined();
    });

    it('returns undefined when navigating into non-object', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x.a.b' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [{ a: 42 }])).toBeUndefined();
    });

    it('returns obj when path is empty', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x' },
        closureCtx: {},
      };
      const obj = { id: 1 };
      expect(applyLambda(lambda, [obj])).toBe(obj);
    });

    it('bracket notation on null returns undefined', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'x.data[0]' },
        closureCtx: {},
      };
      expect(applyLambda(lambda, [{ data: null }])).toBeUndefined();
    });

    it('dot-path with non-param prefix falls to closure', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'other.path' },
        closureCtx: { resolveVariable: (name) => name === 'other.path' ? 'resolved' : undefined },
      };
      expect(applyLambda(lambda, [42])).toBe('resolved');
    });

    it('bracket notation with non-param prefix falls to closure', () => {
      registerEvalNode(mockEvalNode);
      const lambda: LambdaValue = {
        __type: 'lambda',
        params: ['x'],
        body: { kind: 'variable', varName: 'arr[0]' },
        closureCtx: { resolveVariable: (name) => name === 'arr[0]' ? 'fromCtx' : undefined },
      };
      expect(applyLambda(lambda, [42])).toBe('fromCtx');
    });
  });
});
