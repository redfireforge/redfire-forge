/**
 * gRPC metadata validation — shared by UI editor and route validation (Phase 1F).
 */

const METADATA_KEY_PATTERN = /^[a-z0-9_./-]+$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function validateGrpcMetadataKey(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) {
    return 'Metadata key is required';
  }
  const normalized = trimmed.toLowerCase();
  if (!METADATA_KEY_PATTERN.test(normalized)) {
    return 'Metadata keys may only contain lowercase letters, digits, and _ . / -';
  }
  return null;
}

export function isGrpcBinaryMetadataKey(key: string): boolean {
  return key.trim().toLowerCase().endsWith('-bin');
}

export function validateGrpcMetadataValue(key: string, value: string): string | null {
  if (!isGrpcBinaryMetadataKey(key)) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Binary metadata (-bin) values must be non-empty base64';
  }
  if (!BASE64_PATTERN.test(trimmed)) {
    return 'Binary metadata (-bin) values must be valid base64';
  }
  return null;
}

export function validateGrpcMetadataEntry(key: string, value: string): string | null {
  const keyError = validateGrpcMetadataKey(key);
  if (keyError) return keyError;
  return validateGrpcMetadataValue(key, value);
}

/** Validate a metadata record (API / execute snapshot). */
export function validateGrpcMetadataRecord(
  metadata: Record<string, string> | undefined,
): string | null {
  if (!metadata) return null;
  for (const [key, value] of Object.entries(metadata)) {
    const error = validateGrpcMetadataEntry(key, value);
    if (error) return error;
  }
  return null;
}
