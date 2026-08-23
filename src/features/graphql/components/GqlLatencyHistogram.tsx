/**
 * GqlLatencyHistogram — compact latency distribution strip below the response viewer.
 *
 * Shows the last N response latencies in logarithmic buckets with summary metrics.
 */

import { useMemo } from 'react';
import { computePercentiles } from '@shared/utils/percentiles';
import { BUCKETS, bucketIndex, formatLatencyMs } from './gqlLatencyHistogramUtils';

const SPEED_LEGEND = [
  { label: 'Fast', className: 'gql-hist-bar--ok' },
  { label: 'Moderate', className: 'gql-hist-bar--warn' },
  { label: 'Slow', className: 'gql-hist-bar--slow' },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface GqlLatencyHistogramProps {
  /** Ring buffer of recent latency values in milliseconds. */
  latencyHistory: number[];
}

function barColorClass(bucketIdx: number): string {
  if (bucketIdx <= 3) return 'gql-hist-bar--ok';
  if (bucketIdx === 4) return 'gql-hist-bar--warn';
  return 'gql-hist-bar--slow';
}

function formatPercent(count: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

interface MetricProps {
  label: string;
  value: string;
  highlight?: boolean;
  title?: string;
}

function Metric({ label, value, highlight = false, title }: MetricProps) {
  return (
    <div
      className={`gql-hist-metric${highlight ? ' gql-hist-metric--highlight' : ''}`}
      title={title}
    >
      <span className="gql-hist-metric-label">{label}</span>
      <span className="gql-hist-metric-value">{value}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GqlLatencyHistogram({ latencyHistory }: GqlLatencyHistogramProps) {
  const total = latencyHistory.length;

  const counts = useMemo(() => {
    const arr = new Array<number>(BUCKETS.length).fill(0);
    for (const ms of latencyHistory) {
      arr[bucketIndex(ms)]++;
    }
    return arr;
  }, [latencyHistory]);

  const maxCount = useMemo(() => Math.max(...counts, 1), [counts]);

  const stats = useMemo(() => {
    const sorted = [...latencyHistory].sort((a, b) => a - b);
    const summary = computePercentiles(sorted);
    return {
      sorted,
      avg: Math.round(summary.mean),
      min: summary.min,
      max: summary.max,
      p95: Math.round(summary.p95),
      p95Bucket: summary.p95 > 0 ? bucketIndex(summary.p95) : -1,
    };
  }, [latencyHistory]);

  const requestLabel = total === 1 ? '1 request' : `${total} requests`;

  return (
    <section
      className="gql-hist"
      data-testid="gql-histogram-strip"
      aria-label="Latency distribution"
    >
      <div className="gql-hist-header">
        <div className="gql-hist-heading">
          <h3 className="gql-hist-title">Latency distribution</h3>
          <p className="gql-hist-subtitle">Session history · {requestLabel}</p>
        </div>
        <div className="gql-hist-metrics" aria-label="Latency summary">
          <Metric label="Min" value={formatLatencyMs(stats.min)} title="Fastest response" />
          <Metric label="Avg" value={formatLatencyMs(stats.avg)} title="Mean latency" />
          <Metric
            label="p95"
            value={formatLatencyMs(stats.p95)}
            highlight
            title="95th percentile — 95% of requests were faster than this"
          />
          <Metric label="Max" value={formatLatencyMs(stats.max)} title="Slowest response" />
        </div>
      </div>

      <div
        className="gql-hist-chart"
        role="img"
        aria-label={`Latency histogram over ${total} requests`}
      >
        <div className="gql-hist-bars">
          {BUCKETS.map((bucket, i) => {
            const count = counts[i];
            const heightPct = count > 0
              ? Math.max((count / maxCount) * 100, 12)
              : 0;
            const isP95Bucket = i === stats.p95Bucket && count > 0;
            const tooltip = count > 0
              ? `${bucket.label}: ${count} request${count !== 1 ? 's' : ''} (${formatPercent(count, total)})`
              : `${bucket.label}: no requests`;

            return (
              <div
                key={bucket.label}
                className={[
                  'gql-hist-col',
                  count > 0 ? 'gql-hist-col--filled' : 'gql-hist-col--empty',
                  isP95Bucket ? 'gql-hist-col--p95' : '',
                ].filter(Boolean).join(' ')}
                title={tooltip}
                data-testid={`gql-hist-col-${i}`}
              >
                <div className="gql-hist-bar-wrap">
                  {count > 0 && (
                    <span className="gql-hist-count" aria-hidden="true">
                      {count}
                    </span>
                  )}
                  <div
                    className={`gql-hist-bar ${barColorClass(i)}`}
                    style={{ height: count > 0 ? `${heightPct}%` : undefined }}
                    aria-hidden="true"
                  />
                  {count === 0 && <div className="gql-hist-bar gql-hist-bar--ghost" aria-hidden="true" />}
                </div>
                <span className="gql-hist-label">{bucket.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="gql-hist-footer">
        <div className="gql-hist-legend" aria-hidden="true">
          {SPEED_LEGEND.map(({ label, className }, idx) => (
            <span key={label} className="gql-hist-legend-item">
              {idx > 0 && <span className="gql-hist-legend-sep">·</span>}
              <span className={`gql-hist-legend-swatch ${className}`} />
              {label}
            </span>
          ))}
        </div>
        {stats.p95Bucket >= 0 && (
          <span className="gql-hist-p95-note" data-testid="gql-hist-p95-note">
            p95 marker · {BUCKETS[stats.p95Bucket].label}
          </span>
        )}
      </div>
    </section>
  );
}
