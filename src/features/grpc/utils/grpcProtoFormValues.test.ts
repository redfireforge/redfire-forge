import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import {
  buildBodyFromSchema,
  coerceGrpcFieldValue,
  groupMessageFields,
  isValidWideIntegralString,
  isWideIntegralFieldType,
  syncBodyWithSchema,
} from './grpcProtoFormValues';

describe('grpcProtoFormValues (Phase 1F)', () => {
  const schema = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!.requestSchema;
  const messageField = schema.fields[0]!;

  it('builds default body from schema', () => {
    expect(buildBodyFromSchema(schema)).toEqual({ message: '' });
  });

  it('coerces string field values', () => {
    expect(coerceGrpcFieldValue(messageField, 42)).toBe('42');
  });

  it('syncBodyWithSchema preserves known fields and drops unknown keys', () => {
    expect(syncBodyWithSchema({ message: 'hi', extra: true }, schema)).toEqual({ message: 'hi' });
  });

  it('groups oneof members separately from regular fields', () => {
    const fields = [
      { name: 'plain', number: 1, type: 'string' as const, label: 'optional' as const },
      { name: 'a', number: 2, type: 'string' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'pick' },
      { name: 'b', number: 3, type: 'int32' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'pick' },
    ];
    const grouped = groupMessageFields(fields);
    expect(grouped.regular).toHaveLength(1);
    expect(grouped.oneofGroups.get('pick')).toHaveLength(2);
  });

  it('coerces map fields to string-keyed objects', () => {
    const mapField = {
      name: 'counts',
      number: 1,
      type: 'int32' as const,
      label: 'optional' as const,
      isMap: true,
      mapKeyType: 'string' as const,
    };
    expect(coerceGrpcFieldValue(mapField, { alpha: '2', beta: 3 })).toEqual({ alpha: 2, beta: 3 });
  });

  it('syncBodyWithSchema keeps only the active oneof member', () => {
    const oneofSchema = {
      typeName: 'demo.OneofRequest',
      fields: [
        { name: 'name', number: 1, type: 'string' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'payload' },
        { name: 'id', number: 2, type: 'int32' as const, label: 'optional' as const, isOneofMember: true, oneofName: 'payload' },
      ],
    };
    expect(syncBodyWithSchema({ name: 'alice', id: 9 }, oneofSchema)).toEqual({ id: 9 });
  });

  it('preserves int64 values as decimal strings for JSON-safe precision (OQ-8)', () => {
    const int64Field = { name: 'orderId', number: 1, type: 'int64' as const, label: 'optional' as const };
    expect(isWideIntegralFieldType('int64')).toBe(true);
    expect(isValidWideIntegralString('9007199254740993', 'int64')).toBe(true);
    expect(coerceGrpcFieldValue(int64Field, 42)).toBe('42');
    expect(coerceGrpcFieldValue(int64Field, '9007199254740993')).toBe('9007199254740993');

    const schema = {
      typeName: 'demo.OrderRequest',
      fields: [int64Field],
    };
    expect(syncBodyWithSchema({ orderId: '9007199254740993' }, schema)).toEqual({
      orderId: '9007199254740993',
    });
    expect(buildBodyFromSchema(schema)).toEqual({ orderId: '0' });
  });

  it('defaults google.protobuf.Any with @type hint (OQ-7)', () => {
    const anyField = { name: 'payload', number: 1, type: 'google.protobuf.Any' as const, label: 'optional' as const };
    expect(buildBodyFromSchema({
      typeName: 'demo.AnyRequest',
      fields: [anyField],
    })).toEqual({
      payload: { '@type': 'type.googleapis.com/' },
    });
  });
});
