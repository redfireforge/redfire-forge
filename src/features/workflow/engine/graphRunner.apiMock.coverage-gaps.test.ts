import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionTraceOptions, WorkflowEdge, WorkflowNode } from '../types/workflow';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';

const cleanupApiMockServersForRun = vi.fn();

vi.mock('../utils/apiMockRunIsolation', () => ({
  cleanupApiMockServersForRun: (...args: unknown[]) => cleanupApiMockServersForRun(...args),
}));

vi.mock('./graphRunnerApiMockNodeHandlers', () => ({
  handleApiMockStartNode: vi.fn(async (nodeId: string, _node: WorkflowNode, hCtx: NodeHandlerContext, passed: PassedFlag) => {
    passed.value = true;
    hCtx.capturedApiMockDetails?.set(nodeId, {
      transport: 'apiMockStart',
      serverId: 'srv-1__run_exec-1',
      port: 4700,
      generation: 2,
    });
    hCtx.results.push({
      id: 'res-1',
      workflowNodeId: nodeId,
      passed: true,
      responseTimeMs: 15,
      transportType: 'apiMockStart',
    } as never);
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  }),
  handleApiMockApplyNode: vi.fn(async (nodeId: string, _node: WorkflowNode, hCtx: NodeHandlerContext, passed: PassedFlag) => {
    passed.value = true;
    hCtx.capturedApiMockDetails?.set(nodeId, { transport: 'apiMockApply', serverId: 'srv-1', generation: 3 });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  }),
  handleApiMockResetStateNode: vi.fn(async (nodeId: string, _node: WorkflowNode, hCtx: NodeHandlerContext, passed: PassedFlag) => {
    passed.value = true;
    hCtx.capturedApiMockDetails?.set(nodeId, { transport: 'apiMockResetState', serverId: 'srv-1' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  }),
  handleApiMockStopNode: vi.fn(async (nodeId: string, _node: WorkflowNode, hCtx: NodeHandlerContext, passed: PassedFlag) => {
    passed.value = true;
    hCtx.capturedApiMockDetails?.set(nodeId, { transport: 'apiMockStop', serverId: 'srv-1' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  }),
  handleApiMockAssertCallsNode: vi.fn(async (nodeId: string, _node: WorkflowNode, hCtx: NodeHandlerContext, passed: PassedFlag) => {
    passed.value = false;
    hCtx.results.push({
      id: 'res-2',
      workflowNodeId: nodeId,
      passed: false,
      errorMessage: 'assert failed',
      transportType: 'apiMockAssertCalls',
    } as never);
  }),
}));

import { runGraph } from './graphRunner';

function makeCallbacks() {
  const onLog = vi.fn();
  return {
    cbs: {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
      onLog,
    },
    onLog,
  };
}

describe('graphRunner api mock coverage gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupApiMockServersForRun.mockResolvedValue({ stopped: ['srv-1__run_exec-1'], errors: [] });
  });

  it('captures api mock trace details and cleans up run-isolated servers', async () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'start',
        type: 'apiMockStart',
        position: { x: 0, y: 0 },
        data: { label: 'Start mock', serverId: 'srv-1' },
      } as WorkflowNode,
      {
        id: 'end',
        type: 'end',
        position: { x: 0, y: 100 },
        data: { label: 'Done' },
      } as WorkflowNode,
    ];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'start', target: 'end' }];
    const { cbs, onLog } = makeCallbacks();
    const traceOptions: ExecutionTraceOptions = { level: 'standard' };

    await runGraph(nodes, edges, {}, cbs, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, traceOptions);

    expect(cleanupApiMockServersForRun).toHaveBeenCalledWith(expect.stringMatching(/^exec-/));
    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({
      prefix: '*',
      text: expect.stringContaining('Stopped 1 API Mock server'),
    }));
  });

  it('records api mock errors under minimal trace level', async () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'assert',
        type: 'apiMockAssertCalls',
        position: { x: 0, y: 0 },
        data: { label: 'Assert', serverId: 'srv-1', expectedCount: 1 },
      } as WorkflowNode,
    ];
    const edges: WorkflowEdge[] = [];
    let capturedTrace: import('../../../shared/types').WorkflowIterationTrace | undefined;
    const cbs = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn((_r: unknown, _p: unknown, _d: unknown, trace?: import('../../../shared/types').WorkflowIterationTrace) => {
        capturedTrace = trace;
      }),
    };

    await runGraph(nodes, edges, {}, cbs, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { level: 'minimal' });

    const event = capturedTrace?.events.find(e => e.nodeId === 'assert');
    expect(event?.details?.error).toBe('assert failed');
  });

  it('dispatches apply, reset, and stop api mock node handlers', async () => {
    const nodes: WorkflowNode[] = [
      { id: 'apply', type: 'apiMockApply', position: { x: 0, y: 0 }, data: { label: 'Apply', serverId: 'srv-1' } } as WorkflowNode,
      { id: 'reset', type: 'apiMockResetState', position: { x: 0, y: 50 }, data: { label: 'Reset', serverId: 'srv-1' } } as WorkflowNode,
      { id: 'stop', type: 'apiMockStop', position: { x: 0, y: 100 }, data: { label: 'Stop', serverId: 'srv-1' } } as WorkflowNode,
    ];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'apply', target: 'reset' },
      { id: 'e2', source: 'reset', target: 'stop' },
    ];
    const { cbs } = makeCallbacks();

    await runGraph(nodes, edges, {}, cbs);

    expect(cleanupApiMockServersForRun).toHaveBeenCalled();
  });

  it('ignores cleanup failures best-effort', async () => {
    cleanupApiMockServersForRun.mockRejectedValueOnce(new Error('cleanup failed'));
    const nodes: WorkflowNode[] = [{
      id: 'start',
      type: 'apiMockStart',
      position: { x: 0, y: 0 },
      data: { label: 'Start mock', serverId: 'srv-1' },
    } as WorkflowNode];
    const { cbs } = makeCallbacks();

    await expect(runGraph(nodes, [], {}, cbs)).resolves.toBeDefined();
  });
});
