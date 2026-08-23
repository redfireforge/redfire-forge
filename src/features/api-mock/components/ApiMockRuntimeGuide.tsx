import { useMemo, useState } from 'react';
import type { ApiMockRouteV1, ApiMockServerSettingsV1 } from '@shared/api-mock/contracts';

interface Props {
  running: boolean;
  serverAddress: string;
  routes: ApiMockRouteV1[];
  settings?: ApiMockServerSettingsV1;
  variableCount?: number;
  onCopySample?: (text: string) => void;
}

function policyLabel(settings?: ApiMockServerSettingsV1): string {
  if (!settings) return 'Default selection policy';
  const multi = settings.selection.multipleMatchPolicy === 'highest_priority'
    ? 'highest priority wins'
    : 'reject multiple matches';
  const equal = settings.selection.equalPriorityPolicy === 'reject'
    ? 'equal priority → 409'
    : 'specificity then stable id';
  return `${multi} · ${equal}`;
}

function pickSamplePath(routes: ApiMockRouteV1[]): { method: string; path: string } {
  const enabled = routes.find(r => r.enabled) ?? routes[0];
  if (!enabled) return { method: 'GET', path: '/' };
  const path = enabled.path.value?.startsWith('/') ? enabled.path.value : `/${enabled.path.value || ''}`;
  return { method: enabled.method === 'ANY' ? 'GET' : enabled.method, path: path || '/' };
}

/**
 * Full-page Runtime empty state — readiness summary + how the journal works.
 */
export function ApiMockRuntimeGuide({
  running,
  serverAddress,
  routes,
  settings,
  variableCount = 0,
  onCopySample,
}: Props) {
  const enabledCount = routes.filter(r => r.enabled).length;
  const sample = useMemo(() => pickSamplePath(routes), [routes]);
  const curl = `curl -i -X ${sample.method} '${serverAddress.replace(/\/$/, '')}${sample.path}'`;
  const [copied, setCopied] = useState(false);
  const journalMax = settings?.journal.maxEntries ?? 500;
  const journalOn = settings?.journal.enabled !== false;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(curl);
      onCopySample?.(curl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="am-guide" data-testid="api-mock-runtime-guide">
      <div className="am-guide-hero">
        <div className="am-guide-kicker">{running ? 'Server listening' : 'Server stopped'}</div>
        <h2 className="am-guide-title">
          {running ? 'Waiting for the first request' : 'Start the mock to fill this journal'}
        </h2>
        <p className="am-guide-lead">
          Runtime captures every inbound hit with match outcome, duration, and the rule that won —
          so you can debug selection without leaving Mock Studio.
        </p>
      </div>

      <div className="am-guide-stats" role="list" aria-label="Runtime readiness">
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Status</span>
          <span className={`am-badge ${running ? 'success' : ''}`}>{running ? 'Running' : 'Stopped'}</span>
        </div>
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Endpoint</span>
          <span className="am-mono am-guide-stat-value">{serverAddress}</span>
        </div>
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Rules</span>
          <span className="am-guide-stat-value">{enabledCount} enabled · {routes.length} total</span>
        </div>
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Journal</span>
          <span className="am-guide-stat-value">{journalOn ? `On · max ${journalMax}` : 'Disabled'}</span>
        </div>
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Variables</span>
          <span className="am-guide-stat-value">{variableCount}</span>
        </div>
        <div className="am-guide-stat" role="listitem">
          <span className="am-guide-stat-label">Selection</span>
          <span className="am-guide-stat-value">{policyLabel(settings)}</span>
        </div>
      </div>

      <ol className="am-guide-steps">
        <li className={running ? 'done' : 'current'}>
          <strong>Start</strong>
          <span>Use the Start button in the server bar so the companion listens on this port.</span>
        </li>
        <li className={running ? 'current' : ''}>
          <strong>Send a request</strong>
          <span>Hit an enabled rule from curl, Requests, Workflow, or your app under test.</span>
        </li>
        <li>
          <strong>Inspect the journal</strong>
          <span>Each row shows status, duration, matched rule, ambiguity, and near misses.</span>
        </li>
      </ol>

      <div className="am-guide-sample">
        <div className="am-guide-sample-head">
          <span>Try this against the mock</span>
          <button type="button" className="am-btn small" onClick={() => { void copy(); }} data-testid="api-mock-runtime-copy-curl">
            {copied ? 'Copied' : 'Copy curl'}
          </button>
        </div>
        <pre className="am-code-block" data-testid="api-mock-runtime-sample-curl">{curl}</pre>
      </div>

      <div className="am-guide-cards">
        <article className="am-guide-card">
          <h3>Transactions</h3>
          <p>Request/response pairs with match explanation — open a row to create a rule or copy the call.</p>
        </article>
        <article className="am-guide-card">
          <h3>State</h3>
          <p>Live scenario states, counters, and sequence positions once stateful routes are hit.</p>
        </article>
        <article className="am-guide-card">
          <h3>Variables</h3>
          <p>Server-scoped {'{{variables}}'} for response templates. Sensitive values stay masked in the UI.</p>
        </article>
        <article className="am-guide-card">
          <h3>Console</h3>
          <p>Lifecycle logs from Start / Apply / Stop and match warnings from the companion process.</p>
        </article>
      </div>
    </div>
  );
}
