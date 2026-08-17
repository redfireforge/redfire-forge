import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApiMockConflictFindingV1,
  ApiMockRouteV1,
  ApiMockServerDefinitionV1,
  ApiMockServerSettingsV1,
  ApiMockTransactionV1,
  ApiMockVariableV1,
} from '../../../shared/api-mock/contracts';
import { handleTabListArrowKeys } from '../../../shared/utils/tabListKeyboard';
import {
  exportTransactionsJson,
  filterTransactions,
} from '../apiMockJournalActions';
import type { ApiMockConsoleLine } from '../useApiMockConsole';
import { ApiMockConflictInspector } from './ApiMockConflictInspector';
import { ChevronDownIcon, ChevronUpIcon, MaximizeIcon, MinimizeIcon, PlusIcon, TrashIcon } from './ApiMockIcons';
import { deriveScenarioModel, timeOf } from './apiMockDockHelpers';
import { ApiMockTransactionDetail } from './ApiMockTransactionDetail';
import { ApiMockRuntimeGuide } from './ApiMockRuntimeGuide';
import { ApiMockRuntimeSettingsPanel } from './ApiMockRuntimeSettingsPanel';
import { ApiMockDiagnosticsPanel } from './ApiMockDiagnosticsPanel';
import { ApiMockConsolePanel } from './ApiMockConsolePanel';
import { useSplitPaneResize } from '../../../shared/hooks/useSplitPaneResize';

export type ApiMockDockTab = 'transactions' | 'conflicts' | 'state' | 'variables' | 'settings' | 'console' | 'diagnostics';
type DockMode = 'normal' | 'maximized' | 'collapsed';

const DOCK_PANEL_ID = 'api-mock-dock-panel';
/** Mockup 07 Runtime tabs (Conflicts is a top-level workspace view). */
const PAGE_TABS: ApiMockDockTab[] = ['transactions', 'state', 'variables', 'settings', 'diagnostics', 'console'];
/** Compact Studio dock tabs. */
const DOCK_TABS: ApiMockDockTab[] = ['transactions', 'conflicts', 'state', 'variables', 'diagnostics', 'console'];
const EMPTY_HIDDEN_TABS: ApiMockDockTab[] = [];

function initialDockTab(
  requestedTab: ApiMockDockTab | undefined,
  visibleTabs: ApiMockDockTab[],
): ApiMockDockTab {
  if (requestedTab && visibleTabs.includes(requestedTab)) return requestedTab;
  return visibleTabs[0] ?? 'transactions';
}

interface Props {
  routes: ApiMockRouteV1[];
  conflictCount?: number;
  conflictFindings?: ApiMockConflictFindingV1[];
  focusConflictRouteId?: string;
  requestedTab?: ApiMockDockTab;
  onRequestedTabConsumed?: () => void;
  onSelectRoute?: (routeId: string) => void;
  onSimulateWitness?: (finding: ApiMockConflictFindingV1) => void;
  transactions?: ApiMockTransactionV1[];
  running?: boolean;
  variables?: ApiMockVariableV1[];
  onVariablesChange?: (variables: ApiMockVariableV1[]) => void;
  liveState?: {
    states: Record<string, string>;
    counters: Record<string, number>;
    sequencePositions?: Record<string, number>;
  } | null;
  onResetState?: () => void;
  onClearTransactions?: () => void;
  consoleLines?: ApiMockConsoleLine[];
  onClearConsole?: () => void;
  onOpenConflicts?: () => void;
  onAcknowledgeConflict?: (finding: ApiMockConflictFindingV1) => void;
  onAdjustPriority?: (routeId: string, delta: number) => void;
  onOpenInRequests?: (tx: ApiMockTransactionV1) => void;
  onCreateRouteFromTransaction?: (tx: ApiMockTransactionV1) => string | void;
  onSaveSampleFromTransaction?: (tx: ApiMockTransactionV1) => void;
  onCopyTransaction?: (tx: ApiMockTransactionV1) => void;
  /** Selection policy + last analysis stats for the conflict inspector. */
  settings?: ApiMockServerSettingsV1;
  conflictStats?: { analyzedRules: number; durationMs: number };
  /** Listen URL for Runtime empty-state sample curl (page mode). */
  serverAddress?: string;
  /** Full server definition for the Runtime Settings tab (mockup 07). */
  server?: ApiMockServerDefinitionV1;
  onServerPatch?: (patch: Partial<ApiMockServerDefinitionV1>) => void;
  /**
   * `dock` — bottom Studio inspector (legacy chrome).
   * `page` — full Runtime workspace (mockup 07).
   */
  variant?: 'dock' | 'page';
  /** Tabs to omit (e.g. Runtime page hides Conflicts — that is its own top-level view). */
  hiddenTabs?: ApiMockDockTab[];
}

