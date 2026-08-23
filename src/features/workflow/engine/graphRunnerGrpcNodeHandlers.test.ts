import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';
import {
  handleGrpcAssertNode,
  handleGrpcServerStreamNode,
  handleGrpcUnaryNode,
} from './graphRunnerGrpcNodeHandlers';
import { GrpcWorkflowStepResultStore } from '../utils/grpcWorkflowStepResultStore';
import { GrpcWorkflowOutputRegistry } from '../utils/grpcWorkflowOutputRegistry';
import {
  makeHandlerContext,
  makeNode,
  makePassedFlag,
} from './graphRunnerNodeHandlers.test-utils';

function grpcUnaryNode(id: string, overrides: Record<string, unknown> = {}) {
  return makeNode(id, 'grpcUnary', {
    label: 'Echo Unary',
    target: FIXTURE_UNARY_CALL_REQUEST.target.address,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    callType: 'unary',
    body: { message: 'hello' },
    ...overrides,
  });
}

function grpcStreamNode(id: string, overrides: Record<string, unknown> = {}) {
  return makeNode(id, 'grpcServerStream', {
    label: 'Echo Stream',
    target: FIXTURE_UNARY_CALL_REQUEST.target.address,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: 'ServerStream',
    callType: 'server_streaming',
    body: { message: 'hello', repeat_count: 2 },
    collect: { maxMessages: 2 },
    ...overrides,
  });
}

