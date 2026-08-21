import { useMemo, useState, type ReactNode } from 'react';
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

/** Same order as the Findings list: Duplicate → Shadowed → Definite → Potential. */
const KIND_LIST_ORDER: ApiMockConflictFindingV1['kind'][] = [
  'duplicate',
  'shadowed',
  'definite_overlap',
  'potential_overlap',
  'unreachable',
];

const FILTERS: Array<{ id: KindFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'shadowed', label: 'Shadowed' },
  { id: 'definite_overlap', label: 'Definite' },
  { id: 'potential_overlap', label: 'Potential' },
  { id: 'unreachable', label: 'Unreachable' },
];

function kindListRank(kind: ApiMockConflictFindingV1['kind']): number {
  const index = KIND_LIST_ORDER.indexOf(kind);
  return index === -1 ? KIND_LIST_ORDER.length : index;
}

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

interface RouteChip {
  id: string;
  method: string;
  path: string;
  priority?: number;
  found: boolean;
}

function routeChip(routes: ApiMockRouteV1[], id: string): RouteChip {
  const r = routes.find(x => x.id === id);
  if (!r) return { id, method: '', path: id.slice(0, 8), found: false };
  return { id, method: r.method, path: r.path.value || '/', priority: r.priority, found: true };
}

function routeLabel(routes: ApiMockRouteV1[], id: string): string {
  const chip = routeChip(routes, id);
  return chip.method ? `${chip.method} ${chip.path}` : chip.path;
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

function prettyToken(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function severityPolicyCopy(severity: ApiMockConflictFindingV1['severity']): string {
  if (severity === 'error') return 'Apply is blocked until this is resolved or the severity policy allows it.';
  if (severity === 'warning') return 'Apply is still permitted in warn mode.';
  return 'Informational — no apply block.';
}

function methodClass(method: string): string {
  return `am-method ${(method || 'any').toLowerCase()}`;
}

function RouteLine({ chip, action }: { chip: RouteChip; action?: ReactNode }) {
  return (
    <div className="am-finding-rule">
      {chip.method && <span className={methodClass(chip.method)}>{chip.method}</span>}
      <span className="am-finding-path">{chip.path}</span>
      {chip.priority != null && <span className="am-finding-prio">P{chip.priority}</span>}
      {action}
    </div>
  );
}

function OpenInStudioButton({ onClick, testId }: { onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      className="am-btn small am-conflict-open-studio"
      data-testid={testId}
      onClick={onClick}
    >
      Open in Studio
    </button>
  );
}

function witnessHttpText(
  finding: ApiMockConflictFindingV1,
  host: string,
  port: number,
): string {
  const wr = finding.witnessRequest;
  const lines = [
    `${wr?.method ?? 'GET'} ${wr?.rawPath || wr?.path || '/'} HTTP/1.1`,
    `Host: ${host}:${port}`,
  ];
  if (wr) {
    for (const [key, value] of Object.entries(wr.headers)) {
      lines.push(`${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
    }
  }
  return lines.join('\n');
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
  const filtered = useMemo(() => {
    const rows = filter === 'all' ? findings : findings.filter(f => f.kind === filter);
    return [...rows].sort((a, b) => kindListRank(a.kind) - kindListRank(b.kind) || a.id.localeCompare(b.id));
  }, [findings, filter]);
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

  const left = selected ? routeChip(routes, selected.ruleIds[0]) : undefined;
  const right = selected ? routeChip(routes, selected.ruleIds[1]) : undefined;
  const leftLabel = left ? (left.method ? `${left.method} ${left.path}` : left.path) : '';
  const rightLabel = right ? (right.method ? `${right.method} ${right.path}` : right.path) : '';
  const equalPriority = left?.priority != null && right?.priority != null && left.priority === right.priority;
  const equalPolicy = settings?.selection.equalPriorityPolicy ?? 'reject';
  const rejectsOnTie = equalPolicy === 'reject' && equalPriority;
  const fingerprintsMatch = Boolean(
    selected
    && selected.ruleFingerprints[0]
    && selected.ruleFingerprints[0] === selected.ruleFingerprints[1],
  );

  return (
    <div className="am-conflict-inspector" data-testid="api-mock-conflict-inspector">
      <div className="am-conflict-toolbar">
        <div className="am-conflict-summary" data-testid="api-mock-conflict-summary">
          <strong>{findings.length} finding{findings.length === 1 ? '' : 's'}</strong>
          {stats && (
            <span className="am-faint">
              {' '}· {stats.analyzedRules} enabled rule{stats.analyzedRules === 1 ? '' : 's'} · {stats.durationMs} ms
            </span>
          )}
        </div>
        <div className="am-conflict-filters" role="toolbar" aria-label="Conflict kind filters" data-testid="api-mock-conflict-filters">
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
          <div className="am-conflict-list-label">Findings</div>
          {filtered.length === 0 ? (
            <div className="am-dock-empty" data-testid="api-mock-conflict-filter-empty">No findings in this filter.</div>
          ) : filtered.map(f => {
            const active = selected?.id === f.id;
            const a = routeChip(routes, f.ruleIds[0]);
            const b = routeChip(routes, f.ruleIds[1]);
            return (
              <button
                key={f.id}
                type="button"
                className={`am-finding-row${active ? ' active' : ''}`}
                data-testid={`api-mock-finding-${f.id}`}
                data-kind={f.kind}
                onClick={() => { setSelectedId(f.id); setPrioOpen(false); }}
              >
                <div className="am-finding-row-head">
                  <span className={`am-finding-icon ${severityClass(f.severity)}`} aria-hidden="true">
                    {f.severity === 'error' ? '✕' : '!'}
                  </span>
                  <span className="am-finding-title">{KIND_LABEL[f.kind]}</span>
                  {f.acknowledgementStale && <span className="am-badge warning">Stale</span>}
                  {f.acknowledgedAt && !f.acknowledgementStale && <span className="am-badge info">Ack</span>}
                  <span className={`am-badge ${severityClass(f.severity)}`}>{f.severity}</span>
                </div>
                <RouteLine chip={a} />
                <div className="am-finding-vs">vs</div>
                <RouteLine chip={b} />
              </button>
            );
          })}
        </div>

        {selected && left && right && (
          <div className="am-conflict-detail" data-testid="api-mock-conflict-detail">
            <div className="am-conflict-detail-body">
            <header className="am-conflict-detail-head">
              <div>
                <div className="am-conflict-detail-kicker">Selected finding</div>
                <h3 className="am-conflict-detail-title">{KIND_LABEL[selected.kind]}</h3>
              </div>
              <div className="am-conflict-detail-chips">
                <span className={`am-badge ${severityClass(selected.severity)}`}>{selected.severity}</span>
                <span className={`am-badge${selected.selectionOutcome === 'left_wins' || selected.selectionOutcome === 'right_wins' ? ' success' : ''}`}>{prettyToken(selected.selectionOutcome)}</span>
              </div>
            </header>

            <div className={`am-notice ${selected.severity === 'error' ? 'danger' : 'warning'}`}>
              <span>
                {selected.dimensions.map(d => d.explanation).filter(Boolean).slice(0, 2).join(' ')
                  || 'Competing rules can match the same request under the current selection policy.'}
                {equalPriority && <> Both routes have equal priority {left.priority}.</>}
                {' '}
                {rejectsOnTie
                  ? <>Under <strong>reject</strong> equal-priority policy, this request returns <span className="am-badge warning">409</span>.</>
                  : <>Outcome: <strong>{prettyToken(selected.selectionOutcome)}</strong>.</>}
              </span>
            </div>

            <div className="am-conflict-compare" data-testid="api-mock-conflict-compare">
              <div className="am-section-heading am-conflict-compare-kicker">Competing rules</div>
              <article className="am-conflict-rule-card am-conflict-compare-left">
                <div className="am-conflict-rule-kicker">Left</div>
                <RouteLine
                  chip={left}
                  action={onSelectRoute ? (
                    <OpenInStudioButton
                      testId="api-mock-conflict-goto-left"
                      onClick={() => onSelectRoute(selected.ruleIds[0])}
                    />
                  ) : undefined}
                />
              </article>
              <article className="am-conflict-rule-card am-conflict-compare-right">
                <div className="am-conflict-rule-kicker">Right</div>
                <RouteLine
                  chip={right}
                  action={onSelectRoute ? (
                    <OpenInStudioButton
                      testId="api-mock-conflict-goto-right"
                      onClick={() => onSelectRoute(selected.ruleIds[1])}
                    />
                  ) : undefined}
                />
              </article>

              <div className="am-section-heading am-conflict-compare-dim-label">Match dimensions</div>
              <div className="am-section-heading am-conflict-compare-policy-label">Selection policy</div>
              <div className="am-dim-table am-conflict-compare-dims" data-testid="api-mock-conflict-dimensions">
                {selected.dimensions.map((d, i) => (
                  <div
                    key={`${d.source}-${i}`}
                    className="am-dim-row"
                    data-testid="api-mock-conflict-dim-row"
                    data-result={d.result}
                  >
                    <span className="am-dim-source">{d.source}{d.selector ? ` · ${d.selector}` : ''}</span>
                    <span className={`am-badge ${dimBadge(d.result)}`}>{d.result}</span>
                    <span className="am-dim-explain">{d.explanation || '—'}</span>
                  </div>
                ))}
              </div>
              <div className="am-form-grid am-compact am-conflict-compare-policy">
                <div className="am-form-row">
                  <div className="am-form-label">Multiple match</div>
                  <div className="am-form-control">
                    <span data-testid="api-mock-conflict-policy-multiple">
                      {prettyToken(settings?.selection.multipleMatchPolicy ?? 'highest_priority')}
                    </span>
                  </div>
                </div>
                <div className="am-form-row">
                  <div className="am-form-label">Equal priority</div>
                  <div className="am-form-control">
                    <span data-testid="api-mock-conflict-policy-equal">
                      {prettyToken(settings?.selection.equalPriorityPolicy ?? 'reject')}
                    </span>
                    {(settings?.selection.equalPriorityPolicy ?? 'reject') === 'reject' && (
                      <span className="am-badge warning">409 Ambiguous</span>
                    )}
                  </div>
                </div>
                <div className="am-form-row">
                  <div className="am-form-label">Selection</div>
                  <div className="am-form-control">
                    {selected.selectionOutcome === 'left_wins' || selected.selectionOutcome === 'right_wins'
                      ? <span className="am-badge success">{prettyToken(selected.selectionOutcome)}</span>
                      : prettyToken(selected.selectionOutcome)}
                  </div>
                </div>
                <div className="am-form-row">
                  <div className="am-form-label">Severity</div>
                  <div className="am-form-control">
                    <span className={`am-badge ${severityClass(selected.severity)}`}>{selected.severity}</span>
                    <span className="am-muted am-conflict-policy-note">{severityPolicyCopy(selected.severity)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="am-conflict-witness-card">
              <div className="am-conflict-witness-head">
                <div className="am-section-heading">Witness request</div>
                {onSimulateWitness && (
                  <button
                    type="button"
                    className="am-btn small"
                    data-testid="api-mock-conflict-simulate"
                    onClick={() => onSimulateWitness(selected)}
                  >
                    <FlaskIcon size={14} /> Simulate
                  </button>
                )}
              </div>
              <pre className="am-code-block" data-testid="api-mock-conflict-witness">{witnessHttpText(selected, serverHost, serverPort)}</pre>
            </div>

            {selected.acknowledgementStale && (
              <div className="am-notice warning" data-testid="api-mock-conflict-stale">
                <span>
                  Previously acknowledged finding is <span className="am-badge warning">Stale</span> —
                  a rule edit changed a fingerprint. Re-acknowledge after reviewing.
                </span>
              </div>
            )}

            {selected.acknowledgedAt && !selected.acknowledgementStale && (
              <div className="am-notice" data-testid="api-mock-conflict-ack">
                <span>
                  Acknowledged {new Date(selected.acknowledgedAt).toLocaleString()}. Valid until either rule fingerprint changes.
                </span>
              </div>
            )}

            <details className="am-fingerprints" data-testid="api-mock-conflict-fingerprints">
              <summary data-testid="api-mock-conflict-fingerprints-summary">Rule fingerprints</summary>
              <div className="am-fingerprints-body" data-testid="api-mock-conflict-fingerprint-hashes">
                <p className="am-fingerprint-why" data-testid="api-mock-conflict-fingerprint-why">
                  <strong>Why these exist.</strong>
                  <br />
                  Acknowledge means you reviewed this exact pair.
                  Each hash is a snapshot of one rule. Edit either rule and the ack goes{' '}
                  <strong>Stale</strong> — you must look again. Without fingerprints, an ack would
                  stay valid forever even after the overlap changed.
                </p>
                <span
                  className={`am-badge${fingerprintsMatch ? '' : ' warning'}`}
                  data-testid="api-mock-conflict-fingerprint-relation"
                >
                  {fingerprintsMatch ? 'Same hash' : 'Different hashes'}
                </span>
                <table className="am-fingerprint-table" data-testid="api-mock-conflict-fingerprint-table">
                  <tbody>
                    <tr>
                      <th scope="row">
                        <span className="am-fingerprint-side">Left</span>
                        <span className="am-fingerprint-label">{leftLabel}</span>
                      </th>
                      <td>
                        <code className="am-fingerprint-hash" data-testid="api-mock-conflict-fingerprint-left">
                          {selected.ruleFingerprints[0]}
                        </code>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">
                        <span className="am-fingerprint-side">Right</span>
                        <span className="am-fingerprint-label">{rightLabel}</span>
                      </th>
                      <td>
                        <code className="am-fingerprint-hash" data-testid="api-mock-conflict-fingerprint-right">
                          {selected.ruleFingerprints[1]}
                        </code>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <span className="am-hint">
                  Each hash is SHA-256 of that rule (id, name, Match, response, priority).
                  Duplicate is method + path + Match — the hashes can still differ.
                </span>
              </div>
            </details>
            </div>

            <div className="am-conflict-actions">
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
                    <div
                      className="am-conflict-prio-menu"
                      role="menu"
                      data-testid="api-mock-conflict-prio-menu"
                      ref={(node) => {
                        if (node && typeof node.scrollIntoView === 'function') {
                          node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                        }
                      }}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="am-btn small"
                        data-testid="api-mock-conflict-prio-left"
                        onClick={() => { onAdjustPriority(selected.ruleIds[0], 10); setPrioOpen(false); }}
                      >
                        Raise {leftLabel}{left.priority != null ? ` (P${left.priority}→${left.priority + 10})` : ''}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="am-btn small"
                        data-testid="api-mock-conflict-prio-right"
                        onClick={() => { onAdjustPriority(selected.ruleIds[1], 10); setPrioOpen(false); }}
                      >
                        Raise {rightLabel}{right.priority != null ? ` (P${right.priority}→${right.priority + 10})` : ''}
                      </button>
                    </div>
                  )}
                </div>
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
