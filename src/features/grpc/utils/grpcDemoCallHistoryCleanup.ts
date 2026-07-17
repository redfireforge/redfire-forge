/**
 * Demo Hub gRPC call history hygiene.
 * Removes lesson artifacts that accumulate across repeated demo runs.
 */
import {
  clearGrpcCallHistoryFiltered,
  loadGrpcCallHistoryEntries,
} from '../data/grpcCallHistoryRecorder';
import { filterGrpcCallHistoryEntries } from './grpcHistoryFilters';
import { GRPC_CALL_HISTORY_UPDATED_EVENT } from './grpcStudioCallHistoryCapture';

/** Loopback target variants used in GRPC-1 and related echo lessons. */
export const GRPC_DEMO_CALL_HISTORY_TARGETS = [
  'localhost:50051',
  '127.0.0.1:50051',
] as const;

export function dispatchGrpcCallHistoryReload(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GRPC_CALL_HISTORY_UPDATED_EVENT));
  }
}

function grpcDemoCallHistoryFilters() {
  return GRPC_DEMO_CALL_HISTORY_TARGETS.map((target) => ({ text: target }));
}

/** Clear persisted call history rows for demo echo targets (GRPC-1+). */
export async function purgeGrpcDemoCallHistory(): Promise<number> {
  const filters = grpcDemoCallHistoryFilters();
  const entries = await loadGrpcCallHistoryEntries();
  const toRemove = filters.flatMap((filter) => filterGrpcCallHistoryEntries(entries, filter));
  if (toRemove.length === 0) {
    dispatchGrpcCallHistoryReload();
    return 0;
  }
  let removed = 0;
  for (const filter of filters) {
    removed += await clearGrpcCallHistoryFiltered(filter);
  }
  dispatchGrpcCallHistoryReload();
  return removed;
}
