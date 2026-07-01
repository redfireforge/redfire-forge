import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import {
  handleGrpcAssertNode,
  handleGrpcServerStreamNode,
  handleGrpcUnaryNode,
} from './graphRunnerGrpcNodeHandlers';
import { GrpcWorkflowStepResultStore } from '../utils/grpcWorkflowStepResultStore';
import {
  makeHandlerContext,
  makeNode,
  makePassedFlag,
} from './graphRunnerNodeHandlers.test-utils';

vi.mock('../utils/grpcWorkflowUnaryExecutor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/grpcWorkflowUnaryExecutor')>();
  return {
    ...actual,
    executeGrpcWorkflowUnary: vi.fn(actual.executeGrpcWorkflowUnary),
  };
});

import { executeGrpcWorkflowUnary } from '../utils/grpcWorkflowUnaryExecutor';

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

function grpcAssertNode(id: string, overrides: Record<string, unknown> = {}) {
  return makeNode(id, 'grpcAssert', {
    label: 'Assert gRPC',
    source: 'grpc-1',
    assertions: [{ grpcStatus: 0 }],
    ...overrides,
  });
}

describe('graphRunnerGrpcNodeHandlers coverage gaps', () => {
  it('unary success captures bodyPreview from response body', async () => {
    const passed = makePassedFlag();
    const capturedGrpcDetails = new Map<string, import('../../../shared/types').CapturedGrpcNodeDetails>();
    const hCtx = makeHandlerContext({
      capturedGrpcDetails,
      grpcOperations: {
        invokeUnary: vi.fn(async () => ({
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'preview-me' },
          durationMs: 8,
        })),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode('u-preview', grpcUnaryNode('u-preview'), hCtx, passed);
    expect(capturedGrpcDetails.get('u-preview')?.bodyPreview).toContain('preview-me');
  });

  it('unary transport throw sets grpcMeta and does not traverse on fail', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(async () => {
          throw new Error('transport exploded');
        }),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode('u-throw-fail', grpcUnaryNode('u-throw-fail', { onError: 'fail' }), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
    expect(hCtx.results[0]?.errorMessage).toBe('transport exploded');
  });

  it('server stream snapshot build failure does not traverse', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcServerStreamNode(
      's-snap',
      grpcStreamNode('s-snap', { body: { message: '{{missing}}' } }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('server stream abort does not traverse even with onError continue', async () => {
    const passed = makePassedFlag();
    const controller = new AbortController();
    controller.abort();
    const hCtx = makeHandlerContext({
      abortSignal: controller.signal,
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => {
          throw new DOMException('Aborted', 'AbortError');
        }),
      },
    });

    await handleGrpcServerStreamNode(
      's-abort',
      grpcStreamNode('s-abort', { onError: 'continue' }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('server stream success uses last message for bodyPreview when body absent', async () => {
    const passed = makePassedFlag();
    const capturedGrpcDetails = new Map<string, import('../../../shared/types').CapturedGrpcNodeDetails>();
    const hCtx = makeHandlerContext({
      capturedGrpcDetails,
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => ({
          messages: [{ n: 1 }, { n: 99 }],
          durationMs: 20,
          grpcStatus: 0,
          grpcStatusMessage: 'OK',
          trailers: {},
          stopReason: 'max_messages' as const,
        })),
      },
    });

    await handleGrpcServerStreamNode('s-preview', grpcStreamNode('s-preview'), hCtx, passed);
    expect(capturedGrpcDetails.get('s-preview')?.bodyPreview).toContain('99');
  });

  it('server stream failure uses errorDetail when grpcStatusMessage missing', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => ({
          messages: [],
          durationMs: 10,
          grpcStatus: 13,
          grpcStatusMessage: '',
          trailers: {},
          stopReason: 'stream_error' as const,
          errorDetail: 'stream detail error',
        })),
      },
    });

    await handleGrpcServerStreamNode('s-err', grpcStreamNode('s-err'), hCtx, passed);
    expect(hCtx.results[0]?.errorMessage).toBe('stream detail error');
  });

  it('assert fails when step result store is missing', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({ grpcStepResultStore: undefined });

    await handleGrpcAssertNode('a-no-store', grpcAssertNode('a-no-store'), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(hCtx.results[0]?.grpcResultMeta?.assertionFailures?.[0]).toMatch(/step result store/i);
  });

  it('assert failure without upstream uses synthetic step meta', async () => {
    const passed = makePassedFlag();
    const capturedGrpcDetails = new Map<string, import('../../../shared/types').CapturedGrpcNodeDetails>();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: new GrpcWorkflowStepResultStore(),
      capturedGrpcDetails,
    });

    await handleGrpcAssertNode(
      'a-missing-upstream',
      grpcAssertNode('a-missing-upstream', { source: 'missing-node' }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(capturedGrpcDetails.get('a-missing-upstream')?.callType).toBe('unary');
  });

  it('assert failure with onError continue traverses outgoing edges', async () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('grpc-1', undefined, {
      nodeId: 'grpc-1',
      callType: 'unary',
      status: 'success',
      grpcStatus: 0,
      body: { message: 'hello' },
    });
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({ grpcStepResultStore: store });

    await handleGrpcAssertNode(
      'a-continue',
      grpcAssertNode('a-continue', { onError: 'continue', assertions: [{ grpcStatus: 3 }] }),
      hCtx,
      passed,
    );
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('a-continue', 'main');
  });

  it('server stream missing grpcOperations fails without traversal', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext();
    await handleGrpcServerStreamNode('s-no-ops', grpcStreamNode('s-no-ops'), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
  });

  it('commitTransportFailureStepResult no-ops when step store is missing', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(async () => ({
          status: 13,
          statusMessage: 'INTERNAL',
          headers: {},
          trailers: {},
          durationMs: 4,
        })),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode('u-grpc-fail', grpcUnaryNode('u-grpc-fail'), hCtx, passed);
    expect(hCtx.results[0]?.errorMessage).toBe('INTERNAL');
  });

  it('commitTransportFailureStepResult no-ops when step store is missing', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcStepResultStore: undefined,
      grpcOperations: {
        invokeUnary: vi.fn(async () => {
          throw new Error('network down');
        }),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode('u-no-store', grpcUnaryNode('u-no-store'), hCtx, passed);
    expect(passed.value).toBe(false);
  });

  it('server stream transport throw builds grpcMeta and honors onError continue', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => {
          throw new Error('stream transport lost');
        }),
      },
    });

    await handleGrpcServerStreamNode(
      's-throw-continue',
      grpcStreamNode('s-throw-continue', { onError: 'continue' }),
      hCtx,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('s-throw-continue', 'main');
  });

  it('server stream cancelled stop reason fails collection', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => ({
          messages: [],
          durationMs: 4,
          grpcStatus: 0,
          grpcStatusMessage: 'OK',
          trailers: {},
          stopReason: 'cancelled' as const,
        })),
      },
    });

    await handleGrpcServerStreamNode('s-cancel', grpcStreamNode('s-cancel'), hCtx, passed);
    expect(passed.value).toBe(false);
  });

  it('server stream stream_end with OK status succeeds', async () => {
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(async () => ({
          messages: [{ ok: true }],
          durationMs: 4,
          grpcStatus: 0,
          grpcStatusMessage: 'OK',
          trailers: {},
          stopReason: 'stream_end' as const,
        })),
      },
    });

    await handleGrpcServerStreamNode('s-end-ok', grpcStreamNode('s-end-ok'), hCtx, passed);
    expect(passed.value).toBe(true);
    expect(hCtx.visitOutgoing).toHaveBeenCalledWith('s-end-ok', 'main');
  });

  it('unary executor throw hits transport catch path with grpcMeta', async () => {
    vi.mocked(executeGrpcWorkflowUnary).mockRejectedValueOnce(new Error('executor exploded'));
    const passed = makePassedFlag();
    const hCtx = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode('u-exec-throw', grpcUnaryNode('u-exec-throw'), hCtx, passed);
    expect(passed.value).toBe(false);
    expect(hCtx.results[0]?.errorMessage).toBe('executor exploded');
  });

  it('unary success omits bodyPreview when response body is empty', async () => {
    const passed = makePassedFlag();
    const capturedGrpcDetails = new Map<string, import('../../../shared/types').CapturedGrpcNodeDetails>();
    const hCtx = makeHandlerContext({
      capturedGrpcDetails,
      grpcOperations: {
        invokeUnary: vi.fn(async () => ({
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: undefined,
          durationMs: 8,
        })),
        collectServerStream: vi.fn(),
      },
    });

    await handleGrpcUnaryNode('u-no-body', grpcUnaryNode('u-no-body'), hCtx, passed);
    expect(capturedGrpcDetails.get('u-no-body')?.bodyPreview).toBeUndefined();
  });
});
