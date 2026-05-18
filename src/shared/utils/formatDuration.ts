export function formatDurationMs(ms?: number | null): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default formatDurationMs;
