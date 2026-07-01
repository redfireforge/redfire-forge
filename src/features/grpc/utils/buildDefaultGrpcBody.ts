/**
 * Build a default JSON request body from a gRPC message schema (Phase 1E).
 */
import type { GrpcMessageSchema } from '../../../shared/grpc/contracts';
import { buildBodyFromSchema } from './grpcProtoFormValues';

export function buildDefaultGrpcBody(schema: GrpcMessageSchema): Record<string, unknown> {
  return buildBodyFromSchema(schema);
}
