import type { CollectionRunEvent, ScriptLogEntry } from '../../../shared/types/graphql';

export type RunnerConsoleEntry = ScriptLogEntry & { itemName: string };

export interface RunnerExportPayload {
  exportedAt: string;
  collection: string;
  summary: { passed: number; failed: number; skipped: number };
  events: CollectionRunEvent[];
}

export function isRunnerResultEvent(event: CollectionRunEvent): boolean {
  return event.type === 'result' || event.type === 'error' || event.type === 'skip';
}

export function formatRunnerEventSummary(event: CollectionRunEvent): string {
  if (event.type === 'skip') {
    return event.error?.message ? `Skipped — ${event.error.message}` : 'Skipped';
  }
  if (event.type === 'error') {
    const latency = event.latencyMs != null ? ` (${event.latencyMs}ms)` : '';
    return event.error?.message ? `Failed${latency} — ${event.error.message}` : `Failed${latency}`;
  }
  const latency = event.latencyMs != null ? `${event.latencyMs}ms` : '—';
  const testTotal = event.tests?.length ?? 0;
  const testPass = event.tests?.filter((t) => t.passed).length ?? 0;
  const tests = testTotal > 0 ? ` · ${testPass}/${testTotal} tests` : '';
  return `Completed in ${latency}${tests}`;
}

/** Script logs when present; otherwise a one-line run summary per item. */
export function buildRunnerConsoleEntries(
  events: CollectionRunEvent[],
  itemNameById: Map<string, string>,
): RunnerConsoleEntry[] {
  const entries: RunnerConsoleEntry[] = [];
  for (const event of events.filter(isRunnerResultEvent)) {
    const itemName = itemNameById.get(event.itemId) ?? event.itemId;
    if (event.logs && event.logs.length > 0) {
      for (const log of event.logs) {
        entries.push({ ...log, itemName });
      }
      continue;
    }
    entries.push({
      level: event.type === 'error' ? 'error' : event.type === 'skip' ? 'warn' : 'log',
      message: formatRunnerEventSummary(event),
      timestamp: 0,
      itemName,
    });
  }
  return entries;
}

export function buildRunnerExportPayload(
  collectionName: string,
  events: CollectionRunEvent[],
): RunnerExportPayload {
  const resultEvents = events.filter(isRunnerResultEvent);
  return {
    exportedAt: new Date().toISOString(),
    collection: collectionName,
    summary: {
      passed: resultEvents.filter((e) => e.type === 'result').length,
      failed: resultEvents.filter((e) => e.type === 'error').length,
      skipped: resultEvents.filter((e) => e.type === 'skip').length,
    },
    events,
  };
}

export function runnerExportFilename(collectionName: string): string {
  const slug = collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'collection';
  return `runner-results-${slug}-${Date.now()}.json`;
}
