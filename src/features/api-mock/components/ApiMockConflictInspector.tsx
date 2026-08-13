import { useMemo, useState } from 'react';
import type { ApiMockConflictFindingV1, ApiMockRouteV1, ApiMockServerSettingsV1 } from '../../../shared/api-mock/contracts';
import { ApiMockConflictGuide } from './ApiMockConflictGuide';
import { ArrowUpDownIcon, CheckIcon, FlaskIcon } from './ApiMockIcons';

type KindFilter = 'all' | ApiMockConflictFindingV1['kind'];

const KIND_LABEL: Record<ApiMockConflictFindingV1['kind'], string> = {
  definite_overlap: 'Definite overlap',
  potential_overlap: 'Potential overlap',
  duplicate: 'Duplicate routes',
  shadowed: 'Shadowed',
  unreachable: 'Unreachable',
};

const FILTERS: Array<{ id: KindFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'definite_overlap', label: 'Definite' },
  { id: 'potential_overlap', label: 'Potential' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'shadowed', label: 'Shadowed' },
  { id: 'unreachable', label: 'Unreachable' },
];

interface Props {
  findings: ApiMockConflictFindingV1[];
  routes: ApiMockRouteV1[];
  focusRouteId?: string;
  onSimulateWitness?: (finding: ApiMockConflictFindingV1) => void;
  onSelectRoute?: (routeId: string) => void;
  /** Fingerprint acknowledgement (mockup 05). */
  onAcknowledge?: (finding: ApiMockConflictFindingV1) => void;
  /** Bump left or right rule priority to break a tie. */
  onAdjustPriority?: (routeId: string, delta: number) => void;
  /** Server selection policy, shown in the policy outcome table (mockup 05). */
  settings?: ApiMockServerSettingsV1;
  /** Last analysis run stats for the summary line. */
  stats?: { analyzedRules: number; durationMs: number };
  /** Empty-state CTAs (Conflicts page). */
  onAnalyze?: () => void;
  onOpenStudio?: () => void;
  /** Optional Apply (mockup 05 titlebar) when the draft is dirty. */
  onApply?: () => void;
  dirty?: boolean;
  /** Host shown on witness requests. */
  serverHost?: string;
  serverPort?: number;
}

function routeLabel(routes: ApiMockRouteV1[], id: string): string {
  const r = routes.find(x => x.id === id);
  return r ? `${r.method} ${r.path.value || '/'}` : id.slice(0, 8);
}

function routePriority(routes: ApiMockRouteV1[], id: string): number | undefined {
  return routes.find(x => x.id === id)?.priority;
}

