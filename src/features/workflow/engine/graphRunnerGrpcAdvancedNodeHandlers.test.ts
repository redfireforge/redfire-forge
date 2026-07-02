import { describe, expect, it, vi } from 'vitest';
import {
  handleGrpcLoadTestNode,
  handleGrpcMockAssertNode,
  handleGrpcSchemaDiffNode,
} from './graphRunnerGrpcAdvancedNodeHandlers';
import { makeNode } from './graphRunnerNodeHandlers.test-utils';
import { GrpcWorkflowOutputRegistry } from '../utils/grpcWorkflowOutputRegistry';
import { GrpcWorkflowStepResultStore } from '../utils/grpcWorkflowStepResultStore';
import { VariableContext } from './variableContext';
import { FIXTURE_DESCRIPTOR, FIXTURE_DESCRIPTOR_KEY } from '../../../shared/grpc/contractFixtures';

function makeHandlerContext(overrides: Record<string, unknown> = {}) {
  const ctx = new VariableContext({});
  const passed = { value: true };
  const results: import('../../../shared/types').RequestResult[] = [];
  const hCtx = {
    nodeMap: new Map(),
    outgoing: new Map(),
    ctx,
    tokenManager: {} as import('../../../engine/tokenManager').TokenManager,
    results,
    allPassed: true,
    visited: new Set<string>(),
    joinArrived: new Map(),
    incomingCount: new Map(),
    callbacks: {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    },
    initialVariables: {},
    nodeLabel: (id: string) => id,
    log: vi.fn(),
    visitOutgoing: vi.fn(),
    threadId: 'main',
    grpcOperations: {
      invokeUnary: vi.fn(async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'ok' },
        durationMs: 2,
      })),
      collectServerStream: vi.fn(),
      resolveDescriptor: vi.fn(async () => FIXTURE_DESCRIPTOR),
    },
    grpcOutputRegistry: new GrpcWorkflowOutputRegistry(),
    grpcStepResultStore: new GrpcWorkflowStepResultStore(),
    ...overrides,
  };
  return { hCtx, passed, results, ctx };
}

describe('graphRunnerGrpcAdvancedNodeHandlers', () => {
  it('handleGrpcLoadTestNode fails when grpcOperations missing', async () => {
    const { hCtx, passed } = makeHandlerContext({ grpcOperations: undefined });
    await handleGrpcLoadTestNode(
      'lt',
      makeNode('lt', 'grpcLoadTest', {
        label: 'lt',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        callType: 'unary',
        body: {},
        loadTest: { concurrency: 1, totalCalls: 1 },
      }),
      hCtx as never,
      passed,
    );
    expect(passed.value).toBe(false);
  });

  it('handleGrpcSchemaDiffNode publishes summary on clean diff', async () => {
    const { hCtx, passed, ctx } = makeHandlerContext();
    await handleGrpcSchemaDiffNode(
      'sd',
      makeNode('sd', 'grpcSchemaDiff', {
        label: 'sd',
        leftDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
        rightDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
      hCtx as never,
      passed,
    );
    expect(passed.value).toBe(true);
    expect(ctx.get('steps.sd.grpc.schemaDiffSummary')).toBeTruthy();
  });

  it('handleGrpcSchemaDiffNode fails when resolveDescriptor is missing', async () => {
    const { hCtx, passed, results } = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(),
      },
    });
    await handleGrpcSchemaDiffNode(
      'sd-missing',
      makeNode('sd-missing', 'grpcSchemaDiff', {
        label: 'sd',
        leftDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
        rightDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
      hCtx as never,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(results).toHaveLength(1);
    expect(results[0]?.transportType).toBe('grpcSchemaDiff');
    expect(results[0]?.passed).toBe(false);
  });

  it('handleGrpcLoadTestNode resolves profileId when inline loadTest is omitted', async () => {
    const profileResolver = vi.fn(async () => ({
      concurrency: 1,
      totalCalls: 1,
      warmupCalls: 0,
    }));
    const { hCtx, passed } = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(async () => ({
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: { message: 'ok' },
          durationMs: 2,
        })),
        collectServerStream: vi.fn(),
        resolveLoadTestProfile: profileResolver,
      },
    });
    await handleGrpcLoadTestNode(
      'lt-profile',
      makeNode('lt-profile', 'grpcLoadTest', {
        label: 'lt',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        callType: 'unary',
        body: {},
        profileId: 'profile-1',
      }),
      hCtx as never,
      passed,
    );
    expect(passed.value).toBe(true);
    expect(profileResolver).toHaveBeenCalledWith('profile-1');
  });

  it('handleGrpcLoadTestNode fails when any call fails (partial failure)', async () => {
    let call = 0;
    const { hCtx, passed, results } = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(async () => {
          call += 1;
          if (call === 1) {
            return {
              status: 0,
              statusMessage: 'OK',
              headers: {},
              trailers: {},
              body: { message: 'ok' },
              durationMs: 2,
            };
          }
          return {
            status: 13,
            statusMessage: 'INTERNAL',
            headers: {},
            trailers: {},
            body: {},
            durationMs: 2,
          };
        }),
        collectServerStream: vi.fn(),
      },
    });
    await handleGrpcLoadTestNode(
      'lt-partial',
      makeNode('lt-partial', 'grpcLoadTest', {
        label: 'lt',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        callType: 'unary',
        body: {},
        loadTest: { concurrency: 1, totalCalls: 2, warmupCalls: 0 },
      }),
      hCtx as never,
      passed,
    );
    expect(passed.value).toBe(false);
    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(false);
    const summary = JSON.parse(hCtx.ctx.get('steps.lt-partial.grpc.loadTestSummary')!);
    expect(summary.status).toBe('failed');
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
  });

  it('handleGrpcMockAssertNode fails on body mismatch', async () => {
    const { hCtx, passed } = makeHandlerContext();
    await handleGrpcMockAssertNode(
      'ma',
      makeNode('ma', 'grpcMockAssert', {
        label: 'ma',
        listenTarget: '127.0.0.1:50061',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        expectedBodyPath: 'message',
        expectedBodyValue: 'expected-other',
      }),
      hCtx as never,
      passed,
    );
    expect(passed.value).toBe(false);
  });
});
