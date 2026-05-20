import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGraph, type GraphRunCallbacks } from './graphRunner';
import { WorkflowNode, WorkflowEdge, SetVariableNodeData, AggregateNodeData, HttpNodeData } from '../types/workflow';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { httpFetch } from '../../../shared/utils/httpClient';

const mockFetch = vi.mocked(httpFetch);

beforeEach(() => {
  mockFetch.mockClear();
  mockFetch.mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    body: '{"ok": true}',
    duration: 50,
  });
});

function makeCallbacks() {
  const states: Array<{ id: string; state: string }> = [];
  const vars: Record<string, string>[] = [];
  const callbacks: GraphRunCallbacks = {
    onNodeStateChange: (id, status) => states.push({ id, state: status.state }),
    onVariablesChange: (v) => vars.push({ ...v }),
    onComplete: vi.fn(),
  };
  const statesFor = (id: string) => states.filter(s => s.id === id && s.state !== 'pending').map(s => s.state);
  return { states, vars, callbacks, statesFor };
}

function httpNode(id: string, label = 'HTTP'): WorkflowNode {
  return {
    id,
    type: 'http',
    position: { x: 0, y: 0 },
    data: {
      label,
      method: 'GET',
      url: 'https://example.com/api',
      headers: [],
      assertions: [],
    } as HttpNodeData,
  };
}

const startNode: WorkflowNode = {
  id: 's1', type: 'start', position: { x: 0, y: 0 },
  data: { label: 'Start', inputVariables: {} },
};

// ────────────────────────────────────────────────────
// Set Variable Node Tests
// ────────────────────────────────────────────────────

describe('runGraph - SetVariable Node', () => {
  function setVarNode(assignments: SetVariableNodeData['assignments']): WorkflowNode {
    return {
      id: 'sv1', type: 'setVariable', position: { x: 0, y: 0 },
      data: { label: 'Set Variables', assignments } as SetVariableNodeData,
    };
  }

  it('sets a single variable', async () => {
    const sv = setVarNode([{ id: 'a1', name: 'greeting', expression: 'hello' }]);
    const h = httpNode('h1');

    const nodes = [startNode, sv, h];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'sv1' },
      { id: 'e2', source: 'sv1', target: 'h1' },
    ];

    const { vars, statesFor, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    expect(statesFor('sv1')).toContain('pass');
    const lastVars = vars[vars.length - 1];
    expect(lastVars.greeting).toBe('hello');
  });

  it('sets multiple variables in order', async () => {
    const sv = setVarNode([
      { id: 'a1', name: 'x', expression: '10' },
      { id: 'a2', name: 'y', expression: '20' },
      { id: 'a3', name: 'label', expression: 'test-run' },
    ]);

    const nodes = [startNode, sv];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'sv1' }];

    const { vars, statesFor, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    expect(statesFor('sv1')).toContain('pass');
    const lastVars = vars[vars.length - 1];
    expect(lastVars.x).toBe('10');
    expect(lastVars.y).toBe('20');
    expect(lastVars.label).toBe('test-run');
  });

  it('resolves template expressions in assignments', async () => {
    const startWithVars: WorkflowNode = {
      id: 's1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { base: 'https://api.example.com' } },
    };
    const sv = setVarNode([
      { id: 'a1', name: 'endpoint', expression: '{{base}}/users' },
    ]);

    const nodes = [startWithVars, sv];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'sv1' }];

    const { vars, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    const lastVars = vars[vars.length - 1];
    expect(lastVars.endpoint).toBe('https://api.example.com/users');
  });

  it('skips assignments with empty name', async () => {
    const sv = setVarNode([
      { id: 'a1', name: '', expression: 'ignored' },
      { id: 'a2', name: 'valid', expression: 'kept' },
    ]);

    const nodes = [startNode, sv];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'sv1' }];

    const { vars, statesFor, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    expect(statesFor('sv1')).toContain('pass');
    const lastVars = vars[vars.length - 1];
    expect(lastVars.valid).toBe('kept');
    expect(lastVars['']).toBeUndefined();
  });

  it('follows outgoing edges after setting variables', async () => {
    const sv = setVarNode([{ id: 'a1', name: 'token', expression: 'abc123' }]);
    const h = httpNode('h1');

    const nodes = [startNode, sv, h];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'sv1' },
      { id: 'e2', source: 'sv1', target: 'h1' },
    ];

    const { statesFor, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    expect(statesFor('sv1')).toContain('pass');
    expect(statesFor('h1')).toContain('running');
  });

  it('handles empty assignments list', async () => {
    const sv = setVarNode([]);

    const nodes = [startNode, sv];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'sv1' }];

    const { statesFor, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    expect(statesFor('sv1')).toContain('pass');
  });

  it('can override existing variables', async () => {
    const startWithVars: WorkflowNode = {
      id: 's1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { env: 'dev' } },
    };
    const sv = setVarNode([{ id: 'a1', name: 'env', expression: 'prod' }]);

    const nodes = [startWithVars, sv];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'sv1' }];

    const { vars, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    const lastVars = vars[vars.length - 1];
    expect(lastVars.env).toBe('prod');
  });
});

// ────────────────────────────────────────────────────
// Aggregate Node Tests
// ────────────────────────────────────────────────────

