import { useMemo } from 'react';
import type { TestRun } from '@shared/types';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { BaselineMark } from '../utils/runBaselines';

interface Props {
  isBaselineMode: boolean;
  compareBaselineId: string;
  runs: TestRun[];
  baselines: BaselineMark[];
  selectedRunId: string;
  showTrend: boolean;
  onCompareSelectionChange: (runId: string) => void;
  onClearComparison: () => void;
  onToggleTrend: () => void;
}

export function ResultsComparisonTrendsToolbar({
  isBaselineMode,
  compareBaselineId,
  runs,
  baselines,
  selectedRunId,
  showTrend,
  onCompareSelectionChange,
  onClearComparison,
  onToggleTrend,
}: Props) {
  const compareOptions = useMemo(() => {
    const baselineOpts = runs
      .filter((r) => baselines.some((b) => b.runId === r.id) && r.id !== selectedRunId)
      .map((r) => {
        const bl = baselines.find((b) => b.runId === r.id);
        const label = bl?.label ?? new Date(r.timestamp).toLocaleString();
        return { value: r.id, label: `★ ${label} — ${r.summary.tps} TPS` };
      });
    const otherOpts = runs
      .filter((r) => !baselines.some((b) => b.runId === r.id) && r.id !== selectedRunId)
      .map((r) => ({
        value: r.id,
        label: `${new Date(r.timestamp).toLocaleString()} — ${r.summary.tps} TPS`,
      }));
    if (baselineOpts.length > 0 && otherOpts.length > 0) {
      return [
        { label: 'Baselines', options: baselineOpts },
        { label: 'Other runs', options: otherOpts },
      ];
    }
    return [...baselineOpts, ...otherOpts];
  }, [runs, baselines, selectedRunId]);

  return (
    <div className="results-comparison-trends-toolbar baseline-controls">
      <span
        className={`comparison-mode-badge ${isBaselineMode ? 'baseline' : 'adhoc'}`}
        title={
          isBaselineMode
            ? 'Baseline mode: comparing against a baseline-marked run.'
            : 'Ad-hoc mode: manual compare target selection (or no compare target selected).'
        }
      >
        {isBaselineMode ? 'Baseline Mode' : 'Ad-hoc Mode'}
      </span>

      <span className="comparison-mode-caption">
        {isBaselineMode
          ? 'Using a marked baseline as compare target.'
          : 'Manual compare target (or none).'}
      </span>

      <CustomSelect
        className="baseline-compare-select"
        value={compareBaselineId}
        onChange={onCompareSelectionChange}
        options={compareOptions}
        placeholder="Compare against run..."
        size="sm"
      />

      {compareBaselineId && (
        <span className="baseline-compare-chip">
          {(() => {
            const bl = baselines.find((b) => b.runId === compareBaselineId);
            const blRun = runs.find((r) => r.id === compareBaselineId);
            const label = bl?.label ?? (blRun ? new Date(blRun.timestamp).toLocaleString() : compareBaselineId.slice(0, 12));
            return `vs ${label}`;
          })()}
          <button
            className="baseline-compare-chip-clear"
            onClick={onClearComparison}
            title="Clear comparison"
          >✕</button>
        </span>
      )}

      <button
        className={`btn btn-sm ${showTrend ? 'btn-primary' : ''}`}
        onClick={onToggleTrend}
      >
        {showTrend ? 'Hide Trend' : 'Show Trend'}
      </button>
    </div>
  );
}