import { useEffect, useRef, useState } from 'react';
import type { ApiMockLocalDiagnosticsV1 } from '../../../shared/api-mock/contracts';
import { apiMockControlClient } from '../apiMockControlClient';

interface Props {
  serverId?: string;
  running?: boolean;
}

function Metric({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return (
    <div className="am-diag-metric">
      <span className="am-faint">{label}</span>
      <strong data-testid={testId}>{value}</strong>
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

  return (
    <div className="am-diagnostics" data-testid="api-mock-diagnostics">
      <p className="am-hint am-hint--wrap">Local counters only — no URLs, headers, bodies, or secrets.</p>
      <div className="am-diag-grid">
        <Metric label="Generation" value={data.generation} testId="api-mock-diag-generation" />
        <Metric label="Routes" value={data.routeCount} testId="api-mock-diag-routes" />
        <Metric label="Predicates" value={data.predicateCount} testId="api-mock-diag-predicates" />
        <Metric label="Open connections" value={data.openConnections} testId="api-mock-diag-connections" />
        <Metric label="In flight" value={data.inFlight} testId="api-mock-diag-inflight" />
        <Metric label="Match last (ms)" value={data.matchDuration.lastMs} testId="api-mock-diag-match-last" />
        <Metric label="Match p95 (ms)" value={data.matchDuration.p95Ms} testId="api-mock-diag-match-p95" />
        <Metric label="Match samples" value={data.matchDuration.count} testId="api-mock-diag-match-count" />
        <Metric label="Journal drops" value={data.journal.drops} testId="api-mock-diag-drops" />
        <Metric label="Journal truncations" value={data.journal.truncations} testId="api-mock-diag-truncations" />
        <Metric label="Journal size" value={`${data.journal.size}/${data.journal.maxEntries}`} testId="api-mock-diag-journal-size" />
        <Metric label="Template errors" value={data.templateErrors} testId="api-mock-diag-template-errors" />
      </div>
      <div className="am-diag-outcomes" data-testid="api-mock-diag-outcomes">
        {Object.entries(data.outcomes).map(([key, n]) => (
          <span key={key} className="am-badge">{key} {n}</span>
        ))}
      </div>
    </div>
  );
}