function severityClass(severity: ApiMockConflictFindingV1['severity']): string {
  if (severity === 'error') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function dimBadge(result: 'overlap' | 'disjoint' | 'unknown'): string {
  if (result === 'overlap') return 'success';
  if (result === 'disjoint') return 'danger';
  return 'info';
}

function severityPolicyCopy(severity: ApiMockConflictFindingV1['severity']): string {
  if (severity === 'error') return 'error (Apply blocked until resolved or severity policy allows)';
  if (severity === 'warning') return 'warning (Apply permitted in warn mode)';
  return 'info';
}

/**
 * Mockup 05 Conflict Inspector — finding list + dimension/policy/witness detail.
 */
export function ApiMockConflictInspector({
  findings,
  routes,
  focusRouteId,
  onSimulateWitness,
  onSelectRoute,
  onAcknowledge,
  onAdjustPriority,
  settings,
  stats,
  onAnalyze,
  onOpenStudio,
  onApply,
  dirty = false,
  serverHost = '127.0.0.1',
  serverPort = 4600,
}: Props) {
  const [filter, setFilter] = useState<KindFilter>('all');
  const [prioOpen, setPrioOpen] = useState(false);
  const filtered = useMemo(
    () => (filter === 'all' ? findings : findings.filter(f => f.kind === filter)),
    [findings, filter],
  );
  const initialId = useMemo(() => {
    if (focusRouteId) {
      const hit = filtered.find(f => f.ruleIds.includes(focusRouteId));
      if (hit) return hit.id;
    }
    return filtered[0]?.id;
  }, [filtered, focusRouteId]);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);
  const selected = filtered.find(f => f.id === selectedId) ?? filtered[0];

  if (findings.length === 0) {
    if (onAnalyze || onOpenStudio) {
      return (
        <ApiMockConflictGuide
          routes={routes}
          settings={settings}
          stats={stats}
          onAnalyze={onAnalyze}
          onOpenStudio={onOpenStudio}
        />
      );
    }
    return (
      <div className="am-dock-empty" data-testid="api-mock-dock-conflicts-empty">
        No route conflicts detected. Use “Analyze all” to re-check.
      </div>
    );
  }

  const leftLabel = selected ? routeLabel(routes, selected.ruleIds[0]) : '';
  const rightLabel = selected ? routeLabel(routes, selected.ruleIds[1]) : '';
  const leftP = selected ? routePriority(routes, selected.ruleIds[0]) : undefined;
  const rightP = selected ? routePriority(routes, selected.ruleIds[1]) : undefined;

  return (
    <div className="am-conflict-inspector" data-testid="api-mock-conflict-inspector">
      <div className="am-conflict-toolbar">
        <div className="am-conflict-summary" data-testid="api-mock-conflict-summary">
          <strong>{findings.length} finding{findings.length === 1 ? '' : 's'}</strong>
          {stats && (
            <span className="am-faint">
              {' '}across {stats.analyzedRules} enabled rule{stats.analyzedRules === 1 ? '' : 's'} · Analysis took {stats.durationMs} ms
            </span>
          )}
        </div>
        <div className="am-conflict-filters" role="toolbar" aria-label="Conflict kind filters">
          {FILTERS.map(f => {
            const count = f.id === 'all' ? findings.length : findings.filter(x => x.kind === f.id).length;
            return (
              <button
                key={f.id}
                type="button"
                className={`am-btn small${filter === f.id ? ' active' : ''}`}
                data-testid={`api-mock-conflict-filter-${f.id}`}
                onClick={() => { setFilter(f.id); setSelectedId(undefined); setPrioOpen(false); }}
              >
                {f.label}{count > 0 && <> <span className="am-count-badge">{count}</span></>}
              </button>
            );
          })}
        </div>
        {onApply && (
          <button
            type="button"
            className="am-btn primary"
            disabled={!dirty}
            onClick={onApply}
            data-testid="api-mock-conflict-apply"
            title={dirty ? 'Apply draft to the running server' : 'No unapplied draft changes'}
          >
            <CheckIcon size={14} /> Apply
          </button>
        )}
      </div>

      <div className="am-conflict-layout">
        <div className="am-conflict-list" data-testid="api-mock-conflict-list">
          {filtered.length === 0 ? (
            <div className="am-dock-empty">No findings in this filter.</div>
          ) : filtered.map(f => {
            const active = selected?.id === f.id;
            const [left, right] = f.ruleIds;
            const lp = routePriority(routes, left);
            const rp = routePriority(routes, right);
            return (
              <button
                key={f.id}
                type="button"
                className={`am-finding-row${active ? ' active' : ''}`}
                data-testid={`api-mock-finding-${f.id}`}
                onClick={() => { setSelectedId(f.id); setPrioOpen(false); }}
              >
                <span className={`am-finding-icon ${severityClass(f.severity)}`} aria-hidden="true">
                  {f.severity === 'error' ? '✕' : '!'}
                </span>
                <div className="am-finding-summary">
                  <div className="am-finding-title">
                    {KIND_LABEL[f.kind]}
                    {f.acknowledgementStale && <span className="am-badge warning" style={{ marginLeft: 6 }}>Stale</span>}
                    {f.acknowledgedAt && !f.acknowledgementStale && <span className="am-badge info" style={{ marginLeft: 6 }}>Ack</span>}
                  </div>
                  <div className="am-muted">
                    {routeLabel(routes, left)}
                    {lp != null && <span className="am-faint"> P{lp}</span>}
                    {' vs '}
                    {routeLabel(routes, right)}
                    {rp != null && <span className="am-faint"> P{rp}</span>}
                  </div>
                </div>
                <span className={`am-badge ${severityClass(f.severity)}`}>{f.severity}</span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="am-conflict-detail" data-testid="api-mock-conflict-detail">
            <h3 className="am-conflict-detail-title">
              {KIND_LABEL[selected.kind]} · {leftLabel} vs {rightLabel}
            </h3>

            <div className={`am-notice ${selected.severity === 'error' ? 'danger' : 'warning'}`}>
              <span>
                {selected.dimensions.map(d => d.explanation).filter(Boolean).slice(0, 2).join(' ')
                  || 'Competing rules can match the same request under the current selection policy.'}
                {(leftP != null && rightP != null && leftP === rightP) && (
                  <> Both routes have equal priority {leftP}.</>
                )}
                {' '}
                {(settings?.selection.equalPriorityPolicy ?? 'reject') === 'reject' && leftP === rightP
                  ? <>Under <strong>reject</strong> equal-priority policy, this request returns <span className="am-badge warning">409</span>.</>
                  : <>Outcome: <strong>{selected.selectionOutcome.replace(/_/g, ' ')}</strong>.</>}
              </span>
            </div>

            <div className="am-section-heading">Dimension analysis</div>
            {selected.dimensions.map((d, i) => (
              <div key={`${d.source}-${i}`} className="am-dim-row">
                <span className="am-muted">{d.source}{d.selector ? ` · ${d.selector}` : ''}</span>
                <span className={`am-badge ${dimBadge(d.result)}`}>{d.result}</span>
                <span>{d.explanation}</span>
              </div>
            ))}

            <div className="am-section-heading">Policy outcome</div>
            <div className="am-form-grid am-compact">
              <div className="am-form-row">
                <div className="am-form-label">Multiple match</div>
                <div className="am-form-control">
                  <span className="am-mono" data-testid="api-mock-conflict-policy-multiple">
                    {settings?.selection.multipleMatchPolicy ?? 'highest_priority'}
                  </span>
                </div>
              </div>
              <div className="am-form-row">
                <div className="am-form-label">Equal priority</div>
                <div className="am-form-control">
                  <span className="am-mono" data-testid="api-mock-conflict-policy-equal">
                    {settings?.selection.equalPriorityPolicy ?? 'reject'}
                  </span>
                  {(settings?.selection.equalPriorityPolicy ?? 'reject') === 'reject' && (
                    <>
                      <span className="am-faint">→</span>
                      <span className="am-badge warning">409 Ambiguous</span>
                    </>
                  )}
                </div>
              </div>
              <div className="am-form-row">
                <div className="am-form-label">Selection</div>
                <div className="am-form-control">{selected.selectionOutcome.replace(/_/g, ' ')}</div>
              </div>
              <div className="am-form-row">
                <div className="am-form-label">Severity</div>
                <div className="am-form-control">
                  <span className={`am-badge ${severityClass(selected.severity)}`}>{selected.severity}</span>
                  <span className="am-muted" style={{ marginLeft: 6, fontSize: 11 }}>
                    {severityPolicyCopy(selected.severity)}
                  </span>
                </div>
              </div>
            </div>

            <div className="am-section-heading">Witness request</div>
            <pre className="am-code-block" data-testid="api-mock-conflict-witness">
{`${selected.witnessRequest?.method ?? 'GET'} ${selected.witnessRequest?.rawPath || selected.witnessRequest?.path || '/'} HTTP/1.1`}
{`Host: ${serverHost}:${serverPort}`}
{selected.witnessRequest
  ? Object.entries(selected.witnessRequest.headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')
  : ''}
            </pre>

            {selected.acknowledgementStale && (
              <div className="am-notice warning" style={{ marginTop: 10 }} data-testid="api-mock-conflict-stale">
                <span>
                  Previously acknowledged finding is <span className="am-badge warning">Stale</span> —
                  a rule edit changed fingerprints (
                  <span className="am-mono">{selected.ruleFingerprints[0].slice(0, 4)}…</span>
                  {' ≠ '}
                  prior). Re-acknowledge after reviewing.
                </span>
              </div>
            )}

            {selected.acknowledgedAt && !selected.acknowledgementStale && (
              <div className="am-notice" style={{ marginTop: 10 }} data-testid="api-mock-conflict-ack">
                <span>
                  Acknowledged {new Date(selected.acknowledgedAt).toLocaleString()}. Valid until either rule fingerprint changes.
                </span>
              </div>
            )}

            <div className="am-section-heading">Rule fingerprints</div>
            <div className="am-fingerprints" data-testid="api-mock-conflict-fingerprints">
              <span className="am-mono am-faint" title={selected.ruleFingerprints[0]}>
                {leftLabel}: {selected.ruleFingerprints[0].slice(0, 8)}…
              </span>
              <span className="am-mono am-faint" title={selected.ruleFingerprints[1]}>
                {rightLabel}: {selected.ruleFingerprints[1].slice(0, 8)}…
              </span>
              <span className="am-hint">An acknowledgement goes stale when either fingerprint changes.</span>
            </div>

            <div className="am-conflict-actions">
              {onSimulateWitness && (
                <button
                  type="button"
                  className="am-btn"
                  data-testid="api-mock-conflict-simulate"
                  onClick={() => onSimulateWitness(selected)}
                >
                  <FlaskIcon size={14} /> Simulate witness
                </button>
              )}
              {onAcknowledge && (!selected.acknowledgedAt || selected.acknowledgementStale) && (
                <button
                  type="button"
                  className="am-btn"
                  data-testid="api-mock-conflict-acknowledge"
                  onClick={() => onAcknowledge(selected)}
                >
                  <CheckIcon size={14} /> Acknowledge
                </button>
              )}
              {onAdjustPriority && (
                <div className="am-conflict-prio">
                  <button
                    type="button"
                    className={`am-btn${prioOpen ? ' active' : ''}`}
                    data-testid="api-mock-conflict-adjust-priority"
                    aria-expanded={prioOpen}
                    onClick={() => setPrioOpen(v => !v)}
                  >
                    <ArrowUpDownIcon size={14} /> Adjust priority
                  </button>
                  {prioOpen && (
                    <div className="am-conflict-prio-menu" role="menu" data-testid="api-mock-conflict-prio-menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="am-btn small"
                        data-testid="api-mock-conflict-prio-left"
                        onClick={() => { onAdjustPriority(selected.ruleIds[0], 10); setPrioOpen(false); }}
                      >
                        Raise {leftLabel}{leftP != null ? ` (P${leftP}→${leftP + 10})` : ''}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="am-btn small"
                        data-testid="api-mock-conflict-prio-right"
                        onClick={() => { onAdjustPriority(selected.ruleIds[1], 10); setPrioOpen(false); }}
                      >
                        Raise {rightLabel}{rightP != null ? ` (P${rightP}→${rightP + 10})` : ''}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {onSelectRoute && (
                <>
                  <button
                    type="button"
                    className="am-btn small ghost"
                    data-testid="api-mock-conflict-goto-left"
                    onClick={() => onSelectRoute(selected.ruleIds[0])}
                  >
                    Open left rule
                  </button>
                  <button
                    type="button"
                    className="am-btn small ghost"
                    data-testid="api-mock-conflict-goto-right"
                    onClick={() => onSelectRoute(selected.ruleIds[1])}
                  >
                    Open right rule
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Peer rule label for the match-tab conflict notice (mockup 01). */
// eslint-disable-next-line react-refresh/only-export-components
export function conflictPeerLabel(
  findings: ApiMockConflictFindingV1[],
  routeId: string,
  routes: ApiMockRouteV1[],
): string | undefined {
  const hit = findings.find(f => f.ruleIds.includes(routeId));
  if (!hit) return undefined;
  const peerId = hit.ruleIds[0] === routeId ? hit.ruleIds[1] : hit.ruleIds[0];
  return routeLabel(routes, peerId);
}
