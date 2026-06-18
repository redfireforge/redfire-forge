/**
 * GraphqlTracingView.tsx — Sprint 7 (2G-1)
 *
 * Apollo Tracing waterfall view for `extensions.tracing` (v1 format).
 *
 * Renders when `extensions.tracing` is present in the GraphQL response.
 * Shows a Gantt-style horizontal bar chart of resolver execution timings,
 * color-coded by duration (green < 50ms, amber 50–200ms, red > 200ms).
 *
 * Supported tracing formats:
 *   - Apollo Server v2/v3 with `tracing: true` in Apollo config
 *   - Yoga / Envelop with `useApolloTracing()` plugin (same v1 format)
 *
 * Not supported (Phase 3+):
 *   - OpenTelemetry extensions (different structure)
 */

import { useMemo, useState } from 'react';
import type { ApolloTracingData, ResolverTrace } from '../../../shared/types/graphql';

// ─── Types & helpers ─────────────────────────────────────────────────────────

type SortMode = 'startTime' | 'duration' | 'name';

/** Convert nanoseconds to a compact human-readable string. */
function nsToMs(ns: number): string {
  const ms = ns / 1_000_000;
  if (ms < 0.1) return `${(ns / 1000).toFixed(0)} µs`;
  if (ms < 1)   return `${ms.toFixed(2)} ms`;
  if (ms < 100) return `${ms.toFixed(1)} ms`;
  return `${ms.toFixed(0)} ms`;
}

/** Color class based on duration in nanoseconds. */
function durationColorClass(ns: number): string {
  const ms = ns / 1_000_000;
  if (ms < 50)  return 'gql-trace-bar--ok';
  if (ms < 200) return 'gql-trace-bar--warn';
  return 'gql-trace-bar--slow';
}

/** Build a display path string from the resolver path array. */
function formatPath(path: Array<string | number>): string {
  return path.join(' → ');
}

// ─── Resolver row ─────────────────────────────────────────────────────────────

interface ResolverRowProps {
  trace:          ResolverTrace;
  totalDuration:  number;  // nanoseconds (full request duration)
}

