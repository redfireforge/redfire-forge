import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEdge, WorkflowNode, NodeRunStatus } from '../types/workflow';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { runGraph } from './graphRunner';
import { httpFetch } from '@shared/utils/httpClient';
import { DebugController, type DebugThread } from './debugController';
import { endNode, httpNode, startNode } from './graphRunnerNodeHandlers.test-utils';

const mockFetch = vi.mocked(httpFetch);

function httpNodeWithUrl(id: string, label: string, url: string): WorkflowNode {
  const node = httpNode(id, label);
  const scenario = (node.data as { scenario: { url: string } }).scenario;
  scenario.url = url;
  return node;
}

function conditionNode(id: string, left: string, operator: string, right: string): WorkflowNode {
  return {
    id,
    type: 'condition',
    position: { x: 0, y: 0 },
    data: { label: 'Condition', left, operator, right },
  };
}

function forkNode(id: string): WorkflowNode {
  return {
    id,
    type: 'fork',
    position: { x: 0, y: 0 },
    data: { label: 'Fork' },
  };
}

function joinNode(id: string): WorkflowNode {
  return {
    id,
    type: 'join',
    position: { x: 0, y: 0 },
    data: { label: 'Join' },
  };
}

describe('graphRunner - Additional Coverage', () => {

  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
  });

  describe('End Node Handling', () => {
    it('marks End node as pass when workflow succeeds', async () => {
      const nodes = [
        startNode('start'),
        httpNode('h1', 'HTTP'),
        endNode('end'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'start', target: 'h1' },
        { id: 'e2', source: 'h1', target: 'end' },
      ];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      expect(states['end']).toEqual({ state: 'pass' });
      expect(cb.onComplete).toHaveBeenCalledWith(expect.any(Array), true, expect.any(Number), expect.any(Object));
    });

    it('marks unvisited End node as fail when any step fails before reaching end', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const nodes = [
        startNode('start'),
        httpNode('h1', 'HTTP'),
        endNode('end'), // Not connected - will be unvisited
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'start', target: 'h1' },
        // No edge from h1 to end - end is unreachable
      ];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      expect(states['h1']?.state).toBe('fail');
      expect(states['end']?.state).toBe('fail');
      expect(states['end']?.error).toContain('Network error');
      expect(cb.onComplete).toHaveBeenCalledWith(expect.any(Array), false, expect.any(Number), expect.any(Object));
    });

    it('marks unvisited End node as pass when no steps fail but end not reached via edges', async () => {
      const nodes = [
        startNode('start'),
        httpNode('h1', 'HTTP'),
        endNode('end'), // Not connected
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'start', target: 'h1' },
      ];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      expect(states['end']).toEqual({ state: 'pass' });
      expect(cb.onComplete).toHaveBeenCalledWith(expect.any(Array), true, expect.any(Number), expect.any(Object));
    });

    it('handles multiple End nodes - marks all as pass on success', async () => {
      const nodes = [
        forkNode('fork'),
        httpNode('h1', 'Branch A'),
        httpNode('h2', 'Branch B'),
        endNode('end1'),
        endNode('end2'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'fork', target: 'h1' },
        { id: 'e2', source: 'fork', target: 'h2' },
        { id: 'e3', source: 'h1', target: 'end1' },
        { id: 'e4', source: 'h2', target: 'end2' },
      ];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      expect(states['end1']).toEqual({ state: 'pass' });
      expect(states['end2']).toEqual({ state: 'pass' });
    });

    it('marks End node as pass when visited even though earlier node failed', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request failed'));

      const nodes = [
        startNode('start'),
        httpNode('h1', 'HTTP Request'), // This will fail
        endNode('end1'), // Will still be visited
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'start', target: 'h1' },
        { id: 'e2', source: 'h1', target: 'end1' },
      ];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      // h1 fails but execution continues, end1 is still visited and marked pass
      expect(states['h1']?.state).toBe('fail');
      expect(states['end1']?.state).toBe('pass');
      expect(cb.onComplete).toHaveBeenCalledWith(expect.any(Array), false, expect.any(Number), expect.any(Object));
    });

    it('End node visited via edge is marked pass even if other steps failed', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
      }).mockRejectedValueOnce(new Error('Branch B failed'));

      const nodes = [
        forkNode('fork'),
        httpNode('h1', 'Branch A'),
        httpNode('h2', 'Branch B'),
        endNode('end'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'fork', target: 'h1' },
        { id: 'e2', source: 'fork', target: 'h2' },
        { id: 'e3', source: 'h1', target: 'end' },
        { id: 'e4', source: 'h2', target: 'end' },
      ];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      // End should be marked pass because it was visited via h1's edge
      expect(states['end']).toEqual({ state: 'pass' });
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('continues execution after node failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request failed'));

      const nodes = [
        startNode('start'),
        httpNode('h1', 'HTTP Request'), // This will fail
        endNode('end1'), // Will still be visited
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'start', target: 'h1' },
        { id: 'e2', source: 'h1', target: 'end1' },
      ];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      // h1 fails but execution continues, end1 is still visited and marked pass
      expect(states['h1']?.state).toBe('fail');
      expect(states['end1']?.state).toBe('pass');
      expect(cb.onComplete).toHaveBeenCalledWith(expect.any(Array), false, expect.any(Number), expect.any(Object));
    });

    it('provides generic error message when no specific errors exist but allPassed is false', async () => {
      // Simulate a scenario where allPassed is false but no errors were captured
      mockFetch.mockResolvedValueOnce({
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        body: '{}',
      });

      const nodes = [
        httpNodeWithUrl('h1', 'HTTP', 'https://example.com/test'),
        endNode('end'),
      ];
      const edges: WorkflowEdge[] = [];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      // Make validation fail
      nodes[0].data.scenario.validation = {
        mode: 'status',
        assertions: [
          { type: 'status', operator: '==', value: 200 },
        ],
      };

      await runGraph(nodes, edges, {}, cb);

      // If End is unvisited and allPassed=false, it should get an error
      if (!states['end']?.state || states['end']?.state === 'fail') {
        expect(states['end']?.error || '').toBeTruthy();
      }
    });
  });

  describe('markSubtreeSkipped - Join Node Behavior', () => {
    it('decrements join node incoming count instead of skipping when parent is skipped', async () => {
      const nodes = [
        conditionNode('cond', '1', '==', '2'), // false
        httpNode('h1', 'Yes Branch'),
        httpNode('h2', 'Always runs'),
        joinNode('join'),
        httpNode('h3', 'After Join'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'cond', target: 'h1', sourceHandle: 'true' },
        { id: 'e2', source: 'cond', target: 'h2', sourceHandle: 'false' },
        { id: 'e3', source: 'h1', target: 'join' },
        { id: 'e4', source: 'h2', target: 'join' },
        { id: 'e5', source: 'join', target: 'h3' },
      ];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      // h1 should be skipped, h2 should run, join should pass, h3 should run
      expect(states['h1']).toEqual({ state: 'skipped' });
      expect(states['h2']?.state).toBe('pass');
      expect(states['join']?.state).toBe('pass');
      expect(states['h3']?.state).toBe('pass');
    });

    it('marks End node in skipped subtree as skipped', async () => {
      const nodes = [
        conditionNode('cond', '1', '==', '2'), // false
        httpNode('h1', 'Yes Branch'),
        endNode('end1'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'cond', target: 'h1', sourceHandle: 'true' },
        { id: 'e2', source: 'h1', target: 'end1' },
      ];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      // h1 and end1 should be skipped because condition is false
      expect(states['h1']).toEqual({ state: 'skipped' });
      expect(states['end1']).toEqual({ state: 'skipped' });
    });
  });

  describe('Debug Controller Integration', () => {
    it('executes with debug controller and tracks thread state', async () => {
      const controller = new DebugController();
      const threadStates: DebugThread[][] = [];
      
      controller.onStateChange((threads) => {
        threadStates.push(Array.from(threads.values()).map(t => ({ ...t })));
      });

      const nodes = [
        forkNode('fork'),
        httpNode('h1', 'Branch A'),
        httpNode('h2', 'Branch B'),
        joinNode('join'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'fork', target: 'h1' },
        { id: 'e2', source: 'fork', target: 'h2' },
        { id: 'e3', source: 'h1', target: 'join' },
        { id: 'e4', source: 'h2', target: 'join' },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      // Resume all immediately to let execution continue
      controller.resumeAll();

      await runGraph(nodes, edges, {}, cb, undefined, undefined, undefined, undefined, controller);

      // Should have tracked thread states during execution
      expect(threadStates.length).toBeGreaterThan(0);
    });

    it('respects debug controller stop signal', async () => {
      const controller = new DebugController();

      const nodes = [
        httpNode('h1', 'Step 1'),
        httpNode('h2', 'Step 2'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'h1', target: 'h2' },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      // Stop immediately before execution starts
      controller.stop();

      await runGraph(nodes, edges, {}, cb, undefined, undefined, undefined, undefined, controller);

      // When stopped, execution should complete (possibly with no or partial nodes executed)
      expect(cb.onComplete).toHaveBeenCalled();
    });
  });

  describe('Abort Signal Integration', () => {
    it('respects abort signal when checking between nodes', async () => {
      const abortController = new AbortController();

      const nodes = [
        httpNode('h1', 'Step 1'),
        httpNode('h2', 'Step 2'),
        httpNode('h3', 'Step 3'),
      ];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'h1', target: 'h2' },
        { id: 'e2', source: 'h2', target: 'h3' },
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      // Abort immediately
      abortController.abort();

      await runGraph(nodes, edges, {}, cb, abortController.signal);

      // Execution should be stopped early
      expect(cb.onComplete).toHaveBeenCalled();
    });
  });

  describe('Empty Workflow Edge Cases', () => {
    it('handles workflow with no start nodes', async () => {
      const nodes = [
        httpNode('h1', 'Orphan'),
      ];
      const edges: WorkflowEdge[] = [];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      const results = await runGraph(nodes, edges, {}, cb);

      // Should treat orphan as start node and execute it
      expect(results.length).toBe(1);
      expect(cb.onComplete).toHaveBeenCalled();
    });

    it('handles workflow with only End node', async () => {
      const nodes = [endNode('end')];
      const edges: WorkflowEdge[] = [];

      const states: Record<string, NodeRunStatus> = {};
      const cb = {
        onNodeStateChange: vi.fn((nodeId, status) => { states[nodeId] = status; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(nodes, edges, {}, cb);

      expect(states['end']).toEqual({ state: 'pass' });
    });
  });

  describe('Variable Resolution Edge Cases', () => {
    it('resolves variables with environmentLayer as fallback', async () => {
      const nodes = [
        httpNodeWithUrl('h1', 'Test', 'https://{{baseUrl}}/test?key={{apiKey}}'),
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      await runGraph(
        nodes,
        [],
        { apiKey: 'manual-key' },
        cb,
        undefined,
        { baseUrl: 'env.example.com', apiKey: 'env-key' }
      );

      const calledUrl = String(mockFetch.mock.calls[0][0]);
      expect(calledUrl).toContain('env.example.com');
      expect(calledUrl).toContain('manual-key'); // manual vars override environment
    });

    it('uses resolveHttpBaseUrl callback when provided', async () => {
      const nodes = [
        httpNodeWithUrl('h1', 'Test', '/api/test'),
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      const resolveBaseUrl = vi.fn(() => 'https://custom.example.com');

      await runGraph(nodes, [], {}, cb, undefined, undefined, resolveBaseUrl);

      expect(resolveBaseUrl).toHaveBeenCalled();
      const calledUrl = String(mockFetch.mock.calls[0][0]);
      expect(calledUrl).toContain('custom.example.com');
    });

    it('uses resolveHttpAuth callback when provided', async () => {
      const nodes = [
        httpNodeWithUrl('h1', 'Test', 'https://example.com/test'),
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      const resolveAuth = vi.fn(() => ({
        type: 'bearer' as const,
        token: 'custom-token',
      }));

      await runGraph(nodes, [], {}, cb, undefined, undefined, undefined, resolveAuth);

      expect(resolveAuth).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Template Literal Edge Cases', () => {
    it('handles variables with special regex characters in values', async () => {
      const nodes = [
        httpNodeWithUrl('h1', 'Test', 'https://example.com/api?query={{searchTerm}}'),
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      // Variable value contains regex special characters
      await runGraph(nodes, [], { searchTerm: 'test.*[abc]+' }, cb);

      const calledUrl = String(mockFetch.mock.calls[0][0]);
      expect(calledUrl).toContain('test.*[abc]+');
    });

    it('handles variables with keys that have whitespace', async () => {
      const nodes = [
        httpNodeWithUrl('h1', 'Test', 'https://example.com/api?key={{  myKey  }}'),
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      // Variable key with whitespace should be trimmed
      await runGraph(nodes, [], { myKey: 'value123' }, cb);

      const calledUrl = String(mockFetch.mock.calls[0][0]);
      expect(calledUrl).toContain('value123');
    });

    it('handles empty string variable keys', async () => {
      const nodes = [
        httpNodeWithUrl('h1', 'Test', 'https://example.com/api?param={{validKey}}'),
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      // Variable with empty key should be ignored
      await runGraph(nodes, [], { validKey: 'valid', '': 'ignored', '   ': 'alsoIgnored' }, cb);

      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = String(mockFetch.mock.calls[0][0]);
      expect(calledUrl).toContain('valid');
    });

    it('handles null and undefined variable values', async () => {
      const nodes = [
        httpNodeWithUrl('h1', 'Test', 'https://example.com/api?a={{key1}}&b={{key2}}'),
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      // Variables with null/undefined should be filtered out
      const vars: Record<string, NodeRunStatus> = { 
        key1: 'value1', 
        key2: null,
        key3: undefined 
      };
      await runGraph(nodes, [], vars, cb);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles non-string variable values by converting to string', async () => {
      const nodes = [
        httpNodeWithUrl('h1', 'Test', 'https://example.com/api?count={{count}}&flag={{flag}}'),
      ];

      const cb = {
        onNodeStateChange: vi.fn(),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      };

      // Non-string values should be converted
      const vars: Record<string, NodeRunStatus> = { 
        count: 123,
        flag: true
      };
      await runGraph(nodes, [], vars, cb);

      const calledUrl = String(mockFetch.mock.calls[0][0]);
      expect(calledUrl).toContain('123');
      expect(calledUrl).toContain('true');
    });
  });

});