describe('handleGrpcUnaryNode', () => {
  it('executes unary call and traverses outgoing edges on success', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(async () => ({
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'hello' },
          durationMs: 8,
        })),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode('u1', grpcUnaryNode('u1'), hCtx, passed);
    expect(passed.value).toBe(true);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('u1', 'main');
    expect(hCtx.results).toHaveLength(1);
    expect(hCtx.results[0]?.transportType).toBe('grpcUnary');
    expect(hCtx.ctx.get('grpc.response.status')).toBe('0');
  });

  it('logs request metadata, body, gRPC status, and response on unary success', async () => {
    const passed = makePassedFlag();
    const lines: Array<{ prefix: string; text: string }> = [];
    const hCtx = makeHandlerContext({
      log: (line) => lines.push(line),
      grpcOperations: {
        invokeUnary: vi.fn(async () => ({
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'hello' },
          durationMs: 8,
        })),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode(
      'u-log',
      grpcUnaryNode('u-log', {
        saveAs: 'echoReply',
        metadata: { 'x-demo-run-id': 'workflow-demo' },
        auth: { type: 'bearer', bearerToken: 'demo-workflow-token' },
      }),
      hCtx,
      passed,
    );
    const text = lines.map((l) => l.text).join('\n');
    expect(text).toContain('x-demo-run-id: workflow-demo');
    expect(text).toContain('authorization:');
    expect(text).not.toContain('demo-workflow-token');
    expect(text).toContain('Request:');
    expect(text).toContain('gRPC 0 OK');
    expect(text).toContain('Response:');
    expect(text).toContain('saveAs=echoReply');
  });

  it('Phase 6G: unary success sets grpcMeta on onNodeStateChange', async () => {
    const passed = makePassedFlag();
    const states: Record<string, import('../types/workflow/model-core').NodeRunStatus> = {};
    const hCtx = makeHandlerContext({
      callbacks: {
        onNodeStateChange: vi.fn((id, s) => { states[id] = s; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      },
      grpcOperations: {
        invokeUnary: vi.fn(async () => ({
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'hello' },
          durationMs: 8,
        })),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode('u1', grpcUnaryNode('u1'), hCtx, passed);
    expect(states['u1']?.grpcMeta?.callType).toBe('unary');
    expect(states['u1']?.grpcMeta?.grpcStatus).toBe(0);
    expect(states['u1']?.responseTimeMs).toBeDefined();
    expect(states['u1']?.responseDetail).toContain('UNARY');
  });

  it('honors onError continue after transport failure', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(async () => ({
          status: 3,
          statusMessage: 'INVALID_ARGUMENT',
          headers: {},
          trailers: {},
          durationMs: 5,
        })),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode(
      'u2',
      grpcUnaryNode('u2', { onError: 'continue' }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('u2', 'main');
  });

  it('commits step result when invokeUnary throws so downstream assert can resolve source', async () => {
    const passed = makePassedFlag();
    const store = new GrpcWorkflowStepResultStore();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: store,
      grpcOperations: {
        invokeUnary: vi.fn(async () => {
          throw new Error('network down');
        }),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode(
      'u-throw',
      grpcUnaryNode('u-throw', { onError: 'continue' }),
      hCtx,
      passed,
    );

    expect(store.resolveSource('u-throw')?.status).toBe('failed');
    expect(store.resolveSource('u-throw')?.errorDetail).toBe('network down');
  });

  it('passes workflow tab id to invokeUnary', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'hello' },
      durationMs: 8,
    }));
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary,
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode('u-tab', grpcUnaryNode('u-tab'), hCtx, passed);
    expect(invokeUnary).toHaveBeenCalledWith(expect.anything(), 'workflow:u-tab');
  });

  it('does not traverse on snapshot build failure even when onError is continue', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode(
      'u-snap',
      grpcUnaryNode('u-snap', {
        onError: 'continue',
        body: { message: '{{missingVar}}' },
      }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('does not traverse on AbortError even when onError is continue', async () => {
    const passed = makePassedFlag();
    const controller = new AbortController();
    controller.abort();
    const hCtx = makeHandlerContext({
      abortSignal: controller.signal,
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode(
      'u-abort',
      grpcUnaryNode('u-abort', { onError: 'continue' }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('fails when grpcOperations is missing', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext();
    await handleGrpcUnaryNode('u3', grpcUnaryNode('u3'), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('does not traverse outgoing edges when onError is fail', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(async () => ({
          status: 3,
          statusMessage: 'INVALID_ARGUMENT',
          headers: {},
          trailers: {},
          durationMs: 5,
        })),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode('u4', grpcUnaryNode('u4', { onError: 'fail' }), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });
});

describe('handleGrpcServerStreamNode', () => {
  it('collects bounded messages and publishes stream output', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => ({
          messages: [{ n: 1 }, { n: 2 }],
          durationMs: 20,
          grpcStatus: 0,
          grpcStatusMessage: 'OK',
          trailers: {},
          stopReason: 'max_messages' as const,
        })),
      },
    });

    await handleGrpcServerStreamNode('s1', grpcStreamNode('s1'), hCtx, passed);
    expect(passed.value).toBe(true);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('s1', 'main');
    expect(hCtx.ctx.get('grpc.stream')).toContain('"n":2');
  });

  it('Phase 6G: server stream success sets grpcMeta with messageCount and stopReason', async () => {
    const passed = makePassedFlag();
    const states: Record<string, import('../types/workflow/model-core').NodeRunStatus> = {};
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => ({
          messages: [{ n: 1 }, { n: 2 }],
          durationMs: 20,
          grpcStatus: 0,
          grpcStatusMessage: 'OK',
          trailers: {},
          stopReason: 'max_messages' as const,
        })),
      },
      callbacks: {
        onNodeStateChange: vi.fn((id, s) => { states[id] = s; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      },
    });

    await handleGrpcServerStreamNode('s1', grpcStreamNode('s1'), hCtx, passed);
    expect(passed.value).toBe(true);
    const meta = states['s1']?.grpcMeta;
    expect(meta).toBeDefined();
    expect(meta?.callType).toBe('server_streaming');
    expect(meta?.messageCount).toBe(2);
    expect(meta?.streamStopReason).toBe('max_messages');
    expect(meta?.grpcStatus).toBe(0);
    expect(states['s1']?.responseTimeMs).toBeDefined();
  });

  it('honors onError continue after stream collection failure', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => ({
          messages: [],
          durationMs: 10,
          grpcStatus: 13,
          grpcStatusMessage: 'Internal',
          trailers: {},
          stopReason: 'stream_error' as const,
          errorDetail: 'boom',
        })),
      },
    });

    await handleGrpcServerStreamNode(
      's2',
      grpcStreamNode('s2', { onError: 'continue' }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('s2', 'main');
  });

  it('commits step result when collectServerStream throws', async () => {
    const passed = makePassedFlag();
    const store = new GrpcWorkflowStepResultStore();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: store,
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => {
          throw new Error('SSE lost');
        }),
      },
    });

    await handleGrpcServerStreamNode(
      's-throw',
      grpcStreamNode('s-throw', { onError: 'continue' }),
      hCtx,
      passed,
    );

    expect(store.resolveSource('s-throw')?.status).toBe('failed');
    expect(store.resolveSource('s-throw')?.errorDetail).toBe('SSE lost');
  });

  it('fails stream_end with non-zero grpc status', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => ({
          messages: [{ n: 1 }],
          durationMs: 10,
          grpcStatus: 3,
          grpcStatusMessage: 'INVALID_ARGUMENT',
          trailers: {},
          stopReason: 'stream_end' as const,
        })),
      },
    });

    await handleGrpcServerStreamNode('s3', grpcStreamNode('s3'), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('passes interpolated collect config from snapshot to collector', async () => {
    const collectServerStream = vi.fn(async () => ({
      messages: [{ flag: true }],
      durationMs: 5,
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      trailers: {},
      stopReason: 'until_expression' as const,
    }));
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      initialVariables: { flag: 'true' },
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream,
      },
    });

    await handleGrpcServerStreamNode(
      's4',
      grpcStreamNode('s4', {
        collect: { untilExpression: '$.flag == {{flag}}' },
      }),
      hCtx,
      passed,
    );

    expect(collectServerStream).toHaveBeenCalledWith(
      expect.anything(),
      'workflow:s4',
      expect.objectContaining({ untilExpression: '$.flag == true' }),
      expect.anything(),
    );
  });
});

