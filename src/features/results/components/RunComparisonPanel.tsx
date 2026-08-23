import { useState, useMemo, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TestRun } from '@shared/types';
import type { MetricDelta, ScenarioDelta, RegressionAlert, TrendPoint, BaselineMark, RegressionThresholds, TrendMetric, TrendScope } from '../utils/runBaselines';
import { compareRuns, computeTrend, computeScopedTrend, computePerScenarioTrend } from '../utils/runBaselines';
import { ResponseTimeOverlayHistogram } from './ResponseTimeHistogram';
import { generateComparisonMarkdown, generateComparisonJson } from '../utils/comparisonReport';
import { saveFile } from '@shared/utils/fileSaver';
import { CustomSelect } from '@shared/components/CustomSelect';

interface ComparisonProps {
  baselineRun: TestRun;
  currentRun: TestRun;
  /** User-configured thresholds. Defaults to DEFAULT_THRESHOLDS inside compareRuns. */
  thresholds?: RegressionThresholds;
  /** Label stored for the baseline run (from BaselineMark.label). */
  baselineLabel?: string;
  /** True when the compared (left) run is actually baseline-marked. */
  comparedRunIsBaseline?: boolean;
  /** Called when user renames the baseline inline. */
  onRenameBaseline?: (runId: string, label: string) => void;
}

export function RunComparisonPanel({
  baselineRun,
  currentRun,
  thresholds,
  baselineLabel,
  comparedRunIsBaseline,
  onRenameBaseline,
}: ComparisonProps) {
  const comparison = useMemo(
    () => compareRuns(baselineRun, currentRun, thresholds),
    [baselineRun, currentRun, thresholds],
  );
  const [tab, setTab] = useState<'overview' | 'scenarios' | 'regressions' | 'distribution'>('overview');
  const [renamingBaseline, setRenamingBaseline] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  // Prevents onBlur from committing when Escape was pressed
  const renameEscapedRef = useRef(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const handleExportMarkdown = () => {
    setShowExportMenu(false);
    const md = generateComparisonMarkdown(comparison, baselineLabel);
    const blob = new Blob([md], { type: 'text/markdown' });
    void saveFile(blob, { filename: 'comparison-report.md', mimeType: 'text/markdown' });
  };

  const handleExportJson = () => {
    setShowExportMenu(false);
    const json = generateComparisonJson(comparison, baselineLabel);
    const blob = new Blob([json], { type: 'application/json' });
    void saveFile(blob, { filename: 'comparison-report.json', mimeType: 'application/json' });
  };

  // Reset rename UI whenever the baseline being compared changes.
  // Must set the escape guard FIRST so that the input's onBlur (fired when the
  // input unmounts) cannot accidentally rename the newly-arrived baseline.
  useEffect(() => {
    renameEscapedRef.current = true;
    setRenamingBaseline(false);
  }, [baselineRun.id]);

  const startRename = () => {
    renameEscapedRef.current = false;
    setRenameValue(baselineLabel ?? new Date(baselineRun.timestamp).toLocaleString());
    setRenamingBaseline(true);
  };

  // Sole commit path — called only via onBlur
  const commitRename = () => {
    if (renameEscapedRef.current) return;
    const trimmed = renameValue.trim();
    if (trimmed && onRenameBaseline) onRenameBaseline(baselineRun.id, trimmed);
    setRenamingBaseline(false);
  };

  const baselineDisplay = baselineLabel ?? new Date(baselineRun.timestamp).toLocaleString();
  const isComparedRunBaseline = comparedRunIsBaseline ?? !!baselineLabel;
  const leftRunLabel = 'Compared Run';
  const rightRunLabel = 'Baseline Run';
  const selectedColumnLabel = 'Baseline';
  const canRenameComparedBaseline = isComparedRunBaseline && !!onRenameBaseline;
  const improvedCount = comparison.metricDeltas.filter((d) => d.improved && !d.regressed).length;
  const regressedCount = comparison.metricDeltas.filter((d) => d.regressed).length;
  const unchangedCount = comparison.metricDeltas.length - improvedCount - regressedCount;

  return (
    <div className="run-comparison-panel">
      <div className="run-comparison-header">
        <h4>Run Comparison</h4>
        <div className="run-comparison-runs">
          <span className="run-comparison-label baseline-label">
            {leftRunLabel}:
            {renamingBaseline ? (
              <input
                className="baseline-rename-input"
                value={renameValue}
                autoFocus
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                  if (e.key === 'Escape') { e.preventDefault(); renameEscapedRef.current = true; setRenamingBaseline(false); }
                }}
                onBlur={commitRename}
              />
            ) : (
              <>
                {' '}{baselineDisplay}
                {canRenameComparedBaseline && (
                  <button className="baseline-rename-btn" onClick={startRename} title="Rename this baseline">
                    ✏
                  </button>
                )}
              </>
            )}
          </span>
          <span className="run-comparison-vs">vs</span>
          <span className="run-comparison-label current-label">{rightRunLabel}: {new Date(currentRun.timestamp).toLocaleString()}</span>
        </div>
        <div className="run-comparison-export" ref={exportMenuRef}>
          <button
            className="run-comparison-export-btn"
            onClick={() => setShowExportMenu((v) => !v)}
            title="Export comparison report"
          >
            Export ▾
          </button>
          {showExportMenu && (
            <div className="run-comparison-export-menu">
              <button onClick={handleExportMarkdown}>Export as Markdown</button>
              <button onClick={handleExportJson}>Export as JSON</button>
            </div>
          )}
        </div>
      </div>

      <div
        className={`run-comparison-summary ${regressedCount > 0 ? 'has-regressions' : improvedCount > 0 ? 'has-improvements' : 'neutral'}`}
      >
        <span className="run-comparison-summary-counts">
          {regressedCount} regressed · {improvedCount} improved · {unchangedCount} no change
        </span>
        <span className="run-comparison-summary-direction">
          Direction: Compared -&gt; Baseline (swap runs to invert result)
        </span>
      </div>

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

      {tab === 'overview' && <MetricDeltaTable deltas={comparison.metricDeltas} selectedColumnLabel={selectedColumnLabel} />}
      {tab === 'scenarios' && <ScenarioDeltaTable deltas={comparison.scenarioDeltas} selectedColumnLabel={selectedColumnLabel} />}
      {tab === 'regressions' && <RegressionList regressions={comparison.regressions} deltas={comparison.metricDeltas} selectedColumnLabel={selectedColumnLabel} />}
      {tab === 'distribution' && <ResponseTimeOverlayHistogram baselineRun={baselineRun} currentRun={currentRun} />}
    </div>
  );
}

