import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import {
  buildBodyFromSchema,
  coerceGrpcFieldValue,
  defaultValueForGrpcField,
  groupMessageFields,
  isGrpcWellKnownFieldType,
  isGrpcWrapperWkt,
  isValidWideIntegralString,
  isWideIntegralFieldType,
  resolveActiveOneofMember,
  setGrpcBodyField,
  setGrpcOneofMember,
  syncBodyWithSchema,
  wktFieldBadgeLabel,
} from './grpcProtoFormValues';

describe('grpcProtoFormValues coverage gaps', () => {
  const schema = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!.requestSchema;

  it('defaultValueForGrpcField covers scalar, enum, message, map, and repeated defaults', () => {
    expect(defaultValueForGrpcField({ name: 'b', number: 1, type: 'bool', label: 'optional' })).toBe(false);
    expect(defaultValueForGrpcField({ name: 's', number: 2, type: 'string', label: 'optional' })).toBe('');
    expect(defaultValueForGrpcField({ name: 'i', number: 3, type: 'int32', label: 'optional' })).toBe(0);
    expect(defaultValueForGrpcField({ name: 'f', number: 4, type: 'float', label: 'optional' })).toBe(0);
    expect(defaultValueForGrpcField({
      name: 'e',
      number: 5,
      type: 'enum',
      label: 'optional',
      enumValues: [{ name: 'A', number: 7 }],
    })).toBe(7);
    expect(defaultValueForGrpcField({ name: 'm', number: 6, type: 'message', label: 'optional' })).toEqual({});
    expect(defaultValueForGrpcField({
      name: 'map',
      number: 7,
      type: 'string',
      label: 'optional',
      isMap: true,
      mapKeyType: 'string',
    })).toEqual({});
    expect(defaultValueForGrpcField({ name: 'r', number: 8, type: 'string', label: 'repeated' })).toEqual([]);
    expect(defaultValueForGrpcField({ name: 'x', number: 9, type: 'bytes', label: 'optional' })).toBe('');
  });

  it('buildBodyFromSchema seeds first oneof member and regular fields', () => {
    const oneofSchema = {
      typeName: 'demo.OneofRequest',
      fields: [
        { name: 'plain', number: 1, type: 'string' as const, label: 'optional' as const },
        { name: 'name', number: 2, type: 'string' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'payload' },
        { name: 'id', number: 3, type: 'int32' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'payload' },
      ],
    };
    expect(buildBodyFromSchema(oneofSchema)).toEqual({ plain: '', name: '' });
  });

  it('resolveActiveOneofMember returns null when no member is present', () => {
    const members = [
      { name: 'name', number: 1, type: 'string' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'pick' },
      { name: 'id', number: 2, type: 'int32' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'pick' },
    ];
    expect(resolveActiveOneofMember(members, {})).toBeNull();
    expect(resolveActiveOneofMember(members, { name: 'alice', id: 3 })).toBe('id');
  });

  it('groupMessageFields treats oneof members without oneofName as regular fields', () => {
    const grouped = groupMessageFields([
      { name: 'orphan', number: 1, type: 'string' as const, label: 'optional' as const, isOneofMember: true },
    ]);
    expect(grouped.regular).toHaveLength(1);
    expect(grouped.oneofGroups.size).toBe(0);
  });

  it('coerces repeated, map, message, bool, enum, and numeric edge cases', () => {
    const repeatedField = { name: 'tags', number: 1, type: 'string' as const, label: 'repeated' as const };
    expect(coerceGrpcFieldValue(repeatedField, 'not-array')).toEqual([]);
    expect(coerceGrpcFieldValue(repeatedField, ['a', 1])).toEqual(['a', '1']);

    const mapField = {
      name: 'labels',
      number: 2,
      type: 'string' as const,
      label: 'optional' as const,
      isMap: true,
      mapKeyType: 'string' as const,
    };
    expect(coerceGrpcFieldValue(mapField, null)).toEqual({});
    expect(coerceGrpcFieldValue(mapField, { a: '1' })).toEqual({ a: '1' });

    const messageField = { name: 'nested', number: 3, type: 'message' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(messageField, null)).toEqual({});
    expect(coerceGrpcFieldValue(messageField, { ok: true })).toEqual({ ok: true });

    const boolField = { name: 'enabled', number: 4, type: 'bool' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(boolField, 'true')).toBe(true);
    expect(coerceGrpcFieldValue(boolField, 'false')).toBe(false);

    const enumField = {
      name: 'state',
      number: 5,
      type: 'enum' as const,
      label: 'optional' as const,
      enumValues: [{ name: 'ACTIVE', number: 1 }, { name: 'INACTIVE', number: 2 }],
    };
    expect(coerceGrpcFieldValue(enumField, 'ACTIVE')).toBe(1);
    expect(coerceGrpcFieldValue(enumField, 'missing')).toBe(1);

    const intField = { name: 'count', number: 6, type: 'int32' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(intField, 'not-a-number')).toBe(0);

    const floatField = { name: 'ratio', number: 7, type: 'double' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(floatField, 'bad')).toBe(0);
  });

  it('syncBodyWithSchema handles non-object input', () => {
    expect(syncBodyWithSchema(null, schema)).toEqual({ message: '' });
  });

  it('setGrpcBodyField and setGrpcOneofMember update nested body state', () => {
    expect(setGrpcBodyField({ message: 'hi' }, 'message', 'bye')).toEqual({ message: 'bye' });

    const members = [
      { name: 'name', number: 1, type: 'string' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'pick' },
      { name: 'id', number: 2, type: 'int32' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'pick' },
    ];
    expect(setGrpcOneofMember({ name: 'old', id: 1 }, members, 'name', 'alice')).toEqual({ name: 'alice' });
  });

  it('coerces scalar branches for bool, string null, enum number, and integral/float types', () => {
    const boolField = { name: 'enabled', number: 1, type: 'bool' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(boolField, true)).toBe(true);
    expect(coerceGrpcFieldValue(boolField, 0)).toBe(false);

    const stringField = { name: 'label', number: 2, type: 'string' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(stringField, null)).toBe('');

    const enumField = {
      name: 'state',
      number: 3,
      type: 'enum' as const,
      label: 'optional' as const,
      enumValues: [{ name: 'ACTIVE', number: 2 }],
    };
    expect(coerceGrpcFieldValue(enumField, 2)).toBe(2);

    const intField = { name: 'count', number: 4, type: 'int64' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(intField, '42')).toBe('42');

    const floatField = { name: 'ratio', number: 5, type: 'float' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(floatField, '1.5')).toBe(1.5);
  });

  it('syncBodyWithSchema uses defaults for missing regular fields', () => {
    expect(syncBodyWithSchema({}, schema)).toEqual({ message: '' });
    expect(syncBodyWithSchema([], schema)).toEqual({ message: '' });
  });

  it('coerces map entries when raw map value is an array', () => {
    const mapField = {
      name: 'labels',
      number: 1,
      type: 'string' as const,
      label: 'optional' as const,
      isMap: true,
      mapKeyType: 'string' as const,
    };
    expect(coerceGrpcFieldValue(mapField, ['not', 'a', 'map'])).toEqual({});
  });

  it('coerces repeated message items and unknown scalar types via default branch', () => {
    const repeatedMessage = {
      name: 'items',
      number: 1,
      type: 'message' as const,
      label: 'repeated' as const,
    };
    expect(coerceGrpcFieldValue(repeatedMessage, [{ ok: true }])).toEqual([{ ok: true }]);

    const unknownField = { name: 'raw', number: 2, type: 'bytes' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(unknownField, 42)).toBe('42');
  });

  it('syncBodyWithSchema picks first oneof member when none are active', () => {
    const oneofSchema = {
      typeName: 'demo.OneofRequest',
      fields: [
        { name: 'name', number: 1, type: 'string' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'payload' },
        { name: 'id', number: 2, type: 'int32' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'payload' },
      ],
    };
    expect(syncBodyWithSchema({}, oneofSchema)).toEqual({ name: '' });
  });

  it('defaultValueForGrpcField covers well-known types and integral defaults', () => {
    const cases: Array<{ type: import('../../../shared/grpc/contracts').GrpcFieldSchema['type']; expected: unknown }> = [
      { type: 'google.protobuf.Timestamp', expected: expect.any(String) },
      { type: 'google.protobuf.Duration', expected: '0s' },
      { type: 'google.protobuf.BoolValue', expected: { value: false } },
      { type: 'google.protobuf.StringValue', expected: { value: '' } },
      { type: 'google.protobuf.Int32Value', expected: { value: 0 } },
      { type: 'google.protobuf.Int64Value', expected: { value: '0' } },
      { type: 'google.protobuf.Any', expected: { '@type': 'type.googleapis.com/' } },
      { type: 'google.protobuf.Struct', expected: {} },
      { type: 'google.protobuf.Value', expected: {} },
      { type: 'uint64', expected: '0' },
      { type: 'fixed64', expected: '0' },
      { type: 'float', expected: 0 },
      { type: 'enum', expected: 7 },
    ];
    for (const { type, expected } of cases) {
      expect(defaultValueForGrpcField({
        name: 'f',
        number: 1,
        type,
        label: 'optional',
        enumValues: [{ name: 'A', number: 7 }],
      })).toEqual(expected);
    }
    expect(defaultValueForGrpcField({
      name: 'f',
      number: 1,
      type: 'unknown' as 'string',
      label: 'optional',
    })).toBeNull();
  });

  it('isValidWideIntegralString distinguishes signed and unsigned wide types', () => {
    expect(isValidWideIntegralString('', 'int64')).toBe(true);
    expect(isValidWideIntegralString('42', 'uint64')).toBe(true);
    expect(isValidWideIntegralString('-1', 'uint64')).toBe(false);
    expect(isValidWideIntegralString('-42', 'int64')).toBe(true);
    expect(isValidWideIntegralString('abc', 'fixed64')).toBe(false);
    expect(isWideIntegralFieldType('uint32')).toBe(false);
    expect(isWideIntegralFieldType('sint64')).toBe(true);
  });

  it('wkt helpers classify well-known wrapper types', () => {
    expect(isGrpcWellKnownFieldType('google.protobuf.StringValue')).toBe(true);
    expect(isGrpcWellKnownFieldType('string')).toBe(false);
    expect(isGrpcWrapperWkt('google.protobuf.Int64Value')).toBe(true);
    expect(isGrpcWrapperWkt('google.protobuf.Timestamp')).toBe(false);
    expect(wktFieldBadgeLabel('google.protobuf.Duration')).toBe('Duration');
    expect(wktFieldBadgeLabel('int32')).toBe('int32');
  });

  it('coerces well-known wrapper and struct field values', () => {
    const ts = { name: 'ts', number: 1, type: 'google.protobuf.Timestamp' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(ts, null)).toBe('');
    expect(coerceGrpcFieldValue(ts, '2020-01-01T00:00:00.000Z')).toBe('2020-01-01T00:00:00.000Z');

    const dur = { name: 'dur', number: 2, type: 'google.protobuf.Duration' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(dur, '5s')).toBe('5s');

    const boolWkt = { name: 'b', number: 3, type: 'google.protobuf.BoolValue' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(boolWkt, { value: 'true' })).toEqual({ value: true });
    expect(coerceGrpcFieldValue(boolWkt, null)).toEqual({ value: false });

    const strWkt = { name: 's', number: 4, type: 'google.protobuf.StringValue' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(strWkt, { value: 'hi' })).toEqual({ value: 'hi' });
    expect(coerceGrpcFieldValue(strWkt, {})).toEqual({ value: '' });

    const i32Wkt = { name: 'i', number: 5, type: 'google.protobuf.Int32Value' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(i32Wkt, { value: '7' })).toEqual({ value: 7 });
    expect(coerceGrpcFieldValue(i32Wkt, { value: 'bad' })).toEqual({ value: 0 });

    const i64Wkt = { name: 'l', number: 6, type: 'google.protobuf.Int64Value' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(i64Wkt, { value: '9007199254740993' })).toEqual({ value: '9007199254740993' });

    const anyField = { name: 'a', number: 7, type: 'google.protobuf.Any' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(anyField, null)).toEqual({ '@type': 'type.googleapis.com/' });
    expect(coerceGrpcFieldValue(anyField, { '@type': 't', value: 'x' })).toEqual({ '@type': 't', value: 'x' });

    const structField = { name: 'st', number: 8, type: 'google.protobuf.Struct' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(structField, [])).toEqual({});
    expect(coerceGrpcFieldValue(structField, { k: 1 })).toEqual({ k: 1 });
  });

  it('coerces wide integrals via safe integer fallback and uint64 validation', () => {
    const uint64 = { name: 'u', number: 1, type: 'uint64' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(uint64, 'not-a-number')).toBe('0');
    expect(coerceGrpcFieldValue(uint64, 42)).toBe('42');
    expect(coerceGrpcFieldValue(uint64, -1)).toBe('-1');

    const fixed64 = { name: 'f', number: 2, type: 'fixed64' as const, label: 'optional' as const };
    expect(coerceGrpcFieldValue(fixed64, '')).toBe('0');

    const repeatedInt64 = { name: 'ids', number: 3, type: 'int64' as const, label: 'repeated' as const };
    expect(coerceGrpcFieldValue(repeatedInt64, 'not-array')).toEqual([]);
  });

  it('preserves raw values for unrecognized scalar types in the default branch', () => {
    const exotic = {
      name: 'meta',
      number: 1,
      type: 'google.protobuf.Empty' as import('../../../shared/grpc/contracts').GrpcFieldSchema['type'],
      label: 'optional' as const,
    };
    expect(coerceGrpcFieldValue(exotic, 'preserve-me')).toBe('preserve-me');
    expect(coerceGrpcFieldValue(exotic, null)).toBeNull();
  });

  it('resolveActiveOneofMember ignores null members and syncs active oneof from source', () => {
    const members = [
      { name: 'name', number: 1, type: 'string' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'payload' },
      { name: 'id', number: 2, type: 'int32' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'payload' },
    ];
    expect(resolveActiveOneofMember(members, { name: null, id: 5 })).toBe('id');

    const oneofSchema = {
      typeName: 'demo.OneofRequest',
      fields: members,
    };
    expect(syncBodyWithSchema({ id: 9 }, oneofSchema)).toEqual({ id: 9 });
    expect(buildBodyFromSchema(oneofSchema)).toEqual({ name: '' });
  });

  it('groupMessageFields treats oneof members without oneofName as regular fields', () => {
    const grouped = groupMessageFields([
      { name: 'orphan', number: 1, type: 'string' as const, label: 'optional' as const, isOneofMember: true },
    ]);
    expect(grouped.regular).toHaveLength(1);
    expect(grouped.oneofGroups.size).toBe(0);
  });
});
