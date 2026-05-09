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

import { handleSubWorkflowNode } from './graphRunnerSubWorkflowHandler';
import type { RequestResult } from '../../../shared/types';
import type { GraphRunCallbacks } from './graphRunnerInterfaces';
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
    mockRunGraph.mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({ childOutput: 'result-value' });
      cb.onComplete([], true, 0);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(states['sub1']?.state).toBe('pass');
    expect(ctx.resolve('{{parentResult}}')).toBe('result-value');
  });

  it('maps missing output source to empty string', async () => {
    const ctx = makeCtx();
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
      outputMappings: [{ sourceVariable: 'nosuch', targetVariable: 'parentEmpty' }],
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({ other: 'x' });
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    expect(states['sub1']?.state).toBe('pass');
    expect(ctx.resolve('{{parentEmpty}}')).toBe('');
  });

  it('defaults onChildFailure to fail when property omitted', async () => {
    const ctx = makeCtx();
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
    });
    const failResult = { passed: false, httpStatus: 500 };
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([failResult], false, 0);
      return [failResult];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(true), mockRunGraph as never);
    expect(states['sub1']?.state).toBe('fail');
  });

  it('treats mixed child results as failed even when onComplete reports pass', async () => {
    const ctx = makeCtx();
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
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [
        { passed: true, httpStatus: 200 },
        { passed: false, httpStatus: 500 },
      ];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(true), mockRunGraph as never);
    expect(states['sub1']?.state).toBe('fail');
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
    const onSubWorkflowComplete = vi.fn();
    const { callbacks, states } = makeCallbacks();
    callbacks.onSubWorkflowComplete = onSubWorkflowComplete;
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
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(states['sub1']?.state).toBe('pass');
    expect(mockRunGraph).toHaveBeenCalledTimes(2);
    expect(onSubWorkflowComplete).toHaveBeenCalledTimes(2);
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
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
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
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([failResult], false, 0);
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
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({ result: '42', __internal: 'skip' });
      cb.onComplete([], true, 0);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(ctx.resolve('{{result}}')).toBe('42');
    // __internal should not be propagated
    expect(ctx.resolve('{{__internal}}')).toBe('{{__internal}}');
  });

  it('resolves templated workflow id before lookup', async () => {
    const ctx = makeCtx({ wfKey: 'wf-real' });
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const resolveSub = vi.fn((id: string) => (id === 'wf-real' ? childWorkflow : undefined));
    const hCtx = makeHandlerContext({
      ctx, callbacks, resolveSubWorkflow: resolveSub,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: '{{wfKey}}',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    const passed = makePassedFlag();
    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);
    expect(resolveSub).toHaveBeenCalledWith('wf-real');
    expect(states['sub1']?.state).toBe('pass');
  });

  it('uses workflow id in not-found message when name is empty', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, resolveSubWorkflow: () => undefined });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'only-id',
      workflowName: '',
      inputMappings: [],
      outputMappings: [],
    });
    await expect(
      handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), vi.fn() as never),
    ).rejects.toThrow('Sub-workflow "only-id" not found');
  });

  it('throws when multi-instance collection is not a JSON array', async () => {
    const ctx = makeCtx({ items: '{}' });
    const { callbacks } = makeCallbacks();
    const childWorkflow = { name: 'Child WF', nodes: [], edges: [] };
    const hCtx = makeHandlerContext({
      ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      inputMappings: [],
      outputMappings: [],
      multiInstance: { collection: '{{items}}', elementVariable: 'item', mode: 'sequential' },
    });
    await expect(
      handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), vi.fn() as never),
    ).rejects.toThrow('did not resolve to a JSON array');
  });

  it('sets passed to false when child fails and onChildFailure is fail', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const childWorkflow = { name: 'Child WF', nodes: [makeNode('cs1', 'request')], edges: [] };
    const hCtx = makeHandlerContext({ ctx, callbacks, resolveSubWorkflow: () => childWorkflow });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });
    const fail = { passed: false, httpStatus: 500 };
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([fail], false, 0);
      return [fail];
    });
    const passed = makePassedFlag(true);
    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);
    expect(passed.value).toBe(false);
  });

  it('retries failed child runs when retryCount is set', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const childWorkflow = { name: 'Child WF', nodes: [makeNode('cs1', 'start')], edges: [] };
    const hCtx = makeHandlerContext({ ctx, callbacks, resolveSubWorkflow: () => childWorkflow });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      inputMappings: [],
      outputMappings: [],
      retryCount: 1,
      retryDelayMs: 0,
      onChildFailure: 'fail',
    });
    const fail = { passed: false, httpStatus: 500 };
    const mockRunGraph = vi.fn()
      .mockImplementationOnce(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
        cb.onVariablesChange({});
        cb.onComplete([fail], false, 0);
        return [fail];
      })
      .mockImplementationOnce(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
        cb.onVariablesChange({});
        cb.onComplete([], true, 0);
        return [];
      });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(true), mockRunGraph as never);
    expect(mockRunGraph).toHaveBeenCalledTimes(2);
  });

  it('calls onSubWorkflowComplete for single run', async () => {
    const ctx = makeCtx();
    const onSubWorkflowComplete = vi.fn();
    const { callbacks, states } = makeCallbacks();
    callbacks.onSubWorkflowComplete = onSubWorkflowComplete;
    const childWorkflow = { name: 'Child WF', nodes: [makeNode('cs1', 'start')], edges: [] };
    const hCtx = makeHandlerContext({ ctx, callbacks, resolveSubWorkflow: () => childWorkflow });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    expect(onSubWorkflowComplete).toHaveBeenCalledWith(expect.objectContaining({
      parentNodeId: 'sub1',
      childWorkflowName: 'Child WF',
      passed: true,
    }));
    expect(states['sub1']?.state).toBe('pass');
  });

  it('prefixes child logs when parent onLog is set', async () => {
    const ctx = makeCtx();
    const { callbacks, logLines } = makeCallbacks();
    const childWorkflow = { name: 'Child WF', nodes: [makeNode('cs1', 'start')], edges: [] };
    const hCtx = makeHandlerContext({ ctx, callbacks, resolveSubWorkflow: () => childWorkflow });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onLog?.({ text: 'hello' });
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    expect(logLines.some(l => l.text.includes('[sub]') && l.text.includes('hello'))).toBe(true);
  });

  it('marks aggregate failed when a multi-instance child run fails', async () => {
    const ctx = makeCtx({ items: '["a","b"]' });
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
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
    const fail = { passed: false, httpStatus: 500 };
    const mockRunGraph = vi.fn()
      .mockImplementationOnce(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
        cb.onVariablesChange({});
        cb.onComplete([fail], false, 0);
        return [fail];
      })
      .mockImplementationOnce(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
        cb.onVariablesChange({});
        cb.onComplete([], true, 0);
        return [];
      });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(true), mockRunGraph as never);
    expect(states['sub1']?.state).toBe('fail');
  });

  it('maps running HTTP child step to skipped in childSteps summary', async () => {
    const ctx = makeCtx({ items: '["a"]' });
    const onSubWorkflowComplete = vi.fn();
    const { callbacks } = makeCallbacks();
    callbacks.onSubWorkflowComplete = onSubWorkflowComplete;
    const httpNode = makeNode('h1', 'http');
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start'), httpNode],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
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
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onNodeStateChange('h1', { state: 'running', statusCode: 0, responseTimeMs: 1 });
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    const steps = onSubWorkflowComplete.mock.calls[0][0].childSteps;
    expect(steps.some((s: { state: string }) => s.state === 'skipped')).toBe(true);
  });

  it('reports pass and fail states for child HTTP steps', async () => {
    const ctx = makeCtx({ items: '["a"]' });
    const onSubWorkflowComplete = vi.fn();
    const { callbacks } = makeCallbacks();
    callbacks.onSubWorkflowComplete = onSubWorkflowComplete;
    const h1 = makeNode('h1', 'http', { label: 'First hop' });
    const h2 = makeNode('h2', 'http', { label: 'Second hop' });
    const h3 = makeNode('h3', 'http', { label: '' });
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start'), h1, h2, h3],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
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
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onNodeStateChange('h1', { state: 'pass', statusCode: 200, responseTimeMs: 5 });
      cb.onNodeStateChange('h2', { state: 'fail', statusCode: 500, responseTimeMs: 6, error: 'e' });
      cb.onNodeStateChange('h3', { state: 'pass', statusCode: 201, responseTimeMs: 7 });
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    const steps = onSubWorkflowComplete.mock.calls[0][0].childSteps;
    expect(steps.find((s: { nodeId: string }) => s.nodeId === 'h1')?.label).toBe('First hop');
    expect(steps.find((s: { nodeId: string }) => s.nodeId === 'h2')?.label).toBe('Second hop');
    expect(steps.find((s: { nodeId: string }) => s.nodeId === 'h3')?.label).toBe('h3');
  });

  it('omits HTTP nodes without state from childSteps summary', async () => {
    const ctx = makeCtx({ items: '["a"]' });
    const onSubWorkflowComplete = vi.fn();
    const { callbacks } = makeCallbacks();
    callbacks.onSubWorkflowComplete = onSubWorkflowComplete;
    const orphan = makeNode('hOrphan', 'http');
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start'), orphan],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
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
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    const steps = onSubWorkflowComplete.mock.calls[0][0].childSteps;
    expect(steps.some((s: { nodeId: string }) => s.nodeId === 'hOrphan')).toBe(false);
  });

  it('registers parent abort listener when child timeout is set', async () => {
    const ctx = makeCtx();
    const parentAc = new AbortController();
    const { callbacks } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx,
      callbacks,
      resolveSubWorkflow: () => childWorkflow,
      abortSignal: parentAc.signal,
    });
    const addSpy = vi.spyOn(parentAc.signal, 'addEventListener');
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      timeoutMs: 5000,
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    expect(addSpy).toHaveBeenCalled();
    addSpy.mockRestore();
  });

  it('skips parent abort listener when child has timeout but no parent abort signal', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx,
      callbacks,
      resolveSubWorkflow: () => childWorkflow,
      abortSignal: undefined,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      timeoutMs: 5000,
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    expect(mockRunGraph).toHaveBeenCalled();
  });

  it('retries failed child runs after retryDelayMs', async () => {
    vi.useFakeTimers();
    try {
      const ctx = makeCtx();
      const { callbacks } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        inputMappings: [],
        outputMappings: [],
        retryCount: 1,
        retryDelayMs: 300,
        onChildFailure: 'fail',
      });
      const fail = { passed: false, httpStatus: 500 };
      const mockRunGraph = vi.fn()
        .mockImplementationOnce(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
          cb.onVariablesChange({});
          cb.onComplete([fail], false, 0);
          return [fail];
        })
        .mockImplementationOnce(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
          cb.onVariablesChange({});
          cb.onComplete([], true, 0);
          return [];
        });
      const p = handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(true), mockRunGraph as never);
      await vi.advanceTimersByTimeAsync(300);
      await p;
      expect(mockRunGraph).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts child via timeout when runGraph stays pending until timer', async () => {
    vi.useFakeTimers();
    try {
      const ctx = makeCtx();
      const { callbacks, states } = makeCallbacks();
      const childWorkflow = {
        name: 'Child WF',
        nodes: [makeNode('cs1', 'start')],
        edges: [],
      };
      const hCtx = makeHandlerContext({
        ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
      });
      const node = makeNode('sub1', 'subWorkflow', {
        workflowId: 'wf1',
        workflowName: 'Child WF',
        inputMappings: [],
        outputMappings: [],
        timeoutMs: 1000,
        onChildFailure: 'fail',
      });
      let captured: AbortSignal | undefined;
      let release!: () => void;
      const mockRunGraph = vi.fn((_n: unknown, _e: unknown, _i: unknown, _cb: unknown, signal?: AbortSignal) => {
        captured = signal;
        return new Promise<RequestResult[]>((resolve) => {
          release = () => resolve([]);
        });
      });
      const p = handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
      await vi.waitUntil(() => captured !== undefined);
      await vi.advanceTimersByTimeAsync(1000);
      expect(captured?.aborted).toBe(true);
      release();
      await p;
      expect(states['sub1']?.state).toBe('pass');
    } finally {
      vi.useRealTimers();
    }
  });

  it('forwards parent abort into timed child via shared abort chain', async () => {
    const parentAc = new AbortController();
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx,
      callbacks,
      resolveSubWorkflow: () => childWorkflow,
      abortSignal: parentAc.signal,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      timeoutMs: 120000,
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn((_n: unknown, _e: unknown, _i: unknown, _cb: unknown, signal?: AbortSignal) =>
      new Promise<RequestResult[]>((resolve) => {
        signal?.addEventListener('abort', () => resolve([]), { once: true });
      }),
    );
    const runP = handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    parentAc.abort();
    await runP;
    expect(states['sub1']?.state).toBe('pass');
  });

  it('serializes non-string multi-instance elements in logs', async () => {
    const ctx = makeCtx({ items: '[1,2]' });
    const { callbacks, states } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks, resolveSubWorkflow: () => childWorkflow,
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
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    expect(mockRunGraph).toHaveBeenCalledTimes(2);
    expect(states['sub1']?.state).toBe('pass');
  });

  it('runs child without onLog bridge when parent omits onLog', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    delete (callbacks as { onLog?: typeof callbacks.onLog }).onLog;
    const childWorkflow = { name: 'Child WF', nodes: [makeNode('cs1', 'start')], edges: [] };
    const hCtx = makeHandlerContext({ ctx, callbacks, resolveSubWorkflow: () => childWorkflow });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: GraphRunCallbacks) => {
      expect(cb.onLog).toBeUndefined();
      cb.onVariablesChange({});
      cb.onComplete([], true, 0);
      return [];
    });
    await handleSubWorkflowNode('sub1', node, hCtx, makePassedFlag(), mockRunGraph as never);
    expect(mockRunGraph).toHaveBeenCalled();
  });
});
