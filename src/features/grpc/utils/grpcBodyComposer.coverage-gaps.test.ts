/**
 * Coverage gaps — grpcBodyComposer.ts
 */
import { describe, expect, it } from 'vitest';
import type { GrpcFieldSchema, GrpcMessageSchema } from '@shared/grpc/contracts';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import {
  applyJsonTextToSchema,
  bodiesAreJsonEquivalent,
  buildGrpcMessageSchemaIndex,
  findWideIntegralJsonViolations,
  parseGrpcBodyJson,
  resolveNestedMessageSchema,
  serializeGrpcBodyJson,
} from './grpcBodyComposer';

const INT64_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.Int64Request',
  fields: [{ name: 'id', number: 1, type: 'int64', label: 'optional' }],
};

const NESTED_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.NestedRequest',
  fields: [{
    name: 'payload',
    number: 1,
    type: 'message',
    label: 'optional',
    messageTypeName: 'demo.Payload',
  }],
};

const PAYLOAD_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.Payload',
  fields: [{ name: 'token', number: 1, type: 'uint64', label: 'optional' }],
};

describe('grpcBodyComposer coverage gaps', () => {
  it('parseGrpcBodyJson treats whitespace-only text as empty object', () => {
    const parsed = parseGrpcBodyJson('   \n  ');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.body).toEqual({});
    }
  });

  it('parseGrpcBodyJson surfaces non-Error parse failures', () => {
    const original = JSON.parse;
    JSON.parse = () => {
      throw 'broken';
    };
    try {
      const parsed = parseGrpcBodyJson('{');
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) {
        expect(parsed.error).toBe('Invalid JSON');
      }
    } finally {
      JSON.parse = original;
    }
  });

  it('parseGrpcBodyJson rejects null JSON values', () => {
    expect(parseGrpcBodyJson('null').ok).toBe(false);
  });

  it('applyJsonTextToSchema propagates parse failures', () => {
    const schema = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!.requestSchema;
    const result = applyJsonTextToSchema('[', schema);
    expect(result.ok).toBe(false);
  });

  it('buildGrpcMessageSchemaIndex indexes full and short type names', () => {
    expect(buildGrpcMessageSchemaIndex(undefined)).toBeUndefined();
    expect(buildGrpcMessageSchemaIndex([])).toBeUndefined();

    const index = buildGrpcMessageSchemaIndex([PAYLOAD_SCHEMA, NESTED_SCHEMA]);
    expect(index?.get('demo.Payload')).toBe(PAYLOAD_SCHEMA);
    expect(index?.get('Payload')).toBe(PAYLOAD_SCHEMA);
    expect(index?.get('demo.NestedRequest')).toBe(NESTED_SCHEMA);
  });

  it('resolveNestedMessageSchema returns undefined without index or message type', () => {
    const field: GrpcFieldSchema = {
      name: 'payload',
      number: 1,
      type: 'message',
      label: 'optional',
    };
    expect(resolveNestedMessageSchema(field, undefined)).toBeUndefined();
    expect(resolveNestedMessageSchema({ ...field, type: 'string' }, new Map())).toBeUndefined();
  });

  it('serializeGrpcBodyJson and bodiesAreJsonEquivalent compare normalized JSON', () => {
    const left = { a: 1, b: 'x' };
    const right = { a: 1, b: 'x' };
    expect(serializeGrpcBodyJson(left)).toContain('\n');
    expect(bodiesAreJsonEquivalent(left, right)).toBe(true);
    expect(bodiesAreJsonEquivalent(left, { a: 2, b: 'x' })).toBe(false);
  });

  it('findWideIntegralJsonViolations rejects unsafe integer literals', () => {
    const violation = findWideIntegralJsonViolations(
      { id: Number.MAX_SAFE_INTEGER + 100 },
      INT64_SCHEMA,
      undefined,
      { strictStringLiterals: false },
    );
    expect(violation).toMatch(/safe integer range/i);
  });

  it('findWideIntegralJsonViolations enforces quoted strings in strict mode', () => {
    const violation = findWideIntegralJsonViolations(
      { id: 42 },
      INT64_SCHEMA,
      undefined,
      { strictStringLiterals: true },
    );
    expect(violation).toMatch(/quoted decimal string/i);
  });

  it('findWideIntegralJsonViolations allows safe integers when strict mode is off', () => {
    expect(findWideIntegralJsonViolations(
      { id: 42 },
      INT64_SCHEMA,
      undefined,
      { strictStringLiterals: false },
    )).toBeNull();
  });

  it('findWideIntegralJsonViolations rejects invalid uint64 strings', () => {
    const schema: GrpcMessageSchema = {
      typeName: 'demo.UintRequest',
      fields: [{ name: 'token', number: 1, type: 'uint64', label: 'optional' }],
    };
    const violation = findWideIntegralJsonViolations({ token: '-1' }, schema);
    expect(violation).toMatch(/not a valid uint64/i);
  });

  it('findWideIntegralJsonViolations walks nested messages, maps, and repeated fields', () => {
    const index = buildGrpcMessageSchemaIndex([PAYLOAD_SCHEMA, NESTED_SCHEMA])!;
    const mapSchema: GrpcMessageSchema = {
      typeName: 'demo.MapRequest',
      fields: [{
        name: 'byKey',
        number: 1,
        type: 'message',
        label: 'optional',
        isMap: true,
        mapKeyType: 'string',
        messageTypeName: 'demo.Payload',
      }],
    };
    const repeatedSchema: GrpcMessageSchema = {
      typeName: 'demo.RepeatedRequest',
      fields: [{
        name: 'items',
        number: 1,
        type: 'message',
        label: 'repeated',
        messageTypeName: 'demo.Payload',
      }],
    };
    const oneofSchema: GrpcMessageSchema = {
      typeName: 'demo.OneofRequest',
      fields: [
        { name: 'nested', number: 1, type: 'message', label: 'optional', isOneofMember: true, oneofName: 'pick', messageTypeName: 'demo.Payload' },
        { name: 'id', number: 2, type: 'int64', label: 'optional', isOneofMember: true, oneofName: 'pick' },
      ],
    };

    expect(findWideIntegralJsonViolations(
      { payload: { token: 42 } },
      NESTED_SCHEMA,
      index,
    )).toMatch(/token.*quoted decimal string/i);

    expect(findWideIntegralJsonViolations(
      { byKey: { a: { token: '-1' } } },
      mapSchema,
      index,
    )).toMatch(/token/);

    expect(findWideIntegralJsonViolations(
      { items: [{ token: 42 }] },
      repeatedSchema,
      index,
      { strictStringLiterals: true },
    )).toMatch(/items\[0\]/);

    expect(findWideIntegralJsonViolations(
      { nested: { token: 42 } },
      oneofSchema,
      index,
    )).toMatch(/nested\.token.*quoted decimal string/i);
  });

  it('findWideIntegralJsonViolations validates google.protobuf.Int64Value wrappers', () => {
    const schema: GrpcMessageSchema = {
      typeName: 'demo.WrapperRequest',
      fields: [{ name: 'count', number: 1, type: 'google.protobuf.Int64Value', label: 'optional' }],
    };
    expect(findWideIntegralJsonViolations(
      { count: { value: 42 } },
      schema,
    )).toMatch(/count\.value.*quoted decimal string/i);
    expect(findWideIntegralJsonViolations({ count: 'not-an-object' }, schema)).toBeNull();
    expect(findWideIntegralJsonViolations({ count: { value: '42' } }, schema)).toBeNull();
    expect(findWideIntegralJsonViolations(
      { count: { value: '9007199254740993' } },
      schema,
    )).toBeNull();
  });

  it('applyJsonTextToSchema rejects wide integral violations and syncs valid bodies', () => {
    const bad = applyJsonTextToSchema('{"id": 9007199254740993}', INT64_SCHEMA);
    expect(bad.ok).toBe(false);

    const good = applyJsonTextToSchema(
      '{"id": "42"}',
      INT64_SCHEMA,
      { enforceWideIntegralStringLiterals: false, messageTypes: [INT64_SCHEMA] },
    );
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.body).toEqual({ id: '42' });
    }
  });

  it('findWideIntegralJsonViolations validates scalar map and repeated int64 fields', () => {
    const mapSchema: GrpcMessageSchema = {
      typeName: 'demo.Int64Map',
      fields: [{
        name: 'ids',
        number: 1,
        type: 'int64',
        label: 'optional',
        isMap: true,
        mapKeyType: 'string',
      }],
    };
    const repeatedSchema: GrpcMessageSchema = {
      typeName: 'demo.RepeatedInt64',
      fields: [{ name: 'ids', number: 1, type: 'int64', label: 'repeated' }],
    };

    expect(findWideIntegralJsonViolations(
      { ids: { a: 42 } },
      mapSchema,
      undefined,
      { strictStringLiterals: true },
    )).toMatch(/ids\.a/);

    expect(findWideIntegralJsonViolations(
      { ids: [42] },
      repeatedSchema,
      undefined,
      { strictStringLiterals: true },
    )).toMatch(/ids\[0\]/);

    expect(findWideIntegralJsonViolations({ ids: null }, mapSchema)).toBeNull();
    expect(findWideIntegralJsonViolations({ ids: 'not-array' }, repeatedSchema)).toBeNull();
    expect(findWideIntegralJsonViolations({ ids: { a: '42' } }, mapSchema)).toBeNull();
    expect(findWideIntegralJsonViolations({ ids: ['9007199254740993'] }, repeatedSchema)).toBeNull();
  });

  it('findWideIntegralJsonViolations skips non-object map and repeated entries without nested schema', () => {
    const mapSchema: GrpcMessageSchema = {
      typeName: 'demo.MessageMap',
      fields: [{
        name: 'payloads',
        number: 1,
        type: 'message',
        label: 'optional',
        isMap: true,
        mapKeyType: 'string',
        messageTypeName: 'demo.Payload',
      }],
    };
    const repeatedSchema: GrpcMessageSchema = {
      typeName: 'demo.RepeatedMessage',
      fields: [{
        name: 'items',
        number: 1,
        type: 'message',
        label: 'repeated',
        messageTypeName: 'demo.Payload',
      }],
    };
    const index = buildGrpcMessageSchemaIndex([PAYLOAD_SCHEMA])!;

    expect(findWideIntegralJsonViolations(
      { payloads: { a: 'scalar', b: { token: '1' } } },
      mapSchema,
      index,
    )).toBeNull();

    expect(findWideIntegralJsonViolations(
      { items: ['scalar', { token: '1' }] },
      repeatedSchema,
      index,
    )).toBeNull();
  });

  it('applyJsonTextToSchema normalizes nested map, repeated, message, and oneof bodies', () => {
    const payloadSchema: GrpcMessageSchema = {
      typeName: 'demo.Payload',
      fields: [{ name: 'token', number: 1, type: 'int64', label: 'optional' }],
    };
    const outerSchema: GrpcMessageSchema = {
      typeName: 'demo.Outer',
      fields: [{ name: 'payload', number: 1, type: 'message', label: 'optional', messageTypeName: 'demo.Payload' }],
    };
    const mapSchema: GrpcMessageSchema = {
      typeName: 'demo.MapOuter',
      fields: [{
        name: 'byKey',
        number: 1,
        type: 'message',
        label: 'optional',
        isMap: true,
        mapKeyType: 'string',
        messageTypeName: 'demo.Payload',
      }],
    };
    const repeatedSchema: GrpcMessageSchema = {
      typeName: 'demo.RepeatedOuter',
      fields: [{
        name: 'items',
        number: 1,
        type: 'message',
        label: 'repeated',
        messageTypeName: 'demo.Payload',
      }],
    };
    const oneofSchema: GrpcMessageSchema = {
      typeName: 'demo.OneofOuter',
      fields: [
        { name: 'nested', number: 1, type: 'message', label: 'optional', isOneofMember: true, oneofName: 'pick', messageTypeName: 'demo.Payload' },
        { name: 'id', number: 2, type: 'int64', label: 'optional', isOneofMember: true, oneofName: 'pick' },
      ],
    };
    const messageTypes = [payloadSchema, outerSchema, mapSchema, repeatedSchema, oneofSchema];

    const nested = applyJsonTextToSchema('{"payload": {"token": "42"}}', outerSchema, { messageTypes });
    expect(nested.ok).toBe(true);
    if (nested.ok) expect(nested.body).toEqual({ payload: { token: '42' } });

    const mapped = applyJsonTextToSchema('{"byKey": {"a": {"token": "7"}}}', mapSchema, { messageTypes });
    expect(mapped.ok).toBe(true);
    if (mapped.ok) expect(mapped.body).toEqual({ byKey: { a: { token: '7' } } });

    const repeated = applyJsonTextToSchema('{"items": [{"token": "9"}]}', repeatedSchema, { messageTypes });
    expect(repeated.ok).toBe(true);
    if (repeated.ok) expect(repeated.body).toEqual({ items: [{ token: '9' }] });

    const oneof = applyJsonTextToSchema('{"nested": {"token": "3"}}', oneofSchema, { messageTypes });
    expect(oneof.ok).toBe(true);
    if (oneof.ok) expect(oneof.body).toEqual({ nested: { token: '3' } });
  });

  it('applyJsonTextToSchema skips nested normalization when message types are omitted', () => {
    const outerSchema: GrpcMessageSchema = {
      typeName: 'demo.Outer',
      fields: [{ name: 'payload', number: 1, type: 'message', label: 'optional', messageTypeName: 'demo.Payload' }],
    };
    const result = applyJsonTextToSchema('{"payload": {"token": 42}}', outerSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toEqual({ payload: { token: 42 } });
    }
  });
});
