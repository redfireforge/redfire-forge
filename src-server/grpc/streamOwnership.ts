import type { GrpcStreamRegistryEntry } from './streamRegistry.js';

export type StreamOwnershipFailure =
  | 'not_found'
  | 'tab_mismatch';

export type StreamOwnershipResult =
  | { ok: true; entry: GrpcStreamRegistryEntry }
  | { ok: false; reason: StreamOwnershipFailure };

export function assertStreamTabOwnership(
  entry: GrpcStreamRegistryEntry | undefined,
  tabId: string,
): StreamOwnershipResult {
  if (!entry) {
    return { ok: false, reason: 'not_found' };
  }
  if (entry.tabId !== tabId) {
    return { ok: false, reason: 'tab_mismatch' };
  }
  return { ok: true, entry };
}
