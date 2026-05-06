import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowEdge, WorkflowNode } from '../types/workflow';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { runGraph } from './graphRunner';
import { httpFetch } from '../../../shared/utils/httpClient';

const mockFetch = vi.mocked(httpFetch);

function httpNode(id: string, label: string): WorkflowNode {
  return {
    id,
    type: 'http',
    position: { x: 0, y: 0 },
    data: {
      label,
      scenario: {
        id,
        name: label,
        url: `https://example.com/${id}`,
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
    },
  };
}

describe('runGraph', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
  });

  it('evaluates condition with >= operator', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: '10', operator: '>=', right: '10' },
    };
    const hYes = httpNode('hy', 'Yes');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([cond, hYes], edges, {}, cb);
    expect(results).toHaveLength(1);
  });

  it('evaluates condition with not-contains operator', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: 'hello', operator: 'not-contains', right: 'xyz' },
    };
    const hYes = httpNode('hy', 'Yes');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([cond, hYes], edges, {}, cb);
    expect(results).toHaveLength(1);
  });

  it('evaluates condition with unknown operator as false', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: '1', operator: 'bogus' as never, right: '1' },
    };
    const hYes = httpNode('hy', 'Yes');
    const hNo = httpNode('hn', 'No');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
      { id: 'e2', source: 'cond', target: 'hn', sourceHandle: 'false', label: 'No' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([cond, hYes, hNo], edges, {}, cb);
    // Unknown operator → false → No branch taken
    expect(results.some(r => r.url.includes('/hn'))).toBe(true);
    expect(results.some(r => r.url.includes('/hy'))).toBe(false);
  });

  it('evaluates condition with invalid regex gracefully', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: 'test', operator: 'regex', right: '[invalid(' },
    };
    const hYes = httpNode('hy', 'Yes');
    const hNo = httpNode('hn', 'No');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
      { id: 'e2', source: 'cond', target: 'hn', sourceHandle: 'false', label: 'No' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([cond, hYes, hNo], edges, {}, cb);
    // Invalid regex → false → No branch taken
    expect(results.some(r => r.url.includes('/hn'))).toBe(true);
  });

  it('aborts mid-run with abort signal', async () => {
    const controller = new AbortController();
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount >= 1) controller.abort();
      return { status: 200, statusText: 'OK', headers: {}, body: '{}' };
    });
    const h1 = httpNode('h1', 'Step 1');
    const h2 = httpNode('h2', 'Step 2');
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'h1', target: 'h2' }];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h1, h2], edges, {}, cb, controller.signal);
    // Only the first node should run before abort
    expect(callCount).toBe(1);
  });

  it('handles fetch error with result.error field', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 0, statusText: '', headers: {}, body: '',
      error: 'DNS resolution failed',
    });
    const h = httpNode('h1', 'Fail DNS');
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([h], [], {}, cb);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toContain('DNS resolution failed');
  });

  it('handles non-JSON response body', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK', headers: {},
      body: 'plain text response',
    });
    const h = httpNode('h1', 'Text Step');
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([h], [], {}, cb);
    expect(results[0].passed).toBe(true);
  });

  it('sets status variable for downstream condition evaluation', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201, statusText: 'Created', headers: {}, body: '{}',
    });
    const h = httpNode('h1', 'Create');
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If 201', left: '{{status}}', operator: '==', right: '201' },
    };
    const hYes = httpNode('hy', 'Yes');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'h1', target: 'cond' },
      { id: 'e2', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([h, cond, hYes], edges, {}, cb);
    expect(results).toHaveLength(2);
    expect(results.some(r => r.url.includes('/hy'))).toBe(true);
  });

  it('catches non-Error thrown objects in visit', async () => {
    mockFetch.mockRejectedValueOnce('string error');
    const h = httpNode('h1', 'Throw String');
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([h], [], {}, cb);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toBe('string error');
  });

  it('aborts between multiple start nodes', async () => {
    const controller = new AbortController();
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      controller.abort();
      return { status: 200, statusText: 'OK', headers: {}, body: '{}' };
    });
    // Two start nodes (no edges between them)
    const h1 = httpNode('h1', 'Start 1');
    const h2 = httpNode('h2', 'Start 2');
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h1, h2], [], {}, cb, controller.signal);
    // Only the first start node should run, second skipped due to abort
    expect(callCount).toBe(1);
  });

  it('handles httpFetch returning result.error field on non-zero status', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 502, statusText: 'Bad Gateway', headers: {},
      body: '{}', error: 'upstream timeout',
    });
    const h = httpNode('h1', 'Error Field');
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([h], [], {}, cb);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toContain('upstream timeout');
  });

  it('handles delay node abort mid-wait', async () => {
    const controller = new AbortController();
    const delay: WorkflowNode = {
      id: 'd1', type: 'delay', position: { x: 0, y: 0 },
      data: { label: 'Wait', delayMs: 60000, mode: 'fixed' },
    };
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    // Abort immediately
    setTimeout(() => controller.abort(), 5);
    await runGraph([delay], [], {}, cb, controller.signal);
    const delayStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'd1')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(delayStates).toContain('pass');
  });

  it('skips node when nodeMap lookup returns undefined', async () => {
    // Create an edge pointing to a non-existent node
    const h = httpNode('h1', 'Start');
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'h1', target: 'ghost' }];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([h], edges, {}, cb);
    expect(results).toHaveLength(1);
    // ghost node should never get a state change
    const ghostCalls = cb.onNodeStateChange.mock.calls.filter(([id]: [string]) => id === 'ghost');
    expect(ghostCalls).toHaveLength(0);
  });

  it('handles condition with no matching edges on either branch', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: '1', operator: '==', right: '1' },
    };
    // No outgoing edges at all
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([cond], [], {}, cb);
    expect(results).toHaveLength(0);
    const condStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'cond')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(condStates).toContain('pass');
  });

  // ── Start Node Tests ──

  it('executes start node and seeds inputVariables into context', async () => {
    const start: WorkflowNode = {
      id: 'start-1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { token: 'abc123', env: 'test' } },
    };
    const h1 = httpNode('h1', 'Request');
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'start-1', sourceHandle: 'out', target: 'h1', targetHandle: null }];

    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([start, h1], edges, {}, cb);

    // Start node should pass
    const startStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'start-1')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(startStates).toContain('pass');

    // Variables should be seeded
    const varCalls = cb.onVariablesChange.mock.calls;
    expect(varCalls.length).toBeGreaterThan(0);
    const firstSnapshot = varCalls[0][0];
    expect(firstSnapshot.token).toBe('abc123');
    expect(firstSnapshot.env).toBe('test');

    // HTTP node should execute after start
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('start node with empty inputVariables still executes downstream', async () => {
    const start: WorkflowNode = {
      id: 'start-1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: {} },
    };
    const h1 = httpNode('h1', 'Request');
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'start-1', sourceHandle: 'out', target: 'h1', targetHandle: null }];

    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([start, h1], edges, {}, cb);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(cb.onComplete).toHaveBeenCalledWith(expect.any(Array), true, expect.any(Number));
  });

  it('findStartNodes prefers start-type nodes over root nodes', async () => {
    // If a start node exists, it should be the entry point even if other nodes have no incoming edges
    const start: WorkflowNode = {
      id: 'start-1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: {} },
    };
    const h1 = httpNode('h1', 'Request A');
    const h2 = httpNode('h2', 'Request B');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'start-1', sourceHandle: 'out', target: 'h1', targetHandle: null },
    ];

    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([start, h1, h2], edges, {}, cb);

    // Only h1 should run (connected to start); h2 is an orphan but start-type is preferred
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // h2 should remain in pending state since it's not reachable from start
    const h2States = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'h2')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(h2States).toEqual(['pending']);
  });

  it('start node connected to multiple downstream nodes executes all', async () => {
    const start: WorkflowNode = {
      id: 'start-1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { baseUrl: 'https://api.test.com' } },
    };
    const h1 = httpNode('h1', 'Request A');
    const h2 = httpNode('h2', 'Request B');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'start-1', sourceHandle: 'out', target: 'h1', targetHandle: null },
      { id: 'e2', source: 'start-1', sourceHandle: 'out', target: 'h2', targetHandle: null },
    ];

    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([start, h1, h2], edges, {}, cb);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ── Fork Node Tests ──

  it('fork node executes all outgoing branches in parallel', async () => {
    const h0 = httpNode('h0', 'Pre-Fork');
    const fork: WorkflowNode = {
      id: 'fork-1', type: 'fork', position: { x: 0, y: 0 },
      data: { label: 'Parallel Fork' },
    };
    const h1 = httpNode('h1', 'Branch A');
    const h2 = httpNode('h2', 'Branch B');
    const edges: WorkflowEdge[] = [
      { id: 'e0', source: 'h0', target: 'fork-1' },
      { id: 'e1', source: 'fork-1', sourceHandle: 'out', target: 'h1', targetHandle: null },
      { id: 'e2', source: 'fork-1', sourceHandle: 'out', target: 'h2', targetHandle: null },
    ];

    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h0, fork, h1, h2], edges, {}, cb);

    // All 3 HTTP nodes should execute
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Fork should pass
    const forkStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'fork-1')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(forkStates).toContain('pass');
  });

  it('fork node with no outgoing edges still passes', async () => {
    const fork: WorkflowNode = {
      id: 'fork-1', type: 'fork', position: { x: 0, y: 0 },
      data: { label: 'Empty Fork' },
    };
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([fork], [], {}, cb);

    const forkStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'fork-1')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(forkStates).toContain('pass');
  });

  it('start + fork combo: start seeds variables then fork parallelizes', async () => {
    const start: WorkflowNode = {
      id: 'start-1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { region: 'us-east' } },
    };
    const fork: WorkflowNode = {
      id: 'fork-1', type: 'fork', position: { x: 0, y: 0 },
      data: { label: 'Fork' },
    };
    const h1 = httpNode('h1', 'Branch A');
    const h2 = httpNode('h2', 'Branch B');
    const edges: WorkflowEdge[] = [
      { id: 'e0', source: 'start-1', sourceHandle: 'out', target: 'fork-1', targetHandle: null },
      { id: 'e1', source: 'fork-1', sourceHandle: 'out', target: 'h1', targetHandle: null },
      { id: 'e2', source: 'fork-1', sourceHandle: 'out', target: 'h2', targetHandle: null },
    ];

    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([start, fork, h1, h2], edges, {}, cb);

    // Both branches should execute
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Variables should include the seeded ones
    const varCalls = cb.onVariablesChange.mock.calls;
    expect(varCalls[0][0].region).toBe('us-east');
  });

  // ── Join Node Tests ──

  it('join node waits for all incoming branches before proceeding', async () => {
    const fork: WorkflowNode = {
      id: 'fork-1', type: 'fork', position: { x: 0, y: 0 },
      data: { label: 'Fork' },
    };
    const h1 = httpNode('h1', 'Branch A');
    const h2 = httpNode('h2', 'Branch B');
    const join: WorkflowNode = {
      id: 'join-1', type: 'join', position: { x: 0, y: 0 },
      data: { label: 'Join' },
    };
    const h3 = httpNode('h3', 'After Join');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'fork-1', target: 'h1' },
      { id: 'e2', source: 'fork-1', target: 'h2' },
      { id: 'e3', source: 'h1', target: 'join-1' },
      { id: 'e4', source: 'h2', target: 'join-1' },
      { id: 'e5', source: 'join-1', target: 'h3' },
    ];

    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([fork, h1, h2, join, h3], edges, {}, cb);

    // All 3 HTTP nodes should execute (branch A, branch B, after join)
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Join should pass
    const joinStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'join-1')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(joinStates).toContain('pass');

    // After-join node should execute exactly once
    const h3States = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'h3')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(h3States.filter(s => s === 'running')).toHaveLength(1);
  });

  it('join node with single incoming edge passes through immediately', async () => {
    const h1 = httpNode('h1', 'Before');
    const join: WorkflowNode = {
      id: 'join-1', type: 'join', position: { x: 0, y: 0 },
      data: { label: 'Join' },
    };
    const h2 = httpNode('h2', 'After');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'h1', target: 'join-1' },
      { id: 'e2', source: 'join-1', target: 'h2' },
    ];

    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h1, join, h2], edges, {}, cb);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const joinStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'join-1')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(joinStates).toContain('pass');
  });

  it('join node with no outgoing edges still passes', async () => {
    const h1 = httpNode('h1', 'Before');
    const join: WorkflowNode = {
      id: 'join-1', type: 'join', position: { x: 0, y: 0 },
      data: { label: 'Join' },
    };
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'h1', target: 'join-1' },
    ];

    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h1, join], edges, {}, cb);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const joinStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'join-1')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(joinStates).toContain('pass');
  });

  it('full fork-join pattern: start → fork → branches → join → final', async () => {
    const start: WorkflowNode = {
      id: 'start-1', type: 'start', position: { x: 0, y: 0 },
      data: { label: 'Start', inputVariables: { token: 'abc' } },
    };
    const fork: WorkflowNode = {
      id: 'fork-1', type: 'fork', position: { x: 0, y: 0 },
      data: { label: 'Fork' },
    };
    const h1 = httpNode('h1', 'Branch A');
    const h2 = httpNode('h2', 'Branch B');
    const h3 = httpNode('h3', 'Branch C');
    const join: WorkflowNode = {
      id: 'join-1', type: 'join', position: { x: 0, y: 0 },
      data: { label: 'Join' },
    };
    const hFinal = httpNode('h-final', 'Final Step');
    const edges: WorkflowEdge[] = [
      { id: 'e0', source: 'start-1', target: 'fork-1' },
      { id: 'e1', source: 'fork-1', target: 'h1' },
      { id: 'e2', source: 'fork-1', target: 'h2' },
      { id: 'e3', source: 'fork-1', target: 'h3' },
      { id: 'e4', source: 'h1', target: 'join-1' },
      { id: 'e5', source: 'h2', target: 'join-1' },
      { id: 'e6', source: 'h3', target: 'join-1' },
      { id: 'e7', source: 'join-1', target: 'h-final' },
    ];

    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([start, fork, h1, h2, h3, join, hFinal], edges, {}, cb);

    // 3 branch HTTP nodes + 1 final = 4
    expect(mockFetch).toHaveBeenCalledTimes(4);

    // Final node should run exactly once
    const finalStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'h-final')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(finalStates.filter(s => s === 'running')).toHaveLength(1);
  });
});
