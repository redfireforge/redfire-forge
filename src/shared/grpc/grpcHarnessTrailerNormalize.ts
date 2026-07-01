/**
 * Phase 8E — trailer key normalization for harness gRPC assertions.
 */

/** Normalize trailer keys to lowercase for stable grpcTrailer lookups. */
export function normalizeGrpcHarnessTrailers(
  trailers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!trailers) return undefined;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(trailers)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

/** Resolve a trailer value by case-insensitive name against a raw trailer map. */
export function resolveGrpcHarnessTrailerValue(
  trailers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  const normalized = normalizeGrpcHarnessTrailers(trailers);
  if (!normalized) return undefined;
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return Object.prototype.hasOwnProperty.call(normalized, key) ? normalized[key] : undefined;
}
