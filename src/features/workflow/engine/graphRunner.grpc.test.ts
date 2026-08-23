/**
 * Phase 6C+6D — gRPC workflow nodes through full runGraph dispatch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowNode, WorkflowEdge } from '../types/workflow';
import type { ExecutionTraceOptions } from '@shared/types';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';
import { runGraph } from './graphRunner';
import { endNode, makeEdge, startNode } from './graphRunnerNodeHandlers.test-utils';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { httpFetch } from '@shared/utils/httpClient';

const mockHttpFetch = vi.mocked(httpFetch);

function grpcUnaryNode(id: string): WorkflowNode {
  return {
    id,
    type: 'grpcUnary',
    position: { x: 0, y: 0 },
    data: {
      label: 'Echo Unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target.address,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      callType: 'unary',
      body: { message: 'dispatch' },
    },
  };
}

function grpcStreamNode(id: string): WorkflowNode {
  return {
    id,
    type: 'grpcServerStream',
    position: { x: 0, y: 0 },
    data: {
      label: 'Echo Stream',
      target: FIXTURE_UNARY_CALL_REQUEST.target.address,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      callType: 'server_streaming',
      body: { message: 'dispatch', repeat_count: 1 },
      collect: { maxMessages: 1 },
    },
  };
}

const defaultCallbacks = () => ({
  onNodeStateChange: vi.fn(),
  onVariablesChange: vi.fn(),
  onComplete: vi.fn(),
});

describe('gRPC workflow nodes — runGraph dispatch', () => {
  beforeEach(() => {
    resetAllMocks();
    mockHttpFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
  });

  it('runs start → grpcUnary → end with injected grpcOperations', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'dispatch' },
      durationMs: 42,
    }));
    const grpcOperations = {
      invokeUnary,
      collectServerStream: vi.fn(),
    };

    const nodes = [startNode('start'), grpcUnaryNode('g1'), endNode('end')];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 'g1'),
      makeEdge('e2', 'g1', 'end'),
    ];

    let capturedTrace: import('../../../shared/types').WorkflowIterationTrace | undefined;
    const cb = {
      ...defaultCallbacks(),
      onComplete: vi.fn((_r, _p, _d, trace) => { capturedTrace = trace; }),
    };
    const traceOpts: ExecutionTraceOptions = { captureFullTrace: true, traceLevel: 'standard' };

    const results = await runGraph(
      nodes,
      edges,
      {},
      cb,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      traceOpts,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    expect(invokeUnary).toHaveBeenCalledTimes(1);
    expect(invokeUnary.mock.calls[0]?.[1]).toBe('workflow:g1');
    expect(results).toHaveLength(1);
    expect(results[0]?.transportType).toBe('grpcUnary');
    expect(results[0]?.passed).toBe(true);

    const passedIds = (cb.onNodeStateChange as ReturnType<typeof vi.fn>).mock.calls
      .filter(([, s]: [string, { state: string }]) => s.state === 'pass')
      .map(([id]: [string]) => id);
    expect(passedIds).toContain('g1');
    expect(passedIds).toContain('end');

    const grpcEvent = capturedTrace?.events.find(e => e.nodeId === 'g1');
    expect(grpcEvent?.durationMs).toBeDefined();
    expect(grpcEvent?.details?.grpcDetails?.callType).toBe('unary');
    expect(grpcEvent?.details?.responseTimeMs).toBe(results[0]?.responseTimeMs);
  });

  it('runs start → grpcServerStream → end with stream collector', async () => {
    const collectServerStream = vi.fn(async () => ({
      messages: [{ n: 1 }],
      durationMs: 18,
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      trailers: {},
      stopReason: 'max_messages' as const,
    }));
    const grpcOperations = {
      invokeUnary: vi.fn(),
      collectServerStream,
    };

    const nodes = [startNode('start'), grpcStreamNode('s1'), endNode('end')];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 's1'),
      makeEdge('e2', 's1', 'end'),
    ];

    const capturedVars: Record<string, string> = {};
    const cb = {
      ...defaultCallbacks(),
      onVariablesChange: vi.fn((vars: Record<string, string>) => {
        Object.assign(capturedVars, vars);
      }),
    };

    const results = await runGraph(
      nodes,
      edges,
      {},
      cb,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    expect(collectServerStream).toHaveBeenCalledWith(
      expect.anything(),
      'workflow:s1',
      expect.objectContaining({ maxMessages: 1 }),
      expect.anything(),
    );
    expect(results[0]?.transportType).toBe('grpcServerStream');
    expect(capturedVars['grpc.stream']).toContain('"n":1');
  });

  it('fails grpcUnary when grpcOperations is omitted', async () => {
    const nodes = [startNode('start'), grpcUnaryNode('g1')];
    const edges: WorkflowEdge[] = [makeEdge('e1', 'start', 'g1')];
    const cb = defaultCallbacks();

    await runGraph(nodes, edges, {}, cb);

    expect(cb.onNodeStateChange).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({
        state: 'fail',
        error: expect.stringContaining('gRPC operations not configured'),
      }),
    );
  });

  it('runs unary then grpcAssert with frozen step store', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'dispatch' },
      durationMs: 5,
    }));
    const grpcOperations = {
      invokeUnary,
      collectServerStream: vi.fn(),
    };

    const nodes = [
      startNode('start'),
      {
        id: 'g1',
        type: 'grpcUnary' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Echo',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'dispatch' },
        },
      },
      {
        id: 'a1',
        type: 'grpcAssert' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Assert',
          source: 'g1',
          assertions: [{ grpcField: '$.message', equals: 'dispatch' }],
        },
      },
      endNode('end'),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 'g1'),
      makeEdge('e2', 'g1', 'a1'),
      makeEdge('e3', 'a1', 'end'),
    ];

    const cb = defaultCallbacks();
    const results = await runGraph(
      nodes,
      edges,
      {},
      cb,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    expect(results).toHaveLength(2);
    expect(results[1]?.transportType).toBe('grpcAssert');
    expect(results[1]?.passed).toBe(true);
  });

  it('asserts upstream by saveAs alias through runGraph', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'alias-hit' },
      durationMs: 5,
    }));
    const grpcOperations = {
      invokeUnary,
      collectServerStream: vi.fn(),
    };

    const nodes = [
      startNode('start'),
      {
        id: 'g1',
        type: 'grpcUnary' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Echo',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'alias-hit' },
          saveAs: 'echoCall',
        },
      },
      {
        id: 'a1',
        type: 'grpcAssert' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Assert alias',
          source: 'echoCall',
          assertions: [{ grpcField: '$.message', equals: 'alias-hit' }],
        },
      },
      endNode('end'),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 'g1'),
      makeEdge('e2', 'g1', 'a1'),
      makeEdge('e3', 'a1', 'end'),
    ];

    const results = await runGraph(
      nodes,
      edges,
      {},
      defaultCallbacks(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    expect(results[1]?.passed).toBe(true);
  });

  it('asserts failed upstream when unary uses onError continue', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 3,
      statusMessage: 'INVALID_ARGUMENT',
      headers: {},
      trailers: {},
      body: { message: 'bad' },
      durationMs: 5,
    }));
    const grpcOperations = {
      invokeUnary,
      collectServerStream: vi.fn(),
    };

    const nodes = [
      startNode('start'),
      {
        id: 'g1',
        type: 'grpcUnary' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Echo fail',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'bad' },
          onError: 'continue',
        },
      },
      {
        id: 'a1',
        type: 'grpcAssert' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Assert failure',
          source: 'g1',
          assertions: [{ grpcStatus: 3 }],
        },
      },
      endNode('end'),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 'g1'),
      makeEdge('e2', 'g1', 'a1'),
      makeEdge('e3', 'a1', 'end'),
    ];

    const results = await runGraph(
      nodes,
      edges,
      {},
      defaultCallbacks(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    expect(results).toHaveLength(2);
    expect(results[0]?.passed).toBe(false);
    expect(results[1]?.transportType).toBe('grpcAssert');
    expect(results[1]?.passed).toBe(true);
  });

  it('records grpcAssert trace as pass when upstream failed with onError continue', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 3,
      statusMessage: 'INVALID_ARGUMENT',
      headers: {},
      trailers: {},
      body: { message: 'bad' },
      durationMs: 5,
    }));
    const grpcOperations = {
      invokeUnary,
      collectServerStream: vi.fn(),
    };

    const nodes = [
      startNode('start'),
      {
        id: 'g1',
        type: 'grpcUnary' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Echo fail',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'bad' },
          onError: 'continue',
        },
      },
      {
        id: 'a1',
        type: 'grpcAssert' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Assert failure',
          source: 'g1',
          assertions: [{ grpcStatus: 3 }],
        },
      },
      endNode('end'),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 'g1'),
      makeEdge('e2', 'g1', 'a1'),
      makeEdge('e3', 'a1', 'end'),
    ];

    let capturedTrace: import('../../../shared/types').WorkflowIterationTrace | undefined;
    const cb = {
      ...defaultCallbacks(),
      onComplete: vi.fn((_r, _p, _d, trace) => { capturedTrace = trace; }),
    };
    const traceOpts: ExecutionTraceOptions = { captureFullTrace: true, traceLevel: 'standard' };

    await runGraph(
      nodes,
      edges,
      {},
      cb,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      traceOpts,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    const assertEvent = capturedTrace?.events.find(e => e.nodeId === 'a1');
    expect(assertEvent?.state).toBe('pass');
    expect(assertEvent?.details?.grpcDetails?.method).toBe('ASSERT');
    expect(assertEvent?.details?.grpcDetails?.callType).toBe('unary');
    const unaryEvent = capturedTrace?.events.find(e => e.nodeId === 'g1');
    expect(unaryEvent?.state).toBe('fail');
  });

  it('isolates steps namespaces and updates last-success grpc.response across two unary nodes', async () => {
    const invokeUnary = vi
      .fn()
      .mockResolvedValueOnce({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'first' },
        durationMs: 5,
      })
      .mockResolvedValueOnce({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'second' },
        durationMs: 7,
      });
    const grpcOperations = {
      invokeUnary,
      collectServerStream: vi.fn(),
    };

    const nodes = [
      startNode('start'),
      {
        id: 'g1',
        type: 'grpcUnary' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'First',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'first' },
        },
      },
      {
        id: 'g2',
        type: 'grpcUnary' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Second',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'second' },
        },
      },
      endNode('end'),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 'g1'),
      makeEdge('e2', 'g1', 'g2'),
      makeEdge('e3', 'g2', 'end'),
    ];

    let finalVars: Record<string, string> = {};
    const cb = {
      ...defaultCallbacks(),
      onVariablesChange: vi.fn((vars: Record<string, string>) => {
        finalVars = { ...vars };
      }),
    };

    await runGraph(
      nodes,
      edges,
      {},
      cb,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    expect(JSON.parse(finalVars['steps.g1.grpc.body']!)).toEqual({ message: 'first' });
    expect(JSON.parse(finalVars['steps.g2.grpc.body']!)).toEqual({ message: 'second' });
    expect(JSON.parse(finalVars['grpc.response.body']!)).toEqual({ message: 'second' });
  });

  it('preserves last-success grpc.response when a later unary call fails', async () => {
    const invokeUnary = vi
      .fn()
      .mockResolvedValueOnce({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'kept' },
        durationMs: 5,
      })
      .mockResolvedValueOnce({
        status: 3,
        statusMessage: 'INVALID_ARGUMENT',
        headers: {},
        trailers: {},
        durationMs: 5,
      });
    const grpcOperations = {
      invokeUnary,
      collectServerStream: vi.fn(),
    };

    const nodes = [
      startNode('start'),
      {
        id: 'g1',
        type: 'grpcUnary' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'OK',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'kept' },
        },
      },
      {
        id: 'g2',
        type: 'grpcUnary' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Fail',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'bad' },
        },
      },
      endNode('end'),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 'g1'),
      makeEdge('e2', 'g1', 'g2'),
      makeEdge('e3', 'g2', 'end'),
    ];

    let finalVars: Record<string, string> = {};
    const cb = {
      ...defaultCallbacks(),
      onVariablesChange: vi.fn((vars: Record<string, string>) => {
        finalVars = { ...vars };
      }),
    };

    const results = await runGraph(
      nodes,
      edges,
      {},
      cb,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    expect(results[0]?.passed).toBe(true);
    expect(results[1]?.passed).toBe(false);
    expect(JSON.parse(finalVars['grpc.response.body']!)).toEqual({ message: 'kept' });
    expect(finalVars['grpc.response.status']).toBe('0');
  });

  it('runs server stream then grpcAssert on frozen messages', async () => {
    const collectServerStream = vi.fn(async () => ({
      messages: [{ n: 1 }, { n: 2 }, { n: 3 }],
      durationMs: 20,
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      trailers: { 'x-trace': 'abc' },
      stopReason: 'max_messages' as const,
    }));
    const grpcOperations = {
      invokeUnary: vi.fn(),
      collectServerStream,
    };

    const nodes = [
      startNode('start'),
      grpcStreamNode('s1'),
      {
        id: 'a1',
        type: 'grpcAssert' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Stream assert',
          source: 's1',
          assertions: [
            { grpcStreamLength: { equals: 3 } },
            { grpcField: 'messages[0].n', equals: 1 },
            { grpcTrailer: 'x-trace', equals: 'abc' },
          ],
        },
      },
      endNode('end'),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 's1'),
      makeEdge('e2', 's1', 'a1'),
      makeEdge('e3', 'a1', 'end'),
    ];

    const results = await runGraph(
      nodes,
      edges,
      {},
      defaultCallbacks(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    expect(results).toHaveLength(2);
    expect(results[1]?.transportType).toBe('grpcAssert');
    expect(results[1]?.passed).toBe(true);
  });

  it('traverses past failed grpcAssert when onError is continue', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'ok' },
      durationMs: 5,
    }));
    const grpcOperations = {
      invokeUnary,
      collectServerStream: vi.fn(),
    };

    const nodes = [
      startNode('start'),
      {
        id: 'g1',
        type: 'grpcUnary' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Echo',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'ok' },
        },
      },
      {
        id: 'a1',
        type: 'grpcAssert' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Bad assert',
          source: 'g1',
          onError: 'continue',
          assertions: [{ grpcField: '$.message', equals: 'wrong' }],
        },
      },
      endNode('end'),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 'g1'),
      makeEdge('e2', 'g1', 'a1'),
      makeEdge('e3', 'a1', 'end'),
    ];

    const cb = defaultCallbacks();
    const results = await runGraph(
      nodes,
      edges,
      {},
      cb,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    expect(results[1]?.passed).toBe(false);
    expect(results[1]?.grpcResultMeta?.assertionFailures?.length).toBeGreaterThan(0);
    const passedIds = (cb.onNodeStateChange as ReturnType<typeof vi.fn>).mock.calls
      .filter(([, s]: [string, { state: string }]) => s.state === 'pass')
      .map(([id]: [string]) => id);
    expect(passedIds).toContain('end');
  });

  it('Phase 6H: failed grpcAssert with onError continue does not block downstream HTTP', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { token: 'grpc-token-xyz' },
      durationMs: 5,
    }));
    const grpcOperations = {
      invokeUnary,
      collectServerStream: vi.fn(),
    };

    const nodes = [
      startNode('start'),
      {
        id: 'g1',
        type: 'grpcUnary' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Get token',
          target: FIXTURE_UNARY_CALL_REQUEST.target.address,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          callType: 'unary',
          body: { message: 'token' },
        },
      },
      {
        id: 'a1',
        type: 'grpcAssert' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Bad assert',
          source: 'g1',
          onError: 'continue',
          assertions: [{ grpcField: '$.token', equals: 'wrong' }],
        },
      },
      {
        id: 'h1',
        type: 'http' as const,
        position: { x: 0, y: 0 },
        data: {
          label: 'Use gRPC body',
          scenario: {
            id: 'h1',
            name: 'Use gRPC body',
            url: 'https://example.com/api',
            method: 'POST',
            headers: [],
            body: '{{steps.g1.grpc.body}}',
            auth: { type: 'none' as const },
            validation: { mode: 'none' as const },
          },
        },
      },
      endNode('end'),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('e1', 'start', 'g1'),
      makeEdge('e2', 'g1', 'a1'),
      makeEdge('e3', 'a1', 'h1'),
      makeEdge('e4', 'h1', 'end'),
    ];

    const cb = defaultCallbacks();
    const results = await runGraph(
      nodes,
      edges,
      {},
      cb,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperations,
    );

    expect(results[1]?.transportType).toBe('grpcAssert');
    expect(results[1]?.passed).toBe(false);
    expect(mockHttpFetch).toHaveBeenCalled();
    const passedIds = (cb.onNodeStateChange as ReturnType<typeof vi.fn>).mock.calls
      .filter(([, s]: [string, { state: string }]) => s.state === 'pass')
      .map(([id]: [string]) => id);
    expect(passedIds).toContain('h1');
    expect(passedIds).toContain('end');
  });
});
