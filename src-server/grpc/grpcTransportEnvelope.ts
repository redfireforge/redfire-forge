/**
 * Phase 4F — sanitized transport error envelopes for gRPC route handlers.
 */
import type {
  GrpcEnvelopeMeta,
  GrpcErrorEnvelope,
  GrpcOperation,
  GrpcRouteEnvelope,
} from '../../src/shared/grpc/contracts.js';
import { createSanitizedGrpcErrorEnvelope } from '../../src/shared/grpc/grpcRedaction.js';
import { classifyGrpcTransportFailure } from '../../src/shared/grpc/grpcTransportErrors.js';

export function createGrpcTransportErrorEnvelope(
  op: GrpcOperation,
  error: unknown,
  meta?: Partial<GrpcEnvelopeMeta>,
  hints?: {
    grpcStatus?: number;
    grpcDetails?: string;
    grpcMetadata?: Record<string, string>;
  },
): GrpcErrorEnvelope {
  const classified = classifyGrpcTransportFailure(error, {
    grpcStatus: hints?.grpcStatus,
    grpcDetails: hints?.grpcDetails,
  });
  const details = {
    ...classified.details,
    ...(hints?.grpcMetadata ? { trailers: hints.grpcMetadata } : {}),
  };
  return createSanitizedGrpcErrorEnvelope(
    op,
    {
      code: classified.code,
      category: classified.category,
      message: classified.message,
      retryable: classified.retryable,
      details: Object.keys(details).length > 0 ? details : undefined,
    },
    meta,
  );
}

export function createGrpcTransportRouteError<T>(
  op: GrpcOperation,
  error: unknown,
  meta?: Partial<GrpcEnvelopeMeta>,
  hints?: {
    grpcStatus?: number;
    grpcDetails?: string;
    grpcMetadata?: Record<string, string>;
  },
): GrpcRouteEnvelope<T> {
  return createGrpcTransportErrorEnvelope(op, error, meta, hints);
}
