import type { TestRun } from '../../../shared/types';
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

      <select
        className="baseline-compare-select"
        value={compareBaselineId}
        onChange={(e) => onCompareSelectionChange(e.target.value)}
      >
        <option value="">Compare against run...</option>
        {runs.filter((r) => baselines.some((b) => b.runId === r.id) && r.id !== selectedRunId).map((r) => {
          const bl = baselines.find((b) => b.runId === r.id);
          const label = bl?.label ?? new Date(r.timestamp).toLocaleString();
          return <option key={r.id} value={r.id}>★ {label} — {r.summary.tps} TPS</option>;
        })}
        {runs.some((r) => baselines.some((b) => b.runId === r.id) && r.id !== selectedRunId) &&
          runs.some((r) => !baselines.some((b) => b.runId === r.id) && r.id !== selectedRunId) && (
            <option disabled>──────────────</option>
          )}
        {runs.filter((r) => !baselines.some((b) => b.runId === r.id) && r.id !== selectedRunId).map((r) => (
          <option key={r.id} value={r.id}>{new Date(r.timestamp).toLocaleString()} — {r.summary.tps} TPS</option>
        ))}
      </select>

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