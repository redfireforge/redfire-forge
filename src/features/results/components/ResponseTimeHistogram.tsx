import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

import type { TestRun } from '../../../shared/types';
import { computeHistogramBins, computeOverlayHistogram, computeDistributionStats } from '../utils/responseTimeHistogram';

// ── Single-run histogram ──

interface SingleHistogramProps {
  run: TestRun;
}

export function ResponseTimeHistogram({ run }: SingleHistogramProps) {
  const times = useMemo(() => run.results.map(r => r.responseTimeMs), [run]);
  const bins = useMemo(() => computeHistogramBins(times), [times]);
  const stats = useMemo(() => computeDistributionStats(times), [times]);

  if (bins.length === 0) return <div className="empty-hint">No response data for distribution.</div>;

  const data = bins.map(b => ({
    range: `${b.min.toFixed(0)}`,
    count: b.count,
    percent: b.percent,
  }));

  return (
    <div className="histogram-container">
      <div className="histogram-header">
        <h4>Response Time Distribution</h4>
        {stats && (
          <div className="histogram-stats">
            <span>μ={stats.mean}ms</span>
            <span>σ={stats.stdDev}ms</span>
            <span>med={stats.median}ms</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="range"
            stroke="var(--text-muted)"
            fontSize={10}
            label={{ value: 'Response Time (ms)', position: 'bottom', offset: 5, fontSize: 11, fill: 'var(--text-muted)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={10}
            label={{ value: 'Requests', angle: -90, position: 'insideLeft', offset: -5, fontSize: 11, fill: 'var(--text-muted)' }}
          />
          <Tooltip
            formatter={
              ((value: number, name: string) => [
                name === 'percent' ? `${value}%` : value,
                name === 'percent' ? 'Percentage' : 'Count',
              ]) as never
            }
            labelFormatter={(label) => `${label} ms`}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
          />
          <Bar dataKey="count" fill="var(--primary)" opacity={0.8} radius={[2, 2, 0, 0]} />
          {stats && <ReferenceLine x={`${bins.find(b => b.min <= stats.p95 && b.max >= stats.p95)?.min.toFixed(0)}`} stroke="var(--warning, #f59e0b)" strokeDasharray="3 3" label={{ value: 'P95', fill: 'var(--warning, #f59e0b)', fontSize: 10 }} />}
          {stats && <ReferenceLine x={`${bins.find(b => b.min <= stats.p99 && b.max >= stats.p99)?.min.toFixed(0)}`} stroke="var(--error, #ef4444)" strokeDasharray="3 3" label={{ value: 'P99', fill: 'var(--error, #ef4444)', fontSize: 10 }} />}
          {stats?.p999 != null && <ReferenceLine x={`${bins.find(b => b.min <= stats.p999! && b.max >= stats.p999!)?.min.toFixed(0)}`} stroke="var(--text-muted, #9ca3af)" strokeDasharray="5 2" label={{ value: 'P99.9', fill: 'var(--text-muted, #9ca3af)', fontSize: 10 }} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Overlay histogram (baseline vs current) ──

interface OverlayHistogramProps {
  baselineRun: TestRun;
  currentRun: TestRun;
}

export function ResponseTimeOverlayHistogram({ baselineRun, currentRun }: OverlayHistogramProps) {
  const [mode, setMode] = useState<'count' | 'percent'>('percent');

  const baselineTimes = useMemo(() => baselineRun.results.map(r => r.responseTimeMs), [baselineRun]);
  const currentTimes = useMemo(() => currentRun.results.map(r => r.responseTimeMs), [currentRun]);
  const overlay = useMemo(() => computeOverlayHistogram(baselineTimes, currentTimes), [baselineTimes, currentTimes]);
  const baselineStats = useMemo(() => computeDistributionStats(baselineTimes), [baselineTimes]);
  const currentStats = useMemo(() => computeDistributionStats(currentTimes), [currentTimes]);

  if (overlay.bins.length === 0) return <div className="empty-hint">No response data for distribution comparison.</div>;

  const data = overlay.bins.map((b, i) => ({
    range: `${b.min.toFixed(0)}`,
    baseline: mode === 'percent' ? overlay.baselinePercent[i] : overlay.baseline[i],
    current: mode === 'percent' ? overlay.currentPercent[i] : overlay.current[i],
  }));

  return (
    <div className="histogram-container">
      <div className="histogram-header">
        <h4>Response Time Distribution (ms)</h4>
        <div className="histogram-controls">
          <button
            className={`histogram-mode-btn ${mode === 'percent' ? 'active' : ''}`}
            onClick={() => setMode('percent')}
          >%</button>
          <button
            className={`histogram-mode-btn ${mode === 'count' ? 'active' : ''}`}
            onClick={() => setMode('count')}
          >#</button>
        </div>
      </div>

      {baselineStats && currentStats && (
        <div className="histogram-stats-row">
          <div className="histogram-stat-group baseline-stat">
            <span className="stat-label">Baseline:</span>
            <span>μ={baselineStats.mean}ms</span>
            <span>P95={baselineStats.p95}ms</span>
            <span>n={baselineStats.count}</span>
          </div>
          <div className="histogram-stat-group current-stat">
            <span className="stat-label">Current:</span>
            <span>μ={currentStats.mean}ms</span>
            <span>P95={currentStats.p95}ms</span>
            <span>n={currentStats.count}</span>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 30 }} barCategoryGap="10%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="range"
            stroke="var(--text-muted)"
            fontSize={10}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={10}
            label={{ value: mode === 'percent' ? '%' : 'Requests', angle: -90, position: 'insideLeft', offset: -5, fontSize: 11, fill: 'var(--text-muted)' }}
          />
          <Tooltip
            formatter={
              ((value: number, name: string) => [
                mode === 'percent' ? `${value}%` : value,
                name === 'baseline' ? 'Baseline' : 'Current',
              ]) as never
            }
            labelFormatter={(label) => `${label} ms`}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
          />
          <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 12 }} />
          <Bar dataKey="baseline" name="Baseline" fill="var(--info, #3b82f6)" opacity={0.6} radius={[2, 2, 0, 0]} />
          <Bar dataKey="current" name="Current" fill="var(--success, #22c55e)" opacity={0.6} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
