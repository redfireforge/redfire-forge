/**
 * Shared metadata normalization for browser-direct gRPC transports — Phase 10F.
 *
 * Contract:
 *   By the time `request.metadata` arrives here it has already been processed by
 *   `prepareGrpcCallMetadata` (grpcCompressionPolicy.ts) which calls
 *   `prepareGrpcExecuteRequestMetadata` (grpcAuthPolicy.ts) which calls
 *   `normalizeGrpcMetadata` (contracts.ts). This means:
 *     - All keys are already lowercase.
 *     - Auth headers have been merged with auth winning over conflicting manual keys.
 *     - Compression headers (grpc-encoding, grpc-accept-encoding) are already present.
 *
 *   This module handles the HTTP header emission step only:
 *     - Filters out reserved headers (transport layer owns those slots).
 *     - Passes binary (-bin) values through untouched (already base64 at this point).
 *     - Returns binaryKeyCount for diagnostics and testing.
 */
import { isGrpcBinaryMetadataKey } from './metadataValidation';

export interface BrowserTransportUserMetadataHeaders {
  /** User metadata headers to merge into the transport request (non-reserved). */
  headers: Record<string, string>;
  /** Number of binary (-bin) keys found — for diagnostics. */
  binaryKeyCount: number;
}

/**
 * Build the user-metadata portion of browser transport HTTP headers.
 *
 * - Keys already lowercase (enforced upstream by normalizeGrpcMetadata).
 * - Reserved headers are filtered out silently (transport layer owns those slots).
 * - Binary (-bin) keys are passed through with their base64 values untouched.
 *
 * @param metadata - The pre-normalized metadata record from GrpcCallRequest.
 * @param reservedHeaders - Transport-specific reserved header set (lowercase).
 */
export function buildBrowserTransportUserMetadataHeaders(
  metadata: Record<string, string> | undefined,
  reservedHeaders: ReadonlySet<string>,
): BrowserTransportUserMetadataHeaders {
  const headers: Record<string, string> = {};
  let binaryKeyCount = 0;
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (reservedHeaders.has(key.toLowerCase())) continue;
    if (isGrpcBinaryMetadataKey(key)) {
      binaryKeyCount++;
    }
    headers[key] = value;
  }
  return { headers, binaryKeyCount };
}

/**
 * Auth header keys that auth injection writes into metadata (Phase 4A contract).
 * These keys arrive in `request.metadata` after `prepareGrpcCallMetadata` merges them.
 * bearer → 'authorization', basic → 'authorization', api_key → varies by config.
 */
export const GRPC_AUTH_HEADER_KEYS: ReadonlySet<string> = new Set([
  'authorization',
  'x-api-key',
]);
