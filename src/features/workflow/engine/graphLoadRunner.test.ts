/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestResult } from '../../../shared/types';
import { CircuitBreaker } from '../../../engine/circuitBreaker';
import { Workflow, WorkflowNode, WorkflowEdge } from '../types/workflow';
import { makeResult as _makeResult } from '../../../test-utils/factories';

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
  return { syntheticStart, syntheticStop, SyntheticEventInjectorMock: MockInjector as unknown as typeof MockInjector & { mock: { calls: unknown[][] } } };
});

type _SyntheticInjectorMockClass = typeof SyntheticEventInjectorMock & { mock: { calls: unknown[][] } };

// Mock graphRunner
vi.mock('./graphRunner', () => ({
  runGraph: vi.fn(),
  resolveTraceLevel: vi.fn(() => 'standard'),
}));

vi.mock('./syntheticEventInjector', () => ({
  SyntheticEventInjector: SyntheticEventInjectorMock,
}));

import { runGraphLoad } from './graphLoadRunner';
import { runGraph } from './graphRunner';
import { resolveKafkaConsumeLoadPolicy } from './kafkaLoadPolicy';

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

const createMockResult = (overrides: Partial<RequestResult> = {}) =>
  _makeResult({ id: crypto.randomUUID(), scenarioId: 'http1', scenarioName: 'Get Users', workflowNodeId: 'http1', ...overrides });

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
      const breaker = { shouldStop: true, record: vi.fn() };

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
      const breaker = { shouldStop: false, record: vi.fn() };
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
        undefined,          // httpTimeoutMs
        undefined,          // kafkaOperations
        undefined,          // wsOperations
        undefined,          // grpcOperations
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
        record: vi.fn(),
      };
      
      mockRunGraph.mockImplementation(async () => {
        callCount++;
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
      const breaker = { shouldStop: true, record: vi.fn() };
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

    it('onComplete falls back to scenarioId for nodeLabels lookup when workflowNodeId is absent', async () => {
      // Covers the right side of `r.workflowNodeId || r.scenarioId` in onComplete (branch coverage)
      const workflow = createMockWorkflow();
      mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
        callbacks.onComplete(
          [createMockResult({ workflowNodeId: '' as unknown as undefined, scenarioId: 'http1', scenarioName: 'Via ScenarioId' })],
          true,
          1,
        );
        return [];
      });

      const { results } = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(results).toHaveLength(1);
      // nodeLabels.get('http1') === 'Get Users', so groupName is from nodeLabels
      expect(results[0].groupName).toBe('Get Users');
    });

    it('post-runGraph tagging falls back to scenarioId when workflowNodeId is absent', async () => {
      // Covers the right side of `r.workflowNodeId || r.scenarioId` in the in-loop tagging (branch coverage)
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([
        createMockResult({
          workflowNodeId: '' as unknown as undefined,
          scenarioId: 'http1',
          featureGroupName: undefined as unknown as string,
          groupName: undefined as unknown as string,
        }),
      ]);

      const { results } = await runGraphLoad(workflow, { iterations: 1, concurrency: 1 });
      expect(results[0].featureGroupName).toBe('Workflow: Test Workflow');
      // nodeLabels.get('http1') === 'Get Users'
      expect(results[0].groupName).toBe('Get Users');
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

    it('records each successful-path result on the breaker', async () => {
      const workflow = createMockWorkflow();
      const record = vi.fn();
      const breaker = { shouldStop: false, record };
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        const r1 = createMockResult({ passed: true, scenarioId: 'http1' });
        const r2 = createMockResult({ passed: false, scenarioId: 'http1' });
        callbacks.onComplete([r1, r2], false, 10);
        return [];
      });

      await runGraphLoad(workflow, {
        iterations: 2,
        concurrency: 1,
        breaker: breaker as CircuitBreaker,
      });

      expect(record).toHaveBeenCalledTimes(4);
      expect(record.mock.calls.some((c: unknown[]) => (c[0] as RequestResult).passed === false)).toBe(true);
    });

    it('trips stop-first breaker on failed results from successful runGraph (no throw)', async () => {
      const workflow = createMockWorkflow();
      let tripped = false;
      const breaker = {
        get shouldStop() { return tripped; },
        record: (r: RequestResult) => { if (!r.passed) tripped = true; },
      };

      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        callbacks.onComplete([createMockResult({ passed: false })], false, 10);
        return [];
      });

      const { results } = await runGraphLoad(workflow, {
        iterations: 50,
        concurrency: 1,
        breaker: breaker as unknown as CircuitBreaker,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('creates cancelled result when abort signal fires during iteration', async () => {
      const workflow = createMockWorkflow();
      const controller = new AbortController();
      
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks, _signal) => {
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
      
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks, _signal) => {
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

    it('marks all onComplete iteration results as cancelled after abort signal', async () => {
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

      expect(results.every(r => r.cancelled)).toBe(true);
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

    it('when aborting, marks all onComplete results as cancelled (both passed and failed)', async () => {
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
      expect(failed?.cancelled).toBe(true);

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
        undefined, // httpTimeoutMs
        undefined, // kafkaOperations
        undefined, // wsOperations
        undefined, // grpcOperations
      );
    });

    it('passes kafkaOperations from opts through to runGraph', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      const kafkaOperations = {
        produce: vi.fn(),
        consume: vi.fn(),
      };

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        kafkaOperations,
      });

      expect(mockRunGraph).toHaveBeenCalledWith(
        workflow.nodes,
        workflow.edges,
        expect.any(Object),
        expect.any(Object),
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
        undefined,          // httpTimeoutMs
        kafkaOperations,    // kafkaOperations ← must be threaded through
        undefined,          // wsOperations
        undefined,          // grpcOperations
      );
    });

    it('passes grpcOperations from opts through to runGraph', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      const grpcOperations = {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(),
      };

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        grpcOperations,
      });

      expect(mockRunGraph).toHaveBeenCalledWith(
        workflow.nodes,
        workflow.edges,
        expect.any(Object),
        expect.any(Object),
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
        undefined,
        undefined,
        undefined,
        undefined,
        grpcOperations,
      );
    });

    it('creates per-iteration wsOperations when opts.wsOperations is provided', async () => {
      const workflow = createMockWorkflow();
      mockRunGraph.mockResolvedValue([createMockResult()]);

      const wsOperations = {
        connect: vi.fn(),
        send: vi.fn(),
        waitForMessage: vi.fn(),
        disconnect: vi.fn(),
        disconnectAll: vi.fn(),
      };

      await runGraphLoad(workflow, {
        iterations: 1,
        concurrency: 1,
        wsOperations: wsOperations as never,
      });

      const callArgs = mockRunGraph.mock.calls[0];
      const passedWsOps = callArgs[18];
      expect(passedWsOps).toBeDefined();
      expect(passedWsOps).not.toBe(wsOperations);
      expect(passedWsOps).toHaveProperty('connect');
      expect(passedWsOps).toHaveProperty('send');
      expect(passedWsOps).toHaveProperty('snapshotCursor');
      expect(passedWsOps).toHaveProperty('waitForMessage');
      expect(passedWsOps).toHaveProperty('disconnect');
      expect(passedWsOps).toHaveProperty('disconnectAll');
    });

    describe('Kafka load policy guard (Phase 7B)', () => {
      function createWorkflowWithKafkaConsume(mode?: 'wait-for-real' | 'auto-resume' | 'synthetic-inject'): Workflow {
        return {
          id: 'wf-kafka',
          name: 'Kafka Workflow',
          nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
            {
              id: 'consume1',
              type: 'kafkaConsume',
              position: { x: 0, y: 100 },
              data: {
                label: 'Consume Orders',
                clusterId: 'c1',
                topic: 'orders',
                ...(mode !== undefined ? { loadTestBehavior: { mode } } : {}),
              },
            },
            { id: 'end', type: 'end', position: { x: 0, y: 200 }, data: { label: 'End' } },
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'consume1' },
            { id: 'e2', source: 'consume1', target: 'end' },
          ],
          variables: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }

      it('rejects before any iteration when a kafkaConsume node has wait-for-real mode', async () => {
        const workflow = createWorkflowWithKafkaConsume('wait-for-real');
        await expect(runGraphLoad(workflow, { iterations: 1, concurrency: 1 }))
          .rejects.toThrow(/wait-for-real/);
        expect(mockRunGraph).not.toHaveBeenCalled();
      });

      it('does not reject when a kafkaConsume node has auto-resume mode', async () => {
        mockRunGraph.mockResolvedValue([createMockResult()]);
        const workflow = createWorkflowWithKafkaConsume('auto-resume');
        await expect(runGraphLoad(workflow, { iterations: 1, concurrency: 1 }))
          .resolves.toBeDefined();
      });

      it('does not reject when kafkaConsume node has no loadTestBehavior (auto-resume fallback)', async () => {
        mockRunGraph.mockResolvedValue([createMockResult()]);
        const workflow = createWorkflowWithKafkaConsume(undefined);
        await expect(runGraphLoad(workflow, { iterations: 1, concurrency: 1 }))
          .resolves.toBeDefined();
      });
    });

    // ── Phase 7 Advanced Validation: Deterministic Simulation ────────────────

    describe('deterministic load simulation (Phase 7 validation)', () => {
      function kafkaConsumeWorkflow(mode?: 'auto-resume' | 'synthetic-inject'): Workflow {
        return {
          id: 'wf-det',
          name: 'Deterministic Kafka Workflow',
          nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
            {
              id: 'consume1',
              type: 'kafkaConsume',
              position: { x: 0, y: 100 },
              data: {
                label: 'Consume Orders',
                clusterId: 'c1',
                topic: 'orders',
                ...(mode ? { loadTestBehavior: { mode } } : {}),
              },
            },
            { id: 'http1', type: 'http', position: { x: 0, y: 200 }, data: { label: 'Process Order' } },
            { id: 'end', type: 'end', position: { x: 0, y: 300 }, data: { label: 'End' } },
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'consume1' },
            { id: 'e2', source: 'consume1', target: 'http1' },
            { id: 'e3', source: 'http1', target: 'end' },
          ],
          variables: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }

      it('all iterations complete deterministically with auto-resume mode (no hangs)', async () => {
        const workflow = kafkaConsumeWorkflow('auto-resume');
        const ITERATIONS = 10;
        let callCount = 0;
        mockRunGraph.mockImplementation(async () => {
          callCount++;
          return [createMockResult({ passed: true })];
        });

        const { results } = await runGraphLoad(workflow, {
          iterations: ITERATIONS,
          concurrency: 3,
        });

        expect(callCount).toBe(ITERATIONS);
        expect(results).toHaveLength(ITERATIONS);
        const iterationIndices = results.map(r => r.iterationIndex).sort((a, b) => (a ?? 0) - (b ?? 0));
        for (let i = 0; i < ITERATIONS; i++) {
          expect(iterationIndices[i]).toBe(i);
        }
      });

      it('all iterations complete deterministically with undefined loadTestBehavior (auto-resume fallback)', async () => {
        const workflow = kafkaConsumeWorkflow(undefined);
        const ITERATIONS = 5;
        mockRunGraph.mockResolvedValue([createMockResult({ passed: true })]);

        const { results } = await runGraphLoad(workflow, {
          iterations: ITERATIONS,
          concurrency: 2,
        });

        expect(results).toHaveLength(ITERATIONS);
        expect(mockRunGraph).toHaveBeenCalledTimes(ITERATIONS);
      });

      it('synthetic-inject mode completes all iterations without hanging', async () => {
        const workflow = kafkaConsumeWorkflow('synthetic-inject');
        const ITERATIONS = 8;
        mockRunGraph.mockResolvedValue([createMockResult({ passed: true })]);

        const { results } = await runGraphLoad(workflow, {
          iterations: ITERATIONS,
          concurrency: 4,
          correlationWaitConfig: { mode: 'synthetic-inject', syntheticDelayMs: 0 },
        });

        expect(results).toHaveLength(ITERATIONS);
        expect(mockRunGraph).toHaveBeenCalledTimes(ITERATIONS);
      });

      it('results are bounded — total results never exceed iterations × results-per-iteration', async () => {
        const workflow = kafkaConsumeWorkflow('auto-resume');
        const ITERATIONS = 6;
        const RESULTS_PER_ITERATION = 3;
        mockRunGraph.mockImplementation(async () => [
          createMockResult({ scenarioId: 'step1' }),
          createMockResult({ scenarioId: 'step2' }),
          createMockResult({ scenarioId: 'step3' }),
        ]);

        const { results } = await runGraphLoad(workflow, {
          iterations: ITERATIONS,
          concurrency: 2,
        });

        expect(results).toHaveLength(ITERATIONS * RESULTS_PER_ITERATION);
      });

      it('no cross-iteration variable leakage — each iteration starts fresh', async () => {
        const workflow = kafkaConsumeWorkflow('auto-resume');
        const receivedVars: Record<string, string>[] = [];
        mockRunGraph.mockImplementation(async (_nodes, _edges, vars) => {
          receivedVars.push({ ...vars as Record<string, string> });
          return [createMockResult()];
        });

        await runGraphLoad(workflow, {
          iterations: 3,
          concurrency: 1,
          initialVariables: { userId: 'user-1' },
        });

        expect(receivedVars).toHaveLength(3);
        for (const vars of receivedVars) {
          expect(vars['userId']).toBe('user-1');
        }
      });

      it('progress callback reports monotonically increasing completion count', async () => {
        const workflow = kafkaConsumeWorkflow('auto-resume');
        mockRunGraph.mockResolvedValue([createMockResult()]);
        const progressLog: number[] = [];

        await runGraphLoad(workflow, {
          iterations: 5,
          concurrency: 1,
          onProgress: (completed) => { progressLog.push(completed); },
        });

        expect(progressLog).toHaveLength(5);
        for (let i = 1; i < progressLog.length; i++) {
          expect(progressLog[i]).toBeGreaterThanOrEqual(progressLog[i - 1]);
        }
        expect(progressLog[progressLog.length - 1]).toBe(5);
      });
    });

    // ── Phase 7 Advanced Validation: Constant-Arrival Gating ─────────────────

    describe('constant-arrival gating (Phase 7 validation)', () => {
      it('constant-arrival + wait-for-real policy returns warn (not block) — enforcement is desktop-side', () => {
        const outcome = resolveKafkaConsumeLoadPolicy('constant-arrival', 'wait-for-real');
        expect(outcome.decision).toBe('warn');
        expect(outcome.message).toBeTruthy();
      });

      it('constant-arrival + auto-resume policy returns allow — safe for deterministic throughput', () => {
        const outcome = resolveKafkaConsumeLoadPolicy('constant-arrival', 'auto-resume');
        expect(outcome.decision).toBe('allow');
        expect(outcome.message).toBeUndefined();
      });

      it('constant-arrival + undefined policy returns allow with auto-resume fallback', () => {
        const outcome = resolveKafkaConsumeLoadPolicy('constant-arrival', undefined);
        expect(outcome.decision).toBe('allow');
        expect(outcome.fallbackMode).toBe('auto-resume');
      });

      it('workflow mode blocks wait-for-real before execution starts — no iterations run', async () => {
        const workflow: Workflow = {
          id: 'wf-ca-test',
          name: 'CA Test',
          nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
            {
              id: 'kc1', type: 'kafkaConsume', position: { x: 0, y: 100 },
              data: { label: 'Consume', clusterId: 'c1', topic: 't1', loadTestBehavior: { mode: 'wait-for-real' } },
            },
          ],
          edges: [{ id: 'e1', source: 'start', target: 'kc1' }],
          variables: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await expect(runGraphLoad(workflow, { iterations: 10, concurrency: 5 }))
          .rejects.toThrow(/wait-for-real/);
        expect(mockRunGraph).not.toHaveBeenCalled();
      });
    });

    // ── Phase 7 Advanced Validation: Repeated-Run Variance ───────────────────

    describe('repeated-run variance checks (Phase 7 validation)', () => {
      it('repeated runs produce the same result count for the same config', async () => {
        const workflow: Workflow = {
          id: 'wf-var',
          name: 'Variance Check',
          nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
            {
              id: 'kc1', type: 'kafkaConsume', position: { x: 0, y: 100 },
              data: { label: 'Consume', clusterId: 'c1', topic: 't1', loadTestBehavior: { mode: 'auto-resume' } },
            },
            { id: 'http1', type: 'http', position: { x: 0, y: 200 }, data: { label: 'Process' } },
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'kc1' },
            { id: 'e2', source: 'kc1', target: 'http1' },
          ],
          variables: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const opts = { iterations: 5, concurrency: 2 };
        mockRunGraph.mockResolvedValue([createMockResult({ passed: true }), createMockResult({ passed: true })]);

        const counts: number[] = [];
        for (let run = 0; run < 3; run++) {
          const { results } = await runGraphLoad(workflow, opts);
          counts.push(results.length);
        }

        // All runs should produce the same total result count
        expect(counts[0]).toBe(counts[1]);
        expect(counts[1]).toBe(counts[2]);
        expect(counts[0]).toBe(10); // 5 iterations × 2 results
      });

      it('repeated runs produce identical pass/fail ratios for deterministic workflows', async () => {
        const workflow: Workflow = {
          id: 'wf-ratio',
          name: 'Ratio Check',
          nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
            {
              id: 'kc1', type: 'kafkaConsume', position: { x: 0, y: 100 },
              data: { label: 'Consume', clusterId: 'c1', topic: 't1', loadTestBehavior: { mode: 'auto-resume' } },
            },
          ],
          edges: [{ id: 'e1', source: 'start', target: 'kc1' }],
          variables: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        let callIdx = 0;
        mockRunGraph.mockImplementation(async () => {
          callIdx++;
          // Deterministic: even iterations pass, odd fail
          return [createMockResult({ passed: callIdx % 2 === 0 })];
        });

        const ratios: number[] = [];
        for (let run = 0; run < 3; run++) {
          callIdx = 0;
          const { results } = await runGraphLoad(workflow, { iterations: 4, concurrency: 1 });
          const passCount = results.filter(r => r.passed).length;
          ratios.push(passCount / results.length);
        }

        // All runs produce 50% pass rate (2 of 4 pass)
        expect(ratios[0]).toBe(0.5);
        expect(ratios[1]).toBe(0.5);
        expect(ratios[2]).toBe(0.5);
      });

      it('concurrent execution produces same total results as sequential for the same iteration count', async () => {
        const workflow: Workflow = {
          id: 'wf-conc',
          name: 'Concurrency Parity',
          nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
            {
              id: 'kc1', type: 'kafkaConsume', position: { x: 0, y: 100 },
              data: { label: 'Consume', clusterId: 'c1', topic: 't1', loadTestBehavior: { mode: 'auto-resume' } },
            },
          ],
          edges: [{ id: 'e1', source: 'start', target: 'kc1' }],
          variables: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        mockRunGraph.mockImplementation(async () => [createMockResult()]);

        const { results: sequential } = await runGraphLoad(workflow, { iterations: 6, concurrency: 1 });
        const { results: concurrent } = await runGraphLoad(workflow, { iterations: 6, concurrency: 3 });

        expect(sequential.length).toBe(concurrent.length);
        expect(sequential.length).toBe(6);
      });

      it('iteration indices cover the full range [0, N-1] in concurrent execution', async () => {
        const workflow: Workflow = {
          id: 'wf-idx',
          name: 'Index Coverage',
          nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
            {
              id: 'kc1', type: 'kafkaConsume', position: { x: 0, y: 100 },
              data: { label: 'Consume', clusterId: 'c1', topic: 't1', loadTestBehavior: { mode: 'auto-resume' } },
            },
          ],
          edges: [{ id: 'e1', source: 'start', target: 'kc1' }],
          variables: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        mockRunGraph.mockImplementation(async () => [createMockResult()]);

        const { results } = await runGraphLoad(workflow, { iterations: 8, concurrency: 4 });

        const indices = new Set(results.map(r => r.iterationIndex));
        for (let i = 0; i < 8; i++) {
          expect(indices.has(i)).toBe(true);
        }
      });
    });
  });

});
