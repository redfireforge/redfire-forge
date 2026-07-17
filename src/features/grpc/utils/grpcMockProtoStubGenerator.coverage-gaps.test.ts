import { describe, expect, it } from 'vitest';
import type { GrpcDescriptor, GrpcFieldSchema } from '../../../shared/grpc/contracts';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { generateMockRuleStubsFromDescriptor } from './grpcMockProtoStubGenerator';

function buildDescriptor(
  responseFields: GrpcFieldSchema[],
  methodName = 'Probe',
  serviceName = 'demo.ProbeService',
): GrpcDescriptor {
  return {
    source: 'proto_files',
    key: `stub:${methodName}`,
    services: [
      {
        fullName: serviceName,
        methods: [
          {
            name: methodName,
            callType: 'unary',
            requestTypeName: 'demo.ProbeRequest',
            responseTypeName: 'demo.ProbeResponse',
            requestSchema: { typeName: 'demo.ProbeRequest', fields: [] },
            responseSchema: { typeName: 'demo.ProbeResponse', fields: responseFields },
          },
        ],
      },
    ],
  };
}

describe('grpcMockProtoStubGenerator coverage gaps', () => {
  it('generates one rule per FIXTURE_DESCRIPTOR RPC with method_equals predicate', () => {
    const generated = generateMockRuleStubsFromDescriptor(FIXTURE_DESCRIPTOR, 5);

    expect(generated.serviceCount).toBe(1);
    expect(generated.methodCount).toBe(4);
    expect(generated.rules).toHaveLength(4);
    expect(generated.rules[0]?.priority).toBe(5);
    expect(generated.rules[0]?.name).toBe('echo.EchoService/BidiStream');
    expect(generated.rules[0]?.predicate).toMatchObject({
      type: 'leaf',
      kind: 'method_equals',
      method: 'BidiStream',
    });
    expect(generated.rules[0]?.responseStatusCode).toBe(0);

    const echoRule = generated.rules.find((rule) => rule.name.endsWith('/Echo'));
    const body = JSON.parse(echoRule?.responseBodyText ?? '{}') as Record<string, unknown>;
    expect(body.message).toBe('');
  });

  it('builds empty object body when response schema is missing or has no fields', () => {
    const emptySchema = buildDescriptor([]);
    expect(generateMockRuleStubsFromDescriptor(emptySchema).rules[0]?.responseBodyText).toBe('{}');

    const missingFieldsDescriptor = buildDescriptor([]);
    missingFieldsDescriptor.services[0]!.methods[0]!.responseSchema = {
      typeName: 'demo.EmptyMessage',
      fields: undefined as unknown as [],
    };
    expect(
      generateMockRuleStubsFromDescriptor(missingFieldsDescriptor).rules[0]?.responseBodyText,
    ).toBe('{}');

    const descriptor: GrpcDescriptor = {
      source: 'proto_files',
      key: 'no-schema',
      services: [
        {
          fullName: 'demo.NoSchemaService',
          methods: [
            {
              name: 'Ping',
              callType: 'unary',
              requestTypeName: 'demo.PingRequest',
              responseTypeName: 'demo.PingResponse',
              requestSchema: { typeName: 'demo.PingRequest', fields: [] },
              responseSchema: undefined,
            },
          ],
        },
      ],
    };
    expect(generateMockRuleStubsFromDescriptor(descriptor).rules[0]?.responseBodyText).toBe('{}');
  });

  it('stubs repeated fields as empty arrays and scalar types with defaults', () => {
    const descriptor = buildDescriptor([
      { name: 'tags', number: 1, type: 'string', label: 'repeated' },
      { name: 'active', number: 2, type: 'bool', label: 'optional' },
      { name: 'count', number: 3, type: 'int64', label: 'optional' },
      { name: 'ratio', number: 4, type: 'double', label: 'optional' },
      { name: 'payload', number: 5, type: 'bytes', label: 'optional' },
      { name: 'nested', number: 6, type: 'message', label: 'optional' },
      { name: 'unknown', number: 7, type: 'custom' as GrpcFieldSchema['type'], label: 'optional' },
    ]);

    const body = JSON.parse(
      generateMockRuleStubsFromDescriptor(descriptor).rules[0]?.responseBodyText ?? '{}',
    ) as Record<string, unknown>;

    expect(body.tags).toEqual([]);
    expect(body.active).toBe(false);
    expect(body.count).toBe(0);
    expect(body.ratio).toBe(0);
    expect(body.payload).toBe('');
    expect(body.nested).toEqual({});
    expect(body.unknown).toBeNull();
  });

  it('covers additional numeric types and READY/ACTIVE enum preference', () => {
    const numericDescriptor = buildDescriptor([
      { name: 'u32', number: 1, type: 'uint32', label: 'optional' },
      { name: 'flt', number: 2, type: 'float', label: 'optional' },
      { name: 'sfixed', number: 3, type: 'sfixed64', label: 'optional' },
    ]);
    const readyDescriptor = buildDescriptor([
      {
        name: 'phase',
        number: 1,
        type: 'enum',
        label: 'optional',
        enumValues: [
          { name: 'BOOTING', number: 1 },
          { name: 'READY', number: 2 },
        ],
      },
    ]);
    const activeDescriptor = buildDescriptor([
      {
        name: 'state',
        number: 1,
        type: 'enum',
        label: 'optional',
        enumValues: [
          { name: 'IDLE', number: 1 },
          { name: 'ACTIVE', number: 2 },
        ],
      },
    ]);

    const numericBody = JSON.parse(
      generateMockRuleStubsFromDescriptor(numericDescriptor).rules[0]?.responseBodyText ?? '{}',
    ) as Record<string, unknown>;
    const readyBody = JSON.parse(
      generateMockRuleStubsFromDescriptor(readyDescriptor).rules[0]?.responseBodyText ?? '{}',
    ) as Record<string, unknown>;
    const activeBody = JSON.parse(
      generateMockRuleStubsFromDescriptor(activeDescriptor).rules[0]?.responseBodyText ?? '{}',
    ) as Record<string, unknown>;

    expect(numericBody.u32).toBe(0);
    expect(numericBody.flt).toBe(0);
    expect(numericBody.sfixed).toBe(0);
    expect(readyBody.phase).toBe('READY');
    expect(activeBody.state).toBe('ACTIVE');
  });

  it('prefers SUCCESS, OK, SERVING, READY, and ACTIVE enum values in order', () => {
    const successDescriptor = buildDescriptor([
      {
        name: 'status',
        number: 1,
        type: 'enum',
        label: 'optional',
        enumValues: [
          { name: 'UNKNOWN', number: 0 },
          { name: 'SUCCESS', number: 1 },
        ],
      },
    ]);
    const okDescriptor = buildDescriptor([
      {
        name: 'status',
        number: 1,
        type: 'enum',
        label: 'optional',
        enumValues: [
          { name: 'FAILED', number: 2 },
          { name: 'ok', number: 3 },
        ],
      },
    ]);
    const servingDescriptor = buildDescriptor([
      {
        name: 'status',
        number: 1,
        type: 'enum',
        label: 'optional',
        enumValues: [
          { name: 'UNKNOWN', number: 0 },
          { name: 'SERVING', number: 1 },
        ],
      },
    ]);

    const successBody = JSON.parse(
      generateMockRuleStubsFromDescriptor(successDescriptor).rules[0]?.responseBodyText ?? '{}',
    ) as Record<string, unknown>;
    const okBody = JSON.parse(
      generateMockRuleStubsFromDescriptor(okDescriptor).rules[0]?.responseBodyText ?? '{}',
    ) as Record<string, unknown>;
    const servingBody = JSON.parse(
      generateMockRuleStubsFromDescriptor(servingDescriptor).rules[0]?.responseBodyText ?? '{}',
    ) as Record<string, unknown>;

    expect(successBody.status).toBe('SUCCESS');
    expect(okBody.status).toBe('ok');
    expect(servingBody.status).toBe('SERVING');
  });

  it('falls back to first enum value or numeric zero when enum metadata is empty', () => {
    const firstDescriptor = buildDescriptor([
      {
        name: 'status',
        number: 1,
        type: 'enum',
        label: 'optional',
        enumValues: [
          { name: 'PENDING', number: 1 },
          { name: 'DONE', number: 2 },
        ],
      },
    ]);
    const emptyEnumDescriptor = buildDescriptor([
      {
        name: 'status',
        number: 1,
        type: 'enum',
        label: 'optional',
        enumValues: [],
      },
    ]);
    const missingEnumValuesDescriptor = buildDescriptor([
      {
        name: 'status',
        number: 1,
        type: 'enum',
        label: 'optional',
      },
    ]);

    const firstBody = JSON.parse(
      generateMockRuleStubsFromDescriptor(firstDescriptor).rules[0]?.responseBodyText ?? '{}',
    ) as Record<string, unknown>;
    const emptyBody = JSON.parse(
      generateMockRuleStubsFromDescriptor(emptyEnumDescriptor).rules[0]?.responseBodyText ?? '{}',
    ) as Record<string, unknown>;
    const missingValuesBody = JSON.parse(
      generateMockRuleStubsFromDescriptor(missingEnumValuesDescriptor).rules[0]?.responseBodyText ?? '{}',
    ) as Record<string, unknown>;

    expect(firstBody.status).toBe('PENDING');
    expect(emptyBody.status).toBe(0);
    expect(missingValuesBody.status).toBe(0);
  });

  it('increments priority across methods and honors custom start priority', () => {
    const generated = generateMockRuleStubsFromDescriptor(FIXTURE_DESCRIPTOR, 10);
    expect(generated.rules.map((rule) => rule.priority)).toEqual([10, 11, 12, 13]);
  });
});
