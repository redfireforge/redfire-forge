import type { GrpcMessageSchema } from '@shared/grpc/contracts';

export const REPEATED_MESSAGE_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.RepeatedNestedRequest',
  fields: [
    {
      name: 'items',
      number: 1,
      type: 'message',
      label: 'repeated',
      messageTypeName: 'demo.Payload',
    },
  ],
};

export const MAP_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.MapRequest',
  fields: [{
    name: 'labels',
    number: 1,
    type: 'string',
    label: 'optional',
    isMap: true,
    mapKeyType: 'string',
  }],
};

export const ONEOF_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.OneofRequest',
  fields: [
    { name: 'text', number: 1, type: 'string', label: 'optional', isOneofMember: true, oneofName: 'payload' },
    { name: 'count', number: 2, type: 'int32', label: 'optional', isOneofMember: true, oneofName: 'payload' },
  ],
};

export const ENUM_BOOL_SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.EnumBoolRequest',
  fields: [
    {
      name: 'status',
      number: 1,
      type: 'enum',
      label: 'optional',
      enumTypeName: 'demo.Status',
      enumValues: [{ name: 'UNKNOWN', number: 0 }, { name: 'OK', number: 1 }],
    },
    { name: 'enabled', number: 2, type: 'bool', label: 'optional' },
    { name: 'size', number: 3, type: 'int32', label: 'optional' },
  ],
};