function MetricDeltaTable({ deltas, selectedColumnLabel }: { deltas: MetricDelta[]; selectedColumnLabel: string }) {
  return (
    <table className="comparison-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Compared</th>
          <th>{selectedColumnLabel}</th>
          <th>Delta</th>
          <th>Change</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {deltas.map((d) => {
          // valueUnit applies to baseline/current value columns
          const valueUnit = d.metric === 'TPS' ? '' : d.metric === 'Error Rate' ? '%' : ' ms';
          // deltaUnit for Error Rate uses 'pp' (percentage points) — the delta is an absolute
          // change (e.g. +3 pp), not a relative percentage, so '%' would be misleading.
          const deltaUnit = d.metric === 'TPS' ? '' : d.metric === 'Error Rate' ? ' pp' : ' ms';
          return (
            <tr key={d.metric} className={d.regressed ? 'row-regressed' : d.improved ? 'row-improved' : ''}>
              <td className="metric-name">{d.metric}</td>
              <td>{d.baselineValue}{valueUnit}</td>
              <td>{d.currentValue}{valueUnit}</td>
              <td className={d.delta > 0 && d.metric !== 'TPS' ? 'delta-worse' : d.delta < 0 && d.metric !== 'TPS' ? 'delta-better' : d.delta > 0 && d.metric === 'TPS' ? 'delta-better' : d.delta < 0 && d.metric === 'TPS' ? 'delta-worse' : ''}>
                {d.delta > 0 ? '+' : ''}{d.delta}{deltaUnit}
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

function ScenarioDeltaTable({ deltas, selectedColumnLabel }: { deltas: ScenarioDelta[]; selectedColumnLabel: string }) {
  if (deltas.length === 0) return <div className="empty-hint">No scenario data to compare.</div>;
  return (
    <table className="comparison-table scenario-table">
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Compared Avg</th>
          <th>{selectedColumnLabel} Avg</th>
          <th>Delta</th>
          <th>Compared Errors</th>
          <th>{selectedColumnLabel} Errors</th>
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

function RegressionList({
  regressions,
  deltas,
  selectedColumnLabel,
}: {
  regressions: RegressionAlert[];
  deltas: MetricDelta[];
  selectedColumnLabel: string;
}) {
  if (regressions.length === 0) {
    return <div className="empty-hint regression-pass">✓ No regressions detected. All metrics within acceptable thresholds.</div>;
  }
  return (
    <div className="regression-details">
      {regressions.map((r) => {
        const delta = deltas.find((d) => d.metric === r.metric);
        // Unit for baseline/current value display (same logic as MetricDeltaTable valueUnit)
        const detailUnit = !delta ? '' : delta.metric === 'TPS' ? '' : delta.metric === 'Error Rate' ? '%' : ' ms';
        // Show the actual change using the same units as the configured threshold:
        //   Error Rate → absolute pp change (r.actual stores d.delta for Error Rate)
        //   TPS        → magnitude of % drop (prepend '-' since TPS regression is a drop)
        //   others     → % increase (r.actual stores Math.abs(deltaPercent))
        const deltaDisplay = !delta ? '' : r.metric === 'Error Rate'
          ? `+${r.actual} pp`
          : r.metric === 'TPS'
          ? `-${r.actual}%`
          : `+${r.actual}%`;
        return (
          <div key={r.metric} className={`regression-detail regression-${r.severity}`}>
            <div className="regression-detail-header">
              <span className="regression-severity">{r.severity === 'critical' ? '🔴 Critical' : '🟡 Warning'}</span>
              <span className="regression-metric">{r.metric}</span>
            </div>
            {delta && (
              <div className="regression-detail-body">
                <span>Compared: <strong>{delta.baselineValue}{detailUnit}</strong></span>
                <span>→</span>
                <span>{selectedColumnLabel}: <strong>{delta.currentValue}{detailUnit}</strong></span>
                <span className="regression-delta">({deltaDisplay})</span>
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
  /** The currently-viewed run — used as the reference for scope filtering. */
  selectedRun?: TestRun;
}

const METRIC_LABELS: Record<TrendMetric, string> = {
  p95ResponseTime: 'P95 (ms)',
  p50ResponseTime: 'P50 (ms)',
  p99ResponseTime: 'P99 (ms)',
  p999ResponseTime: 'P99.9 (ms)',
  avgResponseTime: 'Avg (ms)',
  tps: 'TPS',
  errorRate: 'Error Rate (%)',
};

const METRIC_OPTIONS: Array<{ value: TrendMetric; label: string }> = [
  { value: 'p95ResponseTime', label: 'P95 Response Time' },
  { value: 'p50ResponseTime', label: 'P50 Response Time' },
  { value: 'p99ResponseTime', label: 'P99 Response Time' },
  { value: 'p999ResponseTime', label: 'P99.9 Response Time' },
  { value: 'avgResponseTime', label: 'Avg Response Time' },
  { value: 'tps', label: 'TPS' },
  { value: 'errorRate', label: 'Error Rate' },
];

/** Colors for per-scenario trend lines — up to 8. */
const SCENARIO_COLORS = [
  'var(--primary, #6366f1)',
  'var(--warning, #f59e0b)',
  '#10b981',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

export function TrendChart({ runs, baselines, selectedRun }: TrendProps) {
  const [metric, setMetric] = useState<TrendMetric>('p95ResponseTime');
  const [metric2, setMetric2] = useState<TrendMetric | 'none'>('none');
  const [scope, setScope] = useState<TrendScope>('all');
  const [chartTab, setChartTab] = useState<'overall' | 'per-scenario'>('overall');

  // Reset to 'all' scope when the selected run changes to one that no longer
  // supports the active scope (e.g., switching from a workflow run to a test run,
  // or when the run becomes undefined and all non-'all' options are disabled).
  useEffect(() => {
    if (!selectedRun) { setScope('all'); return; }
    if (scope === 'service' && !selectedRun.svcName) setScope('all');
    if (scope === 'env' && (!selectedRun.svcName || !selectedRun.envName)) setScope('all');
    if (scope === 'workflow' && !selectedRun.workflowName) setScope('all');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRun?.id]);

  const data = useMemo(() => {
    if (selectedRun && scope !== 'all') return computeScopedTrend(runs, selectedRun, scope, baselines);
    return computeTrend(runs, baselines);
  }, [runs, baselines, selectedRun, scope]);

  const perScenario = useMemo(() => {
    if (chartTab !== 'per-scenario') return null;
    const ref = selectedRun ?? runs[0];
    if (!ref) return null;
    return computePerScenarioTrend(runs, ref, scope, baselines);
  }, [runs, baselines, selectedRun, scope, chartTab]);

  // Flatten per-scenario data into a Recharts-compatible array joined by timestamp
  const scenarioChartData = useMemo(() => {
    if (!perScenario || perScenario.seriesKeys.length === 0) return [];
    const allTimestamps = [...new Set(
      Object.values(perScenario.data).flat().map((p) => p.timestamp),
    )].sort((a, b) => a - b);
    return allTimestamps.map((ts) => {
      const row: Record<string, number | null> = { timestamp: ts };
      for (const key of perScenario.seriesKeys) {
        const pt = perScenario.data[key]?.find((p) => p.timestamp === ts);
        row[key] = pt?.avgTime ?? null;
      }
      return row;
    });
  }, [perScenario]);

  if (data.length < 2) {
    const msg = scope !== 'all'
      ? `Only ${data.length} run${data.length === 1 ? '' : 's'} match this scope — try "All runs" for a broader view.`
      : 'Need at least 2 runs for trend analysis.';
    return <div className="empty-hint">{msg}</div>;
  }

  const baselineRunIds = new Set(baselines.map((b) => b.runId));

  const baselineDot = (props: Record<string, unknown>) => {
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
  };

  return (
    <div className="trend-chart-container">
      <div className="trend-chart-header">
        <h4>Performance Trend</h4>

        {/* Chart tabs: Overall vs Per-Scenario */}
        <div className="trend-chart-tabs">
          <button
            className={`trend-chart-tab${chartTab === 'overall' ? ' active' : ''}`}
            onClick={() => setChartTab('overall')}
          >
            Overall
          </button>
          <button
            className={`trend-chart-tab${chartTab === 'per-scenario' ? ' active' : ''}`}
            onClick={() => setChartTab('per-scenario')}
          >
            Per-Scenario
          </button>
        </div>

        {/* Controls row: scope + metric selectors */}
        <div className="trend-controls">
          {/* Scope filter */}
          <CustomSelect
            value={scope}
            onChange={(v) => setScope(v as TrendScope)}
            className="trend-scope-select"
            aria-label="Limit trend to runs from the same suite"
            options={[
              { value: 'all', label: 'All runs' },
              { value: 'service', label: 'By service', disabled: !selectedRun?.svcName },
              { value: 'env', label: 'By service + env', disabled: !selectedRun?.svcName || !selectedRun?.envName },
              { value: 'workflow', label: 'By workflow', disabled: !selectedRun?.workflowName },
            ]}
            size="sm"
          />

          {chartTab === 'overall' && (
            <>
              <CustomSelect
                value={metric}
                onChange={(v) => {
                  const m = v as TrendMetric;
                  setMetric(m);
                  if (m === metric2) setMetric2('none');
                }}
                className="trend-metric-select"
                options={METRIC_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                size="sm"
              />

              <CustomSelect
                value={metric2}
                onChange={(v) => setMetric2(v as TrendMetric | 'none')}
                className="trend-metric-select2"
                aria-label="Add a second metric line (right axis)"
                placeholder="+ overlay metric"
                options={[
                  { value: 'none', label: '+ overlay metric' },
                  ...METRIC_OPTIONS.filter((o) => o.value !== metric).map((o) => ({
                    value: o.value,
                    label: o.label,
                  })),
                ]}
                size="sm"
              />
            </>
          )}
        </div>
      </div>

      {chartTab === 'overall' && (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 10, right: metric2 !== 'none' ? 50 : 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(t: number) => new Date(t).toLocaleDateString()}
              stroke="var(--text-muted)"
              fontSize={11}
            />
            {/* Always use yAxisId so dual-axis switching is seamless */}
            <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={11} />
            {metric2 !== 'none' && (
              <YAxis yAxisId="right" orientation="right" stroke="var(--accent, #10b981)" fontSize={11} />
            )}
            <Tooltip
              labelFormatter={(t) => new Date(t as number).toLocaleString()}
              formatter={(value, name) => [value, name as string]}
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey={metric}
              name={METRIC_LABELS[metric]}
              stroke="var(--primary)"
              strokeWidth={2}
              dot={baselineDot}
            />
            {metric2 !== 'none' && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={metric2}
                name={METRIC_LABELS[metric2]}
                stroke="var(--accent, #10b981)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      {chartTab === 'per-scenario' && (
        perScenario && perScenario.seriesKeys.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={scenarioChartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(t: number) => new Date(t).toLocaleDateString()}
                stroke="var(--text-muted)"
                fontSize={11}
              />
              <YAxis stroke="var(--text-muted)" fontSize={11} label={{ value: 'Avg (ms)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
              <Tooltip
                labelFormatter={(t) => new Date(t as number).toLocaleString()}
                formatter={(value, name) => [value != null ? `${value} ms` : '—', name as string]}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 }}
              />
              <Legend />
              {perScenario.seriesKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={perScenario.scenarioNames[i]}
                  stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-hint">No scenario data available for the selected scope.</div>
        )
      )}
    </div>
  );
}
