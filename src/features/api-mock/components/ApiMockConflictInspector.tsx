import { useMemo, useState } from 'react';
import type { ApiMockConflictFindingV1, ApiMockRouteV1 } from '../../../shared/api-mock/contracts';

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

/**
 * Mockup 05 Conflict Inspector — finding list + dimension/policy/witness detail.
 * Embedded in the Studio dock Conflicts tab.
 */
export function ApiMockConflictInspector({
  findings,
  routes,
  focusRouteId,
  onSimulateWitness,
  onSelectRoute,
}: Props) {
  const [filter, setFilter] = useState<KindFilter>('all');
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
    return (
      <div className="am-dock-empty" data-testid="api-mock-dock-conflicts-empty">
        No route conflicts detected. Use “Analyze all” to re-check.
      </div>
    );
  }

  return (
    <div className="am-conflict-inspector" data-testid="api-mock-conflict-inspector">
      <div className="am-conflict-filters" role="toolbar" aria-label="Conflict kind filters">
        {FILTERS.map(f => {
          const count = f.id === 'all' ? findings.length : findings.filter(x => x.kind === f.id).length;
          if (f.id !== 'all' && count === 0) return null;
          return (
            <button
              key={f.id}
              type="button"
              className={`am-btn small${filter === f.id ? ' active' : ''}`}
              data-testid={`api-mock-conflict-filter-${f.id}`}
              onClick={() => { setFilter(f.id); setSelectedId(undefined); }}
            >
              {f.label} <span className="am-count-badge">{count}</span>
            </button>
          );
        })}
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
                onClick={() => setSelectedId(f.id)}
              >
                <span className={`am-finding-icon ${severityClass(f.severity)}`} aria-hidden="true">
                  {f.severity === 'error' ? '✕' : '!'}
                </span>
                <div className="am-finding-summary">
                  <div className="am-finding-title">{KIND_LABEL[f.kind]}</div>
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
              {KIND_LABEL[selected.kind]} · {routeLabel(routes, selected.ruleIds[0])} vs {routeLabel(routes, selected.ruleIds[1])}
            </h3>

            <div className={`am-notice ${selected.severity === 'error' ? 'danger' : 'warning'}`}>
              <span>
                {selected.dimensions.map(d => d.explanation).filter(Boolean).slice(0, 2).join(' ')
                  || 'Competing rules can match the same request under the current selection policy.'}
                {' '}
                Outcome: <strong>{selected.selectionOutcome.replace(/_/g, ' ')}</strong>.
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
                <div className="am-form-label">Selection</div>
                <div className="am-form-control">{selected.selectionOutcome.replace(/_/g, ' ')}</div>
              </div>
              <div className="am-form-row">
                <div className="am-form-label">Severity</div>
                <div className="am-form-control">
                  <span className={`am-badge ${severityClass(selected.severity)}`}>{selected.severity}</span>
                </div>
              </div>
            </div>

            {selected.witnessRequest && (
              <>
                <div className="am-section-heading">Witness request</div>
                <pre className="am-code-block" data-testid="api-mock-conflict-witness">
{`${selected.witnessRequest.method} ${selected.witnessRequest.rawPath || selected.witnessRequest.path} HTTP/1.1`}
{Object.entries(selected.witnessRequest.headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')}
                </pre>
              </>
            )}

            <div className="am-conflict-actions">
              {onSimulateWitness && (
                <button
                  type="button"
                  className="am-btn small"
                  data-testid="api-mock-conflict-simulate"
                  onClick={() => onSimulateWitness(selected)}
                >
                  Simulate witness
                </button>
              )}
              {onSelectRoute && (
                <>
                  <button
                    type="button"
                    className="am-btn small"
                    data-testid="api-mock-conflict-goto-left"
                    onClick={() => onSelectRoute(selected.ruleIds[0])}
                  >
                    Open left rule
                  </button>
                  <button
                    type="button"
                    className="am-btn small"
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
