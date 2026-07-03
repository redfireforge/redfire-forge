/**
 * Unified gRPC demo storage hygiene.
 * Purges lesson artifacts that accumulate across repeated Demo Hub runs.
 */
import { purgeGrpcDemoCallHistory } from '../adapters';

export interface GrpcDemoEphemeralPurgeResult {
  historyEntriesRemoved: number;
  sessionKeysRemoved: number;
}

const GRPC_STUDIO_EPHEMERAL_STORAGE_KEYS = [
  'grpc-studio-session-v1',
  'grpc-studio-descriptors-v1',
] as const;

function purgeGrpcStudioSessionDrafts(): number {
  if (typeof globalThis.localStorage === 'undefined') {
    return 0;
  }

  let removed = 0;
  for (const key of GRPC_STUDIO_EPHEMERAL_STORAGE_KEYS) {
    if (globalThis.localStorage.getItem(key) != null) {
      globalThis.localStorage.removeItem(key);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Light purge safe to run before any gRPC lesson starts.
 * Removes demo echo call history without touching unrelated studio data.
 */
export async function purgeGrpcDemoEphemeralStorage(): Promise<GrpcDemoEphemeralPurgeResult> {
  const historyEntriesRemoved = await purgeGrpcDemoCallHistory();
  const sessionKeysRemoved = purgeGrpcStudioSessionDrafts();
  return {
    historyEntriesRemoved,
    sessionKeysRemoved,
  };
}
