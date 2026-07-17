import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  WorkflowNode,
  WorkflowEdge,
  HttpNodeData,
  LoopNodeData,
  ScriptNodeData,
} from '../types/workflow';
import type { WorkflowIterationTrace, ExecutionTraceOptions } from '../../../shared/types';

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

import { runGraph } from './graphRunner';
import { httpFetch } from '../../../shared/utils/httpClient';
import { executeScript } from './scriptSandbox';
import { httpNode } from './graphRunnerNodeHandlers.test-utils';

const mockFetch = vi.mocked(httpFetch);
const mockExecuteScript = vi.mocked(executeScript);

function makeCallbacks() {
  let capturedTrace: WorkflowIterationTrace | undefined;
  return {
    cbs: {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn((_r: unknown, _p: unknown, _d: unknown, trace?: WorkflowIterationTrace) => {
        capturedTrace = trace;
      }),
    },
    getTrace: () => capturedTrace,
  };
}

describe('runGraph trace gating', () => {
  const nodes: WorkflowNode[] = [httpNode('h1', 'Step 1')];
  const edges: WorkflowEdge[] = [];

  beforeEach(() => {
    mockFetch.mockClear();
    mockExecuteScript.mockReset();
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    });
  });

  const MAX_LOG_LINES_PER_NODE = 200;

  const startNode: WorkflowNode = {
    id: 's1',
    type: 'start',
    position: { x: 0, y: 0 },
    data: { label: 'Start', inputVariables: {} },
  };

  function scriptNode(id: string): WorkflowNode {
    return {
      id,
      type: 'script',
      position: { x: 0, y: 0 },
      data: {
        label: 'Script',
        code: 'return null',
        mode: 'expression',
        inputVariables: [],
        outputVariables: [],
        timeoutMs: 5000,
        captureConsole: true,
      } as ScriptNodeData,
    };
  }

  it('standard level: captures statusCode, method, url but no request/response bodies', async () => {
    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'standard' };

    await runGraph(nodes, edges, {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, opts);

    const trace = getTrace();
    expect(trace).toBeDefined();
    expect(trace!.events.length).toBeGreaterThan(0);

    const httpEvent = trace!.events.find(e => e.details?.statusCode !== undefined);
    expect(httpEvent).toBeDefined();
    expect(httpEvent!.details!.statusCode).toBe(200);
    expect(httpEvent!.details!.method).toBe('GET');
    expect(httpEvent!.details!.url).toContain('example.com');
    expect(httpEvent!.details!.request).toBeUndefined();
    expect(httpEvent!.details!.response).toBeUndefined();
  });

  it('minimal level: captures no details for passing nodes', async () => {
    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'minimal' };

    await runGraph(nodes, edges, {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, opts);

    const trace = getTrace();
    expect(trace).toBeDefined();

    const httpEvent = trace!.events.find(e => e.nodeId === 'h1' && e.state === 'pass');
    expect(httpEvent).toBeDefined();
    expect(httpEvent!.details).toBeUndefined();
  });

  it('minimal level: captures error for failing nodes', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      statusText: 'Server Error',
      headers: {},
      body: 'Internal Server Error',
    });

    const failNode = {
      ...httpNode('h-fail', 'Fail Step'),
      data: {
        ...httpNode('h-fail', 'Fail Step').data,
        scenario: {
          ...(httpNode('h-fail', 'Fail Step').data as HttpNodeData).scenario,
          validation: {
            mode: 'status' as const,
            statusCode: 200,
          },
        },
      },
    } as WorkflowNode;

    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'minimal' };

    await runGraph([failNode], [], {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, opts);

    const trace = getTrace();
    expect(trace).toBeDefined();

    const failEvent = trace!.events.find(e => e.nodeId === 'h-fail' && e.state === 'fail');
    expect(failEvent).toBeDefined();
    expect(failEvent!.details?.error).toBeDefined();
  });

  it('default (no traceOptions): behaves like standard', async () => {
    const { cbs, getTrace } = makeCallbacks();

    await runGraph(nodes, edges, {}, cbs);

    const trace = getTrace();
    expect(trace).toBeDefined();

    const httpEvent = trace!.events.find(e => e.details?.statusCode !== undefined);
    expect(httpEvent).toBeDefined();
    expect(httpEvent!.details!.statusCode).toBe(200);
  });

  it('debug level attaches logLines to event details', async () => {
    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'debug' };

    await runGraph(nodes, edges, {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, opts);

    const trace = getTrace();
    expect(trace).toBeDefined();
    const httpEvent = trace!.events.find(e => e.nodeId === 'h1' && e.state === 'pass');
    expect(httpEvent?.details?.logLines).toBeDefined();
    const lines = httpEvent!.details!.logLines!;
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatchObject({
        prefix: expect.any(String),
        text: expect.any(String),
        ts: expect.any(Number),
      });
    }
  });

  it('standard level does not attach logLines', async () => {
    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'standard' };

    await runGraph(nodes, edges, {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, opts);

    const trace = getTrace();
    const httpEvent = trace!.events.find(e => e.nodeId === 'h1' && e.state === 'pass');
    expect(httpEvent?.details?.logLines).toBeUndefined();
  });

  it('debug level attaches scriptOutput for script nodes', async () => {
    mockExecuteScript.mockReturnValue({
      success: true,
      outputs: {},
      consoleLogs: ['script log a', 'script log b'],
      error: undefined,
    });

    const scId = 'sc1';
    const workflowNodes = [startNode, scriptNode(scId)];
    const workflowEdges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: scId }];
    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'debug' };

    await runGraph(workflowNodes, workflowEdges, {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, opts);

    const trace = getTrace();
    const scriptEvent = trace!.events.find(e => e.nodeId === scId && e.state === 'pass');
    expect(scriptEvent?.details?.scriptOutput).toEqual(['script log a', 'script log b']);
  });

  it('log cap truncates at MAX_LOG_LINES_PER_NODE', async () => {
    const loop: WorkflowNode = {
      id: 'loop1',
      type: 'loop',
      position: { x: 0, y: 0 },
      data: {
        label: 'Loop',
        mode: 'count',
        count: 205,
        maxIterations: 300,
      } as LoopNodeData,
    };
    const bodyHttp = httpNode('body-step', 'Body');
    const doneHttp = httpNode('after-loop', 'After');
    const workflowNodes = [startNode, loop, bodyHttp, doneHttp];
    const workflowEdges: WorkflowEdge[] = [
      { id: 'e1', source: 's1', target: 'loop1' },
      { id: 'e2', source: 'loop1', target: 'body-step', sourceHandle: 'body' },
      { id: 'e3', source: 'loop1', target: 'after-loop', sourceHandle: 'done' },
    ];

    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'debug' };

    await runGraph(workflowNodes, workflowEdges, {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, opts);

    const trace = getTrace();
    const loopEvent = trace!.events.find(e => e.nodeId === 'loop1' && e.state === 'pass');
    const lines = loopEvent?.details?.logLines;
    expect(lines).toBeDefined();
    expect(lines!.length).toBe(MAX_LOG_LINES_PER_NODE + 1);
    const last = lines![lines!.length - 1];
    expect(last.text).toContain(`[... log capped at ${MAX_LOG_LINES_PER_NODE} lines]`);
    expect(last.prefix).toBe('*');
  });

  it('standard level: failed HTTP with alwaysCaptureFailures exposes assertions without bodies', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      statusText: 'Server Error',
      headers: {},
      body: '{"err":true}',
    });

    const failNode = {
      ...httpNode('h-fail', 'Fail Step'),
      data: {
        ...httpNode('h-fail', 'Fail Step').data,
        scenario: {
          ...(httpNode('h-fail', 'Fail Step').data as HttpNodeData).scenario,
          validation: {
            mode: 'status' as const,
            statusCode: 200,
          },
        },
      },
    } as WorkflowNode;

    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = {
      captureFullTrace: false,
      traceLevel: 'standard',
      alwaysCaptureFailures: true,
    };

    await runGraph([failNode], [], {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, opts);

    const trace = getTrace()!;
    const ev = trace.events.find(e => e.nodeId === 'h-fail' && e.state === 'fail');
    expect(ev?.details?.assertions).toBeDefined();
    expect(ev?.details?.request).toBeUndefined();
    expect(ev?.details?.response).toBeUndefined();
  });

  it('debug level: script exception still records buffered log lines on failure', async () => {
    mockExecuteScript.mockImplementation(() => {
      throw new Error('script exploded');
    });

    const scId = 'sc1';
    const workflowNodes = [startNode, scriptNode(scId)];
    const workflowEdges: WorkflowEdge[] = [{ id: 'e1', source: 's1', target: scId }];
    const { cbs, getTrace } = makeCallbacks();
    const opts: ExecutionTraceOptions = { captureFullTrace: false, traceLevel: 'debug' };

    await runGraph(workflowNodes, workflowEdges, {}, cbs,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, opts);

    const trace = getTrace()!;
    const ev = trace.events.find(e => e.nodeId === scId && e.state === 'fail');
    expect(ev?.details?.logLines?.length).toBeGreaterThan(0);
    expect(ev?.details?.error).toBeDefined();
  });
});
