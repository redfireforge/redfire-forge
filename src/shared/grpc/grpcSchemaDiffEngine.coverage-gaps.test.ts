/**
 * Coverage gaps — grpcSchemaDiffEngine.ts (Phase 11F).
 */
import { describe, expect, it } from 'vitest';
import type {
  GrpcDescriptor,
  GrpcEnumSchema,
  GrpcFieldSchema,
  GrpcMessageSchema,
  GrpcMethodInfo,
} from './contracts';
import {
  buildGrpcDescriptorIndex,
  collectGrpcSchemaDiffChanges,
  computeGrpcSchemaDiff,
  fieldWireShapeSignature,
} from './grpcSchemaDiffEngine';

function field(
  overrides: Partial<GrpcFieldSchema> & Pick<GrpcFieldSchema, 'name' | 'number' | 'type'>,
): GrpcFieldSchema {
  return {
    label: 'optional',
    ...overrides,
  };
}

function message(typeName: string, fields: GrpcFieldSchema[]): GrpcMessageSchema {
  return { typeName, fields };
}

function method(
  name: string,
  requestSchema: GrpcMessageSchema,
  responseSchema: GrpcMessageSchema,
  overrides: Partial<GrpcMethodInfo> = {},
): GrpcMethodInfo {
  return {
    name,
    callType: 'unary',
    requestTypeName: requestSchema.typeName,
    responseTypeName: responseSchema.typeName,
    requestSchema,
    responseSchema,
    ...overrides,
  };
}

function descriptor(
  key: string,
  services: GrpcDescriptor['services'],
  extras?: Pick<GrpcDescriptor, 'messageTypes' | 'enumTypes'>,
): GrpcDescriptor {
  return {
    source: 'protoset',
    key,
    services,
    ...extras,
  };
}

const STATUS_ENUM: GrpcEnumSchema = {
  typeName: 'order.Status',
  values: [
    { name: 'UNKNOWN', number: 0 },
    { name: 'OPEN', number: 1 },
  ],
};

describe('grpcSchemaDiffEngine coverage gaps', () => {
  it('indexes enum types referenced only from message fields', () => {
    const request = message('order.GetOrderRequest', [
      field({
        name: 'status',
        number: 1,
        type: 'enum',
        enumTypeName: 'order.Status',
        enumValues: STATUS_ENUM.values,
      }),
    ]);
    const response = message('order.GetOrderResponse', [
      field({ name: 'order_id', number: 1, type: 'string' }),
    ]);
    const desc = descriptor('baseline', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', request, response)],
    }]);

    const index = buildGrpcDescriptorIndex(desc);
    expect(index.enums.get('order.Status')?.values).toEqual(STATUS_ENUM.values);
  });

  it('builds wire-shape signatures for enum and map fields', () => {
    const enumField = field({
      name: 'status',
      number: 1,
      type: 'enum',
      enumTypeName: 'order.Status',
    });
    const mapField = field({
      name: 'tags',
      number: 2,
      type: 'string',
      label: 'repeated',
      isMap: true,
      mapKeyType: 'string',
    });

    expect(fieldWireShapeSignature(enumField)).toBe('order.Status:optional');
    expect(fieldWireShapeSignature(mapField)).toBe('map<string,string>:repeated');
  });

  it('classifies required field additions as breaking', () => {
    const baselineRequest = message('order.GetOrderRequest', [
      field({ name: 'order_id', number: 1, type: 'string' }),
    ]);
    const candidateRequest = message('order.GetOrderRequest', [
      field({ name: 'order_id', number: 1, type: 'string' }),
      field({ name: 'tenant', number: 2, type: 'string', label: 'required' }),
    ]);
    const response = message('order.GetOrderResponse', [
      field({ name: 'order_id', number: 1, type: 'string' }),
    ]);
    const left = descriptor('left', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', baselineRequest, response)],
    }]);
    const right = descriptor('right', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', candidateRequest, response)],
    }]);

    const changes = collectGrpcSchemaDiffChanges(left, right);
    expect(changes.some((change) => (
      change.entityPath === 'order.GetOrderRequest.tenant'
      && change.severity === 'breaking'
      && change.changeType === 'added'
    ))).toBe(true);
  });

  it('flags enum value renames as breaking modifications', () => {
    const left = descriptor('left', [{
      fullName: 'order.OrderService',
      methods: [method(
        'GetOrder',
        message('order.GetOrderRequest', [field({ name: 'order_id', number: 1, type: 'string' })]),
        message('order.GetOrderResponse', [field({ name: 'order_id', number: 1, type: 'string' })]),
      )],
    }], {
      enumTypes: [STATUS_ENUM],
    });
    const right = descriptor('right', [{
      fullName: 'order.OrderService',
      methods: [method(
        'GetOrder',
        message('order.GetOrderRequest', [field({ name: 'order_id', number: 1, type: 'string' })]),
        message('order.GetOrderResponse', [field({ name: 'order_id', number: 1, type: 'string' })]),
      )],
    }], {
      enumTypes: [{
        typeName: 'order.Status',
        values: [
          { name: 'UNKNOWN', number: 0 },
          { name: 'OPENED', number: 1 },
        ],
      }],
    });

    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left,
      right,
    });

    expect(report.changes.some((change) => (
      change.entityType === 'enum_value'
      && change.entityPath === 'order.Status#1'
      && change.severity === 'breaking'
      && change.changeType === 'modified'
    ))).toBe(true);
  });

  it('detects wire-shape changes for existing field numbers', () => {
    const leftRequest = message('order.GetOrderRequest', [
      field({ name: 'order_id', number: 1, type: 'string' }),
    ]);
    const rightRequest = message('order.GetOrderRequest', [
      field({ name: 'order_id', number: 1, type: 'int32' }),
    ]);
    const response = message('order.GetOrderResponse', [
      field({ name: 'order_id', number: 1, type: 'string' }),
    ]);
    const left = descriptor('left', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', leftRequest, response)],
    }]);
    const right = descriptor('right', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', rightRequest, response)],
    }]);

    const changes = collectGrpcSchemaDiffChanges(left, right);
    expect(changes.some((change) => (
      change.entityType === 'field'
      && change.changeType === 'modified'
      && change.severity === 'breaking'
      && change.description.includes('wire shape changed')
    ))).toBe(true);
  });
});
