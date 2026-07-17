/** UI-only placeholder keys for in-progress map rows in the proto form builder. */
export const GRPC_MAP_PENDING_KEY_PREFIX = '__grpc_map_pending__';

export function isGrpcMapPendingKey(key: string): boolean {
  return key.startsWith(GRPC_MAP_PENDING_KEY_PREFIX);
}

/** Remove in-progress map rows before RPC execute (pending keys are UI-only). */
export function stripGrpcMapPendingKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripGrpcMapPendingKeysDeep(item));
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (isGrpcMapPendingKey(key)) continue;
    result[key] = stripGrpcMapPendingKeysDeep(item);
  }
  return result;
}
