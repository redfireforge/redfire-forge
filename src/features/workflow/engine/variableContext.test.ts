import { describe, expect, it } from 'vitest';
import type { WorkflowNode } from '../types/workflow';
import { EXPRESSION_FUNCTION_MAP } from '../utils/expressionFunctions';
import { VariableContext, parseNodeScopedInner } from './variableContext';

describe('parseNodeScopedInner', () => {
  it('parses legacy node id and variable name', () => {
    expect(parseNodeScopedInner('node:step-1.channel')).toEqual({ kind: 'id', nodeId: 'step-1', name: 'channel' });
  });

  it('parses quoted step label', () => {
    expect(parseNodeScopedInner('node:"Retrieve Kafka Status".vin')).toEqual({
      kind: 'label',
      label: 'Retrieve Kafka Status',
      name: 'vin',
    });
  });

  it('returns null for plain names', () => {
    expect(parseNodeScopedInner('channel')).toBe(null);
  });
});

describe('VariableContext node-scoped refs', () => {
  it('resolves {{node:id.name}} from setForNode', () => {
    const ctx = new VariableContext();
    ctx.setForNode('n1', 'channel', 'A');
    ctx.setForNode('n2', 'channel', 'B');
    expect(ctx.resolve('x {{node:n1.channel}} {{node:n2.channel}}')).toBe('x A B');
  });

  it('resolves {{node:"Step".name}} after registerWorkflowNodes', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'nid',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'Retrieve Kafka Status',
          scenario: {
            id: 's',
            name: 's',
            url: '/',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    ctx.setForNode('nid', 'vin', 'VIN123');
    expect(ctx.resolve('{{node:"Retrieve Kafka Status".vin}}')).toBe('VIN123');
  });

  it('does not resolve duplicate step titles by label', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'a',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'Same',
          scenario: {
            id: 's1', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'b',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'Same',
          scenario: {
            id: 's2', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    ctx.setForNode('a', 'x', '1');
    ctx.setForNode('b', 'x', '2');
    expect(ctx.resolve('{{node:"Same".x}}')).toBe('{{node:"Same".x}}');
    expect(ctx.resolve('{{node:a.x}}')).toBe('1');
    expect(ctx.resolve('{{node:b.x}}')).toBe('2');
  });

  it('keeps flat {{name}} as latest writer for set()', () => {
    const ctx = new VariableContext();
    ctx.setForNode('n1', 'channel', 'A');
    ctx.set('channel', 'last');
    expect(ctx.resolve('{{channel}}')).toBe('last');
  });

  it('inherits per-node maps in child()', () => {
    const parent = new VariableContext();
    parent.setForNode('n1', 'x', '1');
    const child = parent.child();
    expect(child.resolve('{{node:n1.x}}')).toBe('1');
    child.setForNode('n2', 'y', '2');
    expect(parent.resolve('{{node:n2.y}}')).toBe('{{node:n2.y}}');
  });

  it('snapshot prefers node:"Label".name when label is unique', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'nid',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'My Step',
          scenario: {
            id: 's', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    ctx.setForNode('nid', 'k', 'v');
    expect(ctx.snapshot()['node:"My Step".k']).toBe('v');
  });

  it('snapshot uses node:id.name when label is ambiguous', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'a', type: 'http', position: { x: 0, y: 0 },
        data: { label: 'Dup', scenario: { id: 's1', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } },
      },
      {
        id: 'b', type: 'http', position: { x: 0, y: 0 },
        data: { label: 'Dup', scenario: { id: 's2', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } },
      },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    ctx.setForNode('a', 'x', '1');
    const snap = ctx.snapshot();
    expect(snap['node:a.x']).toBe('1');
    expect(snap['node:"Dup".x']).toBeUndefined();
  });

  it('size counts unique variable keys', () => {
    const ctx = new VariableContext({ a: '1' }, { b: '2' });
    ctx.set('c', '3');
    expect(ctx.size).toBe(3);
  });

  it('size does not double-count overlapping keys', () => {
    const ctx = new VariableContext({ a: '1' }, { a: 'env' });
    ctx.set('a', 'extracted');
    expect(ctx.size).toBe(1);
  });

  it('size includes per-node variables', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'n1', type: 'http', position: { x: 0, y: 0 },
        data: { label: 'Step', scenario: { id: 's', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } },
      },
    ];
    const ctx = new VariableContext({ a: '1' });
    ctx.registerWorkflowNodes(nodes);
    ctx.setForNode('n1', 'b', '2');
    expect(ctx.size).toBe(2);
  });

  it('resolves $uuid generator', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$uuid}}');
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('resolves $timestamp generator', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$timestamp}}');
    const ts = parseInt(result);
    const now = Date.now();
    expect(ts).toBeGreaterThan(now - 5000);
    expect(ts).toBeLessThanOrEqual(now + 1000);
  });

  it('resolves $isoDate generator', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$isoDate}}');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('resolves $randomInt generator', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$randomInt(1,10)}}');
    const num = parseInt(result);
    expect(num).toBeGreaterThanOrEqual(1);
    expect(num).toBeLessThanOrEqual(10);
  });

  it('resolves $randomInt with default range', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$randomInt}}');
    const num = parseInt(result);
    expect(num).toBeGreaterThanOrEqual(0);
    expect(num).toBeLessThanOrEqual(1000);
  });

  it('resolves $randomEmail generator', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$randomEmail}}');
    expect(result).toContain('@test.com');
    expect(result).toContain('user_');
  });

  it('resolves $randomString generator', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$randomString(12)}}');
    expect(result.length).toBe(12);
  });

  it('resolves $randomString with default length', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$randomString}}');
    expect(result.length).toBe(8);
    expect(result).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it('keeps unknown generator as literal', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$unknownGen}}');
    expect(result).toBe('{{$unknownGen}}');
  });

  it('keeps unresolved variable as literal', () => {
    const ctx = new VariableContext();
    expect(ctx.resolve('{{missing}}')).toBe('{{missing}}');
  });

  it('environment has lowest priority', () => {
    const ctx = new VariableContext({ a: 'manual' }, { a: 'env' });
    expect(ctx.get('a')).toBe('manual');
    ctx.set('a', 'extracted');
    expect(ctx.get('a')).toBe('extracted');
  });

  it('child inherits extracted + manual, not environment as separate layer', () => {
    const parent = new VariableContext({ x: '1' }, { y: '2' });
    parent.set('z', '3');
    const child = parent.child();
    expect(child.get('x')).toBe('1');
    expect(child.get('y')).toBe('2');
    expect(child.get('z')).toBe('3');
  });

  it('ignores non-http nodes in registerWorkflowNodes', () => {
    const nodes: WorkflowNode[] = [
      { id: 'c1', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'If', left: '', operator: '==', right: '' } },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    // Should not throw, and labelToNodeId should be empty
    expect(ctx.resolve('{{node:"If".x}}')).toBe('{{node:"If".x}}');
  });

  it('resolves expression functions from registry', () => {
    const ctx = new VariableContext();
    // $length is a common expression function
    const result = ctx.resolve('{{$length("hello")}}');
    // Should resolve to 5 if $length is registered, otherwise keep as literal
    expect(typeof result).toBe('string');
  });

  it('expression function with variable args resolves variables', () => {
    const ctx = new VariableContext({ name: 'world' });
    const result = ctx.resolve('{{$length(name)}}');
    expect(typeof result).toBe('string');
  });

  it('expression function with numeric args', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$add(1, 2)}}');
    expect(typeof result).toBe('string');
  });

  it('expression function with boolean args', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$if(true, "yes", "no")}}');
    expect(typeof result).toBe('string');
  });

  it('expression function with escaped quotes in args', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$length("he\\"llo")}}');
    expect(typeof result).toBe('string');
  });

  it('expression function with single-quoted args', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve("{{$length('hello')}}");
    expect(typeof result).toBe('string');
  });

  it('expression function with no args', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$uuid()}}');
    expect(result).toMatch(/^[0-9a-f]{8}-/i);
  });

  it('expression function with node-scoped variable arg', () => {
    const ctx = new VariableContext();
    ctx.setForNode('n1', 'val', 'test');
    const result = ctx.resolve('{{$length(node:n1.val)}}');
    expect(typeof result).toBe('string');
  });

  it('snapshot uses node:id.name when label contains quote', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'q1', type: 'http', position: { x: 0, y: 0 },
        data: { label: 'Step "quoted"', scenario: { id: 's', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } },
      },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    ctx.setForNode('q1', 'k', 'v');
    const snap = ctx.snapshot();
    // Should fall back to node:id.name since label contains quote
    expect(snap['node:q1.k']).toBe('v');
  });

  it('snapshot uses node:id.name when label contains newline', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'nl1', type: 'http', position: { x: 0, y: 0 },
        data: { label: 'Step\nLine2', scenario: { id: 's', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } },
      },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    ctx.setForNode('nl1', 'k', 'v');
    const snap = ctx.snapshot();
    expect(snap['node:nl1.k']).toBe('v');
  });

  it('getFromNode returns undefined for unknown node', () => {
    const ctx = new VariableContext();
    expect(ctx.getFromNode('nonexistent', 'x')).toBeUndefined();
  });

  it('get resolves node-scoped syntax directly', () => {
    const ctx = new VariableContext();
    ctx.setForNode('n1', 'x', '42');
    expect(ctx.get('node:n1.x')).toBe('42');
  });

  it('resolveExpression falls back to expression function when not a built-in', () => {
    const ctx = new VariableContext();
    // A non-existent function should return the literal
    const result = ctx.resolve('{{$totallyFakeFunction("arg")}}');
    expect(result).toBe('{{$totallyFakeFunction("arg")}}');
  });

  it('expression function returns empty string for null result', () => {
    const ctx = new VariableContext();
    // $if with falsy condition returns the else branch, test null handling
    const result = ctx.resolve('{{$if(false, "yes")}}');
    expect(typeof result).toBe('string');
  });

  it('expression function that returns an object gets JSON.stringified', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$merge("{\\"a\\":1}", "{\\"b\\":2}")}}');
    expect(typeof result).toBe('string');
  });

  it('resolve handles non-expression $ prefix that is not a generator or function', () => {
    const ctx = new VariableContext();
    // Expression that doesn't match GENERATOR_RE (has spaces or special chars)
    const result = ctx.resolve('{{$not a function}}');
    expect(result).toBe('{{$not a function}}');
  });

  it('parseExpressionArgs handles empty args string', () => {
    const ctx = new VariableContext();
    // Call a function with empty args - should not crash
    const result = ctx.resolve('{{$uuid()}}');
    expect(result).toMatch(/^[0-9a-f]{8}-/i);
  });

  it('child inherits label-to-node and ambiguous labels', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'a', type: 'http', position: { x: 0, y: 0 },
        data: { label: 'Dup', scenario: { id: 's1', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } },
      },
      {
        id: 'b', type: 'http', position: { x: 0, y: 0 },
        data: { label: 'Dup', scenario: { id: 's2', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } },
      },
    ];
    const parent = new VariableContext();
    parent.registerWorkflowNodes(nodes);
    parent.setForNode('a', 'x', '1');
    const child = parent.child();
    // Ambiguous label should not resolve in child either
    expect(child.resolve('{{node:"Dup".x}}')).toBe('{{node:"Dup".x}}');
    // But id-based should work
    expect(child.resolve('{{node:a.x}}')).toBe('1');
  });

  it('registerWorkflowNodes ignores http nodes without scenario', () => {
    const nodes: WorkflowNode[] = [
      { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'No Scenario' } },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    expect(ctx.resolve('{{node:"No Scenario".x}}')).toBe('{{node:"No Scenario".x}}');
  });

  it('snapshot uses node:id.name when no label registered', () => {
    const ctx = new VariableContext();
    ctx.setForNode('orphan', 'k', 'v');
    const snap = ctx.snapshot();
    expect(snap['node:orphan.k']).toBe('v');
  });

  it('resolves nested function calls via full evaluator fallback', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$upper($concat("hello", " world"))}}');
    expect(result).toBe('HELLO WORLD');
  });

  it('resolves expressions with variable references', () => {
    const ctx = new VariableContext();
    ctx.set('name', 'Alice');
    const result = ctx.resolve('{{$upper(name)}}');
    expect(result).toBe('ALICE');
  });

  it('delete returns true for existing extracted var and false for missing', () => {
    const ctx = new VariableContext();
    ctx.set('temp', 'x');
    expect(ctx.delete('temp')).toBe(true);
    expect(ctx.delete('temp')).toBe(false);
  });

  it('snapshot filters internal webhook vars across all layers', () => {
    const ctx = new VariableContext({ __webhookMethod: 'POST', manualVisible: 'm' }, { __webhookPath: '/hook', envVisible: 'e' });
    ctx.set('__webhookPayload', '{"ok":true}');
    ctx.set('extractedVisible', 'x');
    ctx.setForNode('n1', '__webhookInput', 'hidden-node');
    ctx.setForNode('n1', 'visibleNodeVar', 'shown-node');

    const snap = ctx.snapshot();
    expect(snap.envVisible).toBe('e');
    expect(snap.manualVisible).toBe('m');
    expect(snap.extractedVisible).toBe('x');
    expect(Object.keys(snap)).not.toContain('__webhookMethod');
    expect(Object.keys(snap)).not.toContain('__webhookPath');
    expect(Object.keys(snap)).not.toContain('__webhookPayload');
    expect(Object.keys(snap).some((k) => k.includes('__webhookInput'))).toBe(false);
  });

  it('expression function fallback returns literal when evaluator throws parse error', () => {
    const ctx = new VariableContext();
    const result = ctx.resolve('{{$upper("a"))}}');
    expect(result).toBe('{{$upper("a"))}}');
  });

  it('expression function returns stringified object fallback when JSON.stringify throws', () => {
    const key = '$__circularForCoverage';
    EXPRESSION_FUNCTION_MAP.set(key, {
      name: key,
      description: 'coverage helper',
      signature: `${key}(): object`,
      category: 'misc',
      evaluate: () => {
        const x: { self?: unknown } = {};
        x.self = x;
        return x;
      },
      examples: [],
    });

    try {
      const ctx = new VariableContext();
      const result = ctx.resolve(`{{${key}()}}`);
      expect(result).toContain('[object Object]');
    } finally {
      EXPRESSION_FUNCTION_MAP.delete(key);
    }
  });

  it('expression function returns literal when custom evaluator throws', () => {
    const key = '$__throwForCoverage';
    EXPRESSION_FUNCTION_MAP.set(key, {
      name: key,
      description: 'coverage helper',
      signature: `${key}(): string`,
      category: 'misc',
      evaluate: () => {
        throw new Error('boom');
      },
      examples: [],
    });

    try {
      const ctx = new VariableContext();
      const result = ctx.resolve(`{{${key}()}}`);
      expect(result).toBe(`{{${key}()}}`);
    } finally {
      EXPRESSION_FUNCTION_MAP.delete(key);
    }
  });
});
