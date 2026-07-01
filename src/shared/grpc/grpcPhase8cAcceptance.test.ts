/**
 * Phase 8C — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import type { GrpcResultMeta, RequestResult } from '../types';

function assertHarnessGrpcCallMeta(meta: GrpcResultMeta | undefined): void {
  expect(meta, 'grpcCall: grpcResultMeta must be defined').toBeDefined();
  for (const field of ['service', 'method', 'target'] as const) {
    expect(meta![field], `grpcCall: grpcResultMeta.${field} is required`).toBeTruthy();
  }
}

describe('Phase 8C acceptance checklist', () => {
  it('exports harness executor modules', async () => {
    const runtime = await import('./grpcHarnessRuntimeContext');
    expect(typeof runtime.createGrpcHarnessSnapshotBuildContext).toBe('function');

    const unary = await import('./grpcHarnessUnaryExecutor');
    expect(typeof unary.executeGrpcHarnessUnary).toBe('function');

    const streams = await import('./grpcHarnessStreamCollector');
    expect(typeof streams.collectGrpcHarnessServerStream).toBe('function');
    expect(typeof streams.executeGrpcHarnessClientStream).toBe('function');
    expect(typeof streams.executeGrpcHarnessBidiStream).toBe('function');

    const executor = await import('./grpcHarnessExecutor');
    expect(typeof executor.executeGrpcHarnessScenario).toBe('function');

    const ops = await import('./buildGrpcHarnessOperations');
    expect(typeof ops.buildGrpcHarnessOperations).toBe('function');
  });

  it('exports grpcExecution harness entry', async () => {
    const grpcExecution = await import('../../engine/grpcExecution');
    expect(typeof grpcExecution.executeGrpcAction).toBe('function');
  });

  it('exports mergeGrpcHarnessRuntimeContext for caller-supplied profiles', async () => {
    const runtime = await import('./grpcHarnessRuntimeContext');
    expect(typeof runtime.mergeGrpcHarnessRuntimeContext).toBe('function');
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../engine/grpcExecution.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('runtimeOverrides');
    expect(source).toContain('mergeGrpcHarnessRuntimeContext');
  });

  it('executor no longer throws Phase 8C placeholder', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../engine/executor.ts', import.meta.url), 'utf8'),
    );
    expect(source).not.toContain('gRPC harness execution ships in Phase 8C');
    expect(source).toContain('executeGrpcAction');
  });

  it('grpcCall RequestResult satisfies Phase 6H harness meta contract', async () => {
    const { executeGrpcAction } = await import('../../engine/grpcExecution');
    const { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } = await import('./contractFixtures');
    const scenario = {
      id: 'grpc-1',
      name: 'Echo',
      url: '',
      method: 'GRPC',
      actionType: 'grpcCall',
      headers: [],
      body: '',
      validation: { mode: 'none' },
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    } as import('../types').Scenario;
    const result: RequestResult = await executeGrpcAction(scenario, {
      invokeUnary: async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 5,
      }),
      collectHarnessServerStream: async () => ({
        callType: 'server_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeClientStream: async () => ({
        callType: 'client_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
      executeBidiStream: async () => ({
        callType: 'bidi_streaming',
        passed: true,
        durationMs: 1,
        attempts: 1,
      }),
    });
    expect(result.transportType).toBe('grpcCall');
    assertHarnessGrpcCallMeta(result.grpcResultMeta);
    expect(result.grpcResultMeta?.grpcStatus).toBe(0);
    expect(result.grpcResultMeta?.attempts).toBe(1);
  });
});
