import { createGrpcSavedRequestIdentity } from '../shared/grpc/grpcPersistenceSchema';
import type { GrpcSavedRequest } from '../shared/grpc/grpcSavedRequest';

export const GRPC_TEST_TIMESTAMP = '2026-06-29T12:00:00.000Z';

export interface MakeGrpcSavedRequestOptions {
  id?: string;
  timestamp?: string;
  name?: string;
  callType?: GrpcSavedRequest['callType'];
  service?: string;
  method?: string;
  descriptorKey?: string;
  body?: Record<string, unknown>;
  metadata?: Record<string, string>;
  timeoutMs?: number;
}

/** Shared factory for gRPC saved-request test fixtures. */
export function makeGrpcSavedRequest(
  id = 'sr-1',
  options: MakeGrpcSavedRequestOptions = {},
): GrpcSavedRequest {
  const timestamp = options.timestamp ?? GRPC_TEST_TIMESTAMP;
  const service = options.service ?? 'echo.EchoService';
  const method = options.method ?? 'Echo';
  const identity = createGrpcSavedRequestIdentity(options.id ?? id, timestamp);
  return {
    ...identity,
    name: options.name ?? `${service}/${method}`,
    callType: options.callType ?? 'unary',
    service,
    method,
    descriptorKey: options.descriptorKey ?? 'desc-1',
    body: options.body ?? {},
    metadata: options.metadata ?? {},
    timeoutMs: options.timeoutMs ?? 30_000,
  };
}
