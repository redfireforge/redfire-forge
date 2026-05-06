/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestResult } from '../../../shared/types';
import type { CircuitBreaker } from '../../../engine/circuitBreaker';
import type { Workflow, WorkflowNode, WorkflowEdge } from '../types/workflow';

// Mock graphRunner
vi.mock('./graphRunner', () => ({
  runGraph: vi.fn(),
}));

import { runGraphLoad } from './graphLoadRunner';
import { runGraph } from './graphRunner';

const mockRunGraph = vi.mocked(runGraph);

function createMockWorkflow(name = 'Test Workflow'): Workflow {
  const nodes: WorkflowNode[] = [
    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
    { id: 'http1', type: 'http', position: { x: 0, y: 100 }, data: { label: 'Get Users', method: 'GET', url: '/users' } },
    { id: 'end', type: 'end', position: { x: 0, y: 200 }, data: { label: 'End' } },
  ];
  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'start', target: 'http1' },
    { id: 'e2', source: 'http1', target: 'end' },
  ];
  return {
    id: 'wf-1',
    name,
    nodes,
    edges,
    variables: { baseUrl: 'https://api.example.com' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createMockResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: crypto.randomUUID(),
    scenarioId: 'http1',
    scenarioName: 'Get Users',
    url: 'https://api.example.com/users',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 100,
    responseBody: '{}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    ...overrides,
  };
}

