/**
 * Coverage gaps — grpcHarnessScenarioContracts.ts (Phase 8A validation).
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY } from '../grpc/contractFixtures';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '@test-utils/factories';
import {
  GRPC_HARNESS_VALIDATION_CODES,
  isValidGrpcHarnessTargetTemplate,
  summarizeGrpcHarnessScenarioValidation,
  validateGrpcHarnessCallActionConfig,
  validateGrpcHarnessScenario,
} from './grpcHarnessScenarioContracts';

function makeTest(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'contract-gap',
    name: 'Gap',
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

describe('grpcHarnessScenarioContracts coverage gaps', () => {
  it('rejects invalid target templates and literal addresses', () => {
    expect(isValidGrpcHarnessTargetTemplate('')).toBe(false);
    expect(isValidGrpcHarnessTargetTemplate('not-a-target')).toBe(false);
    expect(isValidGrpcHarnessTargetTemplate('{{grpcHost}}')).toBe(true);
  });

  it('rejects invalid tlsMode, timeout, and retry policy fields', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      tlsMode: 'invalid' as 'tls',
      timeoutMs: 0,
      retry: {
        maxAttempts: 0,
        backoffMs: -1,
        retryOnStatuses: [99],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_TLS_MODE)).toBe(true);
    expect(result.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_TIMEOUT)).toBe(true);
    expect(result.issues.filter((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_RETRY).length)
      .toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid collect and sendMessages shapes', () => {
    const collectBad = validateGrpcHarnessCallActionConfig({
      callType: 'server_streaming',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hi' },
      collect: { maxMessages: 0, maxDurationMs: -1 },
    });
    expect(collectBad.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_COLLECT_RULE))
      .toBe(true);

    const sendBad = validateGrpcHarnessCallActionConfig({
      callType: 'client_streaming',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'ClientStream',
      sendMessages: ['not-an-object' as unknown as Record<string, unknown>],
    });
    expect(sendBad.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_SEND_MESSAGES))
      .toBe(true);
  });

  it('rejects invalid auth and non-object unary body', () => {
    const authBad = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      auth: { type: 'bearer' },
    });
    expect(authBad.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_AUTH)).toBe(true);

    const bodyBad = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: [] as unknown as Record<string, unknown>,
    });
    expect(bodyBad.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_BODY)).toBe(true);
  });

  it('validates assertion shape errors across grpc* kinds', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'server_streaming',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'ServerStream',
      body: { message: 'hi' },
      collect: { maxMessages: 1 },
      assertions: [
        {},
        { grpcStatus: 0, grpcField: '$.message', equals: 'x' },
        { grpcStatus: 99 },
        { grpcField: '   ' },
        { grpcField: '$.message' },
        { grpcNumericField: '$.n', operator: '??' as '==', value: '' },
        { grpcStreamField: '$.n', index: -1, equals: 1 },
        { grpcStreamField: '$.n', index: 0 },
        { grpcTrailer: '   ' },
        { grpcTrailer: 'x-custom' },
        { grpcDuration: {} },
        { grpcStreamLength: {} },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.filter((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION).length)
      .toBeGreaterThanOrEqual(8);
  });

  it('rejects non-array assertions and summarizes validation text', () => {
    const scenario = makeTest({
      grpcCallAction: {
        callType: 'unary',
        target: '',
        descriptorKey: '',
        service: '',
        method: '',
        body: {},
        assertions: 'bad' as unknown as [],
      },
    });
    const result = validateGrpcHarnessScenario(scenario);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.field === 'grpcCallAction.assertions')).toBe(true);
    expect(summarizeGrpcHarnessScenarioValidation(scenario)).toContain('grpcCallAction.target');
  });

  it('rejects optional non-object body on client streaming', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'client_streaming',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'ClientStream',
      sendMessages: [{ message: 'one' }],
      body: [] as unknown as Record<string, unknown>,
    });
    expect(result.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_BODY)).toBe(true);
  });

  it('rejects invalid literal metadata values', () => {
    const result = validateGrpcHarnessCallActionConfig({
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      metadata: { 'x-custom-bin': 'not!!!base64' },
    });
    expect(result.issues.some((issue) => issue.code === GRPC_HARNESS_VALIDATION_CODES.INVALID_METADATA)).toBe(true);
  });
});