describe('runGraph - Aggregate Node', () => {
  function aggNode(mappings: AggregateNodeData['mappings']): WorkflowNode {
    return {
      id: 'agg1', type: 'aggregate', position: { x: 0, y: 0 },
      data: { label: 'Aggregate', mappings } as AggregateNodeData,
    };
  }

  describe('concat strategy', () => {
    it('builds a JSON array from source values', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { item: 'hello' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{item}}', targetVariable: 'collected', strategy: 'concat' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('agg1')).toContain('pass');
      const lastVars = vars[vars.length - 1];
      expect(JSON.parse(lastVars.collected)).toEqual(['hello']);
    });

    it('appends to existing array', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { item: 'world', collected: '["hello"]' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{item}}', targetVariable: 'collected', strategy: 'concat' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(JSON.parse(lastVars.collected)).toEqual(['hello', 'world']);
    });
  });

  describe('first strategy', () => {
    it('keeps the first value when variable not yet set', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { val: 'first-value' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{val}}', targetVariable: 'result', strategy: 'first' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(lastVars.result).toBe('first-value');
    });

    it('keeps existing value when already set', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { val: 'new-value', result: 'existing' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{val}}', targetVariable: 'result', strategy: 'first' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(lastVars.result).toBe('existing');
    });
  });

  describe('last strategy', () => {
    it('always overwrites with the latest value', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { val: 'latest', result: 'old' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{val}}', targetVariable: 'result', strategy: 'last' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(lastVars.result).toBe('latest');
    });
  });

  describe('count strategy', () => {
    it('increments counter from 0', async () => {
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{val}}', targetVariable: 'counter', strategy: 'count' },
      ]);

      const nodes = [startNode, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(lastVars.counter).toBe('1');
    });

    it('increments existing counter', async () => {
      const startWithCount: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { counter: '5' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{val}}', targetVariable: 'counter', strategy: 'count' },
      ]);

      const nodes = [startWithCount, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(lastVars.counter).toBe('6');
    });
  });

  describe('sum strategy', () => {
    it('sums numeric values', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { price: '25.5', total: '100' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{price}}', targetVariable: 'total', strategy: 'sum' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(lastVars.total).toBe('125.5');
    });

    it('treats non-numeric as zero', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { val: 'abc' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{val}}', targetVariable: 'total', strategy: 'sum' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(lastVars.total).toBe('0');
    });
  });

  describe('custom strategy', () => {
    it('resolves custom expression', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { name: 'Alice' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{name}}', targetVariable: 'greeting', strategy: 'custom', customExpression: 'Hello, {{name}}!' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(lastVars.greeting).toBe('Hello, Alice!');
    });
  });

  describe('edge cases', () => {
    it('handles empty mappings', async () => {
      const agg = aggNode([]);

      const nodes = [startNode, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('agg1')).toContain('pass');
    });

    it('skips mappings with empty targetVariable', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { val: '42' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{val}}', targetVariable: '', strategy: 'last' },
        { id: 'm2', sourceExpression: '{{val}}', targetVariable: 'result', strategy: 'last' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('agg1')).toContain('pass');
      const lastVars = vars[vars.length - 1];
      expect(lastVars.result).toBe('42');
    });

    it('follows outgoing edges after aggregation', async () => {
      const agg = aggNode([{ id: 'm1', sourceExpression: 'x', targetVariable: 'r', strategy: 'last' }]);
      const h = httpNode('h1');

      const nodes = [startNode, agg, h];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'agg1' },
        { id: 'e2', source: 'agg1', target: 'h1' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('agg1')).toContain('pass');
      expect(statesFor('h1')).toContain('running');
    });

    it('handles multiple mappings with different strategies', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { a: '10', b: 'hello' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{a}}', targetVariable: 'total', strategy: 'sum' },
        { id: 'm2', sourceExpression: '{{b}}', targetVariable: 'items', strategy: 'concat' },
        { id: 'm3', sourceExpression: '{{a}}', targetVariable: 'count', strategy: 'count' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(lastVars.total).toBe('10');
      expect(JSON.parse(lastVars.items)).toEqual(['hello']);
      expect(lastVars.count).toBe('1');
    });

    it('falls back to sourceVal for unknown strategy', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { val: 'raw-value' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{val}}', targetVariable: 'result', strategy: 'unknown' as AggregateNodeData['mappings'][0]['strategy'] },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('agg1')).toContain('pass');
      const lastVars = vars[vars.length - 1];
      expect(lastVars.result).toBe('raw-value');
    });

    it('concat handles non-array existing JSON value', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { item: 'new', collected: '"a string"' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{item}}', targetVariable: 'collected', strategy: 'concat' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      // Non-array JSON gets reset to [] then appended
      expect(JSON.parse(lastVars.collected)).toEqual(['new']);
    });

    it('concat pushes parsed JSON values', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { item: '{"id":1}' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{item}}', targetVariable: 'collected', strategy: 'concat' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(JSON.parse(lastVars.collected)).toEqual([{ id: 1 }]);
    });

    it('custom strategy uses customExpression when empty', async () => {
      const agg = aggNode([
        { id: 'm1', sourceExpression: 'fallback-val', targetVariable: 'result', strategy: 'custom' },
      ]);

      const nodes = [startNode, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      // When customExpression is undefined, falls back to sourceVal
      expect(lastVars.result).toBe('fallback-val');
    });

    it('sum starts from zero when target variable not set', async () => {
      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { price: '42.5' } },
      };
      const agg = aggNode([
        { id: 'm1', sourceExpression: '{{price}}', targetVariable: 'total', strategy: 'sum' },
      ]);

      const nodes = [startWithVars, agg];
      const edges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: 'agg1' }];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const lastVars = vars[vars.length - 1];
      expect(lastVars.total).toBe('42.5');
    });
  });
});
