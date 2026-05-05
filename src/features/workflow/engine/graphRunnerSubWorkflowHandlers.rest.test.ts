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

import type { NodeRunStatus, WorkflowEdge } from '../types/workflow';
import { handleSubWorkflowNode } from './graphRunnerNodeHandlers';
import {
  getMockFetch,
  makeCtx,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
  makeEdge,
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
  it('fires onSubWorkflowComplete callback for single execution', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'http', { label: 'Step1' })],
      edges: [],
    };
    const onSubWorkflowComplete = vi.fn();
    callbacks.onSubWorkflowComplete = onSubWorkflowComplete;
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
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
      cb.onVariablesChange({});
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(onSubWorkflowComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        parentNodeId: 'sub1',
        childWorkflowName: 'Child WF',
        passed: true,
      })
    );
  });

  it('resolves dynamic workflowId from variables', async () => {
    const ctx = makeCtx({ wfId: 'dynamic-wf-123' });
    const { callbacks } = makeCallbacks();
    const childWorkflow = {
      name: 'Dynamic WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const resolveSubWorkflow = vi.fn(() => childWorkflow);
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: '{{wfId}}',
      workflowName: 'Dynamic WF',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
      cb.onVariablesChange({});
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(resolveSubWorkflow).toHaveBeenCalledWith('dynamic-wf-123');
  });

  it('handles non-array multi-instance collection', async () => {
    const ctx = makeCtx({ items: '"not-an-array"' });
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

  it('sets up timeout with parent abort signal propagation', async () => {
    const ctx = makeCtx();
    const controller = new AbortController();
    const { callbacks } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'start')],
      edges: [],
    };
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => childWorkflow,
      abortSignal: controller.signal,
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'wf1',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      timeoutMs: 5000,
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
      cb.onVariablesChange({});
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(mockRunGraph).toHaveBeenCalled();
    // Verify the abort signal was passed to child
    const callArgs = mockRunGraph.mock.calls[0];
    expect(callArgs[4]).toBeDefined(); // abortSignal parameter
  });

  it('retries child workflow on failure', async () => {
    const ctx = makeCtx();
    let callCount = 0;
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
      retryCount: 2,
      retryDelayMs: 1,
      onChildFailure: 'fail',
    });
    const failResult = { passed: false, httpStatus: 500 };
    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
      callCount++;
      if (callCount <= 2) {
        cb.onVariablesChange({});
        cb.onComplete([failResult], false);
        return [failResult];
      }
      cb.onVariablesChange({});
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(mockRunGraph).toHaveBeenCalledTimes(3);
    expect(states['sub1']?.state).toBe('pass');
  });

  it('fires onSubWorkflowComplete for multi-instance items', async () => {
    const ctx = makeCtx({ items: '["a","b"]' });
    const { callbacks } = makeCallbacks();
    const childWorkflow = {
      name: 'Child WF',
      nodes: [makeNode('cs1', 'http', { label: 'Step1' })],
      edges: [],
    };
    const onSubWorkflowComplete = vi.fn();
    callbacks.onSubWorkflowComplete = onSubWorkflowComplete;
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

    expect(onSubWorkflowComplete).toHaveBeenCalledTimes(2);
  });

  it('forwards logs with [sub] prefix when onLog is provided', async () => {
    const ctx = makeCtx();
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks, states } = makeCallbacks();
    callbacks.onLog = vi.fn((line) => logLines.push(line));
    const childNodes = [makeNode('ch1', 'http')];
    const childEdges: WorkflowEdge[] = [];
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => ({ nodes: childNodes, edges: childEdges }),
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'child-wf',
      inputMappings: [],
      outputMappings: [],
    });
    const mockRunGraph = vi.fn().mockImplementation(async (
      _n: unknown, _e: unknown, _v: unknown,
      cb: { onLog?: (line: { prefix: string; text: string }) => void; onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void; onNodeStateChange: (id: string, s: NodeRunStatus) => void },
    ) => {
      cb.onNodeStateChange('ch1', { state: 'pass', statusCode: 200, responseTimeMs: 10 });
      cb.onLog?.({ prefix: '>', text: 'child log' });
      cb.onVariablesChange({});
      cb.onComplete([], true);
      return [{ nodeId: 'ch1', passed: true, statusCode: 200, responseTimeMs: 10, url: '', method: 'GET', requestHeaders: {}, responseHeaders: {} }];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    const subLog = logLines.find(l => l.text.includes('[sub]'));
    expect(subLog).toBeDefined();
    expect(subLog!.text).toContain('child log');
  });

  it('does not set onLog when parent has no onLog', async () => {
    const ctx = makeCtx();
    const { callbacks } = makeCallbacks();
    callbacks.onLog = undefined;
    const childNodes = [makeNode('ch1', 'http')];
    const childEdges: WorkflowEdge[] = [];
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => ({ nodes: childNodes, edges: childEdges }),
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'child-wf',
      inputMappings: [],
      outputMappings: [],
    });
    const mockRunGraph = vi.fn().mockImplementation(async (
      _n: unknown, _e: unknown, _v: unknown,
      cb: { onLog?: (line: { prefix: string; text: string }) => void; onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void },
    ) => {
      expect(cb.onLog).toBeUndefined();
      cb.onVariablesChange({});
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);
  });

  it('maps skipped state for child nodes that are not pass or fail', async () => {
    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const onSubWorkflowComplete = vi.fn();
    callbacks.onSubWorkflowComplete = onSubWorkflowComplete;
    const childNodes = [makeNode('ch1', 'http', { label: 'Child HTTP' })];
    const childEdges: WorkflowEdge[] = [];
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      resolveSubWorkflow: () => ({ nodes: childNodes, edges: childEdges }),
    });
    const node = makeNode('sub1', 'subWorkflow', {
      workflowId: 'child-wf',
      workflowName: 'Child WF',
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });
    const mockRunGraph = vi.fn().mockImplementation(async (
      _n: unknown, _e: unknown, _v: unknown,
      cb: { onNodeStateChange: (id: string, s: NodeRunStatus) => void; onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void },
    ) => {
      // Set a non-pass/non-fail state (e.g., 'running')
      cb.onNodeStateChange('ch1', { state: 'running' });
      cb.onVariablesChange({});
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    // buildChildSteps should map 'running' to 'skipped'
    expect(onSubWorkflowComplete).toHaveBeenCalled();
    const completeArgs = onSubWorkflowComplete.mock.calls[0][0];
    expect(completeArgs.childSteps).toBeDefined();
    expect(completeArgs.childSteps[0]?.state).toBe('skipped');
  });

  it('uses timeout and abort controller when timeoutMs is set (line 76)', async () => {
    const ctx = makeCtx();
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
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
      timeoutMs: 60000,
    });

    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onComplete: (r: unknown[], p: boolean) => void }) => {
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(states['sub1']?.state).toBe('pass');
  });

  it('falls back to empty string for missing output variable (line 210)', async () => {
    const ctx = makeCtx();
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
      inputMappings: [],
      // Map a variable that doesn't exist in child output
      outputMappings: [{ sourceVariable: 'nonExistent', targetVariable: 'parentVar' }],
      onChildFailure: 'fail',
    });

    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onVariablesChange: (v: Record<string,string>) => void; onComplete: (r: unknown[], p: boolean) => void }) => {
      cb.onVariablesChange({});
      cb.onComplete([], true);
      return [];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    // nonExistent variable falls back to '' via ?? ''
    expect(ctx.resolve('{{parentVar}}')).toBe('');
    expect(states['sub1']?.state).toBe('pass');
  });

  it('sets passed.value to false on child failure with onChildFailure=fail (line 243)', async () => {
    const ctx = makeCtx();
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
      inputMappings: [],
      outputMappings: [],
      onChildFailure: 'fail',
    });

    const mockRunGraph = vi.fn().mockImplementation(async (_n: unknown, _e: unknown, _v: unknown, cb: { onComplete: (r: unknown[], p: boolean) => void }) => {
      // Child fails
      cb.onComplete([{ passed: false, httpStatus: 500 }], false);
      return [{ passed: false, httpStatus: 500 }];
    });
    const passed = makePassedFlag();

    await handleSubWorkflowNode('sub1', node, hCtx, passed, mockRunGraph as never);

    expect(passed.value).toBe(false);
    expect(states['sub1']?.state).toBe('fail');
  });

});
