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

import type { RequestResult } from '../../../shared/types';
import { handleErrorHandlerNode, handleLogDebugNode } from './graphRunnerNodeHandlers';
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

describe('handleErrorHandlerNode', () => {
  it('warns about multiple unresolved variables', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('ld1', 'logDebug', {
      message: '{{var1}} and {{var2}} missing',
      logLevel: 'info',
    });

    await handleLogDebugNode('ld1', node, hCtx);

    const warnLog = logLines.find(l => l.text.includes('Unresolved variables'));
    expect(warnLog).toBeDefined();
  });

  it('truncates long variable values in snapshot', async () => {
    const ctx = makeCtx({ longVal: 'x'.repeat(100) });
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('ld1', 'logDebug', {
      message: 'snapshot',
      logLevel: 'info',
      snapshotVariables: true,
    });

    await handleLogDebugNode('ld1', node, hCtx);

    const truncatedLog = logLines.find(l => l.text.includes('…'));
    expect(truncatedLog).toBeDefined();
  });

  it('skips snapshot when no non-internal variables exist', async () => {
    const ctx = makeCtx();
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      ctx, callbacks,
      log: (line) => logLines.push(line),
    });
    const node = makeNode('ld1', 'logDebug', {
      message: 'snapshot',
      logLevel: 'info',
      snapshotVariables: true,
    });

    await handleLogDebugNode('ld1', node, hCtx);

    const snapshotLog = logLines.find(l => l.text.includes('Variable snapshot'));
    expect(snapshotLog).toBeUndefined();
  });

  it('passes when body succeeds without retry', async () => {
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
      makeEdge('e3', 'eh1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, visit, outgoing, nodeMap, results: [] });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 0,
      errorFilter: 'all',
      retryDelayMs: 0,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);

    expect(states['eh1']?.state).toBe('pass');
    expect(passed.value).toBe(true);
    // Done edges should be visited
    expect(visit).toHaveBeenCalledWith('done1', 'main');
  });

  it('executes catch path when body fails', async () => {
    const visit = vi.fn();
    const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
    // Simulate body failure: add a failed result when body is visited
    visit.mockImplementation(async (nodeId: string) => {
      if (nodeId === 'body1') {
        results.push({
          passed: false,
          httpStatus: 500,
          errorMessage: 'Server Error',
          scenarioId: 'body1',
          scenarioName: 'BodyStep',
        });
      }
    });

    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
      makeEdge('e3', 'eh1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));

    const ctx = makeCtx();
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks, visit, outgoing, nodeMap, ctx,
      results: results as unknown as RequestResult[],
    });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 0,
      errorFilter: 'all',
      retryDelayMs: 0,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);

    expect(states['eh1']?.state).toBe('fail');
    expect(passed.value).toBe(false);
    // Catch path should be visited
    expect(visit).toHaveBeenCalledWith('catch1', 'main-catch');
    // Error variables should be set
    expect(ctx.resolve('{{error.message}}')).toBe('Server Error');
  });

  it('continues on error when continueOnError is true', async () => {
    const visit = vi.fn();
    const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string }> = [];
    visit.mockImplementation(async (nodeId: string) => {
      if (nodeId === 'body1') {
        results.push({ passed: false, httpStatus: 500, errorMessage: 'fail' });
      }
    });

    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));

    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks, visit, outgoing, nodeMap,
      results: results as unknown as RequestResult[],
    });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 0,
      errorFilter: 'all',
      retryDelayMs: 0,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: true,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);

    expect(states['eh1']?.state).toBe('pass');
    expect(passed.value).toBe(true); // continueOnError keeps passed true
  });

  it('retries body on failure with exponential backoff', async () => {
    let callCount = 0;
    const visit = vi.fn();
    const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
    visit.mockImplementation(async (nodeId: string) => {
      if (nodeId === 'body1') {
        callCount++;
        if (callCount <= 2) {
          results.push({ passed: false, httpStatus: 500, errorMessage: 'Server Error', scenarioId: 'body1', scenarioName: 'Body' });
        }
        // Third call succeeds (no failed result pushed)
      }
    });

    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
      makeEdge('e3', 'eh1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));

    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks, visit, outgoing, nodeMap,
      results: results as unknown as RequestResult[],
    });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 3,
      errorFilter: 'all',
      retryDelayMs: 1,
      retryBackoff: 'exponential',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);

    expect(states['eh1']?.state).toBe('pass');
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it('does not retry when error filter does not match', async () => {
    const visit = vi.fn();
    const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
    visit.mockImplementation(async (nodeId: string) => {
      if (nodeId === 'body1') {
        results.push({ passed: false, httpStatus: 500, errorMessage: 'Server Error', scenarioId: 'body1', scenarioName: 'Body' });
      }
    });

    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));

    const { callbacks, states } = makeCallbacks();
    const ctx = makeCtx();
    const hCtx = makeHandlerContext({
      callbacks, visit, outgoing, nodeMap, ctx,
      results: results as unknown as RequestResult[],
    });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 3,
      errorFilter: 'network-error',
      retryDelayMs: 0,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);

    // Should not retry — body called only once
    expect(visit).toHaveBeenCalledTimes(2); // body + catch
    expect(states['eh1']?.state).toBe('fail');
  });

  it('stops retrying when retry timeout is exceeded', async () => {
    const visit = vi.fn();
    const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
    visit.mockImplementation(async (nodeId: string) => {
      if (nodeId === 'body1') {
        // Always fail + add a small delay to exceed timeout
        await new Promise(r => setTimeout(r, 5));
        results.push({ passed: false, httpStatus: 500, errorMessage: 'Server Error', scenarioId: 'body1', scenarioName: 'Body' });
      }
    });

    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks, visit, outgoing, nodeMap,
      results: results as unknown as RequestResult[],
      log: (line) => logLines.push(line),
    });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 100,
      errorFilter: 'all',
      retryDelayMs: 1,
      retryBackoff: 'fixed',
      retryTimeoutMs: 1, // very short timeout
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);

    const timeoutLog = logLines.find(l => l.text.includes('Retry timeout'));
    expect(timeoutLog).toBeDefined();
  });

  it('uses default retryCount when not specified', async () => {
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, visit, outgoing, nodeMap, results: [] });
    // No retryCount specified — uses ?? 0 fallback
    const node = makeNode('eh1', 'errorHandler', {
      errorFilter: 'all',
      retryDelayMs: 1,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);
    expect(states['eh1']?.state).toBe('pass');
  });

  it('uses default retryDelayMs when not specified', async () => {
    const visit = vi.fn();
    const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
    let callCount = 0;
    visit.mockImplementation(async (nodeId: string) => {
      if (nodeId === 'body1') {
        callCount++;
        if (callCount <= 1) {
          results.push({ passed: false, httpStatus: 500, errorMessage: 'Error', scenarioId: 'body1', scenarioName: 'Body' });
        }
      }
    });
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks, visit, outgoing, nodeMap,
      results: results as unknown as RequestResult[],
    });
    // No retryDelayMs — uses ?? 1000 fallback, but retryCount=1 so it retries once
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 1,
      errorFilter: 'all',
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);
    expect(states['eh1']?.state).toBe('pass');
    expect(callCount).toBe(2);
  }, 10000);

  it('handles no outgoing edges (uses ?? [] fallback)', async () => {
    const { callbacks, states } = makeCallbacks();
    // No outgoing edges for eh1
    const hCtx = makeHandlerContext({ callbacks, results: [] });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 0,
      errorFilter: 'all',
      retryDelayMs: 0,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);
    expect(states['eh1']?.state).toBe('pass');
  });

  it('uses summarizeRequestFailure when errorMessage is empty', async () => {
    const visit = vi.fn();
    const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
    visit.mockImplementation(async (nodeId: string) => {
      if (nodeId === 'body1') {
        // Push with empty errorMessage so || fallback triggers
        results.push({ passed: false, httpStatus: 500, errorMessage: '', scenarioId: 'body1', scenarioName: 'Body' });
      }
    });
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks, visit, outgoing, nodeMap,
      results: results as unknown as RequestResult[],
    });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 0,
      errorFilter: 'all',
      retryDelayMs: 0,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);
    // Should still complete — the error message comes from summarizeRequestFailure
    expect(passed.value).toBe(false);
  });

  it('aborts retry delay when abort signal fires', async () => {
    const abortController = new AbortController();
    const visit = vi.fn();
    const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
    visit.mockImplementation(async (nodeId: string) => {
      if (nodeId === 'body1') {
        results.push({ passed: false, httpStatus: 500, errorMessage: 'Error', scenarioId: 'body1', scenarioName: 'Body' });
        // Schedule abort shortly after — so it fires while the retry delay Promise is waiting
        setTimeout(() => abortController.abort(), 5);
      }
    });

    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({
      callbacks, visit, outgoing, nodeMap,
      results: results as unknown as RequestResult[],
      abortSignal: abortController.signal,
    });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 5,
      errorFilter: 'all',
      retryDelayMs: 60000, // very long delay — abort must interrupt this
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);

    // Should complete without hanging — abort interrupted the delay
    expect(passed.value).toBe(false);
  }, 10000);

  it('stops when abortSignal is already aborted', async () => {
    const abortController = new AbortController();
    abortController.abort(); // pre-aborted
    const { callbacks, states } = makeCallbacks();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    const hCtx = makeHandlerContext({
      callbacks, outgoing, nodeMap,
      abortSignal: abortController.signal,
    });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 5,
      errorFilter: 'all',
      retryDelayMs: 1,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);
    // Should break immediately without visiting body
    expect(states['eh1']?.state).toBe('fail');
  });

  it('uses exponential backoff delay (line 87)', async () => {
    vi.useFakeTimers();
    const visit = vi.fn();
    const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
    visit.mockImplementation(async (nodeId: string) => {
      if (nodeId === 'body1') {
        results.push({ passed: false, httpStatus: 500, errorMessage: 'fail' });
      }
    });
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
      makeEdge('e3', 'eh1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ callbacks, visit, outgoing, nodeMap, results, log: (line) => logLines.push(line) });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 1,
      errorFilter: 'all',
      retryDelayMs: undefined as unknown as number,
      retryBackoff: 'exponential',
      retryTimeoutMs: 0,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    const promise = handleErrorHandlerNode('eh1', node, hCtx, passed);
    // Advance timers to resolve retry delay (1000ms default * 2^0 = 1000ms)
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    vi.useRealTimers();
    expect(states['eh1']?.state).toBe('fail');
    const retryLogs = logLines.filter(l => l.text.includes('Retry'));
    expect(retryLogs.length).toBeGreaterThanOrEqual(1);
  });

  it('breaks on retry timeout exceeded (line 46)', async () => {
    const visit = vi.fn();
    const results: Array<{ passed: boolean; httpStatus: number; errorMessage?: string; scenarioId?: string; scenarioName?: string }> = [];
    visit.mockImplementation(async (nodeId: string) => {
      if (nodeId === 'body1') {
        results.push({ passed: false, httpStatus: 500, errorMessage: 'fail' });
      }
    });
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('eh1', [
      makeEdge('e1', 'eh1', 'body1', 'body'),
      makeEdge('e2', 'eh1', 'catch1', 'catch'),
      makeEdge('e3', 'eh1', 'done1', 'done'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('body1', makeNode('body1', 'http'));
    nodeMap.set('catch1', makeNode('catch1', 'http'));
    nodeMap.set('done1', makeNode('done1', 'http'));
    const logLines: Array<{ prefix: string; text: string }> = [];
    const { callbacks, states } = makeCallbacks();
    // Mock performance.now: first call returns 0 (retryStart), subsequent return large value
    let perfCallCount = 0;
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => {
      perfCallCount++;
      return perfCallCount <= 1 ? 0 : 99999;
    });
    const hCtx = makeHandlerContext({ callbacks, visit, outgoing, nodeMap, results, log: (line) => logLines.push(line) });
    const node = makeNode('eh1', 'errorHandler', {
      retryCount: 10,
      errorFilter: 'all',
      retryDelayMs: 1,
      retryBackoff: 'fixed',
      retryTimeoutMs: 100,
      continueOnError: false,
    });
    const passed = makePassedFlag();

    await handleErrorHandlerNode('eh1', node, hCtx, passed);

    perfSpy.mockRestore();
    const timeoutLogs = logLines.filter(l => l.text.includes('Retry timeout'));
    expect(timeoutLogs.length).toBeGreaterThanOrEqual(1);
    expect(states['eh1']?.state).toBe('fail');
  });
});
