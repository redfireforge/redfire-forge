import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('./scriptSandbox', () => ({
  executeScript: vi.fn(),
}));

vi.mock('./scriptLibraries', () => ({
  loadScriptLibraries: vi.fn(() => []),
  buildLibraryPreamble: vi.fn(() => ''),
}));

import type { WorkflowNode, WorkflowEdge } from '../types/workflow';
import { handleForkNode, handleJoinNode, handleLoopNode, handleWaitForConditionNode } from './graphRunnerNodeHandlers';
import {
  getMockFetch,
  makeCtx,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
  makeEdge,
  makePassedFlag,
} from './graphRunnerNodeHandlers.test-utils';

const mockFetch = getMockFetch();

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok": true}',
  });
});

describe('handleForkNode', () => {
  it('visits all outgoing branches in parallel', async () => {
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('f1', [
      makeEdge('e1', 'f1', 'b1'),
      makeEdge('e2', 'f1', 'b2'),
      makeEdge('e3', 'f1', 'b3'),
    ]);
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, visit, outgoing });
    const node = makeNode('f1', 'fork');

    await handleForkNode('f1', node, hCtx);

    expect(states['f1']?.state).toBe('pass');
    expect(visit).toHaveBeenCalledTimes(3);
    expect(visit).toHaveBeenCalledWith('b1', 'main-branch-0');
    expect(visit).toHaveBeenCalledWith('b2', 'main-branch-1');
  });
});

// ── handleJoinNode ──
describe('handleJoinNode', () => {
  it('marks pass and visits outgoing', async () => {
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks });
    const node = makeNode('j1', 'join');

    await handleJoinNode('j1', node, hCtx);

    expect(states['j1']?.state).toBe('pass');
    expect(hCtx.visitOutgoing).toHaveBeenCalled();
  });
});

