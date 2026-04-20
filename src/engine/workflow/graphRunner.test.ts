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
});
