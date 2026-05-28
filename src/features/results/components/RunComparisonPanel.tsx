import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TestRun } from '../../../shared/types';
import type { MetricDelta, ScenarioDelta, RegressionAlert, TrendPoint, BaselineMark, RegressionThresholds } from '../utils/runBaselines';
import { compareRuns, computeTrend } from '../utils/runBaselines';
import { ResponseTimeOverlayHistogram } from './ResponseTimeHistogram';

interface ComparisonProps {
  baselineRun: TestRun;
  currentRun: TestRun;
  /** User-configured thresholds. Defaults to DEFAULT_THRESHOLDS inside compareRuns. */
  thresholds?: RegressionThresholds;
  /** Label stored for the baseline run (from BaselineMark.label). */
  baselineLabel?: string;
  /** Called when user renames the baseline inline. */
  onRenameBaseline?: (runId: string, label: string) => void;
}

export function RunComparisonPanel({ baselineRun, currentRun, thresholds, baselineLabel, onRenameBaseline }: ComparisonProps) {
  const comparison = useMemo(
    () => compareRuns(baselineRun, currentRun, thresholds),
    [baselineRun, currentRun, thresholds],
  );
  const [tab, setTab] = useState<'overview' | 'scenarios' | 'regressions' | 'distribution'>('overview');
  const [renamingBaseline, setRenamingBaseline] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const startRename = () => {
    setRenameValue(baselineLabel ?? new Date(baselineRun.timestamp).toLocaleString());
    setRenamingBaseline(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && onRenameBaseline) onRenameBaseline(baselineRun.id, trimmed);
    setRenamingBaseline(false);
  };

  const baselineDisplay = baselineLabel ?? new Date(baselineRun.timestamp).toLocaleString();

  return (
    <div className="run-comparison-panel">
      <div className="run-comparison-header">
        <h4>Run Comparison</h4>
        <div className="run-comparison-runs">
          <span className="run-comparison-label baseline-label">
            ★ Baseline:
            {renamingBaseline ? (
              <input
                className="baseline-rename-input"
                value={renameValue}
                autoFocus
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingBaseline(false);
                }}
                onBlur={commitRename}
              />
            ) : (
              <>
                {' '}{baselineDisplay}
                {onRenameBaseline && (
                  <button className="baseline-rename-btn" onClick={startRename} title="Rename this baseline">
                    ✏
                  </button>
                )}
              </>
            )}
          </span>
          <span className="run-comparison-vs">vs</span>
          <span className="run-comparison-label current-label">Current: {new Date(currentRun.timestamp).toLocaleString()}</span>
        </div>
      </div>

      {comparison.regressions.length > 0 && (
        <div className="regression-alerts">
          {comparison.regressions.map((r, i) => (
            <div key={i} className={`regression-alert regression-${r.severity}`}>
              <span className="regression-icon">{r.severity === 'critical' ? '🔴' : '🟡'}</span>
              <span>{r.metric}: {r.severity === 'critical' ? 'Critical' : 'Warning'} regression detected</span>
            </div>
          ))}
        </div>
      )}

      <div className="run-comparison-tabs">
        <button className={`run-comparison-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`run-comparison-tab ${tab === 'scenarios' ? 'active' : ''}`} onClick={() => setTab('scenarios')}>
          Per-Scenario {comparison.scenarioDeltas.some((s) => s.regressed) && <span className="tab-alert">!</span>}
        </button>
        <button className={`run-comparison-tab ${tab === 'regressions' ? 'active' : ''}`} onClick={() => setTab('regressions')}>
          Regressions {comparison.regressions.length > 0 && <span className="tab-badge">{comparison.regressions.length}</span>}
        </button>
        <button className={`run-comparison-tab ${tab === 'distribution' ? 'active' : ''}`} onClick={() => setTab('distribution')}>Distribution</button>
      </div>

      {tab === 'overview' && <MetricDeltaTable deltas={comparison.metricDeltas} />}
      {tab === 'scenarios' && <ScenarioDeltaTable deltas={comparison.scenarioDeltas} />}
      {tab === 'regressions' && <RegressionList regressions={comparison.regressions} deltas={comparison.metricDeltas} />}
      {tab === 'distribution' && <ResponseTimeOverlayHistogram baselineRun={baselineRun} currentRun={currentRun} />}
    </div>
  );
}

function MetricDeltaTable({ deltas }: { deltas: MetricDelta[] }) {
  return (
    <table className="comparison-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Baseline</th>
          <th>Current</th>
          <th>Delta</th>
          <th>Change</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {deltas.map((d) => {
          const unit = d.metric === 'TPS' ? '' : d.metric === 'Error Rate' ? '%' : ' ms';
          return (
            <tr key={d.metric} className={d.regressed ? 'row-regressed' : d.improved ? 'row-improved' : ''}>
              <td className="metric-name">{d.metric}</td>
              <td>{d.baselineValue}{unit}</td>
              <td>{d.currentValue}{unit}</td>
              <td className={d.delta > 0 && d.metric !== 'TPS' ? 'delta-worse' : d.delta < 0 && d.metric !== 'TPS' ? 'delta-better' : d.delta > 0 && d.metric === 'TPS' ? 'delta-better' : d.delta < 0 && d.metric === 'TPS' ? 'delta-worse' : ''}>
                {d.delta > 0 ? '+' : ''}{d.delta}{unit}
              </td>
              <td className={d.deltaPercent > 0 && d.metric !== 'TPS' ? 'delta-worse' : d.deltaPercent < 0 && d.metric !== 'TPS' ? 'delta-better' : d.deltaPercent > 0 && d.metric === 'TPS' ? 'delta-better' : d.deltaPercent < 0 && d.metric === 'TPS' ? 'delta-worse' : ''}>
                {d.deltaPercent > 0 ? '+' : ''}{d.deltaPercent}%
              </td>
              <td>
                {d.regressed && <span className="status-badge status-regressed">Regressed</span>}
                {d.improved && !d.regressed && <span className="status-badge status-improved">Improved</span>}
                {!d.improved && !d.regressed && <span className="status-badge status-neutral">No change</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ScenarioDeltaTable({ deltas }: { deltas: ScenarioDelta[] }) {
  if (deltas.length === 0) return <div className="empty-hint">No scenario data to compare.</div>;
  return (
    <table className="comparison-table scenario-table">
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Baseline Avg</th>
          <th>Current Avg</th>
          <th>Delta</th>
          <th>Baseline Errors</th>
          <th>Current Errors</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {deltas.map((d) => (
          <tr key={d.scenarioName} className={d.regressed ? 'row-regressed' : d.timeDelta < 0 ? 'row-improved' : ''}>
            <td className="scenario-name">
              {d.featureGroupName && <span className="scenario-fg">{d.featureGroupName} / </span>}
              {d.scenarioName}
            </td>
            <td>{d.baselineAvgTime} ms <span className="count-dim">({d.baselineCount})</span></td>
            <td>{d.currentAvgTime} ms <span className="count-dim">({d.currentCount})</span></td>
            <td className={d.timeDelta > 0 ? 'delta-worse' : d.timeDelta < 0 ? 'delta-better' : ''}>
              {d.timeDelta > 0 ? '+' : ''}{d.timeDelta} ms ({d.timeDeltaPercent > 0 ? '+' : ''}{d.timeDeltaPercent}%)
            </td>
            <td>{d.baselineErrorRate}%</td>
            <td className={d.currentErrorRate > d.baselineErrorRate ? 'delta-worse' : ''}>{d.currentErrorRate}%</td>
            <td>
              {d.regressed && <span className="status-badge status-regressed">Regressed</span>}
              {!d.regressed && d.timeDelta < 0 && <span className="status-badge status-improved">Faster</span>}
              {!d.regressed && d.timeDelta >= 0 && <span className="status-badge status-neutral">OK</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RegressionList({ regressions, deltas }: { regressions: RegressionAlert[]; deltas: MetricDelta[] }) {
  if (regressions.length === 0) {
    return <div className="empty-hint regression-pass">✓ No regressions detected. All metrics within acceptable thresholds.</div>;
  }
  return (
    <div className="regression-details">
      {regressions.map((r, i) => {
        const delta = deltas.find((d) => d.metric === r.metric);
        return (
          <div key={i} className={`regression-detail regression-${r.severity}`}>
            <div className="regression-detail-header">
              <span className="regression-severity">{r.severity === 'critical' ? '🔴 Critical' : '🟡 Warning'}</span>
              <span className="regression-metric">{r.metric}</span>
            </div>
            {delta && (
              <div className="regression-detail-body">
                <span>Baseline: <strong>{delta.baselineValue}</strong></span>
                <span>→</span>
                <span>Current: <strong>{delta.currentValue}</strong></span>
                <span className="regression-delta">({delta.deltaPercent > 0 ? '+' : ''}{delta.deltaPercent}%)</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Trend Chart ──

interface TrendProps {
  runs: TestRun[];
  baselines: BaselineMark[];
}

export function TrendChart({ runs, baselines }: TrendProps) {
  const [metric, setMetric] = useState<'p95ResponseTime' | 'p50ResponseTime' | 'p99ResponseTime' | 'p999ResponseTime' | 'avgResponseTime' | 'tps' | 'errorRate'>('p95ResponseTime');
  const data = useMemo(() => computeTrend(runs, baselines), [runs, baselines]);

  if (data.length < 2) return <div className="empty-hint">Need at least 2 runs for trend analysis.</div>;

  const metricLabel: Record<string, string> = {
    p95ResponseTime: 'P95 (ms)',
    p50ResponseTime: 'P50 (ms)',
    p99ResponseTime: 'P99 (ms)',
    p999ResponseTime: 'P99.9 (ms)',
    avgResponseTime: 'Avg (ms)',
    tps: 'TPS',
    errorRate: 'Error Rate (%)',
  };

  const baselineRunIds = new Set(baselines.map((b) => b.runId));

  return (
    <div className="trend-chart-container">
      <div className="trend-chart-header">
        <h4>Performance Trend</h4>
        <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} className="trend-metric-select">
          <option value="p95ResponseTime">P95 Response Time</option>
          <option value="p50ResponseTime">P50 Response Time</option>
          <option value="p99ResponseTime">P99 Response Time</option>
          <option value="p999ResponseTime">P99.9 Response Time</option>
          <option value="avgResponseTime">Avg Response Time</option>
          <option value="tps">TPS</option>
          <option value="errorRate">Error Rate</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(t: number) => new Date(t).toLocaleDateString()}
            stroke="var(--text-muted)"
            fontSize={11}
          />
          <YAxis stroke="var(--text-muted)" fontSize={11} />
          <Tooltip
            labelFormatter={(t) => new Date(t as number).toLocaleString()}
            formatter={(value) => [value, metricLabel[metric]]}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={metric}
            name={metricLabel[metric]}
            stroke="var(--primary)"
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: TrendPoint };
              const isBaselinePoint = baselineRunIds.has(payload?.runId);
              return (
                <circle
                  key={payload?.runId}
                  cx={cx}
                  cy={cy}
                  r={isBaselinePoint ? 6 : 3}
                  fill={isBaselinePoint ? 'var(--warning, #f59e0b)' : 'var(--primary)'}
                  stroke={isBaselinePoint ? 'var(--warning, #f59e0b)' : 'var(--primary)'}
                  strokeWidth={isBaselinePoint ? 2 : 1}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