const TX_SPLIT_STORAGE_KEY = 'redfire-api-mock-tx-split-v1';

/**
 * Runtime inspector panels — bottom dock (Studio) or full Runtime page (mockup 07).
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
  onVariablesChange,
  liveState = null,
  onResetState,
  onClearTransactions,
  consoleLines = [],
  onClearConsole,
  onOpenConflicts,
  onAcknowledgeConflict,
  onAdjustPriority,
  onOpenInRequests,
  onCreateRouteFromTransaction,
  onSaveSampleFromTransaction,
  onCopyTransaction,
  settings,
  conflictStats,
  serverAddress,
  server,
  onServerPatch,
  variant = 'dock',
  hiddenTabs: hiddenTabsProp,
}: Props) {
  const isPage = variant === 'page';
  const hiddenTabs = hiddenTabsProp ?? EMPTY_HIDDEN_TABS;
  const hiddenKey = hiddenTabs.join('|');
  const baseTabs = isPage ? PAGE_TABS : DOCK_TABS;
  const visibleTabs = useMemo(
    () => baseTabs.filter(t => !hiddenTabs.includes(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by hiddenKey + variant
    [hiddenKey, isPage],
  );
  const defaultTab = visibleTabs[0] ?? 'transactions';
  const [tab, setTab] = useState<ApiMockDockTab>(() => initialDockTab(requestedTab, visibleTabs));
  const [mode, setMode] = useState<DockMode>('normal');
  const [selectedTxId, setSelectedTxId] = useState<string | undefined>();
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [txFilter, setTxFilter] = useState('');
  const routeName = (id?: string) => {
    if (!id) return '—';
    const r = routes.find(x => x.id === id);
    return r ? `${r.method} ${r.path.value || '/'}` : id;
  };
  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, txFilter, routeName),
    // routeName is stable enough for filter; depend on routes + filter text
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, txFilter, routes],
  );
  const selected = filteredTransactions.find(t => t.id === selectedTxId)
    ?? transactions.find(t => t.id === selectedTxId);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const { width: listWidth, dividerProps } = useSplitPaneResize({
    storageKey: TX_SPLIT_STORAGE_KEY,
    defaultWidth: 340,
    minWidth: 240,
    minOppositeWidth: 420,
    maxWidthRatio: 0.5,
    containerRef: splitContainerRef,
    label: 'Resize transaction list',
  });
  const scenario = deriveScenarioModel(routes);
  const collapsed = !isPage && mode === 'collapsed';
  const maximized = !isPage && mode === 'maximized';

  useEffect(() => {
    if (!visibleTabs.includes(tab)) setTab(defaultTab);
  }, [tab, defaultTab, visibleTabs]);

  useEffect(() => {
    if (!requestedTab) return;
    if (hiddenTabs.includes(requestedTab)) {
      const skipId = window.setTimeout(() => onRequestedTabConsumed?.(), 0);
      return () => window.clearTimeout(skipId);
    }
    setTab(requestedTab);
    if (!isPage) setMode(prev => (prev === 'collapsed' ? 'normal' : prev));
    // Defer consume so React Strict Mode's remount still sees requestedTab
    // and paints Variables/Transactions instead of resetting to the default.
    const id = window.setTimeout(() => onRequestedTabConsumed?.(), 0);
    return () => window.clearTimeout(id);
    // hiddenTabs identity is unstable when callers pass inline arrays; key by hiddenKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab, onRequestedTabConsumed, hiddenKey, isPage]);

  const selectTab = (id: ApiMockDockTab) => {
    setTab(id);
    if (!isPage && mode === 'collapsed') setMode('normal');
    if (id === 'conflicts') onOpenConflicts?.();
  };

  const dockTab = (id: ApiMockDockTab, content: React.ReactNode) => {
    if (!visibleTabs.includes(id)) return null;
    const active = tab === id;
    return (
      <button
        id={`api-mock-dtab-${id}`}
        role="tab"
        aria-selected={active}
        aria-controls={DOCK_PANEL_ID}
        tabIndex={active ? 0 : -1}
        className={`am-dock-tab${active ? ' active' : ''}`}
        data-testid={`api-mock-dock-tab-${id}`}
        onClick={() => selectTab(id)}
      >
        {content}
      </button>
    );
  };

  return (
    <div
      className={`api-mock-dock${isPage ? ' page' : ''}${maximized ? ' maximized' : ''}${collapsed ? ' collapsed' : ''}`}
      data-testid="api-mock-dock"
      data-mode={isPage ? 'page' : mode}
      data-variant={variant}
    >
      <div className={`am-dock-head${isPage ? ' page-tabs' : ''}`}>
        <div className="am-dock-tabs" role="tablist" aria-label="Runtime inspector" onKeyDown={handleTabListArrowKeys}>
          {dockTab('transactions', <>Transactions <span className="am-count-badge">{transactions.length}</span></>)}
          {dockTab('conflicts', <>Conflicts {conflictCount > 0 && <span className="am-count-badge warning">{conflictCount}</span>}</>)}
          {dockTab('state', 'State')}
          {dockTab('variables', <>Variables <span className="am-count-badge">{variables.length}</span></>)}
          {dockTab('settings', 'Settings')}
          {dockTab('diagnostics', 'Diagnostics')}
          {dockTab('console', isPage ? 'Console' : 'Server console')}
        </div>
        <span className="am-spacer" />
        {!isPage && (
          <div className="am-dock-actions">
            {collapsed ? (
              <button
                type="button"
                className="am-dock-action"
                aria-label="Show dock"
                title="Show dock"
                onClick={() => setMode('normal')}
                data-testid="api-mock-dock-show"
              >
                <ChevronUpIcon size={14} />
                <span>Show</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="am-dock-action"
                  aria-label="Hide dock"
                  title="Hide dock"
                  onClick={() => setMode('collapsed')}
                  data-testid="api-mock-dock-hide"
                >
                  <ChevronDownIcon size={14} />
                  <span>Hide</span>
                </button>
                <button
                  type="button"
                  className={`am-dock-action${maximized ? ' active' : ''}`}
                  aria-label={maximized ? 'Restore dock' : 'Expand dock'}
                  title={maximized ? 'Restore dock' : 'Expand dock'}
                  aria-pressed={maximized}
                  onClick={() => setMode(maximized ? 'normal' : 'maximized')}
                  data-testid="api-mock-dock-maximize"
                >
                  {maximized ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
                  <span>{maximized ? 'Restore' : 'Expand'}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div
        className="am-dock-body"
        id={DOCK_PANEL_ID}
        role="tabpanel"
        aria-labelledby={`api-mock-dtab-${tab}`}
        hidden={collapsed}
      >
        {tab === 'transactions' && (
          transactions.length === 0 ? (
            isPage && serverAddress ? (
              <ApiMockRuntimeGuide
                running={!!running}
                serverAddress={serverAddress}
                routes={routes}
                settings={settings}
                variableCount={variables.length}
              />
            ) : (
              <div className="am-dock-empty" data-testid="api-mock-dock-transactions-empty">
                {running
                  ? 'No transactions yet. Send a request to the running server to see it here.'
                  : 'No transactions yet. Start the server and send a request to see it here.'}
              </div>
            )
          ) : (
            <div className="am-tx-split">
              <div className="am-tx-toolbar" data-testid="api-mock-journal-toolbar">
                <input
                  className="am-input am-tx-filter"
                  placeholder="Filter by path, status, or rule…"
                  value={txFilter}
                  onChange={e => setTxFilter(e.target.value)}
                  aria-label="Filter transactions"
                  data-testid="api-mock-journal-filter"
                />
                <span className="am-spacer" />
                <button
                  type="button"
                  className="am-btn small"
                  onClick={() => exportTransactionsJson(filteredTransactions, server?.name)}
                  data-testid="api-mock-journal-export"
                >
                  Export
                </button>
                <button type="button" className="am-btn small danger" onClick={onClearTransactions} data-testid="api-mock-journal-clear">
                  Clear
                </button>
              </div>
              <div className="am-tx-main" ref={splitContainerRef}>
              <div
                className="am-tx-table-wrap"
                style={selected && !detailCollapsed ? { flex: '0 0 auto', width: listWidth, maxWidth: 'none' } : undefined}
              >
                <table className="am-data-table am-tx-table" aria-label="Transaction log">
                  <thead>
                    <tr>
                      <th className="am-tx-col-time">Time</th>
                      <th className="am-tx-col-method">Method</th>
                      <th className="am-tx-col-path">Path</th>
                      <th className="am-tx-col-status">Status</th>
                      <th className="am-tx-col-duration">Duration</th>
                      <th className="am-tx-col-rule">Matched rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="am-muted" data-testid="api-mock-journal-filter-empty">
                          No transactions match this filter.
                        </td>
                      </tr>
                    ) : filteredTransactions.map(tx => (
                      <tr
                        key={tx.id}
                        className={tx.id === selectedTxId ? 'selected' : ''}
                        onClick={() => setSelectedTxId(tx.id)}
                        style={{ cursor: 'pointer' }}
                        data-testid={`api-mock-tx-${tx.id}`}
                      >
                        <td className="am-tx-time">{timeOf(tx.receivedAt)}</td>
                        <td className="am-tx-method"><span className={`am-method ${tx.request.method.toLowerCase()}`}>{tx.request.method}</span></td>
                        <td className="am-mono am-tx-path" title={tx.request.path}>{tx.request.path}</td>
                        <td className="am-tx-status">
                          <span className={`am-badge ${tx.outcome === 'matched' ? 'success' : tx.outcome === 'ambiguous' ? 'warning' : tx.outcome === 'unmatched' ? '' : 'danger'}`}>
                            {tx.response?.status ?? tx.outcome}
                          </span>
                        </td>
                        <td className="am-muted am-tx-duration" data-testid="api-mock-tx-duration">{tx.durationMs != null ? `${tx.durationMs} ms` : '—'}</td>
                        <td className="am-tx-rule" title={tx.outcome === 'ambiguous' ? `Ambiguous · ${tx.explanation.policyDecision.matchedCount} rules` : routeName(tx.matchedRouteId)}>
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
                detailCollapsed ? (
                  <div
                    className="am-tx-split-divider am-tx-split-divider--collapsed"
                    data-testid="api-mock-tx-splitter"
                  >
                    <button
                      type="button"
                      className="am-tx-detail-toggle"
                      data-testid="api-mock-tx-detail-toggle"
                      onClick={() => setDetailCollapsed(false)}
                      aria-expanded={false}
                      aria-label="Show transaction details"
                      title="Show transaction details"
                    >
                      <span aria-hidden="true">‹</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="am-tx-split-divider"
                      data-testid="api-mock-tx-splitter"
                      {...dividerProps}
                    >
                      <button
                        type="button"
                        className="am-tx-detail-toggle"
                        data-testid="api-mock-tx-detail-toggle"
                        onClick={() => setDetailCollapsed(true)}
                        onMouseDown={e => e.stopPropagation()}
                        aria-expanded={true}
                        aria-label="Hide transaction details"
                        title="Hide transaction details"
                      >
                        <span aria-hidden="true">›</span>
                      </button>
                    </div>
                    <ApiMockTransactionDetail
                      selected={selected}
                      routeName={routeName}
                      onSelectRoute={onSelectRoute}
                      onOpenInRequests={onOpenInRequests}
                      onCreateRouteFromTransaction={onCreateRouteFromTransaction}
                      onSaveSampleFromTransaction={onSaveSampleFromTransaction}
                      onCopyTransaction={onCopyTransaction}
                    />
                  </>
                )
              )}
              </div>
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
            onAcknowledge={onAcknowledgeConflict}
            onAdjustPriority={onAdjustPriority}
            settings={settings}
            stats={conflictStats}
          />
        )}

        {tab === 'variables' && (
          <div style={{ padding: 12, overflow: 'auto', height: '100%' }} data-testid="api-mock-dock-variables">
            <div className="am-section-heading">
              Server variables
              <span className="am-spacer" />
              {onVariablesChange && (
                <button
                  type="button"
                  className="am-btn small"
                  data-testid="api-mock-var-add"
                  onClick={() => onVariablesChange([
                    ...variables,
                    { id: `var-${crypto.randomUUID().slice(0, 8)}`, key: `var${variables.length + 1}`, value: '', sensitive: false },
                  ])}
                >
                  <PlusIcon size={12} /> Variable
                </button>
              )}
            </div>
            {variables.length === 0 ? (
              <div className="am-dock-empty" data-testid="api-mock-dock-variables-empty">
                No variables defined. Add server variables to reference them as {'{{variable}}'} in responses.
              </div>
            ) : (
              <table className="am-data-table am-vars-table" aria-label="Server variables">
                <colgroup>
                  <col className="am-vars-col-key" />
                  <col className="am-vars-col-value" />
                  <col className="am-vars-col-sensitive" />
                  {onVariablesChange && <col className="am-vars-col-actions" />}
                </colgroup>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Sensitive</th>
                    {onVariablesChange && <th />}
                  </tr>
                </thead>
                <tbody>
                  {variables.map(v => (
                    <tr key={v.id} data-testid={`api-mock-var-row-${v.id}`}>
                      <td>
                        {onVariablesChange ? (
                          <input
                            className="am-input mono"
                            value={v.key}
                            aria-label="Variable key"
                            data-testid={`api-mock-var-key-${v.id}`}
                            onChange={e => onVariablesChange(variables.map(x => x.id === v.id ? { ...x, key: e.target.value } : x))}
                          />
                        ) : <span className="am-mono">{v.key}</span>}
                      </td>
                      <td>
                        {onVariablesChange ? (
                          <input
                            className="am-input mono"
                            type={v.sensitive ? 'password' : 'text'}
                            value={v.value}
                            aria-label="Variable value"
                            data-testid={`api-mock-var-value-${v.id}`}
                            onChange={e => onVariablesChange(variables.map(x => x.id === v.id ? { ...x, value: e.target.value } : x))}
                          />
                        ) : (
                          <span className="am-mono">{v.sensitive ? '••••••••' : v.value}</span>
                        )}
                      </td>
                      <td>
                        {onVariablesChange ? (
                          <button
                            type="button"
                            className={`am-toggle${v.sensitive ? ' on' : ''}`}
                            role="switch"
                            aria-checked={v.sensitive}
                            aria-label="Sensitive variable"
                            data-testid={`api-mock-var-sensitive-${v.id}`}
                            onClick={() => onVariablesChange(variables.map(x => x.id === v.id ? { ...x, sensitive: !x.sensitive } : x))}
                          />
                        ) : (
                          v.sensitive ? <span className="am-badge warning">secret</span> : <span className="am-muted">no</span>
                        )}
                      </td>
                      {onVariablesChange && (
                        <td>
                          <button
                            type="button"
                            className="am-icon-btn"
                            aria-label="Delete variable"
                            data-testid={`api-mock-var-delete-${v.id}`}
                            onClick={() => onVariablesChange(variables.filter(x => x.id !== v.id))}
                          ><TrashIcon size={13} /></button>
                        </td>
                      )}
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
              (Object.keys(liveState.states).length === 0
                && Object.keys(liveState.counters).length === 0
                && Object.keys(liveState.sequencePositions ?? {}).length === 0) ? (
                <div className="am-muted" style={{ fontSize: 11 }} data-testid="api-mock-dock-state-live">
                  No state changes yet. Send requests to stateful or sequence routes to advance runtime.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} data-testid="api-mock-dock-state-live">
                  {Object.entries(liveState.states).map(([k, v]) => <span key={`s-${k}`} className="am-chip">{k} = <strong>{v || '∅'}</strong></span>)}
                  {Object.entries(liveState.counters).map(([k, v]) => <span key={`c-${k}`} className="am-chip">{k}: <strong>{v}</strong></span>)}
                  {Object.entries(liveState.sequencePositions ?? {}).map(([routeId, pos]) => (
                    <span key={`seq-${routeId}`} className="am-chip" data-testid="api-mock-dock-seq-row">
                      seq {routeId.slice(0, 8)} → <strong>{pos}</strong>
                    </span>
                  ))}
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

        {tab === 'settings' && (
          server && onServerPatch ? (
            <ApiMockRuntimeSettingsPanel server={server} onSave={onServerPatch} />
          ) : (
            <div className="am-dock-empty" data-testid="api-mock-dock-settings-empty">
              Server settings are unavailable for this view.
            </div>
          )
        )}

        {tab === 'diagnostics' && (
          <ApiMockDiagnosticsPanel serverId={server?.id} running={running} />
        )}

        {tab === 'console' && (
          <ApiMockConsolePanel lines={consoleLines} onClear={onClearConsole} />
        )}
      </div>
    </div>
  );
}

