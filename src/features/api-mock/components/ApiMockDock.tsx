import { useEffect, useState } from 'react';
import type { ApiMockConflictFindingV1, ApiMockRouteV1, ApiMockTransactionV1, ApiMockVariableV1 } from '../../../shared/api-mock/contracts';
import { handleTabListArrowKeys } from '../../../shared/utils/tabListKeyboard';
import type { ApiMockConsoleLine } from '../useApiMockConsole';
import { ApiMockConflictInspector } from './ApiMockConflictInspector';

type DockTab = 'transactions' | 'conflicts' | 'state' | 'variables' | 'console';

const DOCK_PANEL_ID = 'api-mock-dock-panel';

interface Props {
  routes: ApiMockRouteV1[];
  conflictCount?: number;
  conflictFindings?: ApiMockConflictFindingV1[];
  focusConflictRouteId?: string;
  requestedTab?: DockTab;
  onRequestedTabConsumed?: () => void;
  onSelectRoute?: (routeId: string) => void;
  onSimulateWitness?: (finding: ApiMockConflictFindingV1) => void;
  transactions?: ApiMockTransactionV1[];
  running?: boolean;
  variables?: ApiMockVariableV1[];
  liveState?: { states: Record<string, string>; counters: Record<string, number> } | null;
  onResetState?: () => void;
  onClearTransactions?: () => void;
  consoleLines?: ApiMockConsoleLine[];
  onClearConsole?: () => void;
  onOpenConflicts?: () => void;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString();
}

/** Collect scenario states and counter keys declared across route transitions. */
function deriveScenarioModel(routes: ApiMockRouteV1[]): { states: string[]; counters: string[] } {
  const states = new Set<string>();
  const counters = new Set<string>();
  for (const route of routes) {
    for (const variant of route.responses) {
      const t = variant.transition;
      if (!t) continue;
      if (t.currentState) states.add(t.currentState);
      if (t.targetState) states.add(t.targetState);
      for (const c of t.counterUpdates ?? []) counters.add(c.key);
    }
  }
  return { states: [...states], counters: [...counters] };
}

/**
 * Bottom dock: Transactions / Conflicts / State / Variables / Server console (mockup 01/05/07).
 */
