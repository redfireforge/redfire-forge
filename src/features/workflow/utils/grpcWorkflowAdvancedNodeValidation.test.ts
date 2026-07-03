import { describe, expect, it } from 'vitest';
import {
  validateGrpcLoadTestNodeData,
  validateGrpcMockAssertNodeData,
  validateGrpcSchemaDiffNodeData,
} from './grpcWorkflowAdvancedNodeValidation';

describe('grpcWorkflowAdvancedNodeValidation', () => {
  const baseLoadTestData = {
    label: 'Load',
    target: 'localhost:50051',
    descriptorKey: 'desc',
    service: 'echo.EchoService',
    method: 'Echo',
    callType: 'unary' as const,
    body: {},
    onError: 'fail' as const,
  };

  it('returns unary validation issues first when base unary data is invalid', () => {
    const result = validateGrpcLoadTestNodeData({
      ...baseLoadTestData,
      label: ' ',
    } as never, 'n1');

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.field === 'label')).toBe(true);
  });

  it('requires either inline loadTest config or profileId', () => {
    const result = validateGrpcLoadTestNodeData(baseLoadTestData as never, 'n2');
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.field).toBe('loadTest');
  });

  it('returns config validation errors when inline loadTest config is invalid', () => {
    const result = validateGrpcLoadTestNodeData({
      ...baseLoadTestData,
      loadTest: {
        concurrency: 0,
        totalCalls: 0,
      },
    } as never, 'n3');

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.field).toBe('loadTest');
    expect(result.issues[0]?.message.toLowerCase()).toContain('concurrency');
  });

  it('accepts profile-only load test references', () => {
    const result = validateGrpcLoadTestNodeData({
      ...baseLoadTestData,
      profileId: 'profile-1',
    } as never, 'n4');

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('validates schema diff required fields', () => {
    const invalid = validateGrpcSchemaDiffNodeData({
      label: ' ',
      leftDescriptorKey: ' ',
      rightDescriptorKey: '',
      failOnBreaking: true,
      onError: 'fail',
    } as never, 'sd1');

    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(['label', 'leftDescriptorKey', 'rightDescriptorKey']),
    );

    const valid = validateGrpcSchemaDiffNodeData({
      label: 'Schema Diff',
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      failOnBreaking: true,
      onError: 'continue',
    } as never, 'sd2');

    expect(valid.valid).toBe(true);
  });

  it('validates mock assert required fields and expected body dependencies', () => {
    const invalid = validateGrpcMockAssertNodeData({
      label: ' ',
      listenTarget: ' ',
      descriptorKey: '',
      service: ' ',
      method: '',
      expectedBodyPath: '$.message',
      onError: 'fail',
    } as never, 'ma1');

    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        'label',
        'listenTarget',
        'descriptorKey',
        'service',
        'method',
        'expectedBodyValue',
      ]),
    );

    const valid = validateGrpcMockAssertNodeData({
      label: 'Mock Assert',
      listenTarget: '127.0.0.1:50061',
      descriptorKey: 'desc',
      service: 'echo.EchoService',
      method: 'Echo',
      expectedBodyPath: '$.message',
      expectedBodyValue: 'ok',
      onError: 'continue',
    } as never, 'ma2');

    expect(valid.valid).toBe(true);
  });
});