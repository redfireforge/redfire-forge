import type { GrpcMessageSchema } from '@shared/grpc/contracts';
import { groupMessageFields } from '../utils/grpcProtoFormValues';

export function buildHybridNavigatorPaths(schema: GrpcMessageSchema): string[] {
  const { regular, oneofGroups } = groupMessageFields(schema.fields);
  const regularPaths = regular.map((field) => `field:${field.name}`);
  const oneofPaths = [...oneofGroups.keys()].map((groupName) => `oneof:${groupName}`);
  return [...regularPaths, ...oneofPaths];
}
