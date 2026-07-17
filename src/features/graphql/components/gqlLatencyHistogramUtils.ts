/** Shared latency histogram helpers (extracted for react-refresh compliance). */

const BUCKETS: Array<{ label: string; max: number }> = [
  { label: '<50ms',    max: 50 },
  { label: '50–100',  max: 100 },
  { label: '100–200', max: 200 },
  { label: '200–500', max: 500 },
  { label: '0.5–1s',  max: 1000 },
  { label: '1–2s',    max: 2000 },
  { label: '2–5s',    max: 5000 },
  { label: '5–10s',   max: 10000 },
  { label: '10–30s',  max: 30000 },
  { label: '≥30s',    max: Infinity },
];

export { BUCKETS };

export function bucketIndex(ms: number): number {
  for (let i = 0; i < BUCKETS.length - 1; i++) {
    if (ms < BUCKETS[i].max) return i;
  }
  return BUCKETS.length - 1;
}

export function formatLatencyMs(ms: number): string {
  if (ms <= 0) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}
