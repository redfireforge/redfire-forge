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
  copyTextToClipboard,
  copyTransactionToClipboard,
  exportTransactionsJson,
  filterTransactions,
  formatJournalRequestPreview,
  formatJournalResponsePreview,
} from '../apiMockJournalActions';
import type { ApiMockConsoleLine } from '../useApiMockConsole';
import { ApiMockConflictInspector } from './ApiMockConflictInspector';
import { ChevronDownIcon, ChevronUpIcon, CopyIcon, MaximizeIcon, MinimizeIcon, PlusIcon, TrashIcon } from './ApiMockIcons';
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
const TX_FLASH_MS = 2200;

function httpStatusTone(status?: number): 'success' | 'warning' | 'danger' | 'info' | '' {
  if (status == null) return '';
  if (status >= 500) return 'danger';
  if (status >= 400) return 'warning';
  if (status >= 300) return 'info';
  if (status >= 200) return 'success';
  return 'info';
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
                style={selected ? { flex: '0 0 auto', width: listWidth, maxWidth: 'none' } : undefined}
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
                <>
                  <div
                    className="am-tx-split-divider"
                    data-testid="api-mock-tx-splitter"
                    {...dividerProps}
                  />
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
              <table className="am-data-table" aria-label="Server variables">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Key</th>
                    <th>Value</th>
                    <th style={{ width: 90 }}>Sensitive</th>
                    {onVariablesChange && <th style={{ width: 50 }} />}
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

type TxFlash = 'copied' | 'saved' | 'created' | null;

function ApiMockTransactionDetail({
  selected,
  routeName,
  onSelectRoute,
  onOpenInRequests,
  onCreateRouteFromTransaction,
  onSaveSampleFromTransaction,
  onCopyTransaction,
}: {
  selected: ApiMockTransactionV1;
  routeName: (id?: string) => string;
  onSelectRoute?: (routeId: string) => void;
  onOpenInRequests?: (tx: ApiMockTransactionV1) => void;
  onCreateRouteFromTransaction?: (tx: ApiMockTransactionV1) => string | void;
  onSaveSampleFromTransaction?: (tx: ApiMockTransactionV1) => void;
  onCopyTransaction?: (tx: ApiMockTransactionV1) => void;
}) {
  const [flash, setFlash] = useState<TxFlash>(null);
  const [copiedPane, setCopiedPane] = useState<'request' | 'response' | null>(null);
  const [createdRouteId, setCreatedRouteId] = useState<string | undefined>();
  const requestPreview = formatJournalRequestPreview(selected.request);
  const responsePreview = formatJournalResponsePreview(selected.response);
  const statusTone = httpStatusTone(selected.response?.status);
  const outcomeTone = selected.outcome === 'matched' ? 'success'
    : selected.outcome === 'ambiguous' ? 'warning'
      : selected.outcome === 'unmatched' ? ''
        : 'danger';

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), TX_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!copiedPane) return;
    const t = window.setTimeout(() => setCopiedPane(null), TX_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [copiedPane]);

  const copyPane = async (pane: 'request' | 'response', text: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) setCopiedPane(pane);
  };

  return (
    <div className="am-tx-detail" data-testid="api-mock-tx-detail">
      <div className="am-tx-match-bar">
        <span className={`am-badge ${outcomeTone}`} data-testid="api-mock-tx-outcome">{selected.outcome}</span>
        {selected.matchedRouteId && (
          onSelectRoute ? (
            <button
              type="button"
              className="am-tx-match-rule am-tx-match-rule-btn"
              data-testid="api-mock-tx-matched-route"
              onClick={() => onSelectRoute(selected.matchedRouteId!)}
            >
              → {routeName(selected.matchedRouteId)}
            </button>
          ) : (
            <span className="am-tx-match-rule">→ {routeName(selected.matchedRouteId)}</span>
          )
        )}
        <span className="am-tx-kv" data-testid="api-mock-tx-detail-duration">Duration: {selected.durationMs != null ? `${selected.durationMs} ms` : '—'}</span>
        <span className="am-tx-kv">gen {selected.generation}</span>
        <span className="am-tx-kv">policy {selected.explanation.policyDecision.policy.replace(/_/g, ' ')}</span>
      </div>
      <div className="am-tx-io" data-testid="api-mock-tx-io">
        <section className="am-tx-io-pane" data-testid="api-mock-tx-request">
          <div className="am-tx-io-head">
            <span>Request</span>
            <button
              type="button"
              className="am-btn ghost small"
              data-testid="api-mock-tx-copy-request"
              onClick={() => void copyPane('request', requestPreview)}
            >
              <CopyIcon size={12} /> {copiedPane === 'request' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="am-code-block">{requestPreview}</pre>
        </section>
        <section className="am-tx-io-pane" data-testid="api-mock-tx-response">
          <div className="am-tx-io-head">
            <span className="am-tx-io-title">
              Response
              {selected.response && (
                <span className={`am-badge ${statusTone}`} data-testid="api-mock-tx-response-status">{selected.response.status}</span>
              )}
            </span>
            {selected.response && (
              <button
                type="button"
                className="am-btn ghost small"
                data-testid="api-mock-tx-copy-response"
                onClick={() => void copyPane('response', responsePreview)}
              >
                <CopyIcon size={12} /> {copiedPane === 'response' ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          {selected.response ? (
            <pre className="am-code-block">{responsePreview}</pre>
          ) : (
            <div className="am-tx-io-empty">No response captured</div>
          )}
        </section>
      </div>
      {(selected.explanation.candidates.length > 0 || selected.explanation.nearMisses.length > 0) && (
        <div className="am-tx-meta">
          {selected.explanation.candidates.length > 0 && (
            <div className="am-tx-candidates" data-testid="api-mock-tx-candidates">
              {selected.explanation.candidates.slice(0, 6).map(c => {
                const label = (
                  <>
                    {c.routeName || routeName(c.routeId)}
                    <span className="am-faint"> P{c.priority}</span>
                    {' · '}
                    <span className={c.overallMatch ? 'am-ok' : 'am-muted'}>{c.overallMatch ? 'match' : 'miss'}</span>
                  </>
                );
                return onSelectRoute ? (
                  <button key={c.routeId} type="button" className="am-chip" onClick={() => onSelectRoute(c.routeId)}>
                    {label}
                  </button>
                ) : (
                  <div key={c.routeId} className="am-chip">{label}</div>
                );
              })}
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
        </div>
      )}

      {flash === 'created' && (
        <div className="am-notice am-notice--flush am-tx-notice" data-testid="api-mock-tx-notice">
          <span>Draft route created from this transaction. Open it in Studio to review and enable matching.</span>
          {createdRouteId && onSelectRoute && (
            <button type="button" className="am-btn small primary" data-testid="api-mock-tx-open-created" onClick={() => onSelectRoute(createdRouteId)}>
              Open in Studio
            </button>
          )}
        </div>
      )}
      {flash === 'saved' && (
        <div className="am-notice am-notice--flush am-tx-notice" data-testid="api-mock-tx-notice">
          <span>
            {selected.matchedRouteId
              ? 'Example saved on the matched rule.'
              : 'Example saved. Attach it to a rule from Studio → Examples.'}
          </span>
          {selected.matchedRouteId && onSelectRoute && (
            <button type="button" className="am-btn small primary" data-testid="api-mock-tx-view-example" onClick={() => onSelectRoute(selected.matchedRouteId!)}>
              View in Studio
            </button>
          )}
        </div>
      )}

      <div className="am-tx-actions" data-testid="api-mock-tx-actions">
        {onOpenInRequests && (
          <button type="button" className="am-btn small" data-testid="api-mock-tx-open-requests" onClick={() => onOpenInRequests(selected)}>
            Open in Requests
          </button>
        )}
        {onCreateRouteFromTransaction && (
          <button
            type="button"
            className={`am-btn small${selected.outcome !== 'matched' ? ' primary' : ''}`}
            data-testid="api-mock-tx-create-route"
            onClick={() => {
              const id = onCreateRouteFromTransaction(selected);
              setCreatedRouteId(typeof id === 'string' ? id : undefined);
              setFlash('created');
            }}
          >
            {flash === 'created' ? 'Created' : 'Create route'}
          </button>
        )}
        {onSaveSampleFromTransaction && (
          <button
            type="button"
            className="am-btn small"
            data-testid="api-mock-tx-save-example"
            onClick={() => {
              onSaveSampleFromTransaction(selected);
              setFlash('saved');
            }}
          >
            {flash === 'saved' ? 'Saved' : 'Save as example'}
          </button>
        )}
        <button
          type="button"
          className="am-btn small"
          data-testid="api-mock-tx-copy"
          onClick={() => {
            void copyTransactionToClipboard(selected);
            onCopyTransaction?.(selected);
            setFlash('copied');
          }}
        >
          {flash === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
