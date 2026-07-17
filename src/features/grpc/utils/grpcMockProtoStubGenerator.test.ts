import { describe, expect, it } from 'vitest';
import type { GrpcDescriptor } from '../../../shared/grpc/contracts';
import { generateMockRuleStubsFromDescriptor } from './grpcMockProtoStubGenerator';

function buildDescriptorWithStatusEnum(enumValues: Array<{ name: string; number: number }>): GrpcDescriptor {
  return {
    source: 'proto_files',
    key: 'stub-test-descriptor',
    services: [
      {
        fullName: 'demo.StatusService',
        methods: [
          {
            name: 'GetStatus',
            callType: 'unary',
            requestTypeName: 'demo.GetStatusRequest',
            responseTypeName: 'demo.GetStatusResponse',
            requestSchema: {
              typeName: 'demo.GetStatusRequest',
              fields: [],
            },
            responseSchema: {
              typeName: 'demo.GetStatusResponse',
              fields: [
                {
                  name: 'status',
                  number: 1,
                  type: 'enum',
                  label: 'optional',
                  enumTypeName: 'demo.Status',
                  enumValues,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('grpcMockProtoStubGenerator', () => {
  it('prefers SUCCESS enum values over UNKNOWN defaults', () => {
    const descriptor = buildDescriptorWithStatusEnum([
      { name: 'UNKNOWN', number: 0 },
      { name: 'SUCCESS', number: 1 },
    ]);

    const generated = generateMockRuleStubsFromDescriptor(descriptor);
    const responseBody = JSON.parse(generated.rules[0]!.responseBodyText ?? '{}') as Record<string, unknown>;

    expect(responseBody.status).toBe('SUCCESS');
  });

  it('falls back to first enum value when no success-like value exists', () => {
    const descriptor = buildDescriptorWithStatusEnum([
      { name: 'UNKNOWN', number: 0 },
      { name: 'FAILED', number: 2 },
    ]);

    const generated = generateMockRuleStubsFromDescriptor(descriptor);
    const responseBody = JSON.parse(generated.rules[0]!.responseBodyText ?? '{}') as Record<string, unknown>;

    expect(responseBody.status).toBe('UNKNOWN');
  });
});