function grpcAssertNode(id: string, overrides: Record<string, unknown> = {}) {
  return makeNode(id, 'grpcAssert', {
    label: 'Assert gRPC',
    source: 'grpc-1',
    assertions: [{ grpcStatus: 0 }],
    ...overrides,
  });
}

function seedUnaryResult(store: GrpcWorkflowStepResultStore, nodeId = 'grpc-1', body = { message: 'hello' }) {
  store.commit(nodeId, undefined, {
    nodeId,
    callType: 'unary',
    status: 'success',
    grpcStatus: 0,
    grpcStatusMessage: 'OK',
    body,
    durationMs: 10,
  });
}

describe('handleGrpcAssertNode', () => {
  it('passes assertions against frozen upstream result and traverses outgoing edges', async () => {
    const store = new GrpcWorkflowStepResultStore();
    seedUnaryResult(store);
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: store,
      grpcOutputRegistry: new GrpcWorkflowOutputRegistry(),
    });

    await handleGrpcAssertNode('a1', grpcAssertNode('a1'), hCtx, passed);
    expect(passed.value).toBe(true);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('a1', 'main');
    expect(hCtx.results[0]?.transportType).toBe('grpcAssert');
  });

  it('Phase 6G: assert pass sets grpcMeta with assertionFailures=[] for UI pass indicator', async () => {
    const store = new GrpcWorkflowStepResultStore();
    seedUnaryResult(store);
    const passed = makePassedFlag();
    const states: Record<string, import('../types/workflow/model-core').NodeRunStatus> = {};
    const hCtx = makeHandlerContext({
      grpcStepResultStore: store,
      grpcOutputRegistry: new GrpcWorkflowOutputRegistry(),
      callbacks: {
        onNodeStateChange: vi.fn((id, s) => { states[id] = s; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      },
    });

    await handleGrpcAssertNode('a1', grpcAssertNode('a1'), hCtx, passed);
    expect(passed.value).toBe(true);
    const meta = states['a1']?.grpcMeta;
    expect(meta).toBeDefined();
    expect(meta?.callType).toBe('assert');
    // assertionFailures: [] signals "all passed" (not undefined = "not yet evaluated")
    expect(meta?.assertionFailures).toEqual([]);
  });

  it('Phase 6G: assert pass captures grpcDetails for trace event', async () => {
    const store = new GrpcWorkflowStepResultStore();
    seedUnaryResult(store);
    const passed = makePassedFlag();
    const capturedGrpcDetails = new Map<string, import('../../../shared/types').CapturedGrpcNodeDetails>();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: store,
      grpcOutputRegistry: new GrpcWorkflowOutputRegistry(),
      capturedGrpcDetails,
    });

    await handleGrpcAssertNode('a1', grpcAssertNode('a1'), hCtx, passed);
    expect(passed.value).toBe(true);
    // capturedGrpcDetails must be populated so graphRunner can build the trace event
    const captured = capturedGrpcDetails.get('a1');
    expect(captured).toBeDefined();
    expect(captured?.method).toBe('ASSERT');
    expect(captured?.callType).toBe('unary'); // mirrors upstream callType
  });

  it('fails without traversing when onError is fail (default)', async () => {
    const store = new GrpcWorkflowStepResultStore();
    seedUnaryResult(store);
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: store,
      grpcOutputRegistry: new GrpcWorkflowOutputRegistry(),
    });

    await handleGrpcAssertNode(
      'a2',
      grpcAssertNode('a2', { assertions: [{ grpcStatus: 3 }] }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
    expect(hCtx.results[0]?.grpcResultMeta?.assertionFailures).toEqual([
      'assertions[0]: grpcStatus expected 3, got 0',
    ]);
    expect(hCtx.results[0]?.failureDetails).toHaveLength(1);
  });

  it('Phase 6G: assert fail sets grpcMeta.assertionFailures for Output tab', async () => {
    const store = new GrpcWorkflowStepResultStore();
    seedUnaryResult(store);
    const passed = makePassedFlag();
    const states: Record<string, import('../types/workflow/model-core').NodeRunStatus> = {};
    const capturedGrpcDetails = new Map<string, import('../../../shared/types').CapturedGrpcNodeDetails>();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: store,
      grpcOutputRegistry: new GrpcWorkflowOutputRegistry(),
      capturedGrpcDetails,
      callbacks: {
        onNodeStateChange: vi.fn((id, s) => { states[id] = s; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      },
    });

    await handleGrpcAssertNode(
      'a2',
      grpcAssertNode('a2', { assertions: [{ grpcStatus: 3 }] }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(states['a2']?.grpcMeta?.assertionFailures).toEqual([
      'assertions[0]: grpcStatus expected 3, got 0',
    ]);
    expect(states['a2']?.state).toBe('fail');
    expect(capturedGrpcDetails.get('a2')?.method).toBe('ASSERT');
  });

  it('honors onError continue when configured', async () => {
    const store = new GrpcWorkflowStepResultStore();
    seedUnaryResult(store);
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: store,
      grpcOutputRegistry: new GrpcWorkflowOutputRegistry(),
    });

    await handleGrpcAssertNode(
      'a3',
      grpcAssertNode('a3', { onError: 'continue', assertions: [{ grpcStatus: 3 }] }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('a3', 'main');
  });

  it('never invokes grpcOperations (assert is not transport-retryable)', async () => {
    const store = new GrpcWorkflowStepResultStore();
    seedUnaryResult(store);
    const invokeUnary = vi.fn();
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: store,
      grpcOperations: { invokeUnary, collectServerStream: vi.fn() },
    });

    await handleGrpcAssertNode('a4', grpcAssertNode('a4'), hCtx, passed);
    expect(invokeUnary).not.toHaveBeenCalled();
  });

  it('pushes RequestResult when source is empty and honors onError continue', async () => {
    const passed = makePassedFlag();
    const states: Record<string, import('../types/workflow/model-core').NodeRunStatus> = {};
    const capturedGrpcDetails = new Map<string, import('../../../shared/types').CapturedGrpcNodeDetails>();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: new GrpcWorkflowStepResultStore(),
      capturedGrpcDetails,
      callbacks: {
        onNodeStateChange: vi.fn((id, s) => { states[id] = s; }),
        onVariablesChange: vi.fn(),
        onComplete: vi.fn(),
      },
    });

    await handleGrpcAssertNode(
      'a-empty',
      grpcAssertNode('a-empty', { source: '', onError: 'continue' }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.results[0]?.transportType).toBe('grpcAssert');
    expect(hCtx.results[0]?.grpcResultMeta?.assertionFailures).toEqual([
      'Assert source (node id or saveAs alias) is required',
    ]);
    expect(states['a-empty']?.grpcMeta?.assertionFailures).toEqual([
      'Assert source (node id or saveAs alias) is required',
    ]);
    expect(hCtx.capturedGrpcDetails?.get('a-empty')?.method).toBe('ASSERT');
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('a-empty', 'main');
  });

  it('fails when upstream source is missing from step store', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: new GrpcWorkflowStepResultStore(),
    });

    await handleGrpcAssertNode('a5', grpcAssertNode('a5', { source: 'missing' }), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('honors onError continue when upstream source is missing', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: new GrpcWorkflowStepResultStore(),
    });

    await handleGrpcAssertNode(
      'a6',
      grpcAssertNode('a6', { source: 'missing', onError: 'continue' }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('a6', 'main');
  });

  it('evaluates assertions against failed upstream step results', async () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('grpc-fail', undefined, {
      nodeId: 'grpc-fail',
      callType: 'unary',
      status: 'failed',
      grpcStatus: 3,
      grpcStatusMessage: 'INVALID_ARGUMENT',
    });
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({ grpcStepResultStore: store });

    await handleGrpcAssertNode(
      'a7',
      grpcAssertNode('a7', { source: 'grpc-fail', assertions: [{ grpcStatus: 3 }] }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(true);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('a7', 'main');
  });
});