describe('graphLoadRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runGraphLoad', () => {
    it('runs workflow with single iteration and single concurrency', async () => {
      const workflow = createMockWorkflow();
      const mockResult = createMockResult();
      
      mockRunGraph.mockResolvedValue([mockResult]);

      const results = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
      });

      expect(mockRunGraph).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].iterationIndex).toBe(0);
      expect(results[0].featureGroupName).toBe('Workflow: Test Workflow');
    });

    it('runs multiple iterations sequentially with concurrency 1', async () => {
      const workflow = createMockWorkflow();
      
      mockRunGraph.mockImplementation(async () => [createMockResult()]);

      const results = await runGraphLoad(workflow, {
        iterations: 3,
        concurrency: 1,
      });

      expect(mockRunGraph).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
      expect(results.map(r => r.iterationIndex)).toEqual([0, 1, 2]);
    });

    it('runs multiple iterations concurrently', async () => {
      const workflow = createMockWorkflow();
      
      mockRunGraph.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10));
        return [createMockResult()];
      });

      const results = await runGraphLoad(workflow, {
        iterations: 5,
        concurrency: 3,
      });

      expect(mockRunGraph).toHaveBeenCalledTimes(5);
      expect(results).toHaveLength(5);
    });

    it('passes initial variables to runGraph', async () => {
      const workflow = createMockWorkflow();
      
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        initialVariables: { userId: '123', token: 'abc' },
      });

      expect(mockRunGraph).toHaveBeenCalledWith(
        workflow.nodes,
        workflow.edges,
        { baseUrl: 'https://api.example.com', userId: '123', token: 'abc' },
        expect.any(Object), // callbacks
        undefined,          // abortSignal
        undefined,          // environmentLayer
        undefined,          // resolveHttpBaseUrl
        undefined,          // resolveHttpAuth
        undefined,          // debugController
        undefined,          // errorConfig
        undefined,          // resolveSubWorkflow
        undefined,          // correlationStore
        true,               // loadTestMode
        undefined,          // correlationWaitConfig
        undefined,          // pollSemaphore
      );
    });

    it('tags results with workflowNodeId from scenarioId', async () => {
      const workflow = createMockWorkflow();
      const mockResult = createMockResult({ scenarioId: 'http1' });
      
      mockRunGraph.mockResolvedValue([mockResult]);

      const results = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
      });

      expect(results[0].workflowNodeId).toBe('http1');
    });

    it('tags results with step label as groupName and scenarioName', async () => {
      const workflow = createMockWorkflow();
      const mockResult = createMockResult({ scenarioId: 'http1' });
      
      mockRunGraph.mockResolvedValue([mockResult]);

      const results = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
      });

      expect(results[0].groupName).toBe('Get Users');
      expect(results[0].scenarioName).toBe('Get Users');
    });

    it('calls onProgress callback after each iteration', async () => {
      const workflow = createMockWorkflow();
      const onProgress = vi.fn();
      
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 3,
        concurrency: 1,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenLastCalledWith(
        3,
        3,
        expect.any(Array),
        expect.objectContaining({
          elapsedMs: expect.any(Number),
          targetConcurrency: 1,
        }),
      );
    });

    it('stops execution when abort signal is triggered', async () => {
      const workflow = createMockWorkflow();
      const controller = new AbortController();
      
      mockRunGraph.mockImplementation(async () => {
        controller.abort();
        return [createMockResult()];
      });

      const results = await runGraphLoad(workflow, {
        iterations: 10,
        concurrency: 1,
        abortSignal: controller.signal,
      });

      // Should stop after first iteration aborts
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('stops execution when circuit breaker triggers', async () => {
      const workflow = createMockWorkflow();
      let callCount = 0;
      const breaker = {
        shouldStop: false,
        recordResult: vi.fn(),
      };
      
      mockRunGraph.mockImplementation(async () => {
        callCount++;
        // Trigger circuit breaker after 3 iterations
        if (callCount >= 3) {
          breaker.shouldStop = true;
        }
        return [createMockResult({ passed: false })];
      });

      const results = await runGraphLoad(workflow, {
        iterations: 10,
        concurrency: 1,
        breaker: breaker as CircuitBreaker,
      });

      // Should stop after breaker triggers (after 3 iterations)
      // With concurrency 1, it checks shouldStop before each iteration
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('handles errors from runGraph and creates error result', async () => {
      const workflow = createMockWorkflow();
      
      mockRunGraph.mockRejectedValueOnce(new Error('Network error'));
      mockRunGraph.mockResolvedValue([createMockResult()]);

      const results = await runGraphLoad(workflow, {
        iterations: 2,
        concurrency: 1,
      });

      expect(results).toHaveLength(2);
      const errorResult = results.find(r => r.errorMessage === 'Network error');
      expect(errorResult).toBeDefined();
      expect(errorResult?.passed).toBe(false);
      expect(errorResult?.scenarioName).toBe('Test Workflow');
      expect(errorResult?.iterationIndex).toBe(0);
    });

    it('handles multiple results per iteration', async () => {
      const workflow = createMockWorkflow();
      
      mockRunGraph.mockResolvedValue([
        createMockResult({ scenarioId: 'http1' }),
        createMockResult({ scenarioId: 'http2' }),
      ]);

      const results = await runGraphLoad(workflow, {
        iterations: 2,
        concurrency: 1,
      });

      expect(results).toHaveLength(4); // 2 results per iteration × 2 iterations
    });

    it('uses node type as label fallback when no label in data', async () => {
      const workflow: Workflow = {
        id: 'wf-1',
        name: 'Test',
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
          { id: 'http1', type: 'http', position: { x: 0, y: 100 }, data: {} },
        ],
        edges: [{ id: 'e1', source: 'start', target: 'http1' }],
        variables: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      mockRunGraph.mockResolvedValue([createMockResult({ scenarioId: 'http1' })]);

      const results = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
      });

      // Should use 'http' (the type) as the label since no label in data
      expect(results[0].groupName).toBe('http');
    });

    it('handles empty results from runGraph', async () => {
      const workflow = createMockWorkflow();
      
      mockRunGraph.mockResolvedValue([]);

      const results = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
      });

      expect(results).toHaveLength(0);
    });

    it('maintains correct iteration indices with high concurrency', async () => {
      const workflow = createMockWorkflow();
      
      mockRunGraph.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, Math.random() * 20));
        return [createMockResult()];
      });

      const results = await runGraphLoad(workflow, {
        iterations: 10,
        concurrency: 5,
      });

      expect(results).toHaveLength(10);
      const indices = results.map(r => r.iterationIndex).sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('tags results from onComplete callback', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
        const raw = [createMockResult({ scenarioId: 'http1', featureGroupName: undefined as unknown as string })];
        callbacks.onComplete(raw, true, 10);
        return raw;
      });

      const results = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });

      expect(results).toHaveLength(1);
      expect(results[0].groupName).toBe('Get Users');
    });

    it('prefers onComplete iteration results over duplicate runGraph results', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        callbacks.onComplete([createMockResult({ scenarioId: 'http1' })], true, 5);
        return [
          createMockResult({ scenarioId: 'http1' }),
          createMockResult({ scenarioId: 'http1' }),
        ];
      });

      const results = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(results).toHaveLength(1);
    });

    it('stringifies non-Error rejection in error result', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockRejectedValueOnce('string fail');

      const results = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(results[0].errorMessage).toBe('string fail');
    });

    it('skips runGraph when abortSignal already aborted', async () => {
      const workflow = createMockWorkflow();
      const ac = new AbortController();
      ac.abort();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      const results = await runGraphLoad(workflow, { iterations: 3, concurrency: 1, abortSignal: ac.signal });
      expect(results).toHaveLength(0);
      expect(mockRunGraph).not.toHaveBeenCalled();
    });

    it('skips runGraph when breaker already shouldStop', async () => {
      const workflow = createMockWorkflow();
      const breaker = { shouldStop: true, recordResult: vi.fn() };
      mockRunGraph.mockResolvedValue([createMockResult()]);

      const results = await runGraphLoad(workflow, {
        iterations: 2,
        concurrency: 1,
        breaker: breaker as CircuitBreaker,
      });
      expect(results).toHaveLength(0);
    });

    it('onComplete uses scenarioName when node id is unknown', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
        callbacks.onComplete(
          [createMockResult({ scenarioId: 'unknown-node', scenarioName: 'From Name' })],
          true,
          1,
        );
        return [];
      });

      const results = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(results).toHaveLength(1);
      expect(results[0].groupName).toBe('From Name');
    });

    it('preserves existing iterationIndex on raw results from runGraph', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult({ iterationIndex: 42 })]);

      const results = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(results[0].iterationIndex).toBe(42);
    });

    it('tags in-loop when runGraph returns results without featureGroupName', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([
        createMockResult({
          scenarioId: 'http1',
          featureGroupName: undefined as unknown as string,
          groupName: undefined as unknown as string,
        }),
      ]);

      const results = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(results[0].featureGroupName).toBe('Workflow: Test Workflow');
      expect(results[0].groupName).toBe('Get Users');
    });

    it('records breaker result when runGraph throws', async () => {
      const workflow = createMockWorkflow();
      const recordResult = vi.fn();
      mockRunGraph.mockRejectedValueOnce(new Error('boom'));

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        breaker: { shouldStop: false, recordResult } as CircuitBreaker,
      });

      expect(recordResult).toHaveBeenCalled();
      const arg = recordResult.mock.calls[0][0];
      expect(arg.passed).toBe(false);
      expect(arg.errorMessage).toBe('boom');
    });
  });
});
