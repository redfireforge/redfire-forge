/**
 * Coverage for exported test helpers themselves (vitest mocks and factory defaults).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('./scriptSandbox', () => ({
  executeScript: vi.fn(),
}));

import { httpFetch } from '../../../shared/utils/httpClient';
import { executeScript } from './scriptSandbox';
import {
  getMockFetch,
  getMockExecuteScript,
  makeCtx,
  makePassedFlag,
  makeCallbacks,
  makeNode,
  makeEdge,
  makeHandlerContext,
} from './graphRunnerNodeHandlers.test-utils';

describe('graphRunnerNodeHandlers.test-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMockFetch returns the mocked httpFetch', () => {
    expect(getMockFetch()).toBe(vi.mocked(httpFetch));
  });

  it('getMockExecuteScript returns the mocked executeScript', () => {
    expect(getMockExecuteScript()).toBe(vi.mocked(executeScript));
  });

  it('makeCtx creates a VariableContext with optional preset vars', () => {
    const ctx = makeCtx({ a: '1', b: '2' });
    expect(ctx.get('a')).toBe('1');
    expect(ctx.get('b')).toBe('2');
  });

  it('makePassedFlag wraps booleans', () => {
    expect(makePassedFlag(true)).toEqual({ value: true });
    expect(makePassedFlag(false)).toEqual({ value: false });
  });

  it('makeCallbacks aggregates state/log/vars from stubs', async () => {
    const { callbacks, states, logLines } = makeCallbacks();

    callbacks.onNodeStateChange('n1', 'pass');
    expect(states.n1).toBe('pass');

    callbacks.onLog({ prefix: 'x', text: 'y' });
    expect(logLines).toContainEqual({ prefix: 'x', text: 'y' });

    callbacks.onVariablesChange({ foo: 'bar' });
    expect(callbacks.onVariablesChange).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('makeNode and makeEdge build minimal workflow structures', () => {
    const n = makeNode('id1', 'http', { foo: true });
    expect(n.id).toBe('id1');
    expect(n.type).toBe('http');
    expect(n.position).toEqual({ x: 0, y: 0 });
    expect((n.data as Record<string, unknown>).foo).toBe(true);

    expect(makeEdge('e1', 'a', 'b')).toMatchObject({
      id: 'e1', source: 'a', target: 'b',
    });
    expect(makeEdge('e2', 'a', 'b', 'h', 'Lbl')).toMatchObject({
      id: 'e2', sourceHandle: 'h', label: 'Lbl',
    });
  });

  it('makeHandlerContext fills defaults including traceCollector', () => {
    const h = makeHandlerContext();
    expect(h.allPassed).toBe(true);
    expect(h.threadId).toBe('main');
    expect(h.tokenManager).toBeDefined();

    expect(h.traceCollector.onNodeStart).toBeDefined();
    expect(h.traceCollector.reset).toBeDefined();

    h.traceCollector.getEvents();
    expect(h.traceCollector.getEvents).toHaveReturnedWith([]);

    expect(h.nodeLabel('step-one')).toBe('step-one');
    h.log({ prefix: '[x]', text: 'coverage' });
  });

  it('makeHandlerContext honors overrides including traceOptions and captured headers', () => {
    const customTrace = {
      onNodeStart: vi.fn(),
      onNodeComplete: vi.fn(),
      onEdgeTraversed: vi.fn(),
      getEvents: vi.fn(() => []),
      getTraversedEdges: vi.fn(() => []),
      reset: vi.fn(),
    };
    const map = new Map<string, unknown>([['k', {}]]);
    const h = makeHandlerContext({
      initialVariables: { x: 'y' },
      traceOptions: { captureFullTrace: true },
      capturedHttpDetails: map,
      traceCollector: customTrace as never,
      allPassed: false,
      threadId: 't2',
    });
    expect(h.initialVariables.x).toBe('y');
    expect(h.ctx.get('x')).toBe('y');
    expect(h.traceOptions?.captureFullTrace).toBe(true);
    expect(h.capturedHttpDetails).toBe(map);
    expect(h.allPassed).toBe(false);
    expect(h.threadId).toBe('t2');
  });
});
