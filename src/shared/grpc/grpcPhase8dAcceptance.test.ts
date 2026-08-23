/**
 * Phase 8D — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';

describe('Phase 8D acceptance checklist', () => {
  it('exports harness assertion modules', async () => {
    const path = await import('./grpcHarnessAssertPath');
    expect(typeof path.resolveGrpcHarnessFieldValue).toBe('function');
    expect(typeof path.resolveGrpcHarnessStreamFieldValue).toBe('function');

    const numeric = await import('./grpcHarnessNumericCompare');
    expect(typeof numeric.compareGrpcHarnessNumericValues).toBe('function');

    const engine = await import('./grpcHarnessAssertEngine');
    expect(typeof engine.evaluateGrpcHarnessAssertions).toBe('function');
  });

  it('grpcExecution wires evaluateGrpcHarnessAssertions', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../engine/grpc/grpcExecution.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('evaluateGrpcHarnessAssertions');
    expect(source).toContain('assertionFailures');
  });

  it('assertion evaluation stays outside harness transport retry executors', async () => {
    const fs = await import('fs/promises');
    const read = (rel: string) =>
      fs.readFile(new URL(rel, import.meta.url), 'utf8');
    const executorSource = await read('./grpcHarnessExecutor.ts');
    const unarySource = await read('./grpcHarnessUnaryExecutor.ts');
    const streamSource = await read('./grpcHarnessStreamCollector.ts');
    expect(executorSource).not.toContain('evaluateGrpcHarnessAssertions');
    expect(unarySource).not.toContain('evaluateGrpcHarnessAssertions');
    expect(streamSource).not.toContain('evaluateGrpcHarnessAssertions');
  });

  it('grpcCall result carries assertionFailures on harness contract', async () => {
    const { executeGrpcAction } = await import('../../engine/grpc/grpcExecution');
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
        assertions: [{ grpcField: '$.message', equals: 'wrong' }],
      },
    } as import('../types').Scenario;

    const result = await executeGrpcAction(scenario, {
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

    expect(result.passed).toBe(false);
    expect(result.grpcResultMeta?.assertionFailures).toHaveLength(1);
    expect(result.grpcResultMeta?.assertionFailures?.[0]).toContain('assertions[0]:');
    expect(result.failureDetails.some((detail) => detail.path === '(grpcAssertion)')).toBe(true);
  });

  it('skipAssertions from buildSelectedTests prevents harness assertion evaluation', async () => {
    const { buildSelectedTests } = await import('../../features/test-runner/utils/buildSelectedTests');
    const { executeGrpcAction } = await import('../../engine/grpc/grpcExecution');
    const { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } = await import('./contractFixtures');
    const { makeScenario: makeTestScenario } = await import('../../test-utils/factories');
    const fg = {
      name: 'FG',
      scenarios: [{
        id: 'sc-1',
        name: 'Scenario',
        kind: 'standard' as const,
        tests: [makeTestScenario({
          id: 't1',
          actionType: 'grpcCall',
          method: 'GRPC',
          grpcCallAction: {
            callType: 'unary',
            target: FIXTURE_UNARY_CALL_REQUEST.target.address,
            descriptorKey: FIXTURE_DESCRIPTOR_KEY,
            service: FIXTURE_UNARY_CALL_REQUEST.service,
            method: FIXTURE_UNARY_CALL_REQUEST.method,
            body: { message: 'hello' },
            assertions: [{ grpcField: '$.message', equals: 'would-fail' }],
          },
        })],
      }],
    };
    const [selected] = buildSelectedTests(
      [fg],
      new Set(['sc-1']),
      'hardcoded',
      '',
      undefined,
      false,
      true,
      'default',
      'default',
      [],
    );
    const result = await executeGrpcAction(selected, {
      invokeUnary: async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 3,
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
    expect(result.passed).toBe(true);
    expect(result.grpcResultMeta?.assertionFailures).toBeUndefined();
  });
});
