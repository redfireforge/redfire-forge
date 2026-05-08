import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('./scriptSandbox', () => ({
  executeScript: vi.fn(),
}));

vi.mock('./scriptLibraries', () => ({
  loadScriptLibraries: vi.fn(() => []),
  buildLibraryPreamble: vi.fn(() => ''),
}));

import { handleSubWorkflowNode } from './graphRunnerNodeHandlers';
import {
  getMockFetch,
  makeCtx,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
  makePassedFlag,
} from './graphRunnerNodeHandlers.test-utils';

const mockFetch = getMockFetch();

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok": true}',
  });
});

describe('handleSubWorkflowNode', () => {
  it('throws when child workflow not found', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => undefined,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'missing-wf',
      workflowName: 'Missing',
      inputMappings: [],
      outputMappings: [],
    });
    const mockRunGraph = vi.fn();
    const passed = makePassedFlag();

    await expect(
      handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never)
    ).rejects.toThrow('Sub-workflow "Missing" not found');
  });

  it('throws on depth limit exceeded', async () => {
    const ctx = makeCtx({ __subWorkflowDepth: '10' });
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      maxDepth: 10,
      inputMappings: [],
      outputMappings: [],
    });
    const mockRunGraph = vi.fn();
    const passed = makePassedFlag();

    await expect(
      handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never)
    ).rejects.toThrow('depth limit');
  });

  it('executes child workflow and maps outputs', async () => {
    const ctx = makeCtx({ input: 'hello' });
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start'), makeNode('ce1', 'end')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [{ sourceExpression: '{{input}}', targetVariable: 'childInput' }],
      outputMappings: [{ sourceVariable: 'childOutput', targetVariable: 'parentResult' }],
      onChildFailure: 'fail',
    });

    const mockRunGraph = vi.fn().mockResolvedValue([]);
    // Simulate child completing with output
    mockRunGraph.mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
      cb.onVariablesChange({ childOutput: 'result-value' });
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(states['sub1']?.state).toBe('pass');
    expect(ctx.resolve('{{parentResult}}')).toBe('result-value');
  });

  it('handles empty multi-instance collection', async () => {
    const ctx = makeCtx({ items: '[]' });
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      multiInstance: {
        collection: '{{items}}',
        elementVariable: 'item',
        mode: 'sequential',
      },
    });
    const mockRunGraph = vi.fn();
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(states['sub1']?.state).toBe('pass');
    expect(mockRunGraph).not.toHaveBeenCalled();
  });

  it('throws on invalid multi-instance collection', async () => {
    const ctx = makeCtx({ items: 'not-json' });
    const { callbacks } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      inputMappings: [],
      outputMappings: [],
      multiInstance: {
        collection: '{{items}}',
        elementVariable: 'item',
        mode: 'sequential',
      },
    });
    const mockRunGraph = vi.fn();
    const passed = makePassedFlag();

    await expect(
      handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never)
    ).rejects.toThrow('did not resolve to a JSON array');
  });

  it('handles multi-instance sequential execution', async () => {
    const ctx = makeCtx({ items: '["a","b"]' });
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      multiInstance: {
        collection: '{{items}}',
        elementVariable: 'item',
        mode: 'sequential',
      },
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
      cb.onVariablesChange({});
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(states['sub1']?.state).toBe('pass');
    expect(mockRunGraph).toHaveBeenCalledTimes(2);
  });

  it('handles multi-instance parallel execution', async () => {
    const ctx = makeCtx({ items: '["x","y","z"]' });
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      multiInstance: {
        collection: '{{items}}',
        elementVariable: 'item',
        mode: 'parallel',
      },
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
      cb.onVariablesChange({});
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(states['sub1']?.state).toBe('pass');
    expect(mockRunGraph).toHaveBeenCalledTimes(3);
  });

  it('continues on child failure when onChildFailure is continue', async () => {
    const ctx = makeCtx({ input: 'hello' });
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'continue',
    });
    const failResult = { passed: false, httpStatus: 500 };
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
      cb.onVariablesChange({});
      cb.onComplete([failResult], false);
      return [failResult];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(states['sub1']?.state).toBe('pass');
    expect(ctx.resolve('{{__subWorkflowFailed}}')).toBe('true');
  });

  it('propagates all outputs when propagateAllOutputs is true', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      propagateAllOutputs: true,
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
      cb.onVariablesChange({ result: '42', __internal: 'skip' });
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(ctx.resolve('{{result}}')).toBe('42');
    // __internal should not be propagated
    expect(ctx.resolve('{{__internal}}')).toBe('{{__internal}}');
  });
});
