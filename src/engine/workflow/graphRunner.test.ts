import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HttpNodeData, WorkflowEdge, WorkflowNode } from '../../types/workflow';

vi.mock('../../utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { runGraph } from './graphRunner';
import { httpFetch } from '../../utils/httpClient';

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

  it('runs every HTTP step on the taken branch when the condition has multiple outgoing edges', async () => {
    const h0 = httpNode('h0', 'Start');
    const cond: WorkflowNode = {
      id: 'cond',
      type: 'condition',
      position: { x: 0, y: 0 },
      data: { label: 'If', left: '1', operator: '==', right: '1' },
    };
    const ha = httpNode('ha', 'Yes A');
    const hb = httpNode('hb', 'Yes B');
    const hc = httpNode('hc', 'No branch');

    const nodes: WorkflowNode[] = [h0, cond, ha, hb, hc];
    const edges: WorkflowEdge[] = [
      { id: 'e0', source: 'h0', target: 'cond' },
      { id: 'e1', source: 'cond', target: 'ha', sourceHandle: 'true', label: 'Yes' },
      { id: 'e2', source: 'cond', target: 'hb', sourceHandle: 'true', label: 'Yes' },
      { id: 'e3', source: 'cond', target: 'hc', sourceHandle: 'false', label: 'No' },
    ];

    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    const results = await runGraph(nodes, edges, {}, cb);

    expect(results).toHaveLength(3);
    const paths = results.map((r) => r.url);
    expect(paths.some((u) => u.includes('/ha'))).toBe(true);
    expect(paths.some((u) => u.includes('/hb'))).toBe(true);
    expect(paths.some((u) => u.includes('/hc'))).toBe(false);
  });

  it('substitutes per-step initialVariables into URL query templates before fetch', async () => {
    const h: WorkflowNode = {
      id: 'h1',
      type: 'http',
      position: { x: 0, y: 0 },
      data: {
        label: 'Test',
        initialVariables: { vin: 'VIN123' },
        scenario: {
          id: 's1',
          name: 'Test',
          url: 'https://example.com/status?vin={{vin}}',
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        },
      } as HttpNodeData,
    };
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };
    await runGraph([h], [], {}, cb);
    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('vin=VIN123');
    expect(calledUrl).not.toContain('{{vin}}');
  });

  it('runs HTTP when node.type is omitted but data has scenario', async () => {
    const h = {
      id: 'h1',
      type: undefined as unknown as WorkflowNode['type'],
      position: { x: 0, y: 0 },
      data: {
        label: 'Test',
        initialVariables: { vin: 'VIN999' },
        scenario: {
          id: 's1',
          name: 'Test',
          url: 'https://example.com/status?vin={{vin}}',
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        },
      } as HttpNodeData,
    } as WorkflowNode;
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };
    await runGraph([h], [], {}, cb);
    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('vin=VIN999');
    expect(calledUrl).not.toContain('{{vin}}');
  });

  it('substitutes workflow-level variables into URL when per-step initialVariables is omitted', async () => {
    const h: WorkflowNode = {
      id: 'h1',
      type: 'http',
      position: { x: 0, y: 0 },
      data: {
        label: 'Test',
        scenario: {
          id: 's1',
          name: 'Test',
          url: 'https://example.com/status?vin={{vin}}',
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        },
      } as HttpNodeData,
    };
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };
    await runGraph([h], [], { vin: 'WF777' }, cb);
    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('vin=WF777');
    expect(calledUrl).not.toContain('{{vin}}');
  });

  it('substitutes {{vin}} in final URL when api key auth appends query params (buildUrl rewrite)', async () => {
    const h: WorkflowNode = {
      id: 'h1',
      type: 'http',
      position: { x: 0, y: 0 },
      data: {
        label: 'Test',
        initialVariables: { vin: 'ABC123456789' },
        scenario: {
          id: 's1',
          name: 'Test',
          url: 'https://example.com/status?vin={{vin}}',
          method: 'GET',
          headers: [],
          body: '',
          auth: {
            type: 'apikey',
            apiKeyName: 'api_key',
            apiKeyValue: 'secret',
            apiKeyIn: 'query',
          },
          validation: { mode: 'none' },
        },
      } as HttpNodeData,
    };
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };
    await runGraph([h], [], {}, cb);
    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('vin=ABC123456789');
    expect(calledUrl).not.toContain('{{vin}}');
    expect(calledUrl).toContain('api_key=secret');
  });

  it('executes delay node and continues to next', async () => {
    const delay: WorkflowNode = {
      id: 'd1', type: 'delay', position: { x: 0, y: 0 },
      data: { label: 'Wait', delayMs: 1, mode: 'fixed' },
    };
    const h = httpNode('h1', 'After');
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'd1', target: 'h1' }];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([delay, h], edges, {}, cb);
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain('/h1');
    // Delay node should be marked pass
    const delayStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'd1')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(delayStates).toContain('pass');
  });

  it('executes random delay node', async () => {
    const delay: WorkflowNode = {
      id: 'd1', type: 'delay', position: { x: 0, y: 0 },
      data: { label: 'Wait', delayMs: 10, mode: 'random', minMs: 1, maxMs: 2 },
    };
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([delay], [], {}, cb);
    const delayStates = cb.onNodeStateChange.mock.calls
      .filter(([id]: [string]) => id === 'd1')
      .map(([, s]: [string, { state: string }]) => s.state);
    expect(delayStates).toContain('pass');
  });

  it('evaluates condition with != operator', async () => {
    const h0 = httpNode('h0', 'Start');
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: '1', operator: '!=', right: '2' },
    };
    const hYes = httpNode('hy', 'Yes');
    const hNo = httpNode('hn', 'No');
    const edges: WorkflowEdge[] = [
      { id: 'e0', source: 'h0', target: 'cond' },
      { id: 'e1', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
      { id: 'e2', source: 'cond', target: 'hn', sourceHandle: 'false', label: 'No' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([h0, cond, hYes, hNo], edges, {}, cb);
    expect(results.some(r => r.url.includes('/hy'))).toBe(true);
    expect(results.some(r => r.url.includes('/hn'))).toBe(false);
  });

  it('evaluates condition with > operator', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: '10', operator: '>', right: '5' },
    };
    const hYes = httpNode('hy', 'Yes');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([cond, hYes], edges, {}, cb);
    expect(results).toHaveLength(1);
  });

  it('evaluates condition with contains operator', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: 'hello world', operator: 'contains', right: 'world' },
    };
    const hYes = httpNode('hy', 'Yes');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([cond, hYes], edges, {}, cb);
    expect(results).toHaveLength(1);
  });

  it('evaluates condition with regex operator', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: 'abc123', operator: 'regex', right: '^[a-z]+\\d+$' },
    };
    const hYes = httpNode('hy', 'Yes');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([cond, hYes], edges, {}, cb);
    expect(results).toHaveLength(1);
  });

  it('handles empty graph', async () => {
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([], [], {}, cb);
    expect(results).toEqual([]);
    expect(cb.onComplete).toHaveBeenCalledWith([], true, 0);
  });

  it('marks failed HTTP node correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500, statusText: 'Error', headers: {}, body: '{"error": "fail"}',
    });
    const h: WorkflowNode = {
      id: 'h1', type: 'http', position: { x: 0, y: 0 },
      data: {
        label: 'Fail Step',
        scenario: {
          id: 'h1', name: 'Fail Step', url: 'https://example.com/h1', method: 'GET',
          headers: [], body: '', auth: { type: 'none' },
          validation: { mode: 'none', assertions: [{ type: 'status', expected: '200' }] },
        },
      } as HttpNodeData,
    };
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([h], [], {}, cb);
    expect(results[0].passed).toBe(false);
    expect(results[0].httpStatus).toBe(500);
    expect(cb.onComplete).toHaveBeenCalled();
    const [, passed] = cb.onComplete.mock.calls[0];
    expect(passed).toBe(false);
  });

  it('handles fetch throwing an error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    const h = httpNode('h1', 'Throw Step');
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([h], [], {}, cb);
    expect(results[0].passed).toBe(false);
    expect(results[0].errorMessage).toContain('Network failure');
  });

  it('calls onComplete with duration', async () => {
    const h = httpNode('h1', 'Step');
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h], [], {}, cb);
    expect(cb.onComplete).toHaveBeenCalled();
    const [results, passed, durationMs] = cb.onComplete.mock.calls[0];
    expect(results).toHaveLength(1);
    expect(passed).toBe(true);
    expect(typeof durationMs).toBe('number');
  });

  it('resolves base URL from resolveHttpBaseUrl callback', async () => {
    const h: WorkflowNode = {
      id: 'h1', type: 'http', position: { x: 0, y: 0 },
      data: {
        label: 'Step', serviceId: 'svc-1',
        scenario: { id: 's', name: 's', url: '/api/test', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } },
      } as HttpNodeData,
    };
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h], [], {}, cb, undefined, undefined, () => 'https://resolved-base.com');
    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('https://resolved-base.com');
  });

  it('resolves auth from resolveHttpAuth callback', async () => {
    const h = httpNode('h1', 'Auth Step');
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h], [], {}, cb, undefined, undefined, undefined, () => ({
      type: 'bearer', token: 'my-token',
    }));
    expect(mockFetch).toHaveBeenCalled();
    const calledHeaders = mockFetch.mock.calls[0][2] as Record<string, string>;
    expect(calledHeaders['Authorization']).toContain('Bearer my-token');
  });

  it('substitutes variables in headers', async () => {
    const h: WorkflowNode = {
      id: 'h1', type: 'http', position: { x: 0, y: 0 },
      data: {
        label: 'Step',
        initialVariables: { apiKey: 'secret123' },
        scenario: {
          id: 's', name: 's', url: 'https://example.com/', method: 'GET',
          headers: [{ key: 'X-Api-Key', value: '{{apiKey}}' }],
          body: '', auth: { type: 'none' }, validation: { mode: 'none' },
        },
      } as HttpNodeData,
    };
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h], [], {}, cb);
    const calledHeaders = mockFetch.mock.calls[0][2] as Record<string, string>;
    expect(calledHeaders['X-Api-Key']).toBe('secret123');
  });

  it('skips visited nodes to prevent cycles', async () => {
    const h0 = httpNode('h0', 'Entry');
    const h1 = httpNode('h1', 'Step 1');
    const h2 = httpNode('h2', 'Step 2');
    // h0 -> h1 -> h2 -> h1 (cycle)
    const edges: WorkflowEdge[] = [
      { id: 'e0', source: 'h0', target: 'h1' },
      { id: 'e1', source: 'h1', target: 'h2' },
      { id: 'e2', source: 'h2', target: 'h1' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([h0, h1, h2], edges, {}, cb);
    // Should visit each node only once (3 HTTP nodes, not infinite)
    expect(results).toHaveLength(3);
  });

  it('extracts variables from response and makes them available downstream', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200, statusText: 'OK', headers: {},
      body: '{"token":"extracted_value"}',
    });
    const h1: WorkflowNode = {
      id: 'h1', type: 'http', position: { x: 0, y: 0 },
      data: {
        label: 'Extract',
        scenario: {
          id: 's1', name: 's', url: 'https://example.com/auth', method: 'GET',
          headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          extractions: [{ name: 'authToken', source: 'body', expression: '$.token' }],
        },
      } as HttpNodeData,
    };
    const h2: WorkflowNode = {
      id: 'h2', type: 'http', position: { x: 0, y: 0 },
      data: {
        label: 'Use',
        scenario: {
          id: 's2', name: 's', url: 'https://example.com/api?token={{authToken}}', method: 'GET',
          headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
        },
      } as HttpNodeData,
    };
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'h1', target: 'h2' }];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h1, h2], edges, {}, cb);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondUrl = String(mockFetch.mock.calls[1][0]);
    expect(secondUrl).toContain('token=extracted_value');
  });

  it('environment layer variables serve as fallbacks', async () => {
    const h: WorkflowNode = {
      id: 'h1', type: 'http', position: { x: 0, y: 0 },
      data: {
        label: 'Step',
        scenario: {
          id: 's', name: 's', url: 'https://example.com/{{env_var}}', method: 'GET',
          headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
        },
      } as HttpNodeData,
    };
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([h], [], {}, cb, undefined, { env_var: 'from_env' });
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('/from_env');
  });

  it('skips No branch and marks subtree skipped', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: '1', operator: '==', right: '1' },
    };
    const hNo = httpNode('hn', 'No branch');
    const hNoChild = httpNode('hnc', 'No child');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'cond', target: 'hn', sourceHandle: 'false', label: 'No' },
      { id: 'e2', source: 'hn', target: 'hnc' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    await runGraph([cond, hNo, hNoChild], edges, {}, cb);
    const skippedStates = cb.onNodeStateChange.mock.calls
      .filter(([, s]: [string, { state: string }]) => s.state === 'skipped');
    expect(skippedStates.length).toBe(2); // hn and hnc
  });

  it('evaluates condition with <= operator', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: '5', operator: '<=', right: '5' },
    };
    const hYes = httpNode('hy', 'Yes');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([cond, hYes], edges, {}, cb);
    expect(results).toHaveLength(1);
  });

  it('evaluates condition with < operator', async () => {
    const cond: WorkflowNode = {
      id: 'cond', type: 'condition', position: { x: 0, y: 0 },
      data: { label: 'If', left: '3', operator: '<', right: '5' },
    };
    const hYes = httpNode('hy', 'Yes');
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'cond', target: 'hy', sourceHandle: 'true', label: 'Yes' },
    ];
    const cb = { onNodeStateChange: vi.fn(), onVariablesChange: vi.fn(), onComplete: vi.fn() };
    const results = await runGraph([cond, hYes], edges, {}, cb);
    expect(results).toHaveLength(1);
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
});
