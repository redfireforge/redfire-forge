import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWorkflow, saveErrorResult } from './executeWorkflow';
import type { Workflow, NodeRunStatus } from '../src/features/workflow/types/workflow';
import type { WorkflowIterationTrace } from '../src/shared/types/index';

// Mock dependencies
vi.mock('../src/features/workflow/engine/graphRunner', () => ({
  runGraph: vi.fn(),
}));

vi.mock('./file-storage.js', () => ({
  saveExecutionResult: vi.fn().mockResolvedValue(undefined),
}));

import { runGraph } from '../src/features/workflow/engine/graphRunner';
import { saveExecutionResult } from './file-storage.js';

const mockRunGraph = vi.mocked(runGraph);
const mockSaveExecResult = vi.mocked(saveExecutionResult);

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    nodes: [],
    edges: [],
    variables: {},
    ...overrides,
  } as Workflow;
}

describe('executeWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls runGraph with correct parameters', async () => {
    mockRunGraph.mockImplementation(async (_nodes, _edges, _vars, callbacks) => {
      callbacks.onComplete?.([], true, 100);
    });

    const workflow = makeWorkflow();
    await executeWorkflow({
      executionId: 'exec-1',
      workflow,
      initialVariables: { key: 'val' },
      triggerType: 'webhook',
      triggerId: 'trig-1',
      startTime: Date.now(),
    });

    // Check first 4 arguments (nodes, edges, vars, callbacks)
    expect(mockRunGraph).toHaveBeenCalled();
    const [nodes, edges, vars, callbacks] = mockRunGraph.mock.calls[0];
    expect(nodes).toBe(workflow.nodes);
    expect(edges).toBe(workflow.edges);
    expect(vars).toEqual({ key: 'val' });
    expect(callbacks).toEqual(expect.objectContaining({
      onNodeStateChange: expect.any(Function),
      onVariablesChange: expect.any(Function),
      onComplete: expect.any(Function),
    }));
  });

  it('returns success status when all tests pass', async () => {
    mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
      callbacks.onComplete?.([], true, 50);
    });

    const result = await executeWorkflow({
      executionId: 'exec-1',
      workflow: makeWorkflow(),
      initialVariables: {},
      triggerType: 'webhook',
      triggerId: 't1',
      startTime: Date.now(),
    });

    expect(result.status).toBe('success');
    expect(result.passed).toBe(true);
  });

  it('returns failed status when tests fail', async () => {
    mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
      callbacks.onComplete?.([], false, 200);
    });

    const result = await executeWorkflow({
      executionId: 'exec-2',
      workflow: makeWorkflow(),
      initialVariables: {},
      triggerType: 'schedule',
      triggerId: 't1',
      startTime: Date.now(),
    });

    expect(result.status).toBe('failed');
    expect(result.passed).toBe(false);
  });

  it('saves execution result to storage', async () => {
    mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
      callbacks.onComplete?.([], true, 50);
    });

    await executeWorkflow({
      executionId: 'exec-3',
      workflow: makeWorkflow({ id: 'wf-3' }),
      initialVariables: { env: 'test' },
      triggerType: 'webhook',
      triggerId: 'trig-3',
      startTime: 1700000000000,
    });

    expect(mockSaveExecResult).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'exec-3',
        workflowId: 'wf-3',
        triggerId: 'trig-3',
        triggerType: 'webhook',
        status: 'success',
        variables: { env: 'test' },
      })
    );
  });

  it('collects results from runGraph onComplete callback', async () => {
    const mockResults = [
      { url: 'http://api/1', httpStatus: 200, responseTimeMs: 50, passed: true, responseBody: '{}' },
      { url: 'http://api/2', httpStatus: 500, responseTimeMs: 100, passed: false, responseBody: 'error' },
    ];

    mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
      callbacks.onComplete?.(mockResults as unknown as Parameters<NonNullable<typeof callbacks.onComplete>>[0], false, 150);
    });

    const result = await executeWorkflow({
      executionId: 'exec-4',
      workflow: makeWorkflow(),
      initialVariables: {},
      triggerType: 'webhook',
      triggerId: 't1',
      startTime: Date.now(),
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0].url).toBe('http://api/1');
    expect(result.results[1].httpStatus).toBe(500);
  });

  it('passes onLog callback through to runGraph', async () => {
    const onLog = vi.fn();
    mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
      callbacks.onComplete?.([], true, 10);
    });

    await executeWorkflow({
      executionId: 'exec-5',
      workflow: makeWorkflow(),
      initialVariables: {},
      triggerType: 'webhook',
      triggerId: 't1',
      startTime: Date.now(),
      onLog,
    });

    // Check that onLog is passed in the callbacks object
    expect(mockRunGraph).toHaveBeenCalled();
    const [, , , callbacks] = mockRunGraph.mock.calls[0];
    expect(callbacks.onLog).toBe(onLog);
  });

  it('logs node failures via onNodeStateChange', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
      callbacks.onNodeStateChange?.('node-42', { state: 'fail' } as unknown as NodeRunStatus);
      callbacks.onComplete?.([], false, 10);
    });

    await executeWorkflow({
      executionId: 'exec-6',
      workflow: makeWorkflow(),
      initialVariables: {},
      triggerType: 'webhook',
      triggerId: 't1',
      startTime: Date.now(),
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('node-42'));
    consoleSpy.mockRestore();
  });

  it('does not log when node state is not fail', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
      callbacks.onNodeStateChange?.('node-99', { state: 'running' } as unknown as NodeRunStatus);
      callbacks.onNodeStateChange?.('node-99', { state: 'success' } as unknown as NodeRunStatus);
      callbacks.onComplete?.([], true, 10);
    });

    await executeWorkflow({
      executionId: 'exec-6b',
      workflow: makeWorkflow(),
      initialVariables: {},
      triggerType: 'webhook',
      triggerId: 't1',
      startTime: Date.now(),
    });

    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('node-99'));
    consoleSpy.mockRestore();
  });

  it('calculates duration from startTime to completion', async () => {
    const startTime = Date.now() - 500;
    mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
      callbacks.onComplete?.([], true, 500);
    });

    const result = await executeWorkflow({
      executionId: 'exec-7',
      workflow: makeWorkflow(),
      initialVariables: {},
      triggerType: 'schedule',
      triggerId: 't1',
      startTime,
    });

    expect(result.duration).toBeGreaterThanOrEqual(400); // approximate
    expect(result.executionId).toBe('exec-7');
  });

  it('returns iterationTrace when onComplete provides trace', async () => {
    const iterationTrace: WorkflowIterationTrace = {
      index: 0,
      passed: true,
      durationMs: 12,
      events: [],
      finalVariables: { x: '1' },
      traversedEdges: [],
    };

    mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
      callbacks.onComplete?.([], true, 12, iterationTrace);
    });

    const result = await executeWorkflow({
      executionId: 'exec-trace',
      workflow: makeWorkflow(),
      initialVariables: {},
      triggerType: 'webhook',
      triggerId: 't1',
      startTime: Date.now(),
      traceOptions: { captureFullTrace: true },
    });

    expect(result.iterationTrace).toEqual(iterationTrace);
    expect(mockRunGraph.mock.calls[0][15]).toEqual({ captureFullTrace: true });
  });

  it('invokes onVariablesChange callback from runGraph', async () => {
    let capturedOnVariablesChange: ((v: Record<string, string>) => void) | undefined;
    mockRunGraph.mockImplementation(async (_n, _e, _v, callbacks) => {
      capturedOnVariablesChange = callbacks.onVariablesChange;
      callbacks.onVariablesChange?.({ a: 'b' });
      callbacks.onComplete?.([], true, 10);
    });

    await executeWorkflow({
      executionId: 'exec-var',
      workflow: makeWorkflow(),
      initialVariables: {},
      triggerType: 'schedule',
      triggerId: 't1',
      startTime: Date.now(),
    });

    expect(capturedOnVariablesChange).toEqual(expect.any(Function));
  });
});

