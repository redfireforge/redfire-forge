import type { GrpcDescriptor } from '../../../../shared/grpc/contracts';
import {
  buildGrpcSchemaDiffReport,
  type GrpcSchemaDiffChange,
} from '../../../../shared/grpc/grpcSchemaDiffContracts';
import { FIXTURE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';

export const RICH_DESCRIPTOR: GrpcDescriptor = {
  ...FIXTURE_DESCRIPTOR,
  services: [
    {
      fullName: 'echo.EchoService',
      methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((method, index) => ({
        ...method,
        docComment: index === 0 ? 'Unary echo RPC' : undefined,
      })),
    },
  ],
  messageTypes: [
    {
      typeName: 'echo.EchoRequest',
      docComment: 'Echo request\nmulti-line',
      fields: [
        { name: 'message', number: 1, type: 'string', label: 'optional', docComment: 'payload' },
        { name: 'tags', number: 2, type: 'string', label: 'repeated' },
        {
          name: 'nested',
          number: 3,
          type: 'message',
          label: 'optional',
          messageTypeName: 'echo.EchoResponse',
        },
        {
          name: 'status',
          number: 4,
          type: 'enum',
          label: 'optional',
          enumTypeName: 'echo.StatusCode',
        },
        {
          name: 'attrs',
          number: 5,
          type: 'string',
          label: 'optional',
          isMap: true,
          mapKeyType: 'string',
        },
        {
          name: 'flags',
          number: 6,
          type: 'enum',
          label: 'optional',
          isMap: true,
          mapKeyType: 'string',
          enumTypeName: 'echo.StatusCode',
        },
        {
          name: 'children',
          number: 7,
          type: 'message',
          label: 'optional',
          isMap: true,
          mapKeyType: 'string',
          messageTypeName: 'echo.EchoResponse',
        },
      ],
    },
    {
      typeName: 'echo.EchoResponse',
      fields: [{ name: 'message', number: 1, type: 'string', label: 'optional' }],
    },
    {
      typeName: 'echo.EmptyMessage',
      fields: [],
    },
  ],
  enumTypes: [
    {
      typeName: 'echo.StatusCode',
      docComment: 'Status codes',
      values: [
        { name: 'OK', number: 0 },
        { name: 'ERROR', number: 1 },
      ],
    },
    {
      typeName: 'echo.EmptyEnum',
      values: [],
    },
  ],
};

export function diffChange(
  patch: Partial<GrpcSchemaDiffChange> & Pick<GrpcSchemaDiffChange, 'entityPath' | 'severity'>,
): GrpcSchemaDiffChange {
  return {
    entityType: 'field',
    changeType: 'modified',
    description: 'type string number 1',
    ...patch,
  };
}

export function makeReport(
  changes: GrpcSchemaDiffChange[],
  keys?: { left?: string; right?: string },
) {
  return buildGrpcSchemaDiffReport({
    leftDescriptorKey: keys?.left ?? 'proto:workspace',
    rightDescriptorKey: keys?.right ?? 'reflection:localhost:50051:v1',
    generatedAt: '2026-07-01T12:00:00.000Z',
    changes,
  });
}