export function ApiMockDock({
  routes,
  conflictCount = 0,
  conflictFindings = [],
  focusConflictRouteId,
  requestedTab,
  onRequestedTabConsumed,
  onSelectRoute,
  onSimulateWitness,
  transactions = [],
  running = false,
  variables = [],
  liveState = null,
  onResetState,
  onClearTransactions,
  consoleLines = [],
  onClearConsole,
  onOpenConflicts,
}: Props) {
  const [tab, setTab] = useState<DockTab>('transactions');
  const [maximized, setMaximized] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | undefined>();
  const selected = transactions.find(t => t.id === selectedTxId);
  const scenario = deriveScenarioModel(routes);
  const routeName = (id?: string) => {
    if (!id) return '—';
    const r = routes.find(x => x.id === id);
    return r ? `${r.method} ${r.path.value || '/'}` : id;
  };

  useEffect(() => {
    if (!requestedTab) return;
    setTab(requestedTab);
    onRequestedTabConsumed?.();
  }, [requestedTab, onRequestedTabConsumed]);

  const dockTab = (id: DockTab, content: React.ReactNode) => {
    const active = tab === id;
    return (
      <button
        id={`api-mock-dtab-${id}`}
        role="tab"
        aria-selected={active}
        aria-controls={DOCK_PANEL_ID}
        tabIndex={active ? 0 : -1}
        className={`am-dock-tab${active ? ' active' : ''}`}
        onClick={() => {
          setTab(id);
          if (id === 'conflicts') onOpenConflicts?.();
        }}
      >
        {content}
      </button>
    );
  };

  return (
    <div className={`api-mock-dock${maximized ? ' maximized' : ''}`} data-testid="api-mock-dock">
      <div className="am-dock-head" role="tablist" aria-label="Runtime inspector" onKeyDown={handleTabListArrowKeys}>
        {dockTab('transactions', <>Transactions <span className="am-count-badge">{transactions.length}</span></>)}
        {dockTab('conflicts', <>Conflicts {conflictCount > 0 && <span className="am-count-badge warning">{conflictCount}</span>}</>)}
        {dockTab('state', 'State')}
        {dockTab('variables', <>Variables <span className="am-count-badge">{variables.length}</span></>)}
        {dockTab('console', 'Server console')}
        <span className="am-spacer" />
        {tab === 'transactions' && transactions.length > 0 && (
          <button className="am-btn small danger" onClick={onClearTransactions} data-testid="api-mock-journal-clear">Clear</button>
        )}
        {tab === 'console' && consoleLines.length > 0 && (
          <button className="am-btn small ghost" onClick={onClearConsole} data-testid="api-mock-console-clear">Clear</button>
        )}
        <button
          className="am-icon-btn"
          aria-label={maximized ? 'Restore dock' : 'Maximize dock'}
          title={maximized ? 'Restore dock' : 'Maximize dock'}
          onClick={() => setMaximized(m => !m)}
          data-testid="api-mock-dock-maximize"
        >{maximized ? '⤓' : '⤢'}</button>
      </div>

      <div className="am-dock-body" id={DOCK_PANEL_ID} role="tabpanel" aria-labelledby={`api-mock-dtab-${tab}`}>
        {tab === 'transactions' && (
          transactions.length === 0 ? (
            <div className="am-dock-empty" data-testid="api-mock-dock-transactions-empty">
              {running
                ? 'No transactions yet. Send a request to the running server to see it here.'
                : 'No transactions yet. Start the server and send a request to see it here.'}
            </div>
          ) : (
            <div className="am-tx-split">
              <div className="am-tx-table-wrap">
                <table className="am-data-table" aria-label="Transaction log">
                  <thead>
                    <tr>
                      <th style={{ width: 82 }}>Time</th>
                      <th style={{ width: 54 }}>Method</th>
                      <th>Path</th>
                      <th style={{ width: 58 }}>Status</th>
                      <th style={{ width: 72 }}>Duration</th>
                      <th style={{ width: 130 }}>Matched rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr
                        key={tx.id}
                        className={tx.id === selectedTxId ? 'selected' : ''}
                        onClick={() => setSelectedTxId(tx.id)}
                        style={{ cursor: 'pointer' }}
                        data-testid={`api-mock-tx-${tx.id}`}
                      >
                        <td>{timeOf(tx.receivedAt)}</td>
                        <td><span className={`am-method ${tx.request.method.toLowerCase()}`}>{tx.request.method}</span></td>
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} className="am-mono">{tx.request.path}</td>
                        <td>
                          <span className={`am-badge ${tx.outcome === 'matched' ? 'success' : tx.outcome === 'ambiguous' ? 'warning' : tx.outcome === 'unmatched' ? '' : 'danger'}`}>
                            {tx.response?.status ?? tx.outcome}
                          </span>
                        </td>
                        <td className="am-muted">{tx.durationMs != null ? `${tx.durationMs} ms` : '—'}</td>
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tx.outcome === 'ambiguous'
                            ? `Ambiguous · ${tx.explanation.policyDecision.matchedCount} rules`
                            : routeName(tx.matchedRouteId)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected && (
                <div className="am-tx-detail" data-testid="api-mock-tx-detail">
                  <div className="am-section-heading">Request</div>
                  <pre className="am-code-block">{selected.request.method} {selected.request.rawPath}
{Object.entries(selected.request.headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')}
{selected.request.body ? `\n${selected.request.body}` : ''}</pre>

                  <div className="am-section-heading">Match explanation</div>
                  <div style={{ fontSize: 11, marginBottom: 8 }}>
                    <span className={`am-badge ${selected.outcome === 'matched' ? 'success' : selected.outcome === 'ambiguous' ? 'warning' : ''}`}>{selected.outcome}</span>
                    {selected.matchedRouteId && <> → {routeName(selected.matchedRouteId)}</>}
                    {' · '}gen {selected.generation}
                    {' · '}policy {selected.explanation.policyDecision.policy.replace(/_/g, ' ')}
                  </div>
                  {selected.explanation.candidates.length > 0 && (
                    <div className="am-tx-candidates" data-testid="api-mock-tx-candidates">
                      {selected.explanation.candidates.slice(0, 6).map(c => (
                        <div key={c.routeId} className="am-chip">
                          {c.routeName || routeName(c.routeId)}
                          <span className="am-faint"> P{c.priority}</span>
                          {' · '}
                          <span className={c.overallMatch ? 'am-ok' : 'am-muted'}>{c.overallMatch ? 'match' : 'miss'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selected.explanation.nearMisses.length > 0 && (
                    <>
                      <div className="am-section-heading">Near misses</div>
                      <ul className="am-near-miss-list" data-testid="api-mock-tx-near-misses">
                        {selected.explanation.nearMisses.slice(0, 4).map(n => (
                          <li key={n.routeId}>
                            <strong>{n.routeName || routeName(n.routeId)}</strong>
                            {n.failedPredicates.slice(0, 2).map(fp => (
                              <span key={fp.predicateId} className="am-muted"> — {fp.source}: {fp.reason}</span>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {selected.response && (
                    <>
                      <div className="am-section-heading">Response</div>
                      <pre className="am-code-block">HTTP {selected.response.status}
{selected.response.body}</pre>
                      <div className="am-muted" style={{ fontSize: 11, marginTop: 4 }}>
                        Duration: {selected.durationMs != null ? `${selected.durationMs} ms` : '—'}
                        {selected.matchedResponseId ? ` · variant ${selected.matchedResponseId}` : ''}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        )}

        {tab === 'conflicts' && (
          <ApiMockConflictInspector
            findings={conflictFindings}
            routes={routes}
            focusRouteId={focusConflictRouteId}
            onSelectRoute={onSelectRoute}
            onSimulateWitness={onSimulateWitness}
          />
        )}

        {tab === 'variables' && (
          <div style={{ padding: 12, overflow: 'auto', height: '100%' }} data-testid="api-mock-dock-variables">
            {variables.length === 0 ? (
              <div className="am-dock-empty" data-testid="api-mock-dock-variables-empty">
                No variables defined. Add server variables to reference them as {'{{variable}}'} in responses.
              </div>
            ) : (
              <table className="am-data-table" aria-label="Server variables">
                <thead>
                  <tr><th style={{ width: 160 }}>Key</th><th>Value</th><th style={{ width: 90 }}>Sensitive</th></tr>
                </thead>
                <tbody>
                  {variables.map(v => (
                    <tr key={v.id}>
                      <td className="am-mono">{v.key}</td>
                      <td className="am-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.sensitive ? '••••••••' : v.value}</td>
                      <td>{v.sensitive ? <span className="am-badge warning">secret</span> : <span className="am-muted">no</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'state' && (
          <div style={{ padding: 12, overflow: 'auto', height: '100%' }} data-testid="api-mock-dock-state">
            <div className="am-section-heading">
              Scenario {running && <span className="am-badge success">live</span>}
              <span className="am-spacer" />
              {running && <button className="am-btn small ghost" onClick={onResetState} data-testid="api-mock-state-reset">Reset state</button>}
            </div>

            {running && liveState ? (
              (Object.keys(liveState.states).length === 0 && Object.keys(liveState.counters).length === 0) ? (
                <div className="am-muted" style={{ fontSize: 11 }} data-testid="api-mock-dock-state-live">
                  No state changes yet. Send requests to stateful routes to advance the scenario.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} data-testid="api-mock-dock-state-live">
                  {Object.entries(liveState.states).map(([k, v]) => <span key={`s-${k}`} className="am-chip">{k} = <strong>{v || '∅'}</strong></span>)}
                  {Object.entries(liveState.counters).map(([k, v]) => <span key={`c-${k}`} className="am-chip">{k}: <strong>{v}</strong></span>)}
                </div>
              )
            ) : (
              <>
                {scenario.states.length === 0 && scenario.counters.length === 0 ? (
                  <div className="am-muted" style={{ fontSize: 11 }}>No stateful routes. Use response mode “State” to drive transitions.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} data-testid="api-mock-dock-state-list">
                    {scenario.states.map(s => <span key={s} className="am-chip">{s}</span>)}
                    {scenario.counters.map(c => <span key={`c-${c}`} className="am-chip">{c}</span>)}
                  </div>
                )}
                <div className="am-notice" style={{ marginTop: 12 }}>
                  <span>{running ? 'Live counter/state values update as requests hit stateful routes.' : 'Start the server to track live counter and scenario-state values.'}</span>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'console' && (
          consoleLines.length === 0 ? (
            <div className="am-dock-empty" data-testid="api-mock-dock-console-empty">
              Server console output appears here. Start / Stop / Apply actions and lifecycle logs stream in from the running companion.
            </div>
          ) : (
            <div style={{ padding: 8, overflow: 'auto', height: '100%' }} data-testid="api-mock-dock-console">
              <pre className="am-code-block" style={{ margin: 0 }}>{consoleLines.map(l =>
                `${l.ts ? new Date(l.ts).toLocaleTimeString() : ''}${l.level ? ` [${l.level}]` : ''} ${l.message}`.trim(),
              ).join('\n')}</pre>
            </div>
          )
        )}
      </div>
    </div>
  );
}
