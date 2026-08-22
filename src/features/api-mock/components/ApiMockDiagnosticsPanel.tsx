import { useEffect, useRef, useState } from 'react';
import type { ApiMockLocalDiagnosticsV1 } from '../../../shared/api-mock/contracts';
import { apiMockControlClient } from '../apiMockControlClient';

interface Props {
  serverId?: string;
  running?: boolean;
}

const OUTCOME_COLORS: Record<string, string> = {
  matched: '#22c55e',
  unmatched: '#ef4444',
  ambiguous: '#f59e0b',
  fault: '#a78bfa',
  error: '#ef4444',
  proxied: '#3b82f6',
};

function Metric({ label, value, testId, warn }: { label: string; value: string | number; testId: string; warn?: boolean }) {
  return (
    <div className={`am-diag-metric${warn ? ' am-diag-metric--warn' : ''}`}>
      <span className="am-faint">{label}</span>
      <strong data-testid={testId}>{value}</strong>
    </div>
  );
}

function OutcomeBar({ outcomes }: { outcomes: Record<string, number> }) {
  const total = Object.values(outcomes).reduce((s, n) => s + n, 0);
  if (total === 0) {
    return (
      <div className="am-diag-outcome-bar-empty">
        No traffic recorded yet
      </div>
    );
  }
  return (
    <div className="am-diag-outcome-bar-wrap">
      <div className="am-diag-outcome-bar">
        {Object.entries(outcomes).map(([key, n]) => {
          if (n === 0) return null;
          const pct = (n / total) * 100;
          return (
            <div
              key={key}
              className="am-diag-outcome-segment"
              style={{
                width: `${Math.max(pct, 2)}%`,
                backgroundColor: OUTCOME_COLORS[key] ?? 'var(--border)',
              }}
              title={`${key}: ${n} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="am-diag-outcome-legend" data-testid="api-mock-diag-outcomes">
        {Object.entries(outcomes).map(([key, n]) => (
          <span key={key} className="am-diag-outcome-item">
            <span
              className="am-diag-outcome-dot"
              style={{ backgroundColor: OUTCOME_COLORS[key] ?? 'var(--border)' }}
            />
            <span className="am-diag-outcome-label">{key}</span>
            <span className="am-diag-outcome-count">{n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Runtime local diagnostics — counters only, never payloads.
 */
export function ApiMockDiagnosticsPanel({ serverId, running }: Props) {
  const [data, setData] = useState<ApiMockLocalDiagnosticsV1 | null>(null);
  const [error, setError] = useState<string | undefined>();
  const loadedFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!serverId) {
      setData(null);
      setError(undefined);
      return;
    }
    let cancelled = false;
    if (loadedFor.current !== serverId) {
      setData(null);
      setError(undefined);
      loadedFor.current = serverId;
    }
    const load = async () => {
      const res = await apiMockControlClient.diagnostics(serverId);
      if (cancelled) return;
      if (res.ok) {
        setData(res.data);
        setError(undefined);
      } else {
        setError(res.error.message);
      }
    };
    void load();
    if (!running) return () => { cancelled = true; };
    const timer = window.setInterval(() => void load(), 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [serverId, running]);

  if (!serverId) {
    return <div className="am-dock-empty" data-testid="api-mock-diagnostics-empty">Select a mock server to see diagnostics.</div>;
  }
  if (error && !data) {
    return <div className="am-dock-empty" data-testid="api-mock-diagnostics-error">{error}</div>;
  }
  if (!data) {
    return <div className="am-dock-empty" data-testid="api-mock-diagnostics-loading">Loading diagnostics…</div>;
  }

  const journalPct = data.journal.maxEntries > 0
    ? Math.round((data.journal.size / data.journal.maxEntries) * 100)
    : 0;
  const journalHigh = journalPct >= 80;

  return (
    <div className="am-diagnostics" data-testid="api-mock-diagnostics">
      <p className="am-hint am-hint--wrap am-diag-privacy">Local counters only — no URLs, headers, bodies, or secrets.</p>

      {/* ── Traffic outcomes ─────────────────────────── */}
      <div className="am-diag-section">
        <div className="am-diag-section-head">
          <span className="am-diag-section-icon" aria-hidden="true">&#9632;</span>
          <span className="am-diag-section-title">Traffic outcomes</span>
          <span className="am-diag-section-total">
            {Object.values(data.outcomes).reduce((s, n) => s + n, 0)} total
          </span>
        </div>
        <OutcomeBar outcomes={data.outcomes} />
      </div>

      {/* ── Server info ──────────────────────────────── */}
      <div className="am-diag-section">
        <div className="am-diag-section-head">
          <span className="am-diag-section-icon" aria-hidden="true">&#9881;</span>
          <span className="am-diag-section-title">Server</span>
        </div>
        <div className="am-diag-grid">
          <Metric label="Generation" value={data.generation} testId="api-mock-diag-generation" />
          <Metric label="Routes" value={data.routeCount} testId="api-mock-diag-routes" />
          <Metric label="Predicates" value={data.predicateCount} testId="api-mock-diag-predicates" />
          <Metric label="Open connections" value={data.openConnections} testId="api-mock-diag-connections" warn={data.openConnections > 0} />
          <Metric label="In flight" value={data.inFlight} testId="api-mock-diag-inflight" warn={data.inFlight > 0} />
          <Metric label="Template errors" value={data.templateErrors} testId="api-mock-diag-template-errors" warn={data.templateErrors > 0} />
        </div>
      </div>

      {/* ── Match performance ────────────────────────── */}
      <div className="am-diag-section">
        <div className="am-diag-section-head">
          <span className="am-diag-section-icon" aria-hidden="true">&#9201;</span>
          <span className="am-diag-section-title">Match performance</span>
        </div>
        <div className="am-diag-grid">
          <Metric label="Last (ms)" value={data.matchDuration.lastMs} testId="api-mock-diag-match-last" />
          <Metric label="p95 (ms)" value={data.matchDuration.p95Ms} testId="api-mock-diag-match-p95" warn={data.matchDuration.p95Ms > 10} />
          <Metric label="Samples" value={data.matchDuration.count} testId="api-mock-diag-match-count" />
        </div>
      </div>

      {/* ── Journal health ───────────────────────────── */}
      <div className="am-diag-section">
        <div className="am-diag-section-head">
          <span className="am-diag-section-icon" aria-hidden="true">&#128203;</span>
          <span className="am-diag-section-title">Journal</span>
        </div>
        <div className="am-diag-journal-bar-wrap">
          <div className="am-diag-journal-bar">
            <div
              className={`am-diag-journal-fill${journalHigh ? ' am-diag-journal-fill--high' : ''}`}
              style={{ width: `${Math.min(journalPct, 100)}%` }}
            />
          </div>
          <span className="am-diag-journal-label" data-testid="api-mock-diag-journal-size">
            {data.journal.size}/{data.journal.maxEntries}
          </span>
          <span className="am-diag-journal-pct">{journalPct}%</span>
        </div>
        <div className="am-diag-grid am-diag-grid--compact">
          <Metric label="Drops" value={data.journal.drops} testId="api-mock-diag-drops" warn={data.journal.drops > 0} />
          <Metric label="Truncations" value={data.journal.truncations} testId="api-mock-diag-truncations" warn={data.journal.truncations > 0} />
        </div>
      </div>
    </div>
  );
}
