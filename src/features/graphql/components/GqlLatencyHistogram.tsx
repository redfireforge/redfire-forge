/**
 * GqlLatencyHistogram.tsx — Phase 2 Deferred
 *
 * Compact latency histogram strip displayed below the response viewer.
 * Shows a distribution of the last N response latencies in 10 logarithmic
 * buckets.  Appears only when at least 2 data points are available.
 *
 * Bucket boundaries (ms): <50, 50–100, 100–200, 200–500, 500–1000,
 *   1000–2000, 2000–5000, 5000–10000, 10000–30000, ≥30000
 */

import { useMemo } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface GqlLatencyHistogramProps {
  /** Ring buffer of recent latency values in milliseconds. */
  latencyHistory: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bucketIndex(ms: number): number {
  for (let i = 0; i < BUCKETS.length - 1; i++) {
    if (ms < BUCKETS[i].max) return i;
  }
  return BUCKETS.length - 1;
}

function barColorClass(bucketIdx: number): string {
  // 0–3: green (≤ 500ms), 4: amber (≤ 1s), 5+: red (>1s)
  if (bucketIdx <= 3) return 'gql-hist-bar--ok';
  if (bucketIdx === 4) return 'gql-hist-bar--warn';
  return 'gql-hist-bar--slow';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GqlLatencyHistogram({ latencyHistory }: GqlLatencyHistogramProps) {
  const counts = useMemo(() => {
    const arr = new Array<number>(BUCKETS.length).fill(0);
    for (const ms of latencyHistory) {
      arr[bucketIndex(ms)]++;
    }
    return arr;
  }, [latencyHistory]);

  const maxCount = useMemo(() => Math.max(...counts, 1), [counts]);

  // Compact stats
  const avg = useMemo(
    () =>
      latencyHistory.length === 0
        ? 0
        : Math.round(latencyHistory.reduce((s, v) => s + v, 0) / latencyHistory.length),
    [latencyHistory],
  );

  const sorted = useMemo(() => [...latencyHistory].sort((a, b) => a - b), [latencyHistory]);
  const p95 = useMemo(() => {
    if (sorted.length === 0) return 0;
    const idx = Math.min(Math.ceil(sorted.length * 0.95) - 1, sorted.length - 1);
    return sorted[idx];
  }, [sorted]);

  return (
    <div className="gql-hist" data-testid="gql-histogram-strip" aria-label="Latency distribution">
      <div className="gql-hist-header">
        <span className="gql-hist-title">Latency</span>
        <span className="gql-hist-stat" title="Average latency">avg {avg}ms</span>
        <span className="gql-hist-stat" title="95th percentile">p95 {p95}ms</span>
        <span className="gql-hist-stat gql-hist-stat--muted">n={latencyHistory.length}</span>
      </div>
      <div className="gql-hist-bars" role="img" aria-label={`Latency histogram over ${latencyHistory.length} requests`}>
        {BUCKETS.map((bucket, i) => {
          const count = counts[i];
          const heightPct = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 8 : 0) : 0;
          return (
            <div
              key={bucket.label}
              className="gql-hist-col"
              title={`${bucket.label}: ${count} request${count !== 1 ? 's' : ''}`}
            >
              <div className="gql-hist-bar-wrap">
                <div
                  className={`gql-hist-bar ${barColorClass(i)}`}
                  style={{ height: `${heightPct}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className="gql-hist-label">{bucket.label}</span>
              {count > 0 && <span className="gql-hist-count">{count}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
