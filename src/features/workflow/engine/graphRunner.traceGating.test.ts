import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowNode, WorkflowEdge, HttpNodeData } from '../types/workflow';
import type { WorkflowIterationTrace, ExecutionTraceOptions } from '../../../shared/types';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { runGraph } from './graphRunner';
import { httpFetch } from '../../../shared/utils/httpClient';

const mockFetch = vi.mocked(httpFetch);

function httpNode(id: string, label: string): WorkflowNode {
  return {
    id,
    type: 'http',
    position: { x: 0, y: 0 },
    data: {
      label,
      scenario: {
        id,
        name: label,
        url: `https://example.com/${id}`,
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
    } as HttpNodeData,
  };
}

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
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    });
  });

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
});
