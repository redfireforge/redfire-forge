import { describe, it, expect, vi } from 'vitest';
import {
  serializeWorkflowState,
  deserializeWorkflowState,
  encodeWorkflowState,
  decodeWorkflowState,
} from './workflowStateSerializer';
import type { WorkflowPausedState } from '../types/workflow';
import type { NodeHandlerContext } from './graphRunnerNodeHandlers';
import type { RequestResult } from '@shared/types';

// ── helpers ──────────────────────────────────────────

function makeMockCtx(vars: Record<string, string> = {}) {
  return {
    snapshot: () => ({ ...vars }),
    resolve: (expr: string) => vars[expr] ?? expr,
    set: vi.fn(),
  };
}

function makeMockHandlerContext(overrides: Partial<NodeHandlerContext> = {}): NodeHandlerContext {
  const defaults: NodeHandlerContext = {
    nodeMap: new Map(),
    outgoing: new Map(),
    ctx: makeMockCtx({ x: '1', y: '2' }) as never,
    tokenManager: {} as never,
    results: [
      { passed: true, httpStatus: 200, responseTimeMs: 50, url: 'https://api.example.com', method: 'GET', scenarioId: 's1', scenarioName: 'Test' } as RequestResult,
    ],
    allPassed: true,
    visited: new Set(['start', 'http1']),
    joinArrived: new Map([['join1', 2]]),
    incomingCount: new Map(),
    callbacks: {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onNodeResult: vi.fn(),
      onLog: vi.fn(),
    } as never,
    initialVariables: { token: 'abc' },
    environmentLayer: { ENV: 'staging' },
    log: vi.fn(),
    nodeLabel: (id: string) => id,
    visit: vi.fn(),
    visitOutgoing: vi.fn(),
    threadId: 'main',
  };
  return { ...defaults, ...overrides };
}

function makeState(overrides: Partial<WorkflowPausedState> = {}): WorkflowPausedState {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: { x: '1', y: '2' },
    visitedNodes: ['start', 'http1'],
    pausedNodeId: 'cw1',
    threadId: 'main',
    joinArrived: { join1: 2 },
    results: [
      { passed: true, httpStatus: 200, responseTimeMs: 50, url: 'https://api.example.com', method: 'GET', scenarioId: 's1', scenarioName: 'Test' } as RequestResult,
    ],
    startTime: 1000,
    initialVariables: { token: 'abc' },
    environmentLayer: { ENV: 'staging' },
    ...overrides,
  };
}

// ── serializeWorkflowState ───────────────────────────

describe('serializeWorkflowState', () => {
  it('captures all context fields from NodeHandlerContext', () => {
    const hCtx = makeMockHandlerContext();
    const state = serializeWorkflowState(hCtx, 'cw1', 'exec-1', 'wf-1', 1000);

    expect(state.executionId).toBe('exec-1');
    expect(state.workflowId).toBe('wf-1');
    expect(state.pausedNodeId).toBe('cw1');
    expect(state.threadId).toBe('main');
    expect(state.startTime).toBe(1000);
    expect(state.variables).toEqual({ x: '1', y: '2' });
    expect(state.visitedNodes).toEqual(['start', 'http1']);
    expect(state.joinArrived).toEqual({ join1: 2 });
    expect(state.initialVariables).toEqual({ token: 'abc' });
    expect(state.environmentLayer).toEqual({ ENV: 'staging' });
    expect(state.results).toHaveLength(1);
    expect(state.results[0].passed).toBe(true);
  });

  it('handles empty visited and joinArrived', () => {
    const hCtx = makeMockHandlerContext({
      visited: new Set(),
      joinArrived: new Map(),
      results: [],
    });
    const state = serializeWorkflowState(hCtx, 'cw1', 'exec-2', 'wf-2', 500);

    expect(state.visitedNodes).toEqual([]);
    expect(state.joinArrived).toEqual({});
    expect(state.results).toEqual([]);
  });

  it('handles undefined environmentLayer', () => {
    const hCtx = makeMockHandlerContext({ environmentLayer: undefined });
    const state = serializeWorkflowState(hCtx, 'cw1', 'exec-3', 'wf-3', 0);

    expect(state.environmentLayer).toBeUndefined();
  });

  it('produces a deep copy of variables (mutations do not affect original)', () => {
    const vars = { a: '10' };
    const hCtx = makeMockHandlerContext({
      ctx: makeMockCtx(vars) as never,
      initialVariables: { b: '20' },
    });
    const state = serializeWorkflowState(hCtx, 'cw1', 'exec-4', 'wf-4', 0);

    // Mutate originals
    vars.a = 'changed';
    hCtx.initialVariables.b = 'changed';

    expect(state.variables.a).toBe('10');
    expect(state.initialVariables.b).toBe('20');
  });

  it('strips non-serializable properties from results', () => {
    const result = {
      passed: true,
      httpStatus: 200,
      responseTimeMs: 10,
      url: 'https://example.com',
      method: 'GET',
      scenarioId: 's1',
      scenarioName: 'Test',
    } as RequestResult;
    const hCtx = makeMockHandlerContext({ results: [result] });

    const state = serializeWorkflowState(hCtx, 'cw1', 'exec-5', 'wf-5', 0);

    // Should be JSON-serializable
    const json = JSON.stringify(state);
    const parsed = JSON.parse(json);
    expect(parsed.results[0].passed).toBe(true);
  });
});

