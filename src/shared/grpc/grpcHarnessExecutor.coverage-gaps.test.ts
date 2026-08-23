/**
 * Coverage gaps — grpcHarnessExecutor.ts (Phase 8C dispatch + retry).
 */
import { describe, expect, it, vi } from 'vitest';
import { GrpcApiClientError } from './grpcApiClient';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_SERVER_STREAM_START_REQUEST, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '@test-utils/factories';
import {
  buildGrpcHarnessSnapshotForScenario,
  executeGrpcHarnessSnapshot,
} from './grpcHarnessExecutor';
import type { GrpcHarnessOperations } from './buildGrpcHarnessOperations';
import type { GrpcHarnessExecuteSnapshot } from '../types/grpc-harness-snapshot';
import * as attemptLifecycle from './grpcHarnessAttemptLifecycle';
import * as transportAdapter from './grpcHarnessTransportAdapter';

const BUILD_CONTEXT = {
  resolveTemplate: (value: string) => value,
  profiles: [],
  pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' as const },
};

function grpcScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'grpc-exec-gap',
    name: 'Harness gap',
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
    invokeUnary: vi.fn(),
    collectHarnessServerStream: vi.fn(),
    executeClientStream: vi.fn(),
    executeBidiStream: vi.fn(),
    ...overrides,
  };
}

