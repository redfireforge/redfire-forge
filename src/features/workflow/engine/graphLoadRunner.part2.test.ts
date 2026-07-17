/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestResult } from '../../../shared/types';
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

type SyntheticInjectorMockClass = typeof SyntheticEventInjectorMock & { mock: { calls: unknown[][] } };

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
    resetAllMocks();
    syntheticStart.mockClear();
    syntheticStop.mockClear();
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
        undefined, // httpTimeoutMs
        undefined, // kafkaOperations
        undefined, // wsOperations
        undefined, // grpcOperations
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
        undefined, // httpTimeoutMs
        undefined, // kafkaOperations
        undefined, // wsOperations
        undefined, // grpcOperations
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
        undefined, // httpTimeoutMs
        undefined, // kafkaOperations
        undefined, // wsOperations
        undefined, // grpcOperations
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

      const injectorMock = SyntheticEventInjectorMock as SyntheticInjectorMockClass;
      expect(injectorMock.mock.calls.length).toBeGreaterThan(0);
      const [storeArg, configArg] = injectorMock.mock.calls[0]!;
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
        undefined, // httpTimeoutMs
        undefined, // kafkaOperations
        undefined, // wsOperations
        undefined, // grpcOperations
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

      const injectorMock = SyntheticEventInjectorMock as SyntheticInjectorMockClass;
      const ctorCalls = injectorMock.mock.calls;
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
        undefined, // httpTimeoutMs
        undefined, // kafkaOperations
        undefined, // wsOperations
        undefined, // grpcOperations
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
      mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
        // Server returns trace with index=0 always
        callbacks.onComplete([createMockResult()], true, 50, {
          index: 0, // Wrong index from server
          passed: true,
          durationMs: 50,
          stepResults: [],
          traversedEdges: [],
        });
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
        undefined, // httpTimeoutMs
        undefined, // kafkaOperations
        undefined, // wsOperations
        undefined, // grpcOperations
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
        undefined, // httpTimeoutMs
        undefined, // kafkaOperations
        undefined, // wsOperations
        undefined, // grpcOperations
      );
    });
  });
});
