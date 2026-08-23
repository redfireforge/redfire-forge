import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY } from '../grpc/contractFixtures';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '@test-utils/factories';
import {
  GRPC_HARNESS_SCENARIO_CONTRACT_MATRIX,
  GRPC_HARNESS_VALIDATION_CODES,
  hasGrpcHarnessScenarioConfigErrors,
  isGrpcHarnessScenario,
  makeDefaultGrpcHarnessCallAction,
  resolveGrpcHarnessCallType,
  validateGrpcHarnessActionConfig,
  validateGrpcHarnessCallActionConfig,
  validateGrpcHarnessScenario,
} from './grpcHarnessScenarioContracts';

function makeTest(id: string, overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id,
    name: `Test ${id}`,
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
    },
    ...overrides,
  }) as Scenario;
}

describe('grpcHarnessScenarioContracts', () => {
  it('HTTP scenarios skip validation', () => {
    const scenario = makeTest('http', {
      method: 'GET',
      actionType: undefined,
      grpcCallAction: undefined,
      url: '/api',
    });
    expect(validateGrpcHarnessActionConfig(scenario)).toEqual([]);
    expect(hasGrpcHarnessScenarioConfigErrors(scenario)).toBe(false);
  });

  it('Kafka and WS scenarios skip gRPC harness validation', () => {
    const kafka = makeTest('kafka', {
      method: 'KAFKA',
      actionType: 'kafkaProduce',
      grpcCallAction: undefined,
      kafkaProduceAction: { clusterId: 'c1', topic: 't1' },
    });
    const ws = makeTest('ws', {
      method: 'WEBSOCKET',
      actionType: 'wsConnect',
      grpcCallAction: undefined,
      wsConnectAction: { url: 'ws://localhost:8080' },
    });
    expect(validateGrpcHarnessActionConfig(kafka)).toEqual([]);
    expect(validateGrpcHarnessActionConfig(ws)).toEqual([]);
    expect(hasGrpcHarnessScenarioConfigErrors(kafka)).toBe(false);
    expect(hasGrpcHarnessScenarioConfigErrors(ws)).toBe(false);
  });

  it('defaults missing callType to unary', () => {
    const config = makeDefaultGrpcHarnessCallAction();
    expect(resolveGrpcHarnessCallType(config)).toBe('unary');
    const result = validateGrpcHarnessCallActionConfig({
      ...config,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      target: 'localhost:50051',
      body: {},
    });
    expect(result.valid).toBe(true);
  });

  it('requires grpcCallAction when actionType is grpcCall', () => {
    const errors = validateGrpcHarnessActionConfig(makeTest('missing', { grpcCallAction: undefined }));
    expect(errors).toContain('grpcCallAction is required when actionType is "grpcCall"');
  });

  it('validates unary required fields', () => {
    const errors = validateGrpcHarnessActionConfig(makeTest('bad', {
      grpcCallAction: {
        callType: 'unary',
        target: '',
        descriptorKey: '',
        service: '',
        method: '',
        body: {},
      },
    }));
    expect(errors.some((e) => e.includes('target or connectionId is required'))).toBe(true);
    expect(errors.some((e) => e.includes('descriptorKey is required'))).toBe(true);
  });

  it('accepts templated metadata keys and values at import validation', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      metadata: { 'x-{{envName}}': '{{envName}}-value' },
    });
    expect(result.valid).toBe(true);
  });

  it('still rejects invalid literal metadata keys', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      metadata: { 'Invalid Key!': 'value' },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_METADATA))
      .toBe(true);
  });

  it('accepts connection profile without explicit target', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: '',
      connectionId: 'profile-a',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
    });
    expect(result.valid).toBe(true);
  });

  it('accepts env template targets', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: '{{grpcHost}}',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
    });
    expect(result.valid).toBe(true);
  });

  it('accepts in-process target addresses', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'in-process:echo',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
    });
    expect(result.valid).toBe(true);
  });

  it('rejects unknown callType without applying streaming rules', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'invalid_stream' as 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_CALL_TYPE))
      .toBe(true);
    expect(result.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.MISSING_COLLECT_RULE))
      .toBe(false);
  });

  it('requires collect for server streaming', () => {
    const errors = validateGrpcHarnessActionConfig(makeTest('stream', {
      grpcCallAction: {
        callType: 'server_streaming',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
      },
    }));
    expect(errors.some((e) => e.includes('collect requires'))).toBe(true);
  });

  it('accepts valid server streaming config', () => {
    const result = validateGrpcHarnessScenario(makeTest('stream-ok', {
      grpcCallAction: {
        callType: 'server_streaming',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'ServerStream',
        body: { message: 'hi', repeat_count: 1 },
        collect: { maxMessages: 5, maxDurationMs: 3000 },
      },
    }));
    expect(result.valid).toBe(true);
  });

  it('requires sendMessages for client streaming', () => {
    const errors = validateGrpcHarnessActionConfig(makeTest('client', {
      grpcCallAction: {
        callType: 'client_streaming',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'ClientStream',
      },
    }));
    expect(errors.some((e) => e.includes('sendMessages'))).toBe(true);
  });

  it('requires collect and sendMessages for bidi streaming', () => {
    const errors = validateGrpcHarnessActionConfig(makeTest('bidi', {
      grpcCallAction: {
        callType: 'bidi_streaming',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'BidiStream',
        sendMessages: [{ message: 'one' }],
      },
    }));
    expect(errors.some((e) => e.includes('collect requires'))).toBe(true);
  });

  it('rejects grpcStreamField on unary scenarios', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      assertions: [{ grpcStreamField: 'message', index: 0, exists: true }],
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe(GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION);
  });

  it('accepts grpcNumericField assertion shape', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      assertions: [{ grpcNumericField: 'count', operator: '>=', value: '100' }],
    });
    expect(result.valid).toBe(true);
  });

  it('accepts valid bidi streaming config', () => {
    const result = validateGrpcHarnessScenario(makeTest('bidi-ok', {
      grpcCallAction: {
        callType: 'bidi_streaming',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'BidiStream',
        sendMessages: [{ message: 'one' }],
        collect: { maxMessages: 3 },
      },
    }));
    expect(result.valid).toBe(true);
  });

  it('rejects grpcStreamLength on unary and accepts on server streaming', () => {
    const unaryBad = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      assertions: [{ grpcStreamLength: { min: 1 } }],
    });
    expect(unaryBad.valid).toBe(false);
    expect(unaryBad.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION))
      .toBe(true);

    const streamOk = validateGrpcHarnessCallActionConfig({
      callType: 'server_streaming',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hi', repeat_count: 1 },
      collect: { maxMessages: 5 },
      assertions: [{ grpcStreamLength: { min: 1, max: 10 } }],
    });
    expect(streamOk.valid).toBe(true);
  });

  it('accepts valid client streaming config', () => {
    const result = validateGrpcHarnessScenario(makeTest('client-ok', {
      grpcCallAction: {
        callType: 'client_streaming',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'ClientStream',
        sendMessages: [{ message: 'one' }, { message: 'two' }],
      },
    }));
    expect(result.valid).toBe(true);
  });

  it('accepts grpcTrailer and grpcDuration assertion shapes', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      assertions: [
        { grpcTrailer: 'x-custom', equals: 'ok' },
        { grpcDuration: { max: 500 } },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('exports contract matrix for all call types', () => {
    expect(GRPC_HARNESS_SCENARIO_CONTRACT_MATRIX.unary.required).toContain('descriptorKey');
    expect(GRPC_HARNESS_SCENARIO_CONTRACT_MATRIX.server_streaming.required).toContain('collect');
    expect(GRPC_HARNESS_SCENARIO_CONTRACT_MATRIX.client_streaming.required).toContain('sendMessages');
    expect(GRPC_HARNESS_SCENARIO_CONTRACT_MATRIX.bidi_streaming.required).toContain('collect');
    expect(GRPC_HARNESS_SCENARIO_CONTRACT_MATRIX.bidi_streaming.required).toContain('sendMessages');
  });

  it('detects grpc harness scenarios', () => {
    expect(isGrpcHarnessScenario(makeTest('grpc'))).toBe(true);
    expect(isGrpcHarnessScenario(makeTest('http', { actionType: 'http', method: 'GET' }))).toBe(false);
  });
});
