import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import {
  applyJsonTextToSchema,
  bodiesAreJsonEquivalent,
  buildGrpcMessageSchemaIndex,
  findWideIntegralJsonViolations,
  parseGrpcBodyJson,
  serializeGrpcBodyJson,
} from './grpcBodyComposer';
import { syncBodyWithSchema } from './grpcProtoFormValues';

describe('grpcBodyComposer (Phase 1F)', () => {
  const schema = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!.requestSchema;

  it('serializes and parses JSON object bodies', () => {
    const body = { message: 'hello' };
    const text = serializeGrpcBodyJson(body);
    const parsed = parseGrpcBodyJson(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.body).toEqual(body);
    }
  });

  it('rejects non-object JSON', () => {
    expect(parseGrpcBodyJson('[]').ok).toBe(false);
    expect(parseGrpcBodyJson('"x"').ok).toBe(false);
  });

  it('syncs parsed JSON to schema without drift', () => {
    const synced = applyJsonTextToSchema('{ "message": "parity" }', schema);
    expect(synced.ok).toBe(true);
    if (synced.ok) {
      expect(synced.body).toEqual({ message: 'parity' });
      expect(bodiesAreJsonEquivalent(synced.body, syncBodyWithSchema({ message: 'parity' }, schema))).toBe(true);
    }
  });

  it('coerces unknown fields away during schema sync', () => {
    const synced = applyJsonTextToSchema('{ "message": "x", "extra": 1 }', schema);
    expect(synced.ok).toBe(true);
    if (synced.ok) {
      expect(synced.body).toEqual({ message: 'x' });
    }
  });

  it('rejects numeric JSON literals for int64 fields (OQ-8)', () => {
    const int64Schema = {
      typeName: 'demo.OrderRequest',
      fields: [
        { name: 'orderId', number: 1, type: 'int64' as const, label: 'optional' as const },
      ],
    };

    expect(findWideIntegralJsonViolations({ orderId: 42 }, int64Schema)).toMatch(/quoted decimal string/i);
    expect(findWideIntegralJsonViolations({ orderId: '9007199254740993' }, int64Schema)).toBeNull();

    const unsafe = applyJsonTextToSchema('{ "orderId": 9007199254740993 }', int64Schema);
    expect(unsafe.ok).toBe(false);
    if (!unsafe.ok) {
      expect(unsafe.error).toMatch(/quoted decimal string|safe integer/i);
    }

    const safe = applyJsonTextToSchema('{ "orderId": "9007199254740993" }', int64Schema);
    expect(safe.ok).toBe(true);
    if (safe.ok) {
      expect(safe.body).toEqual({ orderId: '9007199254740993' });
    }
  });

  it('allows numeric int64 literals when enforcement is disabled (form send path)', () => {
    const int64Schema = {
      typeName: 'demo.OrderRequest',
      fields: [
        { name: 'orderId', number: 1, type: 'int64' as const, label: 'optional' as const },
      ],
    };
    const synced = applyJsonTextToSchema('{ "orderId": 42 }', int64Schema, {
      enforceWideIntegralStringLiterals: false,
    });
    expect(synced.ok).toBe(true);
    if (synced.ok) {
      expect(synced.body).toEqual({ orderId: '42' });
    }
  });

  it('rejects unsafe int64 numbers even when enforcement is disabled', () => {
    const int64Schema = {
      typeName: 'demo.OrderRequest',
      fields: [
        { name: 'orderId', number: 1, type: 'int64' as const, label: 'optional' as const },
      ],
    };
    const unsafe = applyJsonTextToSchema('{ "orderId": 9007199254740993 }', int64Schema, {
      enforceWideIntegralStringLiterals: false,
    });
    expect(unsafe.ok).toBe(false);
    if (!unsafe.ok) {
      expect(unsafe.error).toMatch(/safe integer/i);
    }
  });

  it('rejects invalid wide integral decimal strings', () => {
    const uint64Schema = {
      typeName: 'demo.OrderRequest',
      fields: [
        { name: 'orderId', number: 1, type: 'uint64' as const, label: 'optional' as const },
      ],
    };
    const invalid = applyJsonTextToSchema('{ "orderId": "-1" }', uint64Schema);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toMatch(/not a valid uint64 decimal string/i);
    }
  });

  it('validates nested int64 fields when messageTypes index is provided', () => {
    const innerSchema = {
      typeName: 'demo.Inner',
      fields: [
        { name: 'id', number: 1, type: 'int64' as const, label: 'optional' as const },
      ],
    };
    const outerSchema = {
      typeName: 'demo.Outer',
      fields: [
        {
          name: 'inner',
          number: 1,
          type: 'message' as const,
          label: 'optional' as const,
          messageTypeName: 'demo.Inner',
        },
      ],
    };
    const violation = findWideIntegralJsonViolations(
      { inner: { id: 42 } },
      outerSchema,
      buildGrpcMessageSchemaIndex([innerSchema, outerSchema]),
    );
    expect(violation).toMatch(/inner\.id.*quoted decimal string/i);
  });

  it('coerces nested int64 numbers to strings when enforcement is disabled (OQ-8)', () => {
    const innerSchema = {
      typeName: 'demo.Inner',
      fields: [
        { name: 'id', number: 1, type: 'int64' as const, label: 'optional' as const },
      ],
    };
    const outerSchema = {
      typeName: 'demo.Outer',
      fields: [
        {
          name: 'inner',
          number: 1,
          type: 'message' as const,
          label: 'optional' as const,
          messageTypeName: 'demo.Inner',
        },
      ],
    };
    const synced = applyJsonTextToSchema(
      '{ "inner": { "id": 42 } }',
      outerSchema,
      {
        enforceWideIntegralStringLiterals: false,
        messageTypes: [innerSchema, outerSchema],
      },
    );
    expect(synced.ok).toBe(true);
    if (synced.ok) {
      expect(synced.body).toEqual({ inner: { id: '42' } });
    }
  });

  it('rejects nested int64 numeric literals in strict JSON mode when messageTypes is provided', () => {
    const innerSchema = {
      typeName: 'demo.Inner',
      fields: [
        { name: 'id', number: 1, type: 'int64' as const, label: 'optional' as const },
      ],
    };
    const outerSchema = {
      typeName: 'demo.Outer',
      fields: [
        {
          name: 'inner',
          number: 1,
          type: 'message' as const,
          label: 'optional' as const,
          messageTypeName: 'demo.Inner',
        },
      ],
    };
    const invalid = applyJsonTextToSchema(
      '{ "inner": { "id": 42 } }',
      outerSchema,
      { messageTypes: [innerSchema, outerSchema] },
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toMatch(/inner\.id.*quoted decimal string/i);
    }
  });
});
