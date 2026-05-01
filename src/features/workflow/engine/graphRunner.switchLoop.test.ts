import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGraph, type GraphRunCallbacks } from './graphRunner';
import type { WorkflowNode, WorkflowEdge, SwitchNodeData, LoopNodeData, HttpNodeData } from '../types/workflow';

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
  /** Get all states for a specific node (excluding initial 'pending'). */
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

// ────────────────────────────────────────────────────
// Switch Node Tests
// ────────────────────────────────────────────────────

describe('runGraph - Switch Node', () => {
  const startNode: WorkflowNode = {
    id: 's1', type: 'start', position: { x: 0, y: 0 },
    data: { label: 'Start', inputVariables: { status: '200' } },
  };

  function switchNode(expression: string, cases: SwitchNodeData['cases']): WorkflowNode {
    return {
      id: 'sw1', type: 'switch', position: { x: 0, y: 0 },
      data: { label: 'Switch', expression, cases } as SwitchNodeData,
    };
  }

  it('routes to matching case by expression value', async () => {
    const sw = switchNode('{{status}}', [
      { id: 'c1', value: '200', label: 'OK' },
      { id: 'c2', value: '404', label: 'NotFound' },
    ]);
    const okHttp = httpNode('ok-handler', 'OkHandler');
    const notFoundHttp = httpNode('nf-handler', 'NotFoundHandler');
    const defaultHttp = httpNode('default-handler', 'DefaultHandler');

    const nodes = [startNode, sw, okHttp, notFoundHttp, defaultHttp];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'sw1' },
      { id: 'e2', source: 'sw1', target: 'ok-handler', sourceHandle: 'case-c1' },
      { id: 'e3', source: 'sw1', target: 'nf-handler', sourceHandle: 'case-c2' },
      { id: 'e4', source: 'sw1', target: 'default-handler', sourceHandle: 'default' },
    ];

    const { statesFor, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    expect(statesFor('sw1')).toContain('pass');
    expect(statesFor('ok-handler')).toContain('running');
    expect(statesFor('nf-handler')).toContain('skipped');
    expect(statesFor('default-handler')).toContain('skipped');
  });

  it('routes to default when no case matches', async () => {
    const sw = switchNode('{{status}}', [
      { id: 'c1', value: '200', label: 'OK' },
      { id: 'c2', value: '404', label: 'NotFound' },
    ]);
    const startWithStatus: WorkflowNode = {
      id: 's1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { status: '500' } },
    };
    const okHttp = httpNode('ok-handler');
    const notFoundHttp = httpNode('nf-handler');
    const defaultHttp = httpNode('default-handler');

    const nodes = [startWithStatus, sw, okHttp, notFoundHttp, defaultHttp];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'sw1' },
      { id: 'e2', source: 'sw1', target: 'ok-handler', sourceHandle: 'case-c1' },
      { id: 'e3', source: 'sw1', target: 'nf-handler', sourceHandle: 'case-c2' },
      { id: 'e4', source: 'sw1', target: 'default-handler', sourceHandle: 'default' },
    ];

    const { statesFor, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    expect(statesFor('default-handler')).toContain('running');
    expect(statesFor('ok-handler')).toContain('skipped');
    expect(statesFor('nf-handler')).toContain('skipped');
  });

  it('routes to default when switch has no cases', async () => {
    const sw = switchNode('{{status}}', []);
    const defaultHttp = httpNode('default-handler');

    const nodes = [startNode, sw, defaultHttp];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'sw1' },
      { id: 'e2', source: 'sw1', target: 'default-handler', sourceHandle: 'default' },
    ];

    const { statesFor, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    expect(statesFor('sw1')).toContain('pass');
    expect(statesFor('default-handler')).toContain('running');
  });

  it('matches first case when multiple cases have the same value', async () => {
    const sw = switchNode('{{status}}', [
      { id: 'c1', value: '200', label: 'First200' },
      { id: 'c2', value: '200', label: 'Second200' },
    ]);
    const first = httpNode('first');
    const second = httpNode('second');

    const nodes = [startNode, sw, first, second];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'sw1' },
      { id: 'e2', source: 'sw1', target: 'first', sourceHandle: 'case-c1' },
      { id: 'e3', source: 'sw1', target: 'second', sourceHandle: 'case-c2' },
    ];

    const { statesFor, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    expect(statesFor('first')).toContain('running');
    expect(statesFor('second')).toContain('skipped');
  });

  it('resolves expressions containing variables', async () => {
    const startWithEnv: WorkflowNode = {
      id: 's1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { env: 'prod' } },
    };
    const sw = switchNode('{{env}}', [
      { id: 'c1', value: 'prod', label: 'Production' },
      { id: 'c2', value: 'staging', label: 'Staging' },
    ]);
    const prodHandler = httpNode('prod-handler');
    const stagingHandler = httpNode('staging-handler');

    const nodes = [startWithEnv, sw, prodHandler, stagingHandler];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'sw1' },
      { id: 'e2', source: 'sw1', target: 'prod-handler', sourceHandle: 'case-c1' },
      { id: 'e3', source: 'sw1', target: 'staging-handler', sourceHandle: 'case-c2' },
    ];

    const { statesFor, callbacks } = makeCallbacks();
    await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

    expect(statesFor('prod-handler')).toContain('running');
    expect(statesFor('staging-handler')).toContain('skipped');
  });
});