describe('saveErrorResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves error execution result with status "error"', async () => {
    await saveErrorResult({
      executionId: 'err-1',
      workflowId: 'wf-1',
      triggerId: 'trig-1',
      triggerType: 'webhook',
      startTime: Date.now() - 100,
      error: 'Something went wrong',
    });

    expect(mockSaveExecResult).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'err-1',
        workflowId: 'wf-1',
        triggerId: 'trig-1',
        triggerType: 'webhook',
        status: 'error',
        error: 'Something went wrong',
        results: [],
        variables: {},
      })
    );
  });

  it('calculates duration from startTime', async () => {
    const startTime = Date.now() - 250;
    await saveErrorResult({
      executionId: 'err-2',
      workflowId: 'wf-1',
      triggerId: 'trig-1',
      triggerType: 'schedule',
      startTime,
      error: 'timeout',
    });

    const savedResult = mockSaveExecResult.mock.calls[0][0];
    expect(savedResult.duration).toBeGreaterThanOrEqual(200);
  });

  it('does not throw when saveExecutionResult fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSaveExecResult.mockRejectedValueOnce(new Error('disk full'));

    await expect(saveErrorResult({
      executionId: 'err-3',
      workflowId: 'wf-1',
      triggerId: 'trig-1',
      triggerType: 'webhook',
      startTime: Date.now(),
      error: 'original error',
    })).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save error result'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('saves error result with triggerType "kafka-trigger"', async () => {
    await saveErrorResult({
      executionId: 'err-4',
      workflowId: 'wf-kafka',
      triggerId: 'trig-kafka-1',
      triggerType: 'kafka-trigger',
      startTime: Date.now() - 50,
      error: 'Kafka dispatch failed',
    });

    expect(mockSaveExecResult).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'err-4',
        workflowId: 'wf-kafka',
        triggerId: 'trig-kafka-1',
        triggerType: 'kafka-trigger',
        status: 'error',
        error: 'Kafka dispatch failed',
      })
    );
  });
});
