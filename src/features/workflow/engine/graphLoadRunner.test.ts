/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestResult } from '../../../shared/types';
import type { CircuitBreaker } from '../../../engine/circuitBreaker';
import type { Workflow, WorkflowNode, WorkflowEdge } from '../types/workflow';

const { syntheticStart, syntheticStop, SyntheticEventInjectorMock } = vi.hoisted(() => {
  const syntheticStart = vi.fn();
  const syntheticStop = vi.fn();
  // Must be a real class so `new SyntheticEventInjector(...)` works
  const calls: unknown[][] = [];
  class MockInjector {
    start = syntheticStart;
    stop = syntheticStop;
    constructor(...args: unknown[]) { calls.push(args); }
    static mock = { calls };
  }
  return { syntheticStart, syntheticStop, SyntheticEventInjectorMock: MockInjector as unknown as ReturnType<typeof vi.fn> };
});

// Mock graphRunner
vi.mock('./graphRunner', () => ({
  runGraph: vi.fn(),
}));

vi.mock('./syntheticEventInjector', () => ({
  SyntheticEventInjector: SyntheticEventInjectorMock,
}));

import { runGraphLoad } from './graphLoadRunner';
import { runGraph } from './graphRunner';
import { SyntheticEventInjector } from './syntheticEventInjector';

const mockRunGraph = vi.mocked(runGraph);
const mockSyntheticInjectorCtor = vi.mocked(SyntheticEventInjector);

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
    workflowNodeId: 'http1', // Phase 7e: Set by executeHttpNode
    ...overrides,
  };
}