// ── deserializeWorkflowState ────────────────────────

describe('deserializeWorkflowState', () => {
  it('converts plain state back into runtime structures', () => {
    const state = makeState();
    const result = deserializeWorkflowState(state);

    expect(result.variables).toEqual({ x: '1', y: '2' });
    expect(result.visitedNodes).toBeInstanceOf(Set);
    expect(result.visitedNodes.has('start')).toBe(true);
    expect(result.visitedNodes.has('http1')).toBe(true);
    expect(result.pausedNodeId).toBe('cw1');
    expect(result.threadId).toBe('main');
    expect(result.joinArrived).toBeInstanceOf(Map);
    expect(result.joinArrived.get('join1')).toBe(2);
    expect(result.results).toHaveLength(1);
    expect(result.startTime).toBe(1000);
    expect(result.initialVariables).toEqual({ token: 'abc' });
    expect(result.environmentLayer).toEqual({ ENV: 'staging' });
  });

  it('handles empty arrays and objects', () => {
    const state = makeState({
      visitedNodes: [],
      joinArrived: {},
      results: [],
    });
    const result = deserializeWorkflowState(state);

    expect(result.visitedNodes.size).toBe(0);
    expect(result.joinArrived.size).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('handles undefined environmentLayer', () => {
    const state = makeState({ environmentLayer: undefined });
    const result = deserializeWorkflowState(state);

    expect(result.environmentLayer).toBeUndefined();
  });

  it('produces deep copies (mutations do not affect original)', () => {
    const state = makeState();
    const result = deserializeWorkflowState(state);

    // Mutate deserialized copies
    result.variables.x = 'changed';
    result.initialVariables.token = 'changed';
    result.visitedNodes.add('new-node');

    expect(state.variables.x).toBe('1');
    expect(state.initialVariables.token).toBe('abc');
    expect(state.visitedNodes).toEqual(['start', 'http1']);
  });
});

// ── encodeWorkflowState / decodeWorkflowState ───────

describe('encodeWorkflowState', () => {
  it('produces valid JSON', () => {
    const state = makeState();
    const json = encodeWorkflowState(state);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.executionId).toBe('exec-1');
  });
});

describe('decodeWorkflowState', () => {
  it('round-trips with encodeWorkflowState', () => {
    const original = makeState();
    const json = encodeWorkflowState(original);
    const decoded = decodeWorkflowState(json);

    expect(decoded).toEqual(original);
  });

  it('throws on invalid JSON', () => {
    expect(() => decodeWorkflowState('not-json')).toThrow();
  });

  it('throws on non-object', () => {
    expect(() => decodeWorkflowState('"just a string"')).toThrow('not an object');
  });

  it('throws on null', () => {
    expect(() => decodeWorkflowState('null')).toThrow('not an object');
  });

  it('throws on missing executionId', () => {
    const json = JSON.stringify({ workflowId: 'wf', pausedNodeId: 'n', threadId: 't', visitedNodes: [], results: [] });
    expect(() => decodeWorkflowState(json)).toThrow('missing executionId');
  });

  it('throws on missing workflowId', () => {
    const json = JSON.stringify({ executionId: 'e', pausedNodeId: 'n', threadId: 't', visitedNodes: [], results: [] });
    expect(() => decodeWorkflowState(json)).toThrow('missing workflowId');
  });

  it('throws on missing pausedNodeId', () => {
    const json = JSON.stringify({ executionId: 'e', workflowId: 'wf', threadId: 't', visitedNodes: [], results: [] });
    expect(() => decodeWorkflowState(json)).toThrow('missing pausedNodeId');
  });

  it('throws on missing threadId', () => {
    const json = JSON.stringify({ executionId: 'e', workflowId: 'wf', pausedNodeId: 'n', visitedNodes: [], results: [] });
    expect(() => decodeWorkflowState(json)).toThrow('missing threadId');
  });

  it('throws on non-array visitedNodes', () => {
    const json = JSON.stringify({ executionId: 'e', workflowId: 'wf', pausedNodeId: 'n', threadId: 't', visitedNodes: 'not-array', results: [] });
    expect(() => decodeWorkflowState(json)).toThrow('visitedNodes must be an array');
  });

  it('throws on non-array results', () => {
    const json = JSON.stringify({ executionId: 'e', workflowId: 'wf', pausedNodeId: 'n', threadId: 't', visitedNodes: [], results: 'not-array' });
    expect(() => decodeWorkflowState(json)).toThrow('results must be an array');
  });
});
