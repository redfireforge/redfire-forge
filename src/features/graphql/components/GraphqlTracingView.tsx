/**
 * GraphqlTracingView.tsx — Sprint 7 (2G-1)
 *
 * Apollo Tracing waterfall view for `extensions.tracing` (v1 format).
 */

import { useMemo, useState } from 'react';
import type { ApolloTracingData, ResolverTrace } from '../../../shared/types/graphql';
import {
  nsToMs,
  durationColorClass,
  durationTextClass,
  pctOfTotal,
  buildPhaseSegments,
  computeOverheadNs,
  formatTracePath,
} from '../utils/graphqlTracingUtils';

type SortMode = 'startTime' | 'duration' | 'name';

interface ResolverRowProps {
  trace: ResolverTrace;
  totalDuration: number;
}

function ResolverRow({ trace, totalDuration }: ResolverRowProps) {
  const leftPct = pctOfTotal(trace.startOffset, totalDuration);
  const widthPct = Math.max(pctOfTotal(trace.duration, totalDuration), 0.4);
  const colorClass = durationColorClass(trace.duration);

  return (
    <div className="gql-trace-row" data-testid="gql-trace-resolver-row" role="listitem">
      <div className="gql-trace-label" title={formatTracePath(trace.path)}>
        <span className="gql-trace-type">{trace.parentType}</span>
        <span className="gql-trace-dot" aria-hidden="true">.</span>
        <span className="gql-trace-field">{trace.fieldName}</span>
        {trace.returnType && (
          <span className="gql-trace-return-type" aria-label={`returns ${trace.returnType}`}>
            → {trace.returnType}
          </span>
        )}
      </div>

      <div className="gql-trace-timeline" aria-hidden="true">
        <div
          className={`gql-trace-bar ${colorClass}`}
          style={{
            left: `${leftPct.toFixed(2)}%`,
            width: `${widthPct.toFixed(2)}%`,
          }}
          title={`Start: ${nsToMs(trace.startOffset)} · Duration: ${nsToMs(trace.duration)}`}
        />
      </div>

      <div
        className={`gql-trace-duration ${durationTextClass(trace.duration)}`}
        aria-label={`Duration: ${nsToMs(trace.duration)}`}
      >
        {nsToMs(trace.duration)}
      </div>
    </div>
  );
}

interface RequestPhaseBarProps {
  tracing: ApolloTracingData;
  totalDuration: number;
}

function RequestPhaseBar({ tracing, totalDuration }: RequestPhaseBarProps) {
  const segments = useMemo(() => buildPhaseSegments(tracing), [tracing]);

  return (
    <div className="gql-trace-phase-bar" data-testid="gql-trace-phase-bar">
      <div className="gql-trace-phase-bar__header">
        <span className="gql-trace-phase-bar__title">Request timeline</span>
        <span className="gql-trace-phase-bar__scale">0 — {nsToMs(totalDuration)}</span>
      </div>
      <div className="gql-trace-phase-track" aria-hidden="true">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`gql-trace-phase-seg gql-trace-phase-seg--${seg.variant}`}
            style={{
              left: `${pctOfTotal(seg.start, totalDuration).toFixed(2)}%`,
              width: `${Math.max(pctOfTotal(seg.duration, totalDuration), 0.25).toFixed(2)}%`,
            }}
            title={`${seg.label}: ${nsToMs(seg.duration)}`}
          />
        ))}
      </div>
      <div className="gql-trace-phase-legend" aria-label="Request phase legend">
        {segments
          .filter((seg, idx, arr) => arr.findIndex((s) => s.variant === seg.variant) === idx)
          .map((seg) => (
            <span key={seg.variant} className="gql-trace-phase-legend-item">
              <span className={`gql-trace-phase-legend-dot gql-trace-phase-seg--${seg.variant}`} aria-hidden="true" />
              {seg.label}
            </span>
          ))}
      </div>
    </div>
  );
}

interface GraphqlTracingViewProps {
  tracing: ApolloTracingData;
}