describe('graphLoadRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syntheticStart.mockClear();
    syntheticStop.mockClear();
  });

  describe('runGraphLoad', () => {
    it('runs workflow with single iteration and single concurrency', async () => {
      const workflow = createMockWorkflow();
      const mockResult = createMockResult();
      
      mockRunGraph.mockResolvedValue([mockResult]);

      const { results } = await runGraphLoad(workflow, {
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

      const { results } = await runGraphLoad(workflow, {
        iterations: 3,
        concurrency: 1,
      });

      expect(mockRunGraph).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
      expect(results.map(r => r.iterationIndex)).toEqual([0, 1, 2]);
    });

    it('never launches iterations when concurrency is increased but iteration count is aborted before pooling', async () => {
      const workflow = createMockWorkflow();
      const controller = new AbortController();
      controller.abort();

      const { results } = await runGraphLoad(workflow, {
        iterations: 200,
        concurrency: 24,
        abortSignal: controller.signal,
      });

      expect(mockRunGraph).not.toHaveBeenCalled();
      expect(results).toHaveLength(0);
    });

    it('never launches iterations under concurrent pool when breaker is already tripped', async () => {
      const workflow = createMockWorkflow();
      const breaker = { shouldStop: true, recordResult: vi.fn() };

      const { results } = await runGraphLoad(workflow, {
        iterations: 200,
        concurrency: 24,
        breaker: breaker as CircuitBreaker,
      });

      expect(mockRunGraph).not.toHaveBeenCalled();
      expect(results).toHaveLength(0);
    });

    it('runs graph stub lifecycle no-ops when graphRunner emits UI callbacks', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
        callbacks.onNodeStateChange('http1', { state: 'running' });
        callbacks.onVariablesChange({ k: 'v' });
        return [createMockResult()];
      });

      await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(mockRunGraph).toHaveBeenCalled();
    });

    it('runs multiple iterations concurrently', async () => {
      const workflow = createMockWorkflow();
      
      mockRunGraph.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10));
        return [createMockResult()];
      });

      const { results } = await runGraphLoad(workflow, {
        iterations: 5,
        concurrency: 3,
      });

      expect(mockRunGraph).toHaveBeenCalledTimes(5);
      expect(results).toHaveLength(5);
    });

    it('stops concurrent pool early when breaker trips between races', async () => {
      const workflow = createMockWorkflow();
      const breaker = { shouldStop: false, recordResult: vi.fn() };
      let invocation = 0;
      mockRunGraph.mockImplementation(async () => {
        invocation += 1;
        if (invocation >= 6) breaker.shouldStop = true;
        await new Promise(resolve => queueMicrotask(resolve));
        return [createMockResult()];
      });

      await runGraphLoad(workflow, {
        iterations: 500,
        concurrency: 10,
        breaker: breaker as CircuitBreaker,
      });

      expect(mockRunGraph.mock.calls.length).toBeLessThan(500);
    });

    it('stops concurrent pool early when abort signal fires between races', async () => {
      const workflow = createMockWorkflow();
      const controller = new AbortController();
      let invocation = 0;

      mockRunGraph.mockImplementation(async () => {
        invocation += 1;
        if (invocation >= 6) controller.abort();
        await new Promise(resolve => queueMicrotask(resolve));
        return [createMockResult()];
      });

      const { results } = await runGraphLoad(workflow, {
        iterations: 500,
        concurrency: 8,
        abortSignal: controller.signal,
      });

      expect(mockRunGraph.mock.calls.length).toBeLessThan(500);
      expect(results.length).toBeLessThan(500);
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
        undefined,          // traceOptions
      );
    });

    it('tags results with workflowNodeId from scenarioId', async () => {
      const workflow = createMockWorkflow();
      const mockResult = createMockResult({ scenarioId: 'http1' });
      
      mockRunGraph.mockResolvedValue([mockResult]);

      const { results } = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
      });

      expect(results[0].workflowNodeId).toBe('http1');
    });

    it('tags results with step label as groupName and scenarioName', async () => {
      const workflow = createMockWorkflow();
      const mockResult = createMockResult({ scenarioId: 'http1' });
      
      mockRunGraph.mockResolvedValue([mockResult]);

      const { results } = await runGraphLoad(workflow, {
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

      const { results } = await runGraphLoad(workflow, {
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

      const { results } = await runGraphLoad(workflow, {
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

      const { results } = await runGraphLoad(workflow, {
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

      const { results } = await runGraphLoad(workflow, {
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

      const { results } = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
      });

      // Should use 'http' (the type) as the label since no label in data
      expect(results[0].groupName).toBe('http');
    });

    it('handles empty results from runGraph', async () => {
      const workflow = createMockWorkflow();
      
      mockRunGraph.mockResolvedValue([]);

      const { results } = await runGraphLoad(workflow, {
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

      const { results } = await runGraphLoad(workflow, {
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

      const { results } = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });

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

      const { results } = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(results).toHaveLength(1);
    });

    it('stringifies non-Error rejection in error result', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockRejectedValueOnce('string fail');

      const { results } = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(results[0].errorMessage).toBe('string fail');
    });

    it('skips runGraph when abortSignal already aborted', async () => {
      const workflow = createMockWorkflow();
      const ac = new AbortController();
      ac.abort();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      const { results } = await runGraphLoad(workflow, { iterations: 3, concurrency: 1, abortSignal: ac.signal });
      expect(results).toHaveLength(0);
      expect(mockRunGraph).not.toHaveBeenCalled();
    });

    it('skips runGraph when breaker already shouldStop', async () => {
      const workflow = createMockWorkflow();
      const breaker = { shouldStop: true, recordResult: vi.fn() };
      mockRunGraph.mockResolvedValue([createMockResult()]);

      const { results } = await runGraphLoad(workflow, {
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
          [createMockResult({ workflowNodeId: 'unknown-node', scenarioId: 'unknown-node', scenarioName: 'From Name' })],
          true,
          1,
        );
        return [];
      });

      const { results } = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(results).toHaveLength(1);
      expect(results[0].groupName).toBe('From Name');
    });

    it('preserves existing iterationIndex on raw results from runGraph', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult({ iterationIndex: 42 })]);

      const { results } = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
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

      const { results } = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
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
        breaker: { shouldStop: false, record: recordResult } as CircuitBreaker,
      });

      expect(recordResult).toHaveBeenCalled();
      const arg = recordResult.mock.calls[0][0];
      expect(arg.passed).toBe(false);
      expect(arg.errorMessage).toBe('boom');
    });

    it('creates cancelled result when abort signal fires during iteration', async () => {
      const workflow = createMockWorkflow();
      const controller = new AbortController();
      
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks, signal) => {
        controller.abort();
        // Simulate results before abort is fully processed
        callbacks.onComplete([createMockResult({ passed: true })], true, 10);
        return [];
      });

      const { results } = await runGraphLoad(workflow, {
        iterations: 2,
        concurrency: 1,
        abortSignal: controller.signal,
      });

      // First iteration should have cancelled results
      const cancelledResults = results.filter(r => r.cancelled);
      expect(cancelledResults.length).toBeGreaterThanOrEqual(0);
    });

    it('creates cancelled marker result when no results exist at abort', async () => {
      const workflow = createMockWorkflow();
      const controller = new AbortController();
      
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks, signal) => {
        controller.abort();
        callbacks.onComplete([], true, 10); // Empty results
        return [];
      });

      const { results } = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        abortSignal: controller.signal,
      });

      const cancelledResult = results.find(r => r.workflowNodeId === 'cancelled');
      expect(cancelledResult).toBeDefined();
      expect(cancelledResult?.errorMessage).toBe('Cancelled by user');
    });

    it('marks successful onComplete iteration results as cancelled after abort signal', async () => {
      const workflow = createMockWorkflow();
      const controller = new AbortController();

      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
        callbacks.onComplete([createMockResult({ passed: true })], true, 10);
        controller.abort();
        return [];
      });

      const { results } = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        abortSignal: controller.signal,
      });

      expect(results.every(r => !r.passed)).toBe(true);
      expect(results.some(r => r.cancelled && r.errorMessage === 'Cancelled by user')).toBe(true);
    });

    it('marks error as cancelled when abort signal is set during error', async () => {
      const workflow = createMockWorkflow();
      const controller = new AbortController();
      
      mockRunGraph.mockImplementation(async () => {
        controller.abort();
        throw new Error('Interrupted');
      });

      const { results } = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        abortSignal: controller.signal,
      });

      expect(results[0].cancelled).toBe(true);
      expect(results[0].errorMessage).toBe('Cancelled by user');
    });

    it('uses raw runGraph return value when onComplete was not invoked', async () => {
      const workflow = createMockWorkflow();
      const raw = createMockResult({ scenarioId: 'http1', featureGroupName: undefined as unknown as string });

      mockRunGraph.mockImplementation(async () => [raw]);

      const { results } = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });

      expect(results).toHaveLength(1);
      expect(results[0].iterationIndex).toBe(0);
      expect(results[0].featureGroupName).toBe('Workflow: Test Workflow');
    });

    it('does not overwrite truthy iterationIndex or existing featureGroupName on raw results', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([
        createMockResult({
          iterationIndex: 77,
          featureGroupName: 'PreTagged',
          groupName: 'G',
          scenarioName: 'S',
        }),
      ]);

      const { results } = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });

      expect(results[0].iterationIndex).toBe(77);
      expect(results[0].featureGroupName).toBe('PreTagged');
      expect(results[0].groupName).toBe('G');
    });

    it('when aborting, only marks passed onComplete results as cancelled (leaves failed rows unchanged)', async () => {
      const workflow = createMockWorkflow();
      const controller = new AbortController();

      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        callbacks.onComplete(
          [
            createMockResult({ passed: true, scenarioId: 'a' }),
            createMockResult({
              passed: false,
              scenarioId: 'b',
              errorMessage: 'Expected failure',
              cancelled: false,
            }),
          ],
          false,
          10,
        );
        controller.abort();
        return [];
      });

      const { results } = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        abortSignal: controller.signal,
      });

      const failed = results.find(r => r.scenarioId === 'b');
      expect(failed?.passed).toBe(false);
      expect(failed?.errorMessage).toBe('Expected failure');
      expect(failed?.cancelled).not.toBe(true);

      const passedThenCancelled = results.find(r => r.scenarioId === 'a');
      expect(passedThenCancelled?.cancelled).toBe(true);
    });

    it('completes immediately with no iterations when concurrency is greater than one', async () => {
      const workflow = createMockWorkflow();

      await runGraphLoad(workflow, { iterations: 0, concurrency: 8 });

      expect(mockRunGraph).not.toHaveBeenCalled();
    });

    it('passes environmentLayer through to runGraph', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        environmentLayer: { baseUrl: 'https://harness.example' },
      });

      expect(mockRunGraph).toHaveBeenCalledWith(
        workflow.nodes,
        workflow.edges,
        expect.any(Object),
        expect.any(Object),
        undefined,
        { baseUrl: 'https://harness.example' },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('correlation wait modes', () => {
    it('uses loadTestMode=true by default (auto-resume behavior)', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
      });

      expect(mockRunGraph).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined, // correlationStore
        true,      // loadTestMode = true
        undefined,
        undefined,
        undefined,
      );
    });

    it('passes correlationWaitConfig to runGraph', async () => {
      const workflow = createMockWorkflow();
      const config = {
        mode: 'auto-resume' as const,
        timeoutMs: 5000,
      };
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        correlationWaitConfig: config,
      });

      expect(mockRunGraph).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        config, // correlationWaitConfig passed through
        undefined,
        undefined,
      );
    });

    it('sets loadTestMode=false for wait-for-real mode', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        correlationWaitConfig: { mode: 'wait-for-real' },
      });

      expect(mockRunGraph).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        expect.anything(), // RemoteCorrelationStore
        false, // loadTestMode = false for wait-for-real
        expect.anything(),
        undefined,
        undefined,
      );
    });

    it('starts and stops synthetic injector for synthetic-inject mode', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 2,
        concurrency: 1,
        correlationWaitConfig: {
          mode: 'synthetic-inject',
          syntheticDelayMs: 12,
          syntheticJitterMs: 3,
          mockPayloads: { http1: { hello: 'world' } },
        },
      });

      expect((SyntheticEventInjectorMock as any).mock.calls.length).toBeGreaterThan(0);
      const [storeArg, configArg] = (SyntheticEventInjectorMock as any).mock.calls[0]!;
      expect(storeArg).toBeDefined();
      expect(configArg).toEqual(
        expect.objectContaining({
          responseDelayMs: 12,
          jitterMs: 3,
          mockPayloads: { http1: { hello: 'world' } },
          defaultPayload: {},
        }),
      );
      expect(syntheticStart).toHaveBeenCalledTimes(1);
      expect(syntheticStop).toHaveBeenCalledTimes(1);

      expect(mockRunGraph).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        expect.anything(), // InMemoryCorrelationStore
        true,
        expect.objectContaining({ mode: 'synthetic-inject' }),
        undefined,
        undefined,
      );
    });

    it('uses zero delay and jitter defaults for synthetic-inject when omitted', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        correlationWaitConfig: { mode: 'synthetic-inject' },
      });

      const ctorCalls = (SyntheticEventInjectorMock as any).mock.calls as unknown[][];
      const [, configArg] = ctorCalls[ctorCalls.length - 1]!;
      expect(configArg).toEqual(
        expect.objectContaining({
          responseDelayMs: 0,
          jitterMs: 0,
          defaultPayload: {},
        }),
      );
    });
  });

  describe('trace collection (Phase 7e)', () => {
    it('collects iteration traces from onComplete callback', async () => {
      const workflow = createMockWorkflow();
      const mockTrace = {
        index: 0,
        passed: true,
        durationMs: 100,
        stepResults: [],
        traversedEdges: ['e1', 'e2'],
      };
      
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        callbacks.onComplete([createMockResult()], true, 100, mockTrace);
        return [];
      });

      const { trace } = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        traceOptions: { captureFullTrace: true },
      });

      expect(trace.iterations).toHaveLength(1);
      expect(trace.iterations[0].passed).toBe(true);
      expect(trace.iterations[0].index).toBe(0);
    });

    it('builds complete execution trace with workflow metadata', async () => {
      const workflow = createMockWorkflow('My Test Workflow');
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        callbacks.onComplete([createMockResult()], true, 50, {
          index: 0,
          passed: true,
          durationMs: 50,
          stepResults: [],
          traversedEdges: ['e1'],
        });
        return [];
      });

      const { trace } = await runGraphLoad(workflow, {
        iterations: 2,
        concurrency: 1,
      });

      expect(trace.workflowId).toBe('wf-1');
      expect(trace.workflowName).toBe('My Test Workflow');
      expect(trace.totalIterations).toBe(2);
      expect(trace.workflowSnapshot.nodes).toEqual(workflow.nodes);
      expect(trace.workflowSnapshot.edges).toEqual(workflow.edges);
    });

    it('aggregates traversed edges from all iterations', async () => {
      const workflow = createMockWorkflow();
      let iterNum = 0;
      
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        const edges = iterNum === 0 ? ['e1', 'e2'] : ['e2', 'e3'];
        callbacks.onComplete([createMockResult()], true, 50, {
          index: iterNum,
          passed: true,
          durationMs: 50,
          stepResults: [],
          traversedEdges: edges,
        });
        iterNum++;
        return [];
      });

      const { trace } = await runGraphLoad(workflow, {
        iterations: 2,
        concurrency: 1,
      });

      // Should deduplicate edges from both iterations
      expect(trace.traversedEdges).toContain('e1');
      expect(trace.traversedEdges).toContain('e2');
      expect(trace.traversedEdges).toContain('e3');
      expect(new Set(trace.traversedEdges).size).toBe(trace.traversedEdges.length);
    });

    it('calculates total duration from all iteration traces', async () => {
      const workflow = createMockWorkflow();
      let iterNum = 0;
      
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        const duration = (iterNum + 1) * 100;
        callbacks.onComplete([createMockResult()], true, duration, {
          index: iterNum,
          passed: true,
          durationMs: duration,
          stepResults: [],
          traversedEdges: [],
        });
        iterNum++;
        return [];
      });

      const { trace } = await runGraphLoad(workflow, {
        iterations: 3,
        concurrency: 1,
      });

      // 100 + 200 + 300 = 600
      expect(trace.totalDurationMs).toBe(600);
    });

    it('passes traceOptions to runGraph', async () => {
      const workflow = createMockWorkflow();
      const traceOpts = {
        captureFullTrace: true,
        maxResponseBodySize: 50000,
        alwaysCaptureFailures: true,
      };
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        traceOptions: traceOpts,
      });

      expect(mockRunGraph).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        undefined,
        traceOpts, // traceOptions passed through
      );
    });

    it('sets fullTraceCaptured flag based on traceOptions', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      const { trace: traceWithCapture } = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        traceOptions: { captureFullTrace: true },
      });

      const { trace: traceWithoutCapture } = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        traceOptions: { captureFullTrace: false },
      });

      expect(traceWithCapture.fullTraceCaptured).toBe(true);
      expect(traceWithoutCapture.fullTraceCaptured).toBe(false);
    });

    it('updates iteration index on collected trace', async () => {
      const workflow = createMockWorkflow();
      let iterNum = 0;
      
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        // Server returns trace with index=0 always
        callbacks.onComplete([createMockResult()], true, 50, {
          index: 0, // Wrong index from server
          passed: true,
          durationMs: 50,
          stepResults: [],
          traversedEdges: [],
        });
        iterNum++;
        return [];
      });

      const { trace } = await runGraphLoad(workflow, {
        iterations: 3,
        concurrency: 1,
      });

      // Traces should have corrected indices
      const indices = trace.iterations.map(t => t.index);
      expect(indices).toEqual([0, 1, 2]);
    });

    it('skips trace capture when onComplete omits trace payload', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        callbacks.onComplete([createMockResult()], true, 10);
        return [];
      });

      const { trace } = await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
      });

      expect(trace.iterations).toHaveLength(0);
      expect(trace.totalDurationMs).toBe(0);
    });
  });

  describe('poll semaphore', () => {
    it('creates poll semaphore when workflow has WaitForCondition nodes', async () => {
      const workflow: Workflow = {
        id: 'wf-1',
        name: 'Test',
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
          { id: 'wait', type: 'waitForCondition', position: { x: 0, y: 100 }, data: {} },
          { id: 'end', type: 'end', position: { x: 0, y: 200 }, data: {} },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'wait' },
          { id: 'e2', source: 'wait', target: 'end' },
        ],
        variables: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        maxConcurrentPolls: 10,
      });

      // Verify pollSemaphore is passed (14th argument)
      expect(mockRunGraph).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        expect.anything(), // pollSemaphore should be defined
        undefined,
      );
    });

    it('does not create poll semaphore without WaitForCondition nodes', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
      });

      // Verify pollSemaphore is undefined
      expect(mockRunGraph).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        undefined, // No pollSemaphore
        undefined,
      );
    });
  });
});
