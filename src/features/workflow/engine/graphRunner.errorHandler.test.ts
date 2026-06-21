import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGraph, type GraphRunCallbacks } from './graphRunner';
import { WorkflowNode, WorkflowEdge, ErrorHandlerNodeData, HttpNodeData } from '../types/workflow';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { httpFetch } from '../../../shared/utils/httpClient';
import { httpNode } from './graphRunnerNodeHandlers.test-utils';

const mockFetch = vi.mocked(httpFetch);

beforeEach(() => {
  mockFetch.mockClear();
});

function makeCallbacks() {
  const states: Array<{ id: string; state: string; error?: string }> = [];
  const vars: Record<string, string>[] = [];
  const callbacks: GraphRunCallbacks = {
    onNodeStateChange: (id, status) => states.push({ id, state: status.state, error: status.error }),
    onVariablesChange: (v) => vars.push({ ...v }),
    onComplete: vi.fn(),
  };
  const statesFor = (id: string) => states.filter(s => s.id === id && s.state !== 'pending').map(s => s.state);
  const lastVars = () => vars.length ? vars[vars.length - 1] : {};
  return { states, vars, callbacks, statesFor, lastVars };
}

const workflowStartNode: WorkflowNode = {
  id: 's1', type: 'start', position: { x: 0, y: 0 },
  data: { label: 'Start' },
};

const workflowEndNode: WorkflowNode = {
  id: 'end1', type: 'end', position: { x: 0, y: 0 },
  data: { label: 'End' },
};

function failHttpNode(id: string, label = 'HTTP'): WorkflowNode {
  const node = httpNode(id, label);
  const scenario = (node.data as HttpNodeData).scenario;
  if (scenario) {
    scenario.url = 'https://example.com/api';
    scenario.validation = {
      mode: 'none',
      assertions: [{ type: 'status', expected: '200' }],
    };
  }
  return node;
}

function errorHandlerNode(id: string, overrides?: Partial<ErrorHandlerNodeData>): WorkflowNode {
  return {
    id,
    type: 'errorHandler',
    position: { x: 0, y: 0 },
    data: {
      label: 'Error Handler',
      errorFilter: 'all',
      retryCount: 0,
      retryDelayMs: 0,
      retryBackoff: 'fixed',
      retryTimeoutMs: 0,
      continueOnError: true,
      ...overrides,
    } as ErrorHandlerNodeData,
  };
}

function okResponse() {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok": true}',
    duration: 10,
  };
}

function failResponse(status = 500) {
  return {
    status,
    statusText: 'Server Error',
    headers: { 'content-type': 'text/plain' },
    body: 'error',
    duration: 10,
  };
}

function networkError() {
  return {
    status: 0,
    statusText: '',
    headers: {},
    body: '',
    duration: 0,
    error: 'Network error: connection refused',
  };
}

// ────────────────────────────────────────────────────
// Error Handler Node Tests
// ────────────────────────────────────────────────────

