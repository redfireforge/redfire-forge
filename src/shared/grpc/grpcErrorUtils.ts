/**
 * Shared error-to-string helper used across gRPC transport layers.
 * Extracts a readable message from any thrown value.
 */
export function errorToString(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
