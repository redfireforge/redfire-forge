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

import { handleSubWorkflowNode } from './graphRunnerSubWorkflowHandler';
import type { RequestResult } from '../../../shared/types';
import type { GraphRunCallbacks } from './graphRunnerInterfaces';
import {
  getMockFetch,
  makeCtx,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
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

describe('handleSubWorkflowNode', () => {

  it('retries failed child runs after retryDelayMs', async () => {
    vi.useFakeTimers();
    try {
      const ctx = makeCtx();
      const { callbacks } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        inputMappings: [],
        outputMappings: [],
        retryCount: 1,
        retryDelayMs: 300,
        onChildFailure: 'fail',
      });
      const fail = { passed: false, httpStatus: 500 };
      const mockRunGraph = vi.fn()
        .mockImplementationOnce(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
          cb.onVariablesChange({});
          cb.onComplete([fail], false, 0);
          return [fail];
        })
        .mockImplementationOnce(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
          cb.onVariablesChange({});
          cb.onComplete([], true, 0);
          return [];
        });
      const p = handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(true), mockRunGraph as never);
      await vi.advanceTimersByTimeAsync(300);
      await p;
      expect(mockRunGraph).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts child via timeout when runGraph stays pending until timer', async () => {
    vi.useFakeTimers();
    try {
      const ctx = makeCtx();
      const { callbacks, states } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        timeoutMs: 1000,
        onChildFailure: 'fail',
      });
      let captured: AbortSignal | undefined;
      let release!: () => void;
      const mockRunGraph = vi.fn((_n: unknown, _e: unknown, _i: unknown, _cb: unknown, signal?: AbortSignal) => {
        captured = signal;
        return new Promise<RequestResult[]>((resolve) => {
          release = () => resolve([]);
        });
      });
      const p = handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
      await vi.waitUntil(() => captured !== undefined);
      await vi.advanceTimersByTimeAsync(1000);
      expect(captured?.aborted).toBe(true);
      release();
      await p;
      expect(states['sub1']?.state).toBe('pass');
    } finally {
      vi.useRealTimers();
    }
  });

  it('forwards parent abort into timed child via shared abort chain', async () => {
    const parentAc = new AbortController();
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx,
      callbacks,
      resolveSubWorkflow: () => childWorkflow,
      abortSignal: parentAc.signal,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      timeoutMs: 120000,
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn((_n: unknown, _e: unknown, _i: unknown, _cb: unknown, signal?: AbortSignal) =>
      new Promise<RequestResult[]>((resolve) => {
        signal?.addEventListener('abort', () => resolve([]), { once: true });
      }),
    );
    const runP = handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    parentAc.abort();
    await runP;
    expect(states['sub1']?.state).toBe('pass');
  });

  it('serializes non-string multi-instance elements in logs', async () => {
    const ctx = makeCtx({ items: '[1,2]' });
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      multiInstance: {
        collection: '{{items}}',
        elementVariable: 'item',
        mode: 'sequential',
      },
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    expect(mockRunGraph).toHaveBeenCalledTimes(2);
    expect(states['sub1']?.state).toBe('pass');
  });

  it('runs child without onLog bridge when parent omits onLog', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    delete (callbacks as { onLog?: typeof callbacks.onLog }).onLog;
    const childWorkflow = { name: 'Child WF', nodes: [makeNode('cs1', 'start')], edges: [] };
    const hCtx = makeHandlerContext({ ctx, callbacks, resolveSubWorkflow: () => childWorkflow });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      expect(cb.onLog).toBeUndefined();
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    expect(mockRunGraph).toHaveBeenCalled();
  });

  it('captures subWorkflowTrace when capturedSubWorkflowTraces map is provided', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const childWorkflow = {
      id: 'child-wf-1',
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start'), makeNode('ch1', 'http', { method: 'GET', url: '/api' }), makeNode('ce1', 'end')],
      edges: [{ id: 'e1', source: 'cs1', target: 'ch1' }, { id: 'e2', source: 'ch1', target: 'ce1' }],
    };
    const capturedSubWorkflowTraces = new Map<string, import('../../../shared/types').WorkflowExecutionTrace>();
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
      capturedSubWorkflowTraces,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'child-wf-1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });

    const mockIterationTrace = {
      index: 0,
      passed: true,
      durationMs: 42,
      events: [{ nodeId: 'ch1', state: 'pass', durationMs: 30 }],
      finalVariables: { result: 'ok' },
      traversedEdges: ['e1', 'e2'],
    };
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({ result: 'ok' });
      cb.onComplete([], true, 42, mockIterationTrace as never);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(capturedSubWorkflowTraces.has('sub1')).toBe(true);
    const trace = capturedSubWorkflowTraces.get('sub1')!;
    expect(trace.workflowId).toBe('child-wf-1');
    expect(trace.workflowName).toBe('Child WF');
    expect(trace.totalIterations).toBe(1);
    expect(trace.iterations).toHaveLength(1);
    expect(trace.iterations[0].passed).toBe(true);
    expect(trace.traversedEdges).toEqual(['e1', 'e2']);
    expect(trace.workflowSnapshot.nodes).toBe(childWorkflow.nodes);
    expect(trace.workflowSnapshot.edges).toBe(childWorkflow.edges);
  });

  it('does not capture trace when capturedSubWorkflowTraces map is not provided', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      id: 'child-wf-1',
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'child-wf-1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });

    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    expect(states['sub1']?.state).toBe('pass');
    // No crash when capturedSubWorkflowTraces is undefined
  });

  it('captures multi-instance traces with correct iteration indices', async () => {
    const ctx = makeCtx({ items: '["a","b","c"]' });
    const { callbacks } = makeCallbacks();
    const childWorkflow = {
      id: 'child-wf-mi',
      name: 'MI Child',
      nodes: [makeNode('cs1', 'start'), makeNode('ce1', 'end')],
      edges: [{ id: 'e1', source: 'cs1', target: 'ce1' }],
    };
    const capturedSubWorkflowTraces = new Map<string, import('../../../shared/types').WorkflowExecutionTrace>();
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
      capturedSubWorkflowTraces,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'child-wf-mi',
      workflowName: 'MI Child',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
      multiInstance: {
        collection: '{{items}}',
        elementVariable: 'item',
        mode: 'sequential',
      },
    });

    let callIdx = 0;
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      const i = callIdx++;
      const iterTrace = {
        index: 0,
        passed: i !== 1, // second iteration fails
        durationMs: (i + 1) * 10,
        events: [],
        finalVariables: {},
        traversedEdges: ['e1'],
      };
      cb.onVariablesChange({});
      cb.onComplete([], i !== 1, (i + 1) * 10, iterTrace as never);
      return [];
    });

    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);

    expect(capturedSubWorkflowTraces.has('sub1')).toBe(true);
    const trace = capturedSubWorkflowTraces.get('sub1')!;
    expect(trace.totalIterations).toBe(3);
    expect(trace.iterations[0].index).toBe(0);
    expect(trace.iterations[1].index).toBe(1);
    expect(trace.iterations[2].index).toBe(2);
    expect(trace.iterations[1].passed).toBe(false);
  });
});
