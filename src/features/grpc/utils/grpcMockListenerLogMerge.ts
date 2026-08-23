import type { GrpcMockListenerLogEntry } from '@shared/grpc/grpcMockListenerContracts';

/** Merge polled listener log pages, dedupe by id, cap history length. */
export function mergeGrpcMockListenerLogs(
  previous: GrpcMockListenerLogEntry[],
  incoming: GrpcMockListenerLogEntry[],
): GrpcMockListenerLogEntry[] {
  if (incoming.length === 0) {
    return previous;
  }

  const merged = [...previous, ...incoming].slice(-160);
  const dedupedById = new Map<string, GrpcMockListenerLogEntry>();
  for (const entry of merged) {
    dedupedById.set(String(entry.id), entry);
  }
  return Array.from(dedupedById.values()).slice(-80);
}
