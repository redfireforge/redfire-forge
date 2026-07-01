/**
 * Phase 4J-D — per-call gRPC compression via metadata headers.
 */
import type { GrpcAuthConfig, GrpcCompressionAlgorithm, GrpcCompressionConfig } from './contracts';
import { prepareGrpcExecuteRequestMetadata } from './grpcAuthPolicy';

export type { GrpcCompressionAlgorithm, GrpcCompressionConfig } from './contracts';

export const GRPC_COMPRESSION_ALGORITHMS: GrpcCompressionAlgorithm[] = [
  'identity',
  'gzip',
  'deflate',
];

export const DEFAULT_GRPC_COMPRESSION_CONFIG: GrpcCompressionConfig = {
  enabled: false,
  algorithm: 'gzip',
};

export function normalizeGrpcCompressionConfig(
  config: GrpcCompressionConfig | undefined,
): GrpcCompressionConfig | undefined {
  if (!config) return undefined;
  const algorithm = GRPC_COMPRESSION_ALGORITHMS.includes(config.algorithm)
    ? config.algorithm
    : 'gzip';
  return {
    enabled: Boolean(config.enabled),
    algorithm,
  };
}

/** Effective grpc-encoding value for preview and merge. Identity means no compression. */
export function resolveGrpcCompressionEncoding(
  config: GrpcCompressionConfig | undefined,
): string | undefined {
  const normalized = normalizeGrpcCompressionConfig(config);
  if (!normalized?.enabled) return undefined;
  if (normalized.algorithm === 'identity') return undefined;
  return normalized.algorithm;
}

export function formatGrpcAcceptEncodingHeader(
  config: GrpcCompressionConfig | undefined,
): string {
  const encoding = resolveGrpcCompressionEncoding(config);
  if (!encoding || encoding === 'identity') {
    return 'identity';
  }
  return `${encoding},identity`;
}

/**
 * Merge compression headers into metadata. Compression wins over manual keys
 * for grpc-encoding and grpc-accept-encoding when enabled.
 */
export function mergeGrpcCompressionMetadata(
  metadata: Record<string, string>,
  config: GrpcCompressionConfig | undefined,
): Record<string, string> {
  const encoding = resolveGrpcCompressionEncoding(config);
  if (!encoding) {
    return metadata;
  }
  return {
    ...metadata,
    'grpc-encoding': encoding,
    'grpc-accept-encoding': formatGrpcAcceptEncodingHeader(config),
  };
}

/** Auth merge then compression merge — used at execute boundary. */
export function prepareGrpcCallMetadata(
  manualMetadata: Record<string, string> | undefined,
  auth: GrpcAuthConfig | undefined,
  compression: GrpcCompressionConfig | undefined,
): Record<string, string> | undefined {
  const withAuth = prepareGrpcExecuteRequestMetadata(manualMetadata, auth) ?? {};
  const withCompression = mergeGrpcCompressionMetadata(withAuth, compression);
  return Object.keys(withCompression).length > 0 ? withCompression : undefined;
}
