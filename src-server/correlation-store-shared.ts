import type { ServerPausedEntry } from './correlation-handler.js';

export const MAX_UNMATCHED_LOG = 100;

export interface UnmatchedWebhookEntry {
  path: string;
  correlationId?: string;
  payload: unknown;
  receivedAt: number;
}

export function appendUnmatchedEntry(
  entries: UnmatchedWebhookEntry[],
  entry: UnmatchedWebhookEntry,
  maxSize: number = MAX_UNMATCHED_LOG,
): void {
  entries.push(entry);
  while (entries.length > maxSize) {
    entries.shift();
  }
}

export function cleanupExpiredEntries(
  entries: Map<string, ServerPausedEntry>,
  now: number,
  onExpired?: (id: string) => void,
): number {
  let count = 0;
  for (const [id, entry] of entries) {
    if (entry.timeoutAt > 0 && entry.timeoutAt <= now) {
      entries.delete(id);
      onExpired?.(id);
      count++;
    }
  }
  return count;
}
