import type { ApiMockConsoleLine } from './useApiMockConsole';

export type ApiMockConsoleEventKind = 'started' | 'stopped' | 'applied' | 'error' | 'other';
export type ApiMockConsoleEventFilter = 'all' | 'started' | 'stopped' | 'applied' | 'errors';

export const CONSOLE_EVENT_FILTERS: ReadonlyArray<{ id: ApiMockConsoleEventFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'started', label: 'Started' },
  { id: 'stopped', label: 'Stopped' },
  { id: 'applied', label: 'Apply' },
  { id: 'errors', label: 'Errors' },
];

export function formatConsoleLine(line: ApiMockConsoleLine): string {
  return `${line.ts ? new Date(line.ts).toLocaleTimeString() : ''}${line.level ? ` [${line.level}]` : ''} ${line.message}`.trim();
}

export function classifyConsoleLine(line: ApiMockConsoleLine): ApiMockConsoleEventKind {
  const level = (line.level ?? '').toLowerCase();
  if (level === 'error' || level === 'warn' || level === 'warning') return 'error';
  const msg = line.message ?? '';
  if (/^started\b/i.test(msg)) return 'started';
  if (/^stopped\b/i.test(msg)) return 'stopped';
  if (/^committed\b/i.test(msg)) return 'applied';
  if (/\b(error|fail|failed)\b/i.test(msg)) return 'error';
  return 'other';
}

export function filterConsoleLines(
  lines: ApiMockConsoleLine[],
  query: string,
  event: ApiMockConsoleEventFilter,
): ApiMockConsoleLine[] {
  const q = query.trim().toLowerCase();
  return lines.filter(line => {
    const kind = classifyConsoleLine(line);
    if (event === 'started' && kind !== 'started') return false;
    if (event === 'stopped' && kind !== 'stopped') return false;
    if (event === 'applied' && kind !== 'applied') return false;
    if (event === 'errors' && kind !== 'error') return false;
    if (!q) return true;
    return formatConsoleLine(line).toLowerCase().includes(q) || line.message.toLowerCase().includes(q);
  });
}

export function countConsoleEvents(lines: ApiMockConsoleLine[]): Record<ApiMockConsoleEventFilter, number> {
  const counts: Record<ApiMockConsoleEventFilter, number> = {
    all: lines.length,
    started: 0,
    stopped: 0,
    applied: 0,
    errors: 0,
  };
  for (const line of lines) {
    const kind = classifyConsoleLine(line);
    if (kind === 'started') counts.started += 1;
    else if (kind === 'stopped') counts.stopped += 1;
    else if (kind === 'applied') counts.applied += 1;
    else if (kind === 'error') counts.errors += 1;
  }
  return counts;
}