function ResolverRow({ trace, totalDuration }: ResolverRowProps) {
  const leftPct  = totalDuration > 0 ? (trace.startOffset / totalDuration) * 100 : 0;
  const widthPct = totalDuration > 0 ? Math.max((trace.duration / totalDuration) * 100, 0.3) : 0.3;

  return (
    <div className="gql-trace-row" data-testid="gql-trace-resolver-row">
      {/* Left: label column */}
      <div className="gql-trace-label" title={formatPath(trace.path)}>
        <span className="gql-trace-type">{trace.parentType}</span>
        <span className="gql-trace-dot" aria-hidden="true">.</span>
        <span className="gql-trace-field">{trace.fieldName}</span>
        {trace.returnType && (
          <span className="gql-trace-return-type" aria-label={`returns ${trace.returnType}`}>
            → {trace.returnType}
          </span>
        )}
      </div>

      {/* Right: Gantt bar */}
      <div className="gql-trace-timeline" aria-hidden="true">
        <div
          className={`gql-trace-bar ${durationColorClass(trace.duration)}`}
          style={{
            left:  `${leftPct.toFixed(2)}%`,
            width: `${widthPct.toFixed(2)}%`,
          }}
          title={`Start: ${nsToMs(trace.startOffset)} | Duration: ${nsToMs(trace.duration)}`}
        />
      </div>

      {/* Duration badge */}
      <div className="gql-trace-duration" aria-label={`Duration: ${nsToMs(trace.duration)}`}>
        {nsToMs(trace.duration)}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface GraphqlTracingViewProps {
  tracing: ApolloTracingData;
}

export function GraphqlTracingView({ tracing }: GraphqlTracingViewProps) {
  const [sortMode, setSortMode] = useState<SortMode>('startTime');

  const totalDurationNs = tracing.duration;

  const sortedResolvers = useMemo(() => {
    const resolvers = [...(tracing.execution?.resolvers ?? [])];
    switch (sortMode) {
      case 'duration':
        return resolvers.sort((a, b) => b.duration - a.duration);
      case 'name':
        return resolvers.sort((a, b) => {
          const an = `${a.parentType}.${a.fieldName}`;
          const bn = `${b.parentType}.${b.fieldName}`;
          return an.localeCompare(bn);
        });
      case 'startTime':
      default:
        return resolvers.sort((a, b) => a.startOffset - b.startOffset);
    }
  }, [tracing, sortMode]);

  // Summary stats
  const slowest = useMemo(() => {
    const r = [...(tracing.execution?.resolvers ?? [])];
    return r.sort((a, b) => b.duration - a.duration)[0];
  }, [tracing]);

  if (!tracing.execution?.resolvers?.length) {
    return (
      <div className="gql-trace-empty" data-testid="gql-trace-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p>No resolver traces in response</p>
        <p className="gql-trace-empty-hint">Enable tracing on your GraphQL server (e.g. Apollo Server: <code>plugins: [ApolloServerPluginInlineTrace()]</code>)</p>
      </div>
    );
  }

  return (
    <div className="gql-trace-view" data-testid="gql-trace-view">
      {/* Summary bar */}
      <div className="gql-trace-summary">
        <span className="gql-trace-summary-item">
          <span className="gql-trace-summary-label">Total</span>
          <span className="gql-trace-summary-value">{nsToMs(totalDurationNs)}</span>
        </span>
        <span className="gql-trace-summary-item">
          <span className="gql-trace-summary-label">Resolvers</span>
          <span className="gql-trace-summary-value">{tracing.execution!.resolvers.length}</span>
        </span>
        {tracing.parsing && (
          <span className="gql-trace-summary-item">
            <span className="gql-trace-summary-label">Parse</span>
            <span className="gql-trace-summary-value">{nsToMs(tracing.parsing.duration)}</span>
          </span>
        )}
        {tracing.validation && (
          <span className="gql-trace-summary-item">
            <span className="gql-trace-summary-label">Validate</span>
            <span className="gql-trace-summary-value">{nsToMs(tracing.validation.duration)}</span>
          </span>
        )}
        {slowest && (
          <span className="gql-trace-summary-item gql-trace-summary-item--slowest">
            <span className="gql-trace-summary-label">Slowest</span>
            <span className="gql-trace-summary-value">
              {slowest.parentType}.{slowest.fieldName} ({nsToMs(slowest.duration)})
            </span>
          </span>
        )}
      </div>

      {/* Sort controls */}
      <div className="gql-trace-controls">
        <span className="gql-trace-controls-label">Sort:</span>
        <div className="gql-trace-sort-btns" role="group" aria-label="Sort resolvers by">
          {(['startTime', 'duration', 'name'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`gql-trace-sort-btn${sortMode === mode ? ' gql-trace-sort-btn--active' : ''}`}
              onClick={() => setSortMode(mode)}
              aria-pressed={sortMode === mode}
              data-testid={`gql-trace-sort-${mode}`}
            >
              {mode === 'startTime' ? 'Start time' : mode === 'duration' ? 'Slowest first' : 'Name'}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="gql-trace-legend" aria-label="Duration color legend">
        <span className="gql-trace-legend-item">
          <span className="gql-trace-legend-dot gql-trace-bar--ok" aria-hidden="true" />
          <span>&lt; 50ms</span>
        </span>
        <span className="gql-trace-legend-item">
          <span className="gql-trace-legend-dot gql-trace-bar--warn" aria-hidden="true" />
          <span>50–200ms</span>
        </span>
        <span className="gql-trace-legend-item">
          <span className="gql-trace-legend-dot gql-trace-bar--slow" aria-hidden="true" />
          <span>&gt; 200ms</span>
        </span>
      </div>

      {/* Header row */}
      <div className="gql-trace-header-row" aria-hidden="true">
        <div className="gql-trace-label gql-trace-header-label">Resolver</div>
        <div className="gql-trace-timeline gql-trace-header-timeline">Timeline</div>
        <div className="gql-trace-duration gql-trace-header-duration">Duration</div>
      </div>

      {/* Resolver rows */}
      <div className="gql-trace-rows" role="list" aria-label="Resolver traces">
        {sortedResolvers.map((trace, idx) => (
          <ResolverRow
            key={idx}
            trace={trace}
            totalDuration={totalDurationNs}
          />
        ))}
      </div>
    </div>
  );
}