describe('grpcHarnessExecutor coverage gaps', () => {
  it('dispatches client_streaming snapshots to executeClientStream', async () => {
    const executeClientStream = vi.fn(async () => ({
      callType: 'client_streaming' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 4,
      attempts: 1,
      streamStopReason: 'stream_end' as const,
    }));
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'client_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ClientStream',
        sendMessages: [{ message: 'one' }],
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ executeClientStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.callType).toBe('client_streaming');
    expect(executeClientStream).toHaveBeenCalledTimes(1);
  });

  it('dispatches bidi_streaming snapshots to executeBidiStream', async () => {
    const executeBidiStream = vi.fn(async () => ({
      callType: 'bidi_streaming' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 6,
      attempts: 1,
      streamStopReason: 'stream_end' as const,
    }));
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'bidi_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'BidiStream',
        sendMessages: [{ message: 'ping' }],
        collect: { maxMessages: 3 },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ executeBidiStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.callType).toBe('bidi_streaming');
    expect(executeBidiStream).toHaveBeenCalledTimes(1);
  });

  it('throws when server_streaming snapshot is missing collect config', async () => {
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
      },
    });
    const snapshot = buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT);
    const badSnapshot = { ...snapshot, collect: undefined } as GrpcHarnessExecuteSnapshot;
    const outcome = await executeGrpcHarnessSnapshot(badSnapshot, {
      operations: mockOps(),
      buildContext: BUILD_CONTEXT,
    });
    expect(outcome.passed).toBe(false);
    expect(outcome.errorDetail).toContain('requires collect config');
  });

  it('throws for unsupported harness callType', async () => {
    const scenario = grpcScenario();
    const snapshot = buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT);
    const badSnapshot = {
      ...snapshot,
      execute: { ...snapshot.execute, callType: 'invalid' as 'unary' },
    } as GrpcHarnessExecuteSnapshot;
    await expect(executeGrpcHarnessSnapshot(badSnapshot, {
      operations: mockOps(),
      buildContext: BUILD_CONTEXT,
    })).rejects.toThrow(/Unsupported harness gRPC callType/i);
  });

  it('retries client_streaming after retryable grpc status', async () => {
    const executeClientStream = vi
      .fn()
      .mockResolvedValueOnce({
        callType: 'client_streaming',
        passed: false,
        grpcStatus: 14,
        durationMs: 3,
        attempts: 1,
        streamStopReason: 'stream_end',
      })
      .mockResolvedValueOnce({
        callType: 'client_streaming',
        passed: true,
        grpcStatus: 0,
        durationMs: 4,
        attempts: 1,
        streamStopReason: 'stream_end',
      });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'client_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ClientStream',
        sendMessages: [{ message: 'one' }],
        retry: { maxAttempts: 2, backoffMs: 0, retryOnStatuses: [14] },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ executeClientStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.passed).toBe(true);
    expect(outcome.attempts).toBe(2);
    expect(executeClientStream).toHaveBeenCalledTimes(2);
  });

  it('returns transport failure with network category for retryable GrpcApiClientError', async () => {
    const collectHarnessServerStream = vi.fn(async () => {
      throw new GrpcApiClientError('stream', 'UNAVAILABLE', { retryable: true });
    });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 2 },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ collectHarnessServerStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.streamStopReason).toBe('transport_error');
    expect(outcome.errorCategory).toBe('network');
  });

  it('aborts stream execution when abortSignal is set', async () => {
    const collectHarnessServerStream = vi.fn(async () => ({
      callType: 'server_streaming',
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      attempts: 1,
      streamStopReason: 'stream_end',
    }));
    const controller = new AbortController();
    controller.abort();
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
      },
    });
    await expect(executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      {
        operations: mockOps({ collectHarnessServerStream }),
        buildContext: BUILD_CONTEXT,
        abortSignal: controller.signal,
      },
    )).rejects.toMatchObject({ name: 'AbortError' });
    expect(collectHarnessServerStream).not.toHaveBeenCalled();
  });

  it('returns failed outcome when bidi snapshot is missing collect config', async () => {
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'bidi_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'BidiStream',
        sendMessages: [{ message: 'one' }],
        collect: { maxMessages: 2 },
      },
    });
    const snapshot = buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT);
    const badSnapshot = { ...snapshot, collect: undefined } as GrpcHarnessExecuteSnapshot;
    const outcome = await executeGrpcHarnessSnapshot(badSnapshot, {
      operations: mockOps(),
      buildContext: BUILD_CONTEXT,
    });
    expect(outcome.errorDetail).toContain('bidi_streaming harness snapshot requires collect config');
  });

  it('continues retry loop after retryable transport throw', async () => {
    const collectHarnessServerStream = vi
      .fn()
      .mockRejectedValueOnce(new GrpcApiClientError('stream', 'UNAVAILABLE', { retryable: true }))
      .mockResolvedValueOnce({
        callType: 'server_streaming',
        passed: true,
        grpcStatus: 0,
        durationMs: 2,
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
        collect: { maxMessages: 1 },
        retry: { maxAttempts: 2, backoffMs: 0, retryOnStatuses: [14] },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ collectHarnessServerStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.passed).toBe(true);
    expect(collectHarnessServerStream).toHaveBeenCalledTimes(2);
  });

  it('returns failed stream outcome without retry when grpc status is not retryable', async () => {
    const collectHarnessServerStream = vi.fn(async () => ({
      callType: 'server_streaming',
      passed: false,
      grpcStatus: 3,
      grpcStatusMessage: 'INVALID_ARGUMENT',
      durationMs: 2,
      attempts: 1,
      streamStopReason: 'stream_end',
    }));
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
        retry: { maxAttempts: 3, backoffMs: 0, retryOnStatuses: [14] },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ collectHarnessServerStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.passed).toBe(false);
    expect(collectHarnessServerStream).toHaveBeenCalledTimes(1);
  });

  it('passes undefined sendMessages as empty array for client and bidi snapshots', async () => {
    const executeClientStream = vi.fn(async () => ({
      callType: 'client_streaming' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      attempts: 1,
      streamStopReason: 'stream_end' as const,
    }));
    const executeBidiStream = vi.fn(async () => ({
      callType: 'bidi_streaming' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 1,
      attempts: 1,
      streamStopReason: 'stream_end' as const,
    }));
    const clientScenario = grpcScenario({
      grpcCallAction: {
        callType: 'client_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ClientStream',
        sendMessages: [{ message: 'one' }],
      },
    });
    const clientSnapshot = buildGrpcHarnessSnapshotForScenario(clientScenario, BUILD_CONTEXT);
    await executeGrpcHarnessSnapshot(
      { ...clientSnapshot, sendMessages: undefined } as GrpcHarnessExecuteSnapshot,
      { operations: mockOps({ executeClientStream }), buildContext: BUILD_CONTEXT },
    );
    expect(executeClientStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      [],
      expect.anything(),
    );

    const bidiScenario = grpcScenario({
      grpcCallAction: {
        callType: 'bidi_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'BidiStream',
        sendMessages: [{ message: 'one' }],
        collect: { maxMessages: 2 },
      },
    });
    const bidiSnapshot = buildGrpcHarnessSnapshotForScenario(bidiScenario, BUILD_CONTEXT);
    await executeGrpcHarnessSnapshot(
      { ...bidiSnapshot, sendMessages: undefined } as GrpcHarnessExecuteSnapshot,
      { operations: mockOps({ executeBidiStream }), buildContext: BUILD_CONTEXT },
    );
    expect(executeBidiStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      [],
      expect.anything(),
      expect.anything(),
    );
  });

  it('rethrows AbortError from stream operations', async () => {
    const collectHarnessServerStream = vi.fn(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
      },
    });
    await expect(executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ collectHarnessServerStream }), buildContext: BUILD_CONTEXT },
    )).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('uses grpcStatusMessage when stream failure omits errorDetail', async () => {
    const collectHarnessServerStream = vi.fn(async () => ({
      callType: 'server_streaming',
      passed: false,
      grpcStatus: 14,
      grpcStatusMessage: 'UNAVAILABLE',
      durationMs: 2,
      attempts: 1,
      streamStopReason: 'stream_end',
    }));
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ collectHarnessServerStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.grpcStatusMessage).toBe('UNAVAILABLE');
    expect(outcome.passed).toBe(false);
  });

  it('maps non-Error transport throws to internal stream transport failures', async () => {
    const collectHarnessServerStream = vi.fn(async () => {
      throw 'stream blew up';
    });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
        retry: { maxAttempts: 1, backoffMs: 0 },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ collectHarnessServerStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.errorDetail).toBe('stream blew up');
    expect(outcome.errorCategory).toBe('internal');
  });

  it('returns last failed outcome when retries are exhausted without transport throw', async () => {
    const collectHarnessServerStream = vi.fn(async () => ({
      callType: 'server_streaming',
      passed: false,
      grpcStatus: 3,
      grpcStatusMessage: 'INVALID_ARGUMENT',
      durationMs: 2,
      attempts: 1,
      streamStopReason: 'stream_end',
    }));
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
        retry: { maxAttempts: 1, backoffMs: 0 },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ collectHarnessServerStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.grpcStatus).toBe(3);
    expect(collectHarnessServerStream).toHaveBeenCalledTimes(1);
  });

  it('returns last outcome after exhausting retryable grpc status attempts', async () => {
    const collectHarnessServerStream = vi.fn(async () => ({
      callType: 'server_streaming',
      passed: false,
      grpcStatus: 14,
      grpcStatusMessage: 'UNAVAILABLE',
      durationMs: 2,
      attempts: 1,
      streamStopReason: 'stream_end',
    }));
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
        retry: { maxAttempts: 2, backoffMs: 0, retryOnStatuses: [14] },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ collectHarnessServerStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.grpcStatus).toBe(14);
    expect(collectHarnessServerStream).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported harness call types at dispatch', async () => {
    const snapshot = buildGrpcHarnessSnapshotForScenario(grpcScenario(), BUILD_CONTEXT);
    await expect(executeGrpcHarnessSnapshot(
      {
        ...snapshot,
        execute: {
          ...snapshot.execute,
          callType: 'unsupported' as never,
        },
      },
      { operations: mockOps(), buildContext: BUILD_CONTEXT },
    )).rejects.toThrow('Unsupported harness gRPC callType');
  });

  it('returns lastOutcome when retry loop ends after a failed attempt', async () => {
    let canStartCalls = 0;
    const canStartSpy = vi.spyOn(attemptLifecycle, 'canStartNextGrpcHarnessAttempt')
      .mockImplementation(() => {
        canStartCalls += 1;
        return canStartCalls <= 1;
      });
    const collectHarnessServerStream = vi.fn(async () => ({
      callType: 'server_streaming' as const,
      passed: false,
      grpcStatus: 14,
      grpcStatusMessage: 'UNAVAILABLE',
      durationMs: 2,
      attempts: 1,
      streamStopReason: 'stream_end' as const,
    }));
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
        retry: { maxAttempts: 3, backoffMs: 0, retryOnStatuses: [14] },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps({ collectHarnessServerStream }), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.grpcStatus).toBe(14);
    expect(collectHarnessServerStream).toHaveBeenCalledTimes(1);
    canStartSpy.mockRestore();
  });

  it('returns no-attempt fallback when retry session cannot start', async () => {
    const canStartSpy = vi.spyOn(attemptLifecycle, 'canStartNextGrpcHarnessAttempt')
      .mockReturnValue(false);
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps(), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.errorDetail).toBe('No harness stream attempts executed');
    expect(outcome.passed).toBe(false);
    canStartSpy.mockRestore();
  });

  it('maps unsupported stream call types inside executeStreamAttempt to transport failure', async () => {
    const adapterSpy = vi.spyOn(transportAdapter, 'grpcHarnessSnapshotToStreamStartRequest')
      .mockReturnValue(FIXTURE_SERVER_STREAM_START_REQUEST);
    const originalStart = attemptLifecycle.startGrpcHarnessAttempt;
    const startSpy = vi.spyOn(attemptLifecycle, 'startGrpcHarnessAttempt')
      .mockImplementation((session) => {
        const attempt = originalStart(session);
        attempt.snapshot.execute.callType = 'bogus' as never;
        return attempt;
      });
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
      },
    });
    const outcome = await executeGrpcHarnessSnapshot(
      buildGrpcHarnessSnapshotForScenario(scenario, BUILD_CONTEXT),
      { operations: mockOps(), buildContext: BUILD_CONTEXT },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.errorDetail).toContain('Unsupported harness stream callType');
    startSpy.mockRestore();
    adapterSpy.mockRestore();
  });

  it('rejects non-streaming snapshots in stream transport failure helper', async () => {
    const snapshot = buildGrpcHarnessSnapshotForScenario(grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 1 },
        retry: { maxAttempts: 1, backoffMs: 0 },
      },
    }), BUILD_CONTEXT);
    const collectHarnessServerStream = vi.fn(async () => {
      snapshot.execute.callType = 'unary' as never;
      throw new Error('transport blew up');
    });
    await expect(executeGrpcHarnessSnapshot(
      snapshot,
      { operations: mockOps({ collectHarnessServerStream }), buildContext: BUILD_CONTEXT },
    )).rejects.toThrow('Expected streaming callType');
  });
});
