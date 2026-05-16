/**
 * MappingCompare — Phase 9D.1
 *
 * Side-by-side comparison of mapping traces from two different test runs.
 * Shows regressions, fixes, changed values, and unchanged mappings.
 * Designed as an embeddable panel (used in Results Explorer or standalone).
 */

import { useMemo, useState } from 'react';
import type { MappingTrace } from './utils/mappingTrace';
import { isTraceError } from './utils/mappingTrace';
import {
  compareTraces,
  formatComparisonValue,
  type TraceComparisonEntry,
  type ComparisonStatus,
} from './utils/traceComparison';

export interface MappingCompareProps {
  baselineTraces: MappingTrace[];
  currentTraces: MappingTrace[];
  baselineLabel?: string;
  currentLabel?: string;
}

type FilterMode = 'all' | 'regression' | 'changed' | 'fixed';

const STATUS_LABELS: Record<ComparisonStatus, string> = {
  unchanged: 'Unchanged',
  changed: 'Changed',
  regression: 'Regression',
  fixed: 'Fixed',
  added: 'Added',
  removed: 'Removed',
};

const STATUS_ICONS: Record<ComparisonStatus, string> = {
  unchanged: '=',
  changed: '~',
  regression: '✗',
  fixed: '✓',
  added: '+',
  removed: '−',
};

export default function MappingCompare({
  baselineTraces,
  currentTraces,
  baselineLabel = 'Baseline',
  currentLabel = 'Current',
}: MappingCompareProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  const comparison = useMemo(
    () => compareTraces(baselineTraces, currentTraces),
    [baselineTraces, currentTraces],
  );

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return comparison.entries;
    if (filter === 'changed') {
      return comparison.entries.filter((e) => e.status !== 'unchanged');
    }
    return comparison.entries.filter((e) => e.status === filter);
  }, [comparison.entries, filter]);

  const { summary } = comparison;

  return (
    <div className="dm-compare" data-testid="mapping-compare">
      {/* Summary bar */}
      <div className="dm-compare-summary">
        <span className="dm-compare-total">{summary.total} mappings compared</span>
        {summary.regressions > 0 && (
          <span className="dm-compare-badge dm-compare-badge--regression">
            {summary.regressions} regression{summary.regressions !== 1 ? 's' : ''}
          </span>
        )}
        {summary.fixed > 0 && (
          <span className="dm-compare-badge dm-compare-badge--fixed">
            {summary.fixed} fixed
          </span>
        )}
        {summary.changed > 0 && (
          <span className="dm-compare-badge dm-compare-badge--changed">
            {summary.changed} changed
          </span>
        )}
        {summary.unchanged > 0 && (
          <span className="dm-compare-badge dm-compare-badge--unchanged">
            {summary.unchanged} unchanged
          </span>
        )}
      </div>

      {/* Filter controls */}
      <div className="dm-compare-filters" role="group" aria-label="Filter comparison">
        <button
          className={`dm-compare-filter-btn ${filter === 'all' ? 'dm-compare-filter-btn--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({summary.total})
        </button>
        <button
          className={`dm-compare-filter-btn ${filter === 'regression' ? 'dm-compare-filter-btn--active' : ''}`}
          onClick={() => setFilter('regression')}
          disabled={summary.regressions === 0}
        >
          Regressions ({summary.regressions})
        </button>
        <button
          className={`dm-compare-filter-btn ${filter === 'changed' ? 'dm-compare-filter-btn--active' : ''}`}
          onClick={() => setFilter('changed')}
          disabled={summary.changed + summary.regressions + summary.fixed + summary.added + summary.removed === 0}
        >
          Changes ({summary.total - summary.unchanged})
        </button>
        <button
          className={`dm-compare-filter-btn ${filter === 'fixed' ? 'dm-compare-filter-btn--active' : ''}`}
          onClick={() => setFilter('fixed')}
          disabled={summary.fixed === 0}
        >
          Fixed ({summary.fixed})
        </button>
      </div>

      {/* Comparison table */}
      <div className="dm-compare-table-wrap">
        <table className="dm-compare-table">
          <thead>
            <tr>
              <th className="dm-compare-th-status"></th>
              <th className="dm-compare-th-path">Mapping</th>
              <th className="dm-compare-th-value">{baselineLabel}</th>
              <th className="dm-compare-th-value">{currentLabel}</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={4} className="dm-compare-empty">
                  {summary.total === 0
                    ? 'No mapping traces to compare.'
                    : 'No mappings match the current filter.'}
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <ComparisonRow key={entry.mappingId} entry={entry} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparisonRow({ entry }: { entry: TraceComparisonEntry }) {
  const baseVal = formatComparisonValue(entry.baseline);
  const currVal = formatComparisonValue(entry.current);

  return (
    <tr className={`dm-compare-row dm-compare-row--${entry.status}`} data-testid={`compare-row-${entry.mappingId}`}>
      <td className="dm-compare-cell-status">
        <span
          className={`dm-compare-status-icon dm-compare-status-icon--${entry.status}`}
          title={STATUS_LABELS[entry.status]}
        >
          {STATUS_ICONS[entry.status]}
        </span>
      </td>
      <td className="dm-compare-cell-path">
        <span className="dm-compare-source">{entry.sourcePath}</span>
        <span className="dm-compare-arrow">→</span>
        <span className="dm-compare-target">{entry.targetPath}</span>
      </td>
      <td
        className={`dm-compare-cell-value ${entry.baseline && isTraceError(entry.baseline) ? 'dm-compare-cell-value--error' : ''}`}
        title={baseVal}
      >
        <code>{truncateValue(baseVal)}</code>
      </td>
      <td
        className={`dm-compare-cell-value ${entry.current && isTraceError(entry.current) ? 'dm-compare-cell-value--error' : ''}`}
        title={currVal}
      >
        <code>{truncateValue(currVal)}</code>
      </td>
    </tr>
  );
}

function truncateValue(v: string, max = 60): string {
  return v.length > max ? v.slice(0, max - 1) + '…' : v;
}