export function GraphqlTracingView({ tracing }: GraphqlTracingViewProps) {
  const [sortMode, setSortMode] = useState<SortMode>('startTime');

  const totalDurationNs = tracing.duration;
  const resolvers = useMemo(
    () => tracing.execution?.resolvers ?? [],
    [tracing.execution?.resolvers],
  );

  const sortedResolvers = useMemo(() => {
    const copy = [...resolvers];
    switch (sortMode) {
      case 'duration':
        return copy.sort((a, b) => b.duration - a.duration);
      case 'name':
        return copy.sort((a, b) => {
          const an = `${a.parentType}.${a.fieldName}`;
          const bn = `${b.parentType}.${b.fieldName}`;
          return an.localeCompare(bn);
        });
      case 'startTime':
      default:
        return copy.sort((a, b) => a.startOffset - b.startOffset);
    }
  }, [resolvers, sortMode]);

  const slowest = useMemo(() => {
    if (!resolvers.length) return undefined;
    return [...resolvers].sort((a, b) => b.duration - a.duration)[0];
  }, [resolvers]);

  const overheadNs = useMemo(() => computeOverheadNs(tracing), [tracing]);

  if (!resolvers.length) {
    return (
      <div className="gql-trace-empty" data-testid="gql-trace-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p>No resolver traces in response</p>
        <p className="gql-trace-empty-hint">
          Enable tracing on your GraphQL server (e.g. Apollo Server:{' '}
          <code>plugins: [ApolloServerPluginInlineTrace()]</code>)
        </p>
      </div>
    );
  }

  return (
    <div className="gql-trace-view" data-testid="gql-trace-view">
      <div className="gql-trace-stats" data-testid="gql-trace-stats">
        <div className="gql-trace-stat">
          <span className="gql-trace-stat-label">Total</span>
          <span className="gql-trace-stat-value">{nsToMs(totalDurationNs)}</span>
        </div>
        <div className="gql-trace-stat">
          <span className="gql-trace-stat-label">Resolvers</span>
          <span className="gql-trace-stat-value">{resolvers.length}</span>
        </div>
        {tracing.parsing && (
          <div className="gql-trace-stat">
            <span className="gql-trace-stat-label">Parse</span>
            <span className="gql-trace-stat-value">{nsToMs(tracing.parsing.duration)}</span>
          </div>
        )}
        {tracing.validation && (
          <div className="gql-trace-stat">
            <span className="gql-trace-stat-label">Validate</span>
            <span className="gql-trace-stat-value">{nsToMs(tracing.validation.duration)}</span>
          </div>
        )}
        {overheadNs > 0 && (
          <div className="gql-trace-stat">
            <span className="gql-trace-stat-label">Other</span>
            <span className="gql-trace-stat-value gql-trace-stat-value--muted">{nsToMs(overheadNs)}</span>
          </div>
        )}
        {slowest && (
          <div className="gql-trace-stat gql-trace-stat--slowest">
            <span className="gql-trace-stat-label">Slowest</span>
            <span className={`gql-trace-stat-value ${durationTextClass(slowest.duration)}`}>
              <span className="gql-trace-stat-resolver">{slowest.parentType}.{slowest.fieldName}</span>
              <span className="gql-trace-stat-timing">{nsToMs(slowest.duration)}</span>
            </span>
          </div>
        )}
      </div>

      <RequestPhaseBar tracing={tracing} totalDuration={totalDurationNs} />

      <div className="gql-trace-toolbar">
        <div className="gql-trace-sort" role="group" aria-label="Sort resolvers by">
          <span className="gql-trace-toolbar-label">Sort</span>
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
        <div className="gql-trace-legend" aria-label="Duration color legend">
          <span className="gql-trace-legend-item">
            <span className="gql-trace-legend-dot gql-trace-bar--ok" aria-hidden="true" />
            <span>&lt; 50 ms</span>
          </span>
          <span className="gql-trace-legend-item">
            <span className="gql-trace-legend-dot gql-trace-bar--warn" aria-hidden="true" />
            <span>50–200 ms</span>
          </span>
          <span className="gql-trace-legend-item">
            <span className="gql-trace-legend-dot gql-trace-bar--slow" aria-hidden="true" />
            <span>&gt; 200 ms</span>
          </span>
        </div>
      </div>

      <div className="gql-trace-table">
        <div className="gql-trace-header-row" aria-hidden="true">
          <div className="gql-trace-label gql-trace-header-label">Resolver</div>
          <div className="gql-trace-timeline gql-trace-header-timeline">Timeline</div>
          <div className="gql-trace-duration gql-trace-header-duration">Duration</div>
        </div>

        <div className="gql-trace-rows" role="list" aria-label="Resolver traces">
          {sortedResolvers.map((trace, idx) => (
            <ResolverRow
              key={`${trace.parentType}.${trace.fieldName}-${trace.startOffset}-${idx}`}
              trace={trace}
              totalDuration={totalDurationNs}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