describe('handleLoopNode', () => {
  it('executes count-based loop', async () => {
    const ctx = makeCtx();
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'count', count: 3, maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);

    expect(states['l1']?.state).toBe('pass');
    // body visited 3 times + done visited once
    expect(visit).toHaveBeenCalledTimes(4);
    expect(ctx.resolve('{{i}}')).toBe('3');
  });

  it('executes forEach loop', async () => {
    const ctx = makeCtx({ items: '["a","b","c"]' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'forEach', sourceExpression: '{{items}}',
      itemVariable: 'item', maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);
    // 3 body iterations + 1 done
    expect(visit).toHaveBeenCalledTimes(4);
  });

  it('stops on maxIterations', async () => {
    const ctx = makeCtx();
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'count', count: 999, maxIterations: 2,
    });

    await handleLoopNode('l1', node, hCtx);
    // 2 body iterations + 1 done
    expect(visit).toHaveBeenCalledTimes(3);
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [makeEdge('e1', 'l1', 'body1', 'body')]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx: makeCtx(), callbacks, visit, outgoing, nodeMap, abortSignal: controller.signal });
    const node = makeNode('l1', 'loop', { mode: 'count', count: 10, maxIterations: 100 });

    await handleLoopNode('l1', node, hCtx);
    expect(visit).not.toHaveBeenCalled();
  });

  it('handles while mode', async () => {
    const ctx = makeCtx({ counter: '0' });
    let callCount = 0;
    const visit = vi.fn(async () => {
      callCount++;
      if (callCount >= 3) {
        ctx.set('counter', '10');
      }
    });
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'while',
      whileLeft: '{{counter}}', whileOperator: '<', whileRight: '5',
      maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it('handles forEach with non-array source', async () => {
    const ctx = makeCtx({ items: 'not-json' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'forEach', sourceExpression: '{{items}}',
      maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);
    // Empty items → 0 body iterations + 1 done
    expect(visit).toHaveBeenCalledTimes(1);
  });

  it('handles forEach with object items', async () => {
    const ctx = makeCtx({ items: '[{"name":"a"},{"name":"b"}]' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'forEach', sourceExpression: '{{items}}',
      itemVariable: 'item', maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);
    expect(visit).toHaveBeenCalledTimes(3); // 2 body + 1 done
  });

  it('uses countExpression for dynamic count', async () => {
    const ctx = makeCtx({ total: '2' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'count', countExpression: '{{total}}', maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);
    expect(visit).toHaveBeenCalledTimes(3); // 2 body + 1 done
  });

  it('does not loop for unknown loop type', async () => {
    const ctx = makeCtx();
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'unknownType', count: 3, maxIterations: 100,
    });
    const passed = makePassedFlag();

    await handleLoopNode('l1', node, hCtx, passed);

    // Unknown type => shouldContinue returns false => no body visits, only done branch
    const bodyVisits = visit.mock.calls.filter((c: string[]) => c[0] === 'body1');
    expect(bodyVisits).toHaveLength(0);
    // done branch is visited
    const doneVisits = visit.mock.calls.filter((c: string[]) => c[0] === 'done1');
    expect(doneVisits).toHaveLength(1);
  });

  it('uses default while condition properties when not specified', async () => {
    const ctx = makeCtx();
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    // No whileLeft/whileOperator/whileRight — uses ?? '' and ?? '==' fallbacks
    const node = makeNode('l1', 'loop', {
      mode: 'while', maxIterations: 1,
    });

    await handleLoopNode('l1', node, hCtx);
    expect(visit).toHaveBeenCalled();
  });

  it('handles non-array JSON in forEach source (line 407)', async () => {
    const ctx = makeCtx({ items: '{"key": "value"}' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'forEach', sourceExpression: '{{items}}',
      itemVariable: 'item', maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);
    // Non-array falls back to [] — no body iterations, only done
    const bodyVisits = visit.mock.calls.filter((c: string[]) => c[0] === 'body1');
    expect(bodyVisits).toHaveLength(0);
  });

  it('handles forEach with no sourceExpression (line 404)', async () => {
    const ctx = makeCtx();
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'forEach', maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);
    const bodyVisits = visit.mock.calls.filter((c: string[]) => c[0] === 'body1');
    expect(bodyVisits).toHaveLength(0);
  });

  it('uses count expression from variable (line 420)', async () => {
    const ctx = makeCtx({ n: '3' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'count', countExpression: '{{n}}', maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);
    const bodyVisits = visit.mock.calls.filter((c: string[]) => c[0] === 'body1');
    expect(bodyVisits).toHaveLength(3);
  });
});

describe('handleWaitForConditionNode', () => {
  it('completes when condition is met immediately', async () => {
    const ctx = makeCtx({ ready: 'true' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('wc1', [
      makeEdge('e1', 'wc1', 'body1', 'body'),
      makeEdge('e2', 'wc1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('wc1', 'waitForCondition', {
      conditionExpression: '{{ready}} == true',
      pollIntervalMs: 10,
      timeoutMs: 1000,
      maxAttempts: 10,
    });
    const passed = makePassedFlag();

    await handleWaitForConditionNode('wc1', node, hCtx, passed);

    expect(states['wc1']?.state).toBe('pass');
    expect(visit).toHaveBeenCalledWith('done1', 'main');
  });

  it('fails when max attempts reached', async () => {
    const ctx = makeCtx({ ready: 'false' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('wc1', [
      makeEdge('e1', 'wc1', 'body1', 'body'),
      makeEdge('e2', 'wc1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('wc1', 'waitForCondition', {
      conditionExpression: '{{ready}} == true',
      pollIntervalMs: 1,
      timeoutMs: 0,
      maxAttempts: 2,
    });
    const passed = makePassedFlag();

    await handleWaitForConditionNode('wc1', node, hCtx, passed);

    expect(states['wc1']?.state).toBe('fail');
    expect(passed.value).toBe(false);
  });

  it('fails when timeout is exceeded', async () => {
    const ctx = makeCtx({ ready: 'false' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('wc1', [
      makeEdge('e1', 'wc1', 'body1', 'body'),
      makeEdge('e2', 'wc1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({
      ctx, callbacks, visit, outgoing, nodeMap,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('wc1', 'waitForCondition', {
      conditionExpression: '{{ready}} == true',
      pollIntervalMs: 1,
      timeoutMs: 1, // very short timeout
      maxAttempts: 0, // no max attempts limit
    });
    const passed = makePassedFlag();

    await handleWaitForConditionNode('wc1', node, hCtx, passed);

    expect(states['wc1']?.state).toBe('fail');
    const timeoutLog = logLines.find(l => l.text.includes('Timeout'));
    expect(timeoutLog).toBeDefined();
  });
});

describe('handleWaitForConditionNode — abort signal', () => {
  it('resolves early when abort signal fires during poll wait', async () => {
    const ctx = makeCtx({ ready: 'false' });
    const abortController = new AbortController();
    const { callbacks, states } = makeCallbacks();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('wc1', [
      makeEdge('e1', 'wc1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('done1', makeNode('done1', 'http'));
    const hCtx = makeHandlerContext({
      ctx, callbacks, outgoing, nodeMap,
      abortSignal: abortController.signal,
    });
    const node = makeNode('wc1', 'waitForCondition', {
      conditionExpression: '{{ready}} == true',
      pollIntervalMs: 60000,
      timeoutMs: 0,
      maxAttempts: 5,
    });
    const passed = makePassedFlag();

    const promise = handleWaitForConditionNode('wc1', node, hCtx, passed);
    abortController.abort();
    await promise;

    expect(states['wc1']).toBeDefined();
  });

  it('handles no outgoing edges (uses ?? [] fallback)', async () => {
    const ctx = makeCtx({ ready: 'true' });
    const { callbacks, states } = makeCallbacks();
    // Don't set any outgoing edges for wc1
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('wc1', 'waitForCondition', {
      conditionExpression: '{{ready}} == true',
      pollIntervalMs: 10,
      timeoutMs: 1000,
      maxAttempts: 10,
    });
    const passed = makePassedFlag();

    await handleWaitForConditionNode('wc1', node, hCtx, passed);
    expect(states['wc1']?.state).toBe('pass');
  });

  it('stops when debugController.isStopped is true', async () => {
    const ctx = makeCtx({ ready: 'false' });
    const { callbacks, states } = makeCallbacks();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('wc1', [
      makeEdge('e1', 'wc1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('done1', makeNode('done1', 'http'));
    const hCtx = makeHandlerContext({
      ctx, callbacks, outgoing, nodeMap,
      debugController: { isStopped: true, breakpoints: new Set(), shouldPause: () => false, waitForResume: async () => {} },
    });
    const node = makeNode('wc1', 'waitForCondition', {
      conditionExpression: '{{ready}} == true',
      pollIntervalMs: 10,
      timeoutMs: 0,
      maxAttempts: 5,
    });
    const passed = makePassedFlag();

    await handleWaitForConditionNode('wc1', node, hCtx, passed);
    expect(states['wc1']?.state).toBe('fail');
  });

  it('runs body edges and re-visits them on subsequent attempts', async () => {
    let callCount = 0;
    const ctx = makeCtx({ ready: 'false' });
    const { callbacks, states } = makeCallbacks();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('wc1', [
      makeEdge('e1', 'wc1', 'body1', 'body'),
      makeEdge('e2', 'wc1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const visit = vi.fn(async () => {
      callCount++;
      if (callCount >= 2) ctx.set('ready', 'true');
    });
    const hCtx = makeHandlerContext({
      ctx, callbacks, outgoing, nodeMap, visit,
    });
    const node = makeNode('wc1', 'waitForCondition', {
      conditionExpression: '{{ready}} == true',
      pollIntervalMs: 1,
      timeoutMs: 5000,
      maxAttempts: 10,
    });
    const passed = makePassedFlag();

    await handleWaitForConditionNode('wc1', node, hCtx, passed);

    expect(states['wc1']?.state).toBe('pass');
    expect(visit).toHaveBeenCalledTimes(3); // 2 body visits + 1 done visit
  });
});

describe('handleLoopNode — data source integration', () => {
  it('iterates over data source rows when dataSource is set inline', async () => {
    const ctx = makeCtx();
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'forEach',
      dataSource: {
        id: 'ds-1',
        type: 'inline' as const,
        origin: 'manual' as const,
        distribution: 'sequential' as const,
        columns: [
          { id: 'col-1', name: 'userId', type: 'path' as const, mapping: 'userId' },
          { id: 'col-2', name: 'role', type: 'param' as const, mapping: 'role' },
        ],
        rows: [
          { id: 'r1', enabled: true, values: { 'col-1': 'U1', 'col-2': 'admin' } },
          { id: 'r2', enabled: true, values: { 'col-1': 'U2', 'col-2': 'viewer' } },
          { id: 'r3', enabled: false, values: { 'col-1': 'U3', 'col-2': 'editor' } },
        ],
      },
      itemVariable: 'row',
      maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);

    // 2 enabled rows → 2 body iterations + 1 done
    expect(visit).toHaveBeenCalledTimes(3);
    // Check that item variable was set to row objects
    // After last iteration, item should be second row
    const lastItem = ctx.resolve('{{row}}');
    expect(lastItem).toContain('U2');
    expect(lastItem).toContain('viewer');
  });

  it('falls back to sourceExpression when no dataSource is set', async () => {
    const ctx = makeCtx({ items: '["x","y"]' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('l1', [
      makeEdge('e1', 'l1', 'body1', 'body'),
      makeEdge('e2', 'l1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('l1', 'loop', {
      mode: 'forEach',
      sourceExpression: '{{items}}',
      itemVariable: 'item',
      maxIterations: 100,
    });

    await handleLoopNode('l1', node, hCtx);

    // Falls back to sourceExpression: 2 items + 1 done = 3
    expect(visit).toHaveBeenCalledTimes(3);
  });
});
