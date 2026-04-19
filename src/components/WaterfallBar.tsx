import type { TimingBreakdown } from '../types';

const PHASES: { key: keyof TimingBreakdown; label: string; color: string }[] = [
  { key: 'dnsLookup', label: 'DNS', color: '#8b5cf6' },
  { key: 'tcpConnect', label: 'TCP', color: '#3b82f6' },
  { key: 'tlsHandshake', label: 'TLS', color: '#f59e0b' },
  { key: 'ttfb', label: 'TTFB', color: '#22c55e' },
  { key: 'download', label: 'Download', color: '#06b6d4' },
];

interface Props {
  timing: TimingBreakdown;
  showLegend?: boolean;
}

export default function WaterfallBar({ timing, showLegend = true }: Props) {
  const total = timing.total || 1;
  const visiblePhases = PHASES.filter(p => timing[p.key] > 0);
  if (visiblePhases.length === 0 && timing.ttfb === 0) return null;

  return (
    <div className="wf-bar-container">
      <div className="wf-bar-track">
        {PHASES.map(phase => {
          const ms = timing[phase.key];
          if (ms <= 0) return null;
          const pct = Math.max((ms / total) * 100, 2);
          return (
            <div
              key={phase.key}
              className="wf-bar-segment"
              style={{ width: `${pct}%`, background: phase.color }}
              title={`${phase.label}: ${ms.toFixed(1)} ms`}
            />
          );
        })}
      </div>

      <div className="wf-bar-labels">
        {PHASES.map(phase => {
          const ms = timing[phase.key];
          if (ms <= 0) return null;
          return (
            <span key={phase.key} className="wf-bar-label">
              <span className="wf-bar-dot" style={{ background: phase.color }} />
              {phase.label}: <strong>{ms.toFixed(1)} ms</strong>
            </span>
          );
        })}
        <span className="wf-bar-label wf-bar-total">
          Total: <strong>{timing.total.toFixed(1)} ms</strong>
        </span>
      </div>

      {showLegend && visiblePhases.length < PHASES.length && (
        <div className="wf-bar-note">
          Phases at 0 ms (connection reused) are hidden.
        </div>
      )}
    </div>
  );
}

export function AggregatedTimingTable({ results }: { results: { timing?: TimingBreakdown }[] }) {
  const withTiming = results.filter((r): r is { timing: TimingBreakdown } => !!r.timing);
  if (withTiming.length === 0) return null;

  const avg = (key: keyof TimingBreakdown) => {
    const sum = withTiming.reduce((s, r) => s + r.timing[key], 0);
    return (sum / withTiming.length).toFixed(1);
  };

  return (
    <div className="wf-agg-table">
      <h4 className="wf-agg-title">Avg Timing Breakdown ({withTiming.length} requests)</h4>
      <div className="wf-agg-grid">
        {PHASES.map(phase => (
          <div key={phase.key} className="wf-agg-cell">
            <span className="wf-bar-dot" style={{ background: phase.color }} />
            <span className="wf-agg-label">{phase.label}</span>
            <strong>{avg(phase.key)} ms</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
