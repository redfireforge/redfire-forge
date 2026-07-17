/**
 * Phase 8A — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY } from './contractFixtures';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '../../test-utils/factories';
import {
  GRPC_HARNESS_VALIDATION_CODES,
  validateGrpcHarnessActionConfig,
  validateGrpcHarnessScenario,
} from '../utils/grpcHarnessScenarioContracts';

function grpcScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'grpc-1',
    name: 'Echo unary',
    url: '',
    method: 'GRPC',
    actionType: 'grpcCall',
    grpcCallAction: {
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      assertions: [{ grpcStatus: 0 }],
    },
    ...overrides,
  }) as Scenario;
}

describe('Phase 8A acceptance checklist', () => {
  it('exports frozen harness scenario types', async () => {
    const types = await import('../types/grpc-harness');
    expect(typeof types.GrpcHarnessCallActionConfig).toBe('undefined');
    const contracts = await import('../utils/grpcHarnessScenarioContracts');
    expect(typeof contracts.makeDefaultGrpcHarnessCallAction).toBe('function');
  });

  it('exports validators, error catalog, and contract matrix', async () => {
    const contracts = await import('../utils/grpcHarnessScenarioContracts');
    expect(typeof contracts.validateGrpcHarnessScenario).toBe('function');
    expect(contracts.GRPC_HARNESS_VALIDATION_CODES.MISSING_DESCRIPTOR_KEY)
      .toBe('grpc.harness.missing_descriptor_key');
    expect(contracts.GRPC_HARNESS_SCENARIO_CONTRACT_MATRIX.bidi_streaming.required)
      .toContain('sendMessages');
  });

  it('valid unary scenario passes validation', () => {
    expect(validateGrpcHarnessScenario(grpcScenario()).valid).toBe(true);
  });

  it('legacy HTTP scenarios remain valid', () => {
    const http = _makeScenario({ id: 'http-1', method: 'GET', url: '/api' }) as Scenario;
    expect(validateGrpcHarnessScenario(http).valid).toBe(true);
    expect(validateGrpcHarnessActionConfig(http)).toEqual([]);
  });

  it('Kafka scenarios do not trip gRPC harness validation on import', () => {
    const kafka = _makeScenario({
      id: 'kafka-1',
      method: 'KAFKA',
      actionType: 'kafkaProduce',
      kafkaProduceAction: { clusterId: 'c1', topic: 'events' },
    }) as Scenario;
    expect(validateGrpcHarnessActionConfig(kafka)).toEqual([]);
  });

  it('malformed streaming scenario fails with stable codes', () => {
    const result = validateGrpcHarnessScenario(grpcScenario({
      grpcCallAction: {
        callType: 'server_streaming',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'ServerStream',
        body: { message: 'hi' },
      },
    }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.MISSING_COLLECT_RULE))
      .toBe(true);
  });
});
