import { describe, expect, it } from 'vitest';
import { buildDefaultGrpcBody } from './buildDefaultGrpcBody';
import type { GrpcMessageSchema } from '../../../shared/grpc/contracts';

describe('buildDefaultGrpcBody (Phase 1E)', () => {
  it('builds defaults for scalar and repeated fields', () => {
    const schema: GrpcMessageSchema = {
      typeName: 'demo.Request',
      fields: [
        { name: 'message', number: 1, type: 'string', label: 'optional' },
        { name: 'count', number: 2, type: 'int32', label: 'optional' },
        { name: 'enabled', number: 3, type: 'bool', label: 'optional' },
        { name: 'tags', number: 4, type: 'string', label: 'repeated' },
      ],
    };

    expect(buildDefaultGrpcBody(schema)).toEqual({
      message: '',
      count: 0,
      enabled: false,
      tags: [],
    });
  });

  it('uses first enum value number when available', () => {
    const schema: GrpcMessageSchema = {
      typeName: 'demo.EnumRequest',
      fields: [{
        name: 'status',
        number: 1,
        type: 'enum',
        label: 'optional',
        enumValues: [{ name: 'UNKNOWN', number: 0 }, { name: 'OK', number: 1 }],
      }],
    };

    expect(buildDefaultGrpcBody(schema)).toEqual({ status: 0 });
  });
});
