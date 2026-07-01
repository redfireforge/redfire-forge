/**
 * Phase 8C — harness executor dispatch tests.
 */
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '../../test-utils/factories';
import {
  buildGrpcHarnessSnapshotForScenario,
  executeGrpcHarnessScenario,
  executeGrpcHarnessSnapshot,
} from './grpcHarnessExecutor';
import type { GrpcHarnessOperations } from './buildGrpcHarnessOperations';

const BUILD_CONTEXT = {
  resolveTemplate: (value: string) => value,
  profiles: [],
  pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' as const },
};

function grpcScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'grpc-1',
    name: 'Echo unary',
    url: '',
    method: 'GRPC',
    actionType: 'grpcCall',
    grpcCallAction: {
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target.address,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
    },
    ...overrides,
  }) as Scenario;
}

function mockOps(overrides: Partial<GrpcHarnessOperations> = {}): GrpcHarnessOperations {
  return {
    invokeUnary: vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'ok' },
      durationMs: 5,
    })),
    collectHarnessServerStream: vi.fn(),
    executeClientStream: vi.fn(),
    executeBidiStream: vi.fn(),
    ...overrides,
  };
}

describe('grpcHarnessExecutor (Phase 8C)', () => {
  it('buildGrpcHarnessSnapshotForScenario throws on unresolved templates', () => {
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: '{{missingHost}}',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    });
    expect(() => buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT)).toThrow(/unresolved/i);
  });

  it('dispatches unary snapshots to invokeUnary path', async () => {
    const ops = mockOps();
    const outcome = await executeGrpcHarnessScenario(grpcScenario(), {
      operations: ops,
      buildContext: BUILD_CONTEXT,
    });
    expect(outcome.passed).toBe(true);
    expect(outcome.callType).toBe('unary');
    expect(ops.invokeUnary).toHaveBeenCalledTimes(1);
  });

  it('returns failed stream outcome on terminal transport error instead of throwing', async () => {
    const ops = mockOps({
      collectHarnessServerStream: vi.fn(async () => {
        throw new Error('SSE disconnected');
      }),
    });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 3 },
      },
    });
    const outcome = await executeGrpcHarnessScenario(scenario, {
      operations: ops,
      buildContext: BUILD_CONTEXT,
    });
    expect(outcome.passed).toBe(false);
    expect(outcome.streamStopReason).toBe('transport_error');
    expect(outcome.errorDetail).toContain('SSE disconnected');
  });

  it('retries server_streaming on retryable grpc status', async () => {
    const collectHarnessServerStream = vi
      .fn()
      .mockResolvedValueOnce({
        callType: 'server_streaming',
        passed: false,
        grpcStatus: 14,
        grpcStatusMessage: 'UNAVAILABLE',
        durationMs: 5,
        attempts: 1,
        streamStopReason: 'stream_end',
      })
      .mockResolvedValueOnce({
        callType: 'server_streaming',
        passed: true,
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        durationMs: 6,
        messages: [{ message: 'ok' }],
        attempts: 1,
        streamStopReason: 'stream_end',
      });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 3 },
        retry: { maxAttempts: 2, backoffMs: 0, retryOnStatuses: [14] },
      },
    });
    const outcome = await executeGrpcHarnessScenario(scenario, {
      operations: mockOps({ collectHarnessServerStream }),
      buildContext: BUILD_CONTEXT,
    });
    expect(outcome.passed).toBe(true);
    expect(outcome.attempts).toBe(2);
    expect(collectHarnessServerStream).toHaveBeenCalledTimes(2);
  });

  it('dispatches server_streaming snapshots to collectHarnessServerStream', async () => {
    const ops = mockOps({
      collectHarnessServerStream: vi.fn(async () => ({
        callType: 'server_streaming',
        passed: true,
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        durationMs: 8,
        messages: [{ message: 'a' }],
        attempts: 1,
        streamStopReason: 'stream_end',
      })),
    });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 3 },
      },
    });
    const snapshot = buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT);
    const outcome = await executeGrpcHarnessSnapshot(snapshot, {
      operations: ops,
      buildContext: BUILD_CONTEXT,
    });
    expect(outcome.callType).toBe('server_streaming');
    expect(ops.collectHarnessServerStream).toHaveBeenCalledTimes(1);
    expect(ops.invokeUnary).not.toHaveBeenCalled();
  });
});