describe('runGraph - Error Handler Node', () => {

  describe('body success', () => {
    it('skips catch path when body succeeds', async () => {
      mockFetch.mockResolvedValue(okResponse());
      const eh = errorHandlerNode('eh1');
      const bodyHttp = httpNode('body1', 'BodyStep');
      const catchHttp = httpNode('catch1', 'CatchStep');
      const doneHttp = httpNode('done1', 'DoneStep');

      const nodes = [workflowStartNode, eh, bodyHttp, catchHttp, doneHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'catch1', sourceHandle: 'catch' },
        { id: 'e4', source: 'eh1', target: 'done1', sourceHandle: 'done' },
        { id: 'e5', source: 'done1', target: 'end1' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('eh1')).toContain('pass');
      expect(statesFor('body1')).toContain('pass');
      expect(statesFor('catch1')).toContain('skipped');
      expect(statesFor('done1')).toContain('pass');
    });
  });

  describe('body failure', () => {
    it('executes catch path when body fails', async () => {
      mockFetch.mockResolvedValueOnce(failResponse()).mockResolvedValue(okResponse());
      const eh = errorHandlerNode('eh1');
      const bodyHttp = failHttpNode('body1', 'BodyStep');
      const catchHttp = httpNode('catch1', 'CatchStep');
      const doneHttp = httpNode('done1', 'DoneStep');

      const nodes = [workflowStartNode, eh, bodyHttp, catchHttp, doneHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'catch1', sourceHandle: 'catch' },
        { id: 'e4', source: 'eh1', target: 'done1', sourceHandle: 'done' },
        { id: 'e5', source: 'done1', target: 'end1' },
      ];

      const { statesFor, lastVars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('eh1')).toContain('pass'); // continueOnError=true
      expect(statesFor('catch1')).toContain('pass');
      expect(statesFor('done1')).toContain('pass');
      // Error variables should be set
      const v = lastVars();
      expect(v['error.type']).toBe('http-error');
      expect(v['error.statusCode']).toBe('500');
    });

    it('marks handler as fail when continueOnError is false', async () => {
      mockFetch.mockResolvedValueOnce(failResponse()).mockResolvedValue(okResponse());
      const eh = errorHandlerNode('eh1', { continueOnError: false });
      const bodyHttp = failHttpNode('body1', 'HTTP');
      const catchHttp = httpNode('catch1');

      const nodes = [workflowStartNode, eh, bodyHttp, catchHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'catch1', sourceHandle: 'catch' },
        { id: 'e4', source: 'eh1', target: 'end1', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('eh1')).toContain('fail');
    });
  });

  describe('retry', () => {
    it('retries and succeeds on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce(failResponse())  // body attempt 0
        .mockResolvedValueOnce(okResponse());    // body attempt 1 (retry)
      const eh = errorHandlerNode('eh1', { retryCount: 2, retryDelayMs: 0 });
      const bodyHttp = failHttpNode('body1', 'HTTP');
      const catchHttp = httpNode('catch1');

      const nodes = [workflowStartNode, eh, bodyHttp, catchHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'catch1', sourceHandle: 'catch' },
        { id: 'e4', source: 'eh1', target: 'end1', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('eh1')).toContain('pass');
      expect(statesFor('catch1')).toContain('skipped');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('exhausts retries then executes catch', async () => {
      // Body fails on each attempt; catch (the recovery step) succeeds.
      mockFetch
        .mockResolvedValueOnce(failResponse())  // body attempt 0
        .mockResolvedValueOnce(failResponse())  // body attempt 1 (retry)
        .mockResolvedValueOnce(failResponse())  // body attempt 2 (retry)
        .mockResolvedValue(okResponse());        // catch HTTP succeeds
      const eh = errorHandlerNode('eh1', { retryCount: 2, retryDelayMs: 0 });
      const bodyHttp = failHttpNode('body1', 'HTTP');
      const catchHttp = httpNode('catch1');

      const nodes = [workflowStartNode, eh, bodyHttp, catchHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'catch1', sourceHandle: 'catch' },
        { id: 'e4', source: 'eh1', target: 'end1', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      // 1 initial + 2 retries + 1 catch = 4 total
      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(statesFor('catch1')).toContain('pass');
    });
  });

  describe('error filter', () => {
    it('does not retry when error type does not match filter', async () => {
      // Body returns 500 (http-error) but filter is 'network-error', so no retry.
      // Catch (the recovery step) then succeeds.
      mockFetch
        .mockResolvedValueOnce(failResponse())  // body attempt 0 — fails, no retry
        .mockResolvedValue(okResponse());        // catch HTTP succeeds
      const eh = errorHandlerNode('eh1', {
        retryCount: 3,
        retryDelayMs: 0,
        errorFilter: 'network-error',
      });
      const bodyHttp = failHttpNode('body1', 'HTTP');
      const catchHttp = httpNode('catch1');

      const nodes = [workflowStartNode, eh, bodyHttp, catchHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'catch1', sourceHandle: 'catch' },
        { id: 'e4', source: 'eh1', target: 'end1', sourceHandle: 'done' },
      ];

      const { statesFor, lastVars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      // Should only try body once + catch once = 2 calls, not retry because filter doesn't match
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(statesFor('catch1')).toContain('pass');
      expect(lastVars()['error.type']).toBe('http-error');
    });

    it('retries when error type matches filter', async () => {
      mockFetch.mockResolvedValueOnce(failResponse()).mockResolvedValue(okResponse());
      const eh = errorHandlerNode('eh1', {
        retryCount: 1,
        retryDelayMs: 0,
        errorFilter: 'http-error',
      });
      const bodyHttp = failHttpNode('body1', 'HTTP');
      const catchHttp = httpNode('catch1');

      const nodes = [workflowStartNode, eh, bodyHttp, catchHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'catch1', sourceHandle: 'catch' },
        { id: 'e4', source: 'eh1', target: 'end1', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(statesFor('eh1')).toContain('pass');
      expect(statesFor('catch1')).toContain('skipped');
    });
  });

  describe('retry timeout', () => {
    it('stops retrying when timeout exceeded', async () => {
      // Body call is slow + fail (50ms vs 1ms timeout → no retries).
      // Catch (recovery) is fast + succeeds.
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          await new Promise(r => setTimeout(r, 50));
          return failResponse();
        }
        return okResponse(); // catch HTTP and beyond
      });
      const eh = errorHandlerNode('eh1', {
        retryCount: 10,
        retryDelayMs: 0,
        retryTimeoutMs: 1, // very short timeout
      });
      const bodyHttp = failHttpNode('body1', 'HTTP');
      const catchHttp = httpNode('catch1');

      const nodes = [workflowStartNode, eh, bodyHttp, catchHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'catch1', sourceHandle: 'catch' },
        { id: 'e4', source: 'eh1', target: 'end1', sourceHandle: 'done' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      // Should have retried fewer than max due to timeout
      expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(3);
      expect(statesFor('catch1')).toContain('pass');
    });
  });

  describe('network error classification', () => {
    it('classifies status 0 as network-error', async () => {
      mockFetch.mockResolvedValueOnce(networkError()).mockResolvedValue(okResponse());
      const eh = errorHandlerNode('eh1', { retryCount: 0, errorFilter: 'all' });
      const bodyHttp = failHttpNode('body1', 'HTTP');
      const catchHttp = httpNode('catch1');

      const nodes = [workflowStartNode, eh, bodyHttp, catchHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'catch1', sourceHandle: 'catch' },
        { id: 'e4', source: 'eh1', target: 'end1', sourceHandle: 'done' },
      ];

      const { lastVars, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(lastVars()['error.type']).toBe('network-error');
      expect(lastVars()['error.statusCode']).toBe('0');
    });
  });

  describe('done edges always execute', () => {
    it('executes done after body success', async () => {
      mockFetch.mockResolvedValue(okResponse());
      const eh = errorHandlerNode('eh1');
      const bodyHttp = httpNode('body1');
      const doneHttp = httpNode('done1');

      const nodes = [workflowStartNode, eh, bodyHttp, doneHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'done1', sourceHandle: 'done' },
        { id: 'e4', source: 'done1', target: 'end1' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('done1')).toContain('pass');
    });

    it('executes done after body failure + catch', async () => {
      mockFetch.mockResolvedValueOnce(failResponse()).mockResolvedValue(okResponse());
      const eh = errorHandlerNode('eh1');
      const bodyHttp = failHttpNode('body1', 'HTTP');
      const catchHttp = httpNode('catch1');
      const doneHttp = httpNode('done1');

      const nodes = [workflowStartNode, eh, bodyHttp, catchHttp, doneHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'eh1' },
        { id: 'e2', source: 'eh1', target: 'body1', sourceHandle: 'body' },
        { id: 'e3', source: 'eh1', target: 'catch1', sourceHandle: 'catch' },
        { id: 'e4', source: 'eh1', target: 'done1', sourceHandle: 'done' },
        { id: 'e5', source: 'done1', target: 'end1' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(nodes, edges, {}, callbacks, new AbortController().signal, {});

      expect(statesFor('done1')).toContain('pass');
    });
  });

  describe('workflow-level error config', () => {
    it('runs handler node on unhandled failure when mode is run-handler', async () => {
      // First call fails (main flow), second call succeeds (handler)
      mockFetch.mockResolvedValueOnce(failResponse()).mockResolvedValue(okResponse());
      const failHttp = failHttpNode('fail1', 'FailStep');
      const handlerHttp = httpNode('handler1', 'HandlerStep');

      const nodes = [workflowStartNode, failHttp, handlerHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'fail1' },
        { id: 'e2', source: 'fail1', target: 'end1' },
      ];

      const { statesFor, callbacks } = makeCallbacks();
      await runGraph(
        nodes, edges, {}, callbacks, new AbortController().signal, {},
        undefined, undefined, undefined,
        { mode: 'run-handler', handlerEntryNodeId: 'handler1' },
      );

      expect(statesFor('fail1')).toContain('fail');
      expect(statesFor('handler1')).toContain('pass');
    });

    it('logs handler node id when handlerEntryNodeId is missing from workflow', async () => {
      mockFetch.mockResolvedValueOnce(failResponse());
      const failHttp = failHttpNode('fail1', 'FailStep');
      const nodes = [workflowStartNode, failHttp, workflowEndNode];
      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 's1', target: 'fail1' },
        { id: 'e2', source: 'fail1', target: 'end1' },
      ];

      const { callbacks } = makeCallbacks();
      await runGraph(
        nodes, edges, {}, callbacks, new AbortController().signal, {},
        undefined, undefined, undefined,
        { mode: 'run-handler', handlerEntryNodeId: 'missing-handler-node' },
      );

      expect(callbacks.onComplete).toHaveBeenCalled();
    });
  });
});
