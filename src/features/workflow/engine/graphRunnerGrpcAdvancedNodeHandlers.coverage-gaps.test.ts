import { describe, expect, it, vi } from 'vitest';
import {
  handleGrpcLoadTestNode,
  handleGrpcSchemaDiffNode,
} from './graphRunnerGrpcAdvancedNodeHandlers';
import { makeNode } from './graphRunnerNodeHandlers.test-utils';
import { GrpcWorkflowOutputRegistry } from '../utils/grpcWorkflowOutputRegistry';
import { GrpcWorkflowStepResultStore } from '../utils/grpcWorkflowStepResultStore';
import { VariableContext } from './variableContext';
import { FIXTURE_DESCRIPTOR, FIXTURE_DESCRIPTOR_KEY } from '@shared/grpc/contractFixtures';

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

describe('graphRunnerGrpcAdvancedNodeHandlers coverage gaps', () => {
  it('handleGrpcSchemaDiffNode fails when resolveDescriptor returns null', async () => {
    const { hCtx, passed, results } = makeHandlerContext({
      grpcOperations: {
        invokeUnary: vi.fn(),
        collectServerStream: vi.fn(),
        resolveDescriptor: vi.fn(async () => null),
      },
    });

    await handleGrpcSchemaDiffNode(
      'sd-null-desc',
      makeNode('sd-null-desc', 'grpcSchemaDiff', {
        label: 'sd',
        leftDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
        rightDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
      }),
      hCtx as never,
      passed,
    );

    expect(passed.value).toBe(false);
    expect(results[0]?.errorMessage).toContain('Descriptor not found');
  });

  it('handleGrpcLoadTestNode fails when output registry is missing on success path', async () => {
    const { hCtx, passed, results } = makeHandlerContext({
      grpcOutputRegistry: undefined,
    });

    await handleGrpcLoadTestNode(
      'lt-no-registry',
      makeNode('lt-no-registry', 'grpcLoadTest', {
        label: 'lt',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        callType: 'unary',
        body: {},
        loadTest: { concurrency: 1, totalCalls: 1, warmupCalls: 0 },
      }),
      hCtx as never,
      passed,
    );

    expect(passed.value).toBe(false);
    expect(results[0]?.errorMessage).toContain('GrpcWorkflowOutputRegistry is required');
  });

  it('handleGrpcLoadTestNode treats whitespace profileId as missing config', async () => {
    const { hCtx, passed, results } = makeHandlerContext();

    await handleGrpcLoadTestNode(
      'lt-blank-profile',
      makeNode('lt-blank-profile', 'grpcLoadTest', {
        label: 'lt',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        callType: 'unary',
        body: {},
        profileId: '   ',
      }),
      hCtx as never,
      passed,
    );

    expect(passed.value).toBe(false);
    expect(results[0]?.errorMessage).toContain('Either inline loadTest config or profileId is required');
  });
});
