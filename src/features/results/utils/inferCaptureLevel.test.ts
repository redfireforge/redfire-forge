import { describe, it, expect } from 'vitest';
import { inferCaptureLevel } from './inferCaptureLevel';
import type { WorkflowExecutionTrace, WorkflowIterationTrace, ExecutionEvent } from '../../../shared/types';

function makeTrace(overrides: Partial<WorkflowExecutionTrace> = {}): WorkflowExecutionTrace {
  return {
    iterations: [],
    traversedEdges: [],
    workflowSnapshot: { nodes: [], edges: [] },
    workflowId: 'w1',
    workflowName: 'Test',
    totalIterations: 1,
    totalDurationMs: 100,
    ...overrides,
  };
}

function makeIteration(events: ExecutionEvent[], overrides: Partial<WorkflowIterationTrace> = {}): WorkflowIterationTrace {
  return {
    index: 0,
    passed: true,
    durationMs: 100,
    events,
    finalVariables: {},
    traversedEdges: [],
    ...overrides,
  };
}

function makeEvent(details?: ExecutionEvent['details']): ExecutionEvent {
  return {
    nodeId: 'n1',
    nodeType: 'http',
    nodeLabel: 'Fetch',
    timestamp: Date.now(),
    state: 'pass',
    durationMs: 50,
    details,
  };
}

describe('inferCaptureLevel', () => {
  it('returns explicit captureLevel when present', () => {
    const trace = makeTrace({ captureLevel: 'full' });
    expect(inferCaptureLevel(trace)).toBe('full');
  });

  it('returns debug when logLines are present', () => {
    const trace = makeTrace({
      iterations: [makeIteration([
        makeEvent({ logLines: [{ prefix: '*', text: 'hello', ts: 1 }] }),
      ])],
    });
    expect(inferCaptureLevel(trace)).toBe('debug');
  });

  it('returns full when request/response bodies are present', () => {
    const trace = makeTrace({
      iterations: [makeIteration([
        makeEvent({
          request: { method: 'GET', url: '/api' },
          response: { statusCode: 200, body: '{}' },
        }),
      ])],
    });
    expect(inferCaptureLevel(trace)).toBe('full');
  });

  it('returns full when fullTraceCaptured flag is set', () => {
    const trace = makeTrace({
      fullTraceCaptured: true,
      iterations: [makeIteration([makeEvent()])],
    });
    expect(inferCaptureLevel(trace)).toBe('full');
  });

  it('returns standard when structured HTTP data is present', () => {
    const trace = makeTrace({
      iterations: [makeIteration([
        makeEvent({ statusCode: 200, method: 'GET', url: '/api' }),
      ])],
    });
    expect(inferCaptureLevel(trace)).toBe('standard');
  });

  it('returns standard when assertions are present', () => {
    const trace = makeTrace({
      iterations: [makeIteration([
        makeEvent({
          assertions: [{ type: 'status', description: 'status == 200', passed: true }],
        }),
      ])],
    });
    expect(inferCaptureLevel(trace)).toBe('standard');
  });

  it('returns standard when extractedVariables are present', () => {
    const trace = makeTrace({
      iterations: [makeIteration([
        makeEvent({ extractedVariables: { token: 'abc' } }),
      ])],
    });
    expect(inferCaptureLevel(trace)).toBe('standard');
  });

  it('returns standard for events with no details', () => {
    const trace = makeTrace({
      iterations: [makeIteration([makeEvent()])],
    });
    expect(inferCaptureLevel(trace)).toBe('standard');
  });

  it('returns minimal for empty iterations', () => {
    const trace = makeTrace({ iterations: [] });
    expect(inferCaptureLevel(trace)).toBe('minimal');
  });

  it('returns minimal when all iterations have empty events', () => {
    const trace = makeTrace({
      iterations: [makeIteration([], { index: 0 })],
    });
    expect(inferCaptureLevel(trace)).toBe('minimal');
  });

  it('skips stripped iterations (sampled: false)', () => {
    const trace = makeTrace({
      iterations: [
        makeIteration([], { index: 0, sampled: false }),
        makeIteration([makeEvent({ statusCode: 200 })], { index: 1 }),
      ],
    });
    expect(inferCaptureLevel(trace)).toBe('standard');
  });

  it('checks highest fidelity first — debug trumps full', () => {
    const trace = makeTrace({
      iterations: [makeIteration([
        makeEvent({
          request: { method: 'GET', url: '/api' },
          logLines: [{ prefix: '*', text: 'log', ts: 1 }],
        }),
      ])],
    });
    expect(inferCaptureLevel(trace)).toBe('debug');
  });
});