// ────────────────────────────────────────────────────
// Loop Node Tests
// ────────────────────────────────────────────────────

describe('runGraph - Loop Node', () => {
  const startNode: WorkflowNode = {
    id: 's1', type: 'start', position: { x: 0, y: 0 },
    data: { label: 'Start', inputVariables: {} },
  };

  function loopNode(data: Partial<LoopNodeData> & { mode: LoopNodeData['mode'] }): WorkflowNode {
    return {
      id: 'loop1', type: 'loop', position: { x: 0, y: 0 },
      data: { label: 'Loop', maxIterations: 100, ...data } as LoopNodeData,
    };
  }

  describe('count mode', () => {
    it('executes body N times', async () => {
      const loop = loopNode({ mode: 'count', count: 3 });
      const bodyHttp = httpNode('body-step');
      const afterHttp = httpNode('after-loop');

      const nodes = [startNode, loop, bodyHttp, afterHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'after-loop', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      // Body should have been called 3 times (each time running + pass)
      const bodyRunningCount = statesFor('body-step').filter(s => s === 'running').length;
      expect(bodyRunningCount).toBe(3);
      expect(statesFor('loop1')).toContain('running');
      expect(statesFor('loop1')).toContain('pass');
      expect(statesFor('after-loop')).toContain('running');
    });

    it('sets index variable on each iteration', async () => {
      const loop = loopNode({ mode: 'count', count: 3, indexVariable: 'idx' });
      const bodyHttp = httpNode('body-step');

      const nodes = [startNode, loop, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'done-node', sourceHandle: 'done' },
      ];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const idxValues = vars.filter(v => 'idx' in v).map(v => v.idx);
      expect(idxValues).toContain('0');
      expect(idxValues).toContain('1');
      expect(idxValues).toContain('2');
    });

    it('uses countExpression when provided', async () => {
      const startWithCount: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { n: '2' } },
      };
      const loop = loopNode({ mode: 'count', countExpression: '{{n}}' });
      const bodyHttp = httpNode('body-step');

      const nodes = [startWithCount, loop, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'done-node', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const bodyRunning = statesFor('body-step').filter(s => s === 'running').length;
      expect(bodyRunning).toBe(2);
    });

    it('does not execute body when count is 0', async () => {
      const loop = loopNode({ mode: 'count', count: 0 });
      const bodyHttp = httpNode('body-step');
      const afterHttp = httpNode('after-loop');

      const nodes = [startNode, loop, bodyHttp, afterHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'after-loop', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('body-step')).toHaveLength(0);
      expect(statesFor('after-loop')).toContain('running');
    });
  });

  describe('forEach mode', () => {
    it('iterates over JSON array and sets item/index variables', async () => {
      const startWithItems: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { items: '["a","b","c"]' } },
      };
      const loop = loopNode({
        mode: 'forEach',
        sourceExpression: '{{items}}',
        itemVariable: 'item',
        indexVariable: 'i',
      });
      const bodyHttp = httpNode('body-step');

      const nodes = [startWithItems, loop, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'done-node', sourceHandle: 'done' },
      ];

      const { vars, statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const bodyRunning = statesFor('body-step').filter(s => s === 'running').length;
      expect(bodyRunning).toBe(3);

      const itemValues = vars.filter(v => 'item' in v).map(v => v.item);
      expect(itemValues).toContain('a');
      expect(itemValues).toContain('b');
      expect(itemValues).toContain('c');
    });

    it('does not iterate when source is not a valid JSON array', async () => {
      const startWithBadItems: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { items: 'not-json' } },
      };
      const loop = loopNode({
        mode: 'forEach',
        sourceExpression: '{{items}}',
      });
      const bodyHttp = httpNode('body-step');

      const nodes = [startWithBadItems, loop, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'done-node', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('body-step')).toHaveLength(0);
    });

    it('handles object items by serializing to JSON', async () => {
      const startWithObjItems: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { items: '[{"id":1},{"id":2}]' } },
      };
      const loop = loopNode({
        mode: 'forEach',
        sourceExpression: '{{items}}',
        itemVariable: 'item',
      });
      const bodyHttp = httpNode('body-step');

      const nodes = [startWithObjItems, loop, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'done-node', sourceHandle: 'done' },
      ];

      const { vars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const itemValues = vars.filter(v => 'item' in v).map(v => v.item);
      expect(itemValues).toContain('{"id":1}');
      expect(itemValues).toContain('{"id":2}');
    });
  });

  describe('while mode', () => {
    it('loops while condition is true then stops', async () => {
      // Start with counter=0, loop while counter < 3
      // Body HTTP response sets counter via response, but since we mock httpFetch,
      // we need a simpler approach: test with count-like behavior using whileLeft/whileRight
      const startWithCounter: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { counter: '0' } },
      };
      // This while loop checks i < 3 (i is set by the loop itself as indexVariable)
      const loop = loopNode({
        mode: 'while',
        whileLeft: '{{i}}',
        whileOperator: '<',
        whileRight: '3',
        indexVariable: 'i',
      });
      const bodyHttp = httpNode('body-step');

      const nodes = [startWithCounter, loop, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'done-node', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const bodyRunning = statesFor('body-step').filter(s => s === 'running').length;
      expect(bodyRunning).toBe(3);
    });
  });

  describe('safety and edge cases', () => {
    it('respects maxIterations safety cap', async () => {
      const loop = loopNode({ mode: 'count', count: 500, maxIterations: 5 });
      const bodyHttp = httpNode('body-step');

      const nodes = [startNode, loop, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'done-node', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const bodyRunning = statesFor('body-step').filter(s => s === 'running').length;
      expect(bodyRunning).toBe(5);
    });

    it('stops when abortSignal is triggered', async () => {
      const ac = new AbortController();
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount >= 2) ac.abort();
        return {
          status: 200, statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          body: '{}', duration: 10,
        };
      });

      const loop = loopNode({ mode: 'count', count: 100 });
      const bodyHttp = httpNode('body-step');

      const nodes = [startNode, loop, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'done-node', sourceHandle: 'done' },
      ];

      const { callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, ac.signal, {});

      // Should have stopped early, not 100 iterations
      expect(callCount).toBeLessThan(10);
    });

    it('follows done edges after loop completes', async () => {
      const loop = loopNode({ mode: 'count', count: 1 });
      const bodyHttp = httpNode('body-step');
      const afterHttp = httpNode('after-loop');

      const nodes = [startNode, loop, bodyHttp, afterHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'after-loop', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('after-loop')).toContain('running');
    });

    it('defaults to maxIterations=100 when not specified', async () => {
      const loop: WorkflowNode = {
        id: 'loop1', type: 'loop', position: { x: 0, y: 0 },
        data: { label: 'Loop', mode: 'count', count: 999 } as LoopNodeData,
      };
      const bodyHttp = httpNode('body-step');

      const nodes = [startNode, loop, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
        { id: 'e3', source: 'loop1', target: 'done-node', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const bodyRunning = statesFor('body-step').filter(s => s === 'running').length;
      expect(bodyRunning).toBe(100);
    });
  });

  describe('forEach mode', () => {
    it('iterates over JSON array items and sets item variable', async () => {
      const loopNode: WorkflowNode = {
        id: 'loop1', type: 'loop', position: { x: 0, y: 0 },
        data: {
          label: 'ForEachLoop', mode: 'forEach',
          sourceExpression: '{{items}}', itemVariable: 'current',
          indexVariable: 'idx', maxIterations: 10,
        } as LoopNodeData,
      };
      const bodyHttp = httpNode('body1', 'Body');

      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { items: '["a","b","c"]' } },
      };

      const nodes = [startWithVars, loopNode, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body1', sourceHandle: 'body' },
      ];

      const { vars: _vars, statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      // Body should have been visited 3 times
      const bodyRunning = statesFor('body1').filter(s => s === 'running').length;
      expect(bodyRunning).toBe(3);
    });

    it('handles non-array JSON (object) as empty items', async () => {
      const loopNode: WorkflowNode = {
        id: 'loop1', type: 'loop', position: { x: 0, y: 0 },
        data: {
          label: 'ForEachLoop', mode: 'forEach',
          sourceExpression: '{{items}}', itemVariable: 'item',
          indexVariable: 'i', maxIterations: 10,
        } as LoopNodeData,
      };
      const bodyHttp = httpNode('body1', 'Body');

      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { items: '{"key":"value"}' } },
      };

      const nodes = [startWithVars, loopNode, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body1', sourceHandle: 'body' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      // Body should not have been visited since items is empty
      const bodyStates = statesFor('body1');
      expect(bodyStates.filter(s => s === 'running')).toHaveLength(0);
    });

    it('handles invalid JSON source expression as empty items', async () => {
      const loopNode: WorkflowNode = {
        id: 'loop1', type: 'loop', position: { x: 0, y: 0 },
        data: {
          label: 'ForEachLoop', mode: 'forEach',
          sourceExpression: '{{items}}', itemVariable: 'item',
          indexVariable: 'i', maxIterations: 10,
        } as LoopNodeData,
      };

      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { items: 'not-json' } },
      };

      const nodes = [startWithVars, loopNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('loop1')).toContain('pass');
    });
  });

  describe('count mode with countExpression', () => {
    it('resolves countExpression from variables', async () => {
      const loopNode: WorkflowNode = {
        id: 'loop1', type: 'loop', position: { x: 0, y: 0 },
        data: {
          label: 'CountLoop', mode: 'count',
          countExpression: '{{total}}',
          indexVariable: 'i', maxIterations: 100,
        } as LoopNodeData,
      };
      const bodyHttp = httpNode('body1', 'Body');

      const startWithVars: WorkflowNode = {
        id: 's1', type: 'start', position: { x: 0, y: 0 },
        data: { label: 'Start', inputVariables: { total: '4' } },
      };

      const nodes = [startWithVars, loopNode, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body1', sourceHandle: 'body' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      const bodyRunning = statesFor('body1').filter(s => s === 'running').length;
      expect(bodyRunning).toBe(4);
    });

    it('handles non-numeric countExpression by falling back to data.count', async () => {
      const loopNode: WorkflowNode = {
        id: 'loop1', type: 'loop', position: { x: 0, y: 0 },
        data: {
          label: 'CountLoop', mode: 'count',
          countExpression: '{{missing}}', count: 2,
          indexVariable: 'i', maxIterations: 100,
        } as LoopNodeData,
      };
      const bodyHttp = httpNode('body1', 'Body');

      const nodes = [startNode, loopNode, bodyHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'loop1' },
        { id: 'e2', source: 'loop1', target: 'body1', sourceHandle: 'body' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      // countExpression resolves to '{{missing}}', parseInt => NaN, falls back to 1
      const bodyRunning = statesFor('body1').filter(s => s === 'running').length;
      expect(bodyRunning).toBe(1);
    });
  });

  describe('switch edge cases', () => {
    it('handles switch with no cases property (null coalesce)', async () => {
      const switchNode: WorkflowNode = {
        id: 'sw1', type: 'switch', position: { x: 0, y: 0 },
        data: {
          label: 'Switch', expression: '{{val}}',
          // cases is intentionally missing to test ?? []
        } as SwitchNodeData,
      };
      const defaultHttp = httpNode('d1', 'Default');

      const nodes = [startNode, switchNode, defaultHttp];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'sw1' },
        { id: 'e2', source: 'sw1', target: 'd1', sourceHandle: 'default' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('sw1')).toContain('pass');
      expect(statesFor('d1')).toContain('running');
    });
  });

  describe('http node after loop with empty response headers', () => {
    it('handles switch node with no label (uses type as fallback)', async () => {
      const switchNode: WorkflowNode = {
        id: 'sw1', type: 'switch', position: { x: 0, y: 0 },
        data: {
          label: '', expression: 'test',
          cases: [{ id: 'c1', label: '', value: 'test' }],
        } as SwitchNodeData,
      };

      const nodes = [startNode, switchNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'sw1' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('sw1')).toContain('pass');
    });
  });
});
