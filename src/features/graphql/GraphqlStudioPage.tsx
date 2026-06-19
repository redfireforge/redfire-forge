/**
 * GraphqlStudioPage — main page for the GraphQL Studio feature.
 *
 * Phase 1A: multi-tab editor + variables panel + headers panel + layout.
 *           Close-tab confirmation for unsaved changes (two-click pattern).
 * Phase 1B: introspection, schema explorer, schema status badge.
 * Phase 1C: query/mutation execution engine + AST validation squiggles.
 * Phase 1D: connection management (auth, profiles, saved connections).
 * Phase 1E: environment variable management with {{var}} interpolation.
 *
 * Extracted hooks:
 *   hooks/useGqlStudioTabs               — tab lifecycle, persistence, content callbacks
 *   hooks/useGqlStudioEditorActions      — prettify + insert-field actions
 *   hooks/useGqlPollingPopover           — (used inside GraphqlConnectionBar)
 *   hooks/useGraphqlConnectionSettings   — endpoint, TLS, polling, auth, profiles, env
 *   hooks/useGqlItemLoaders              — load/run collection/history items into editor
 *   hooks/useGqlKeyboardShortcuts        — keyboard shortcuts (Cmd+Enter, Esc, etc.)
 *   hooks/useGraphqlSchemaSnapshots      — schema snapshot CRUD + diff modal
 *   hooks/useGraphqlAdvancedSettings     — APQ, batch, dedup, complexity gate settings
 *   hooks/useGraphqlBatchExecution       — batch query execution
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMonaco } from '@monaco-editor/react';
import { isTauri } from '../../shared/utils/platform';
import { getProxyBase } from './utils/graphqlProxyTransports';
import type { GlobalAuthProfile } from '../../shared/types';
import type { GraphqlHistoryItem, RfResponseContext } from '../../shared/types/graphql';
import { GraphqlConnectionBar } from './components/GraphqlConnectionBar';
import { GraphqlEditor } from './components/GraphqlEditor';
import { GqlTabBar } from './components/GqlTabBar';
import { GqlBottomPanel } from './components/GqlBottomPanel';
import { GqlRightPane } from './components/GqlRightPane';
import { GraphqlQueryBuilder } from './components/GraphqlQueryBuilder';
import { GraphqlSubscriptionAssertionPanel } from './components/GraphqlSubscriptionAssertionPanel';
import { GraphqlStudioActivityBar } from './components/GraphqlStudioActivityBar';
import { loadPersistedActivityTab } from './utils/gqlActivityBarUtils';
import { GraphqlHistoryPanel } from './components/GraphqlHistoryPanel';
import { GraphqlCollections, SaveToCollectionModal } from './components/GraphqlCollections';
import { GraphqlCollectionRunnerPanel } from './components/GraphqlCollectionRunnerPanel';
import { GraphqlSchemaDiff } from './components/GraphqlSchemaDiff';
import { GraphqlMockPanel } from './components/GraphqlMockPanel';
import { GraphqlAdvancedSettings } from './components/GraphqlAdvancedSettings';
import { GraphqlBatchResults } from './components/GraphqlBatchResults';
import { GraphqlComplexityGateModal } from './components/GraphqlComplexityGateModal';
import { GqlDedupBanner } from './components/GqlDedupBanner';
import { GqlComplexityWarningBanner } from './components/GqlComplexityWarningBanner';
import { GqlPageToasts } from './components/GqlPageToasts';
import { GqlConnectionModals } from './components/GqlConnectionModals';
import { useGraphqlExecution } from './hooks/useGraphqlExecution';
import { useQueryValidation } from './hooks/useQueryValidation';
import { useGraphqlSchema } from './hooks/useGraphqlSchema';
import { useGraphqlSubscription } from './hooks/useGraphqlSubscription';
import { useSubscriptionOrchestration } from './hooks/useSubscriptionOrchestration';
import { useGqlStudioTabs } from './hooks/useGqlStudioTabs';
import { useGqlStudioEditorActions } from './hooks/useGqlStudioEditorActions';
import { useGraphqlHistory } from './hooks/useGraphqlHistory';
import { useGraphqlCollections } from './hooks/useGraphqlCollections';
import { useGraphqlCollectionRunner } from './hooks/useGraphqlCollectionRunner';
import { useGraphqlConnectionSettings } from './hooks/useGraphqlConnectionSettings';
import { useGqlItemLoaders } from './hooks/useGqlItemLoaders';
import { useGqlKeyboardShortcuts } from './hooks/useGqlKeyboardShortcuts';
import { useGraphqlCollectionRun } from './hooks/useGraphqlCollectionRun';
import { useMonacoExecutionMarkers } from './hooks/useMonacoExecutionMarkers';
import { buildAuthHeaders } from './utils/authUtils';
import { findUnresolvedVars, resolveVars } from './utils/envUtils';
import type { FileEntry } from './utils/multipartBuilder';
import { buildMultipartFormData } from './utils/multipartBuilder';
import { buildClientSchema, validate, parse as gqlParseDoc } from 'graphql';
import type { IntrospectionQuery } from 'graphql';
import { computeQueryComplexity } from './utils/complexityEstimator';
import { buildAssertionResultMap } from './utils/subscriptionAssertions';
import { useGraphqlMockServer } from './hooks/useGraphqlMockServer';
import { useGraphqlAdvancedSettings } from './hooks/useGraphqlAdvancedSettings';
import { useGraphqlBatchExecution } from './hooks/useGraphqlBatchExecution';
import { useGraphqlSchemaSnapshots } from './hooks/useGraphqlSchemaSnapshots';
import {
  buildVarsModelUri,
  clearGraphqlSchema,
  setGraphqlSchema,
} from './utils/monacoGraphqlSetup';
import { DEFAULT_VARS } from './utils/tabPersistence';
import '../../styles/graphql-studio.css';
import '../../styles/graphql-collections.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type BottomPanelTab = 'variables' | 'headers' | 'files';
type RightPaneView = 'response' | 'schema';
type BottomPanelTabExtended = BottomPanelTab | 'runner';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GraphqlStudioPageProps {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
}

// ─── Module-level constants ───────────────────────────────────────────────────

// Proxy base for batch + mock requests — evaluated once at module load time.
const GQL_PROXY_BASE = getProxyBase();

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphqlStudioPage({
  resolvedBaseUrl,
}: GraphqlStudioPageProps) {
  // ── UI state ───────────────────────────────────────────────────────────────
  const [bottomTab, setBottomTab]   = useState<BottomPanelTabExtended>('variables');
  const [rightView, setRightView]   = useState<RightPaneView>('response');
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [builderMode, setBuilderMode] = useState(false);

  // ── Phase 3A — Activity bar + history + collections ────────────────────────
  const [activityTab, setActivityTab] = useState(() => loadPersistedActivityTab());
  const [runnerCollectionId, setRunnerCollectionId] = useState<string | null>(null);
  const [saveToColItem, setSaveToColItem] = useState<GraphqlHistoryItem | null>(null);
  const [historyMaxItems, setHistoryMaxItems] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('gql_history_max_items');
      if (raw) { const n = parseInt(raw, 10); if (!Number.isNaN(n)) return Math.max(10, Math.min(500, n)); }
    } catch { /* silent */ }
    return 100;
  });
  const handleHistoryMaxItemsChange = useCallback((n: number) => {
    setHistoryMaxItems(n);
    try { localStorage.setItem('gql_history_max_items', String(n)); } catch { /* silent */ }
  }, []);

  // ── Connection settings (endpoint, TLS, polling, auth, profiles, env) ─────
  const {
    endpoint, setEndpoint, historyConnectionId, prevBaseUrlRef,
    skipTlsVerify, handleSkipTlsVerifyChange,
    pollingEnabled, pollingIntervalSeconds, pollingIntervalMs, handlePollingChange,
    auth, handleAuthChange,
    recentEndpoints, pushRecentEndpoint, removeRecentEndpoint,
    profiles, saveProfile, deleteProfile, profileModalOpen, setProfileModalOpen,
    environments, activeEnvironment,
    createEnvironment, deleteEnvironment, setActiveEnvironment,
    updateEnvironmentName, updateVariables, importEnvironment, exportEnvironment,
    envModalOpen, setEnvModalOpen,
  } = useGraphqlConnectionSettings(resolvedBaseUrl);

  const history     = useGraphqlHistory(historyConnectionId, historyMaxItems);
  const collections = useGraphqlCollections();
  const runner      = useGraphqlCollectionRunner();

  // ── Execution engine ───────────────────────────────────────────────────────
  const {
    status: execStatus,
    response,
    execute,
    cancel,
    isDuplicate,
    apqInfo,
    resolveDedupChoice,
  } = useGraphqlExecution();
  const executing = execStatus === 'loading';

  useEffect(() => { if (!executing) setUploadProgress(null); }, [executing]);

  // Auto-save history after execution completes
  const prevExecStatusRef = useRef(execStatus);
  useEffect(() => {
    const prev = prevExecStatusRef.current;
    prevExecStatusRef.current = execStatus;
    if (prev !== 'loading' || (execStatus !== 'success' && execStatus !== 'error')) return;
    if (!response || !activeTab || !endpoint) return;
    history.saveHistory({
      connectionId: historyConnectionId ?? endpoint,
      operation: {
        id: activeTab.id,
        name: activeTab.selectedOperation ?? (activeTab.label !== 'Untitled' ? activeTab.label : undefined),
        query: activeTab.query,
        variables: activeTab.variables,
        operationType: (activeTab.operationType ?? 'query') as 'query' | 'mutation' | 'subscription',
      },
      response,
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execStatus]);

  const subscription = useGraphqlSubscription();

  const {
    advSettingsOpen, setAdvSettingsOpen, advSettingsBtnRef,
    advSettings, advSettingsRef, setAdvSettings,
    apqUnsupportedToast, setApqUnsupportedToast, batchUnsupportedToast, setBatchUnsupportedToast,
    connectionIdRef, handleAdvSettingsChange,
  } = useGraphqlAdvancedSettings(historyConnectionId, apqInfo);

  const monacoInstance = useMonaco();
  const monacoRef      = useRef(monacoInstance);
  monacoRef.current    = monacoInstance;
  const responseModelUriRef = useRef<string>('');

  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  const {
    tabs, activeTabId, activeTab, operations, selectedOperation,
    confirmingCloseTabId, closeActiveTabRef, executingRef,
    addTab, handleTabClick, closeTab,
    handleSelectOperation, handleQueryChange, handleVariablesChange,
    handleHeadersChange, handleAssertionsChange, handleSubscriptionTransportChange,
  } = useGqlStudioTabs({
    onCancelExecution: () => cancelRef.current(),
    executing, responseModelUriRef,
    onClearFileEntries: () => setFileEntries([]),
    onResetSubscription: () => subscription.reset(),
    monacoRef: monacoRef as React.MutableRefObject<import('@monaco-editor/react').Monaco | null>,
  });

  const {
    editorMountRef, prettifyError, insertToast, handlePrettify, handleInsertField,
  } = useGqlStudioEditorActions({ activeQuery: activeTab?.query ?? '', onQueryChange: handleQueryChange });

  const activeTabForHeaders = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const activeTabHeaders = useMemo<Record<string, string>>(() => {
    if (!activeTabForHeaders) return {};
    const map: Record<string, string> = {};
    for (const h of activeTabForHeaders.headers) {
      if (h.enabled && h.key.trim()) map[h.key.trim()] = h.value;
    }
    return map;
  }, [activeTabForHeaders]);

  const schemaHeaders = useMemo<Record<string, string>>(() => {
    const authH = buildAuthHeaders(auth);
    const resolved: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...authH, ...activeTabHeaders })) {
      resolved[k] = resolveVars(v, activeEnvironment);
    }
    return resolved;
  }, [auth, activeTabHeaders, activeEnvironment]);

  const {
    status: schemaStatus, schemaInfo, rawIntrospection, errorMessage: schemaErrorMessage,
    introspecting, introspect, pollErrorMessage,
  } = useGraphqlSchema(resolveVars(endpoint, activeEnvironment), schemaHeaders, { pollingIntervalMs, skipTlsVerify });

  const mockServer = useGraphqlMockServer(historyConnectionId, schemaInfo?.sdl ?? null);
  useEffect(() => {
    if (rawIntrospection) { try { setGraphqlSchema(rawIntrospection); } catch { /* non-fatal */ } }
    else { try { clearGraphqlSchema(); } catch { /* non-fatal */ } }
  }, [rawIntrospection]);

  const invalidItemIds = useMemo<Set<string>>(() => {
    if (!rawIntrospection) return new Set();
    const allItems = collections.trees.flatMap((t) => t.items);
    if (allItems.length === 0) return new Set();
    let schema: ReturnType<typeof buildClientSchema>;
    try { schema = buildClientSchema(rawIntrospection as unknown as IntrospectionQuery); }
    catch { return new Set(); }
    const invalid = new Set<string>();
    for (const item of allItems) {
      if (!item.operation.query.trim()) continue;
      try {
        const errors = validate(schema, gqlParseDoc(item.operation.query));
        if (errors.length > 0) invalid.add(item.id);
      } catch { invalid.add(item.id); }
    }
    return invalid;
  }, [rawIntrospection, collections.trees]);

  const {
    snapshots, deprecatedUsages, diffModal, setDiffModal,
    schemaDiffToast, setSchemaDiffToast, toastBaselineSnapshotIdRef,
    handleSaveSnapshot, handleDeleteSnapshot, handleOpenDiff,
    handleAcknowledge, handleUnacknowledge,
  } = useGraphqlSchemaSnapshots(historyConnectionId, schemaInfo, schemaStatus, rawIntrospection, collections.trees);

  const prevIntrospectingRef = useRef(introspecting);
  const introspectStartResolvedRef = useRef('');
  useEffect(() => {
    const resolved = resolveVars(endpoint, activeEnvironment);
    if (introspecting && !prevIntrospectingRef.current) introspectStartResolvedRef.current = resolved;
    if (prevIntrospectingRef.current && !introspecting && schemaStatus === 'loaded'
        && resolved === introspectStartResolvedRef.current) setRightView('schema');
    prevIntrospectingRef.current = introspecting;
  }, [introspecting, schemaStatus, endpoint, activeEnvironment]);

  const connectionBarSchemaStatus: 'loaded' | 'error' | 'none' =
    schemaStatus === 'loaded' ? 'loaded' : (schemaStatus === 'error' || schemaStatus === 'introspection-disabled') ? 'error' : 'none';

  // ── Monaco execution error markers ────────────────────────────────────────
  useMonacoExecutionMarkers(response, monacoInstance, responseModelUriRef);

  // ── Query AST validation ───────────────────────────────────────────────────
  const queryValidationErrorCount = useQueryValidation(
    activeTab?.query ?? '',
    activeTab?.modelUri ?? '',
    rawIntrospection,
    schemaStatus === 'loaded',
  );

  const complexityResult = useMemo(() => {
    if (schemaStatus !== 'loaded' || !schemaInfo) return null;
    const query = activeTab?.query ?? '';
    if (!query.trim()) return null;
    return computeQueryComplexity(query, schemaInfo, undefined, activeTab?.selectedOperation ?? undefined);
  }, [activeTab?.query, activeTab?.selectedOperation, schemaInfo, schemaStatus]);

  const [complexityWarningPending, setComplexityWarningPending] = useState(false);
  const prevComplexityQueryRef = useRef<string>('');
  useEffect(() => {
    const q = activeTab?.query ?? '';
    if (q !== prevComplexityQueryRef.current) { prevComplexityQueryRef.current = q; setComplexityWarningPending(false); }
  }, [activeTab?.query]);

  const [varsError, setVarsError] = useState<string | null>(null);
  const prevVarsTabIdRef = useRef(activeTabId);
  useEffect(() => {
    const vars = activeTab?.variables ?? '';
    const isTabSwitch = activeTabId !== prevVarsTabIdRef.current;
    prevVarsTabIdRef.current = activeTabId;
    const validateVars = () => {
      const trimmed = vars.trim();
      if (!trimmed || trimmed === '{}') { setVarsError(null); return; }
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        setVarsError(parsed === null || Array.isArray(parsed) || typeof parsed !== 'object'
          ? 'Variables must be a JSON object — e.g. {"id": "1"}' : null);
      } catch { setVarsError('Invalid JSON'); }
    };
    if (isTabSwitch) { validateVars(); return; }
    const timer = setTimeout(validateVars, 300);
    return () => clearTimeout(timer);
  }, [activeTab?.variables, activeTabId]);

  const assertionResultMap = useMemo(
    () => buildAssertionResultMap(subscription.messages, activeTab?.subscriptionAssertions ?? []),
    [subscription.messages, activeTab?.subscriptionAssertions],
  );

  // ── Phase 3F: Batch execute handler ───────────────────────────────────────
  const {
    batchResult, setBatchResult, batchExecuting,
    complexityGatePending, setComplexityGatePending,
    pendingExecuteAfterGateRef, skipComplexityGateRef, sessionBypassComplexityGateRef,
    effectiveBatchedTabs, batchedTabIdsSet,
    handleToggleBatch, handleSendBatch,
  } = useGraphqlBatchExecution({
    tabs, endpoint, auth, activeEnvironment, skipTlsVerify,
    advSettingsRef, connectionIdRef, setAdvSettings, setBatchUnsupportedToast,
    setRightView, gqlProxyBase: GQL_PROXY_BASE,
  });

  // ── Execute handler ────────────────────────────────────────────────────────
  const executionLockRef = useRef(false);
  if (!executing) executionLockRef.current = false;

  const handleExecute = useCallback(() => {
    if (!activeTab || !endpoint.trim() || !activeTab.query.trim()) return;
    if (findUnresolvedVars(endpoint, activeEnvironment).length > 0) return;
    const trimmedVars = activeTab.variables.trim();
    if (trimmedVars && trimmedVars !== '{}') {
      try {
        const parsed = JSON.parse(trimmedVars) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      } catch { return; }
    }
    if (fileEntries.some((e) => e.error !== null)) return;
    if (executing || executionLockRef.current) return;

    if (complexityResult?.shouldBlock && !complexityWarningPending) {
      setComplexityWarningPending(true);
      return;
    }
    setComplexityWarningPending(false);

    if (
      advSettings.complexityBlockEnabled &&
      complexityResult &&
      complexityResult.score > advSettings.complexityBlockThreshold &&
      !complexityGatePending &&
      !skipComplexityGateRef.current &&
      !sessionBypassComplexityGateRef.current
    ) {
      setComplexityGatePending(true);
      pendingExecuteAfterGateRef.current = handleExecute;
      return;
    }
    skipComplexityGateRef.current = false;

    executionLockRef.current = true;
    responseModelUriRef.current = activeTab.modelUri;
    setRightView('response');
    const resolvedEndpoint = resolveVars(endpoint, activeEnvironment);
    pushRecentEndpoint(resolvedEndpoint);
    const authH = buildAuthHeaders(auth);
    const resolvedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...authH, ...activeTabHeaders })) {
      resolvedHeaders[k] = resolveVars(v, activeEnvironment);
    }
    const resolvedVariables = resolveVars(activeTab.variables, activeEnvironment);
    const validFiles = fileEntries.filter((e) => e.error === null && e.varPath.trim() !== '');

    if (validFiles.length > 0) {
      let parsedVars: Record<string, unknown> = {};
      try {
        const trimmed = resolvedVariables.trim();
        if (trimmed && trimmed !== '{}') {
          parsedVars = JSON.parse(trimmed) as Record<string, unknown>;
        }
      } catch { /* ignore */ }
      const formData = buildMultipartFormData(activeTab.query, parsedVars, validFiles);
      setUploadProgress(0);
      execute({
        endpoint: resolvedEndpoint, query: activeTab.query,
        variables: resolvedVariables, operationName: selectedOperation,
        headers: resolvedHeaders, skipTlsVerify, formData,
        connectionId: resolvedEndpoint,
        operationType: activeTab.operationType === 'mutation' ? 'mutation' : 'query',
        onUploadProgress: (loaded, total) => {
          if (!executingRef.current && loaded !== 0) return;
          if (total > 0) setUploadProgress(Math.min(98, Math.round((loaded / total) * 100)));
        },
      });
    } else {
      execute({
        endpoint: resolvedEndpoint, query: activeTab.query,
        variables: resolvedVariables, operationName: selectedOperation,
        headers: resolvedHeaders, skipTlsVerify, connectionId: resolvedEndpoint,
        apqEnabled: advSettings.apqEnabled, apqUseGet: advSettings.apqUseGet,
        dedupEnabled: advSettings.dedupEnabled,
        operationType: activeTab.operationType === 'mutation' ? 'mutation' : 'query',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs (pendingExecuteAfterGateRef, skipComplexityGateRef, sessionBypassComplexityGateRef) and stable setters (setComplexityGatePending) are intentionally omitted; self-referencing handleExecute via ref avoids circular dep
  }, [activeTab, endpoint, execute, executing, selectedOperation, activeTabHeaders, auth,
      pushRecentEndpoint, activeEnvironment, skipTlsVerify, fileEntries, complexityResult,
      complexityWarningPending, complexityGatePending, advSettings, executingRef]);

  // ── Phase 3A+3B: collection runner ────────────────────────────────────────
  const { handleRunCollection } = useGraphqlCollectionRun({
    collectionTrees: collections.trees,
    endpoint, activeEnvironment, activeTabHeaders, auth, runner, updateVariables,
    onSetRunnerCollectionId: setRunnerCollectionId,
    onSetBottomTab: (tab) => setBottomTab(tab as BottomPanelTabExtended),
    onItemExecuted: (id) => collections.markItemExecuted(id).catch(() => {}),
  });

  // ── Item loaders (collection/history → editor) ────────────────────────────
  const handleExecuteRef = useRef(handleExecute);
  handleExecuteRef.current = handleExecute;

  const {
    handleLoadCollectionItem,
    handleOpenCollectionItem,
    handleLoadHistoryItem,
    handleRunHistoryItem,
    handleEditInEditor,
    handleBuilderExecute,
  } = useGqlItemLoaders({
    editorMountRef,
    onQueryChange: handleQueryChange,
    onVariablesChange: handleVariablesChange,
    onSetActivityTab: (tab) => setActivityTab(tab as Parameters<typeof setActivityTab>[0]),
    onSetBuilderMode: setBuilderMode,
    handleExecuteRef,
    collectionTrees: collections.trees,
  });

  // ── Subscription orchestration ─────────────────────────────────────────────
  const { handleSubscribe: _handleSubscribe, handleStopSubscription, handleExportSubscription } = useSubscriptionOrchestration({
    activeTab, endpoint, auth, activeEnvironment, activeTabHeaders,
    selectedOperation, skipTlsVerify, subscription,
  });

  const handleSubscribe = useCallback(() => {
    setRightView('response');
    _handleSubscribe();
  }, [_handleSubscribe]);

  const prevTabIdForSubRef = useRef(activeTabId);
  useEffect(() => {
    const tabChanged = prevTabIdForSubRef.current !== activeTabId;
    prevTabIdForSubRef.current = activeTabId;
    if (subscription.state === 'idle') return;
    if (activeTab?.operationType !== 'subscription' || tabChanged) {
      subscription.disconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, activeTab?.operationType]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useGqlKeyboardShortcuts({
    handleExecute,
    handleSubscribe,
    handleStopSubscription,
    introspect,
    introspecting,
    cancel,
    addTab,
    closeActiveTab: closeActiveTabRef.current,
    subscriptionState: subscription.state,
    subscriptionDisconnect: subscription.disconnect,
    activeTabOperationType: activeTab?.operationType,
    execStatus,
    endpoint,
    activeEnvironment,
    profileModalOpen,
    envModalOpen,
  });

  // ─────────────────────────────────────────────────────────────────────────
  if (tabs.length === 0 || !activeTab) return null;

  const varsModelPath = buildVarsModelUri(activeTab.id);

  return (
    <div className="gql-studio" data-testid="gql-studio-page">
      <GraphqlConnectionBar
        endpoint={endpoint}
        onEndpointChange={setEndpoint}
        onExecute={handleExecute}
        onCancel={cancel}
        executing={executing}
        introspecting={introspecting}
        onIntrospect={introspect}
        schemaStatus={connectionBarSchemaStatus}
        typesCount={schemaInfo?.types?.length}
        schemaPolling={pollingEnabled}
        operations={operations}
        selectedOperation={selectedOperation}
        onSelectOperation={handleSelectOperation}
        varsInvalid={varsError !== null}
        queryEmpty={!activeTab?.query.trim()}
        fileErrors={fileEntries.some((e) => e.error !== null)}
        queryValidationErrors={queryValidationErrorCount}
        auth={auth ?? undefined}
        onAuthChange={handleAuthChange}
        recentEndpoints={recentEndpoints}
        onRemoveRecentEndpoint={removeRecentEndpoint}
        activeEnvName={activeEnvironment?.name ?? null}
        activeEnvironment={activeEnvironment}
        onEnvBadgeClick={() => setEnvModalOpen(true)}
        profiles={profiles}
        onProfileBadgeClick={() => setProfileModalOpen(true)}
        skipTlsVerify={skipTlsVerify}
        onSkipTlsVerifyChange={isTauri() ? undefined : handleSkipTlsVerifyChange}
        pollingEnabled={pollingEnabled}
        pollingIntervalSeconds={pollingIntervalSeconds}
        onPollingChange={handlePollingChange}
        pollErrorMessage={pollErrorMessage}
        activeOperationType={activeTab?.operationType ?? null}
        subscriptionState={subscription.state}
        onSubscribe={handleSubscribe}
        onStop={handleStopSubscription}
        subscriptionTransport={activeTab?.subscriptionTransport ?? 'auto'}
        onSubscriptionTransportChange={handleSubscriptionTransportChange}
        complexityScore={complexityResult?.score}
        complexityLevel={complexityResult?.level}
        advancedSettingsOpen={advSettingsOpen}
        onAdvancedSettingsClick={() => setAdvSettingsOpen((v) => !v)}
        advSettingsBtnRef={advSettingsBtnRef}
        batchEnabled={advSettings.batchEnabled}
        batchedTabCount={effectiveBatchedTabs.length}
        batchExecuting={batchExecuting}
        onSendBatch={handleSendBatch}
        apqCacheHit={apqInfo?.cacheHit}
        apqHash={apqInfo?.hash}
        apqUnsupported={apqInfo?.unsupported}
      />

      <GraphqlAdvancedSettings
        values={advSettings}
        onChange={handleAdvSettingsChange}
        anchorRef={advSettingsBtnRef}
        open={advSettingsOpen}
        onClose={() => setAdvSettingsOpen(false)}
      />

      {complexityGatePending && complexityResult && (
        <GraphqlComplexityGateModal
          complexityResult={complexityResult}
          blockThreshold={advSettings.complexityBlockThreshold}
          onSendAnyway={(rememberSession) => {
            setComplexityGatePending(false);
            const fn = pendingExecuteAfterGateRef.current;
            pendingExecuteAfterGateRef.current = null;
            if (fn) {
              setComplexityWarningPending(false);
              if (rememberSession) sessionBypassComplexityGateRef.current = true;
              skipComplexityGateRef.current = true;
              fn();
            }
          }}
          onCancel={() => {
            setComplexityGatePending(false);
            pendingExecuteAfterGateRef.current = null;
          }}
        />
      )}

      <GqlDedupBanner
        visible={isDuplicate}
        onWait={() => resolveDedupChoice('wait')}
        onCancelOriginal={() => resolveDedupChoice('cancel')}
        onSendAnyway={() => resolveDedupChoice('sendAnyway')}
      />

      <GqlConnectionModals
        profileModalOpen={profileModalOpen}
        onProfileModalClose={() => setProfileModalOpen(false)}
        profiles={profiles}
        endpoint={endpoint}
        auth={auth}
        onSaveProfile={(name) => saveProfile(name, endpoint, auth)}
        onDeleteProfile={deleteProfile}
        onSetEndpoint={setEndpoint}
        onAuthChange={handleAuthChange}
        prevBaseUrlRef={prevBaseUrlRef}
        envModalOpen={envModalOpen}
        onEnvModalClose={() => setEnvModalOpen(false)}
        environments={environments}
        activeEnvironmentId={activeEnvironment?.id ?? null}
        onCreateEnvironment={createEnvironment}
        onDeleteEnvironment={deleteEnvironment}
        onSetActiveEnvironment={setActiveEnvironment}
        onRenameEnvironment={updateEnvironmentName}
        onUpdateVariables={updateVariables}
        onImportEnvironment={importEnvironment}
        onExportEnvironment={exportEnvironment}
      />

      <GqlTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        confirmingCloseTabId={confirmingCloseTabId}
        onTabClick={handleTabClick}
        onTabClose={closeTab}
        onAddTab={addTab}
        batchEnabled={advSettings.batchEnabled}
        batchedTabIds={batchedTabIdsSet}
        onToggleBatch={handleToggleBatch}
      />

      <div className={`gql-main${builderMode ? ' gql-main--builder' : ''} gql-main--with-activity`} data-testid="gql-main">
        <GraphqlStudioActivityBar activeTab={activityTab} onTabChange={setActivityTab} />

        <div className={`gql-studio-left-panel${activityTab ? '' : ' gql-studio-left-panel--hidden'}`} data-testid="gql-studio-left-panel">
          {activityTab === 'history' && (
            <GraphqlHistoryPanel
              history={history}
              onLoadIntoEditor={handleLoadHistoryItem}
              onRunInEditor={handleRunHistoryItem}
              onSaveToCollection={(item) => setSaveToColItem(item)}
              maxItems={historyMaxItems}
              onMaxItemsChange={handleHistoryMaxItemsChange}
              endpoint={historyConnectionId ?? ''}
            />
          )}
          {activityTab === 'mock' && (
            <GraphqlMockPanel mockServer={mockServer} schemaInfo={schemaInfo} />
          )}
          {activityTab === 'collections' && (
            <GraphqlCollections
              collections={collections}
              loading={collections.loading}
              invalidItemIds={invalidItemIds}
              onRunItem={(item) => handleRunCollection(item.collectionId, undefined, item)}
              onRunAll={(colId, folderId) => handleRunCollection(colId, folderId)}
              onLoadItem={handleLoadCollectionItem}
              currentOperation={
                saveToColItem
                  ? saveToColItem.operation
                  : (activeTab ? {
                      id: activeTab.id,
                      name: activeTab.selectedOperation ?? undefined,
                      query: activeTab.query,
                      variables: activeTab.variables,
                      operationType: (activeTab.operationType ?? 'query') as 'query' | 'mutation' | 'subscription',
                    } : undefined)
              }
              onSaveComplete={() => setSaveToColItem(null)}
              lastRfResponse={(() => {
                const last = history.items[0];
                if (!last) return undefined;
                try {
                  const parsed = JSON.parse(last.response) as {
                    data?: unknown;
                    errors?: Array<{ message: string }>;
                    httpStatus?: number;
                    httpHeaders?: Record<string, string>;
                  };
                  return {
                    httpStatus:  parsed.httpStatus  ?? 200,
                    httpHeaders: parsed.httpHeaders ?? {},
                    data:        parsed.data,
                    errors:      parsed.errors,
                    latencyMs:   last.latencyMs,
                  } satisfies RfResponseContext;
                } catch {
                  return undefined;
                }
              })()}
              envSnapshot={(() => {
                const snapshot: Record<string, string> = {};
                for (const v of (activeEnvironment?.variables ?? [])) {
                  if (v.enabled && v.key.trim()) snapshot[v.key.trim()] = v.value;
                }
                return snapshot;
              })()}
            />
          )}
        </div>

        <div className="gql-left-pane">
          <div className="gql-editor-mode-bar" data-testid="gql-editor-mode-bar">
            <div className="gql-mode-toggle" role="group" aria-label="Edit mode">
              <button type="button" className={`gql-mode-btn${!builderMode ? ' gql-mode-btn--active' : ''}`}
                onClick={() => setBuilderMode(false)} aria-pressed={!builderMode} data-testid="gql-mode-editor">
                Editor
              </button>
              <button type="button" className={`gql-mode-btn${builderMode ? ' gql-mode-btn--active' : ''}`}
                onClick={() => setBuilderMode(true)} aria-pressed={builderMode} data-testid="gql-mode-builder"
                title={schemaInfo ? undefined : 'Introspect a schema to use the builder'}>
                Builder
              </button>
            </div>
          </div>

          {builderMode ? (
            <GraphqlQueryBuilder
              schemaInfo={schemaInfo}
              onEditInEditor={handleEditInEditor}
              onExecute={handleBuilderExecute}
            />
          ) : (
            <>
              <div className="gql-editor-pane" data-testid="gql-editor-pane">
                <GraphqlEditor
                  modelPath={activeTab.modelUri}
                  defaultValue={activeTab.query}
                  onChange={handleQueryChange}
                  height="100%"
                  data-testid="gql-editor"
                  editorMountRef={editorMountRef}
                />
                <button
                  type="button"
                  className={`gql-prettify-btn${prettifyError ? ' gql-prettify-btn--error' : ''}`}
                  onClick={handlePrettify}
                  aria-label={prettifyError ? 'Fix syntax errors before formatting' : 'Prettify / format query'}
                  title={prettifyError ? 'Cannot format — fix syntax errors first' : 'Prettify / format query'}
                  data-testid="gql-prettify-btn"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
                    <line x1="16" y1="8" x2="2" y2="22" />
                    <line x1="17.5" y1="15" x2="9" y2="15" />
                  </svg>
                  Prettify
                </button>
              </div>

              {insertToast && (
                <div className="gql-insert-toast" role="status" aria-live="polite" data-testid="gql-insert-toast">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  {insertToast}
                </div>
              )}

              {activeTab?.operationType === 'subscription' && (
                <GraphqlSubscriptionAssertionPanel
                  assertions={activeTab.subscriptionAssertions ?? []}
                  onChange={handleAssertionsChange}
                />
              )}

              <GqlComplexityWarningBanner
                visible={complexityWarningPending}
                complexityResult={complexityResult}
                onConfirm={handleExecute}
                onDismiss={() => setComplexityWarningPending(false)}
              />

              {bottomTab === 'runner' && runnerCollectionId ? (
                <GraphqlCollectionRunnerPanel
                  runner={runner}
                  items={collections.trees.find((t) => t.collection.id === runnerCollectionId)?.items ?? []}
                  collectionName={collections.trees.find((t) => t.collection.id === runnerCollectionId)?.collection.name ?? 'Collection'}
                  onClose={() => setBottomTab('variables')}
                />
              ) : (
                <GqlBottomPanel
                  activeTab={(bottomTab === 'runner' ? 'variables' : bottomTab) as 'variables' | 'headers' | 'files'}
                  onTabChange={(tab) => setBottomTab(tab as BottomPanelTabExtended)}
                  varsModelPath={varsModelPath}
                  defaultVarsValue={activeTab.variables ?? DEFAULT_VARS}
                  onVariablesChange={handleVariablesChange}
                  varsError={varsError}
                  headers={activeTab.headers}
                  onHeadersChange={handleHeadersChange}
                  activeEnvironment={activeEnvironment}
                  fileEntries={fileEntries}
                  onFileEntriesChange={setFileEntries}
                  uploadProgress={uploadProgress}
                />
              )}
            </>
          )}
        </div>

        {!builderMode && (
          <GqlRightPane
            view={rightView}
            onViewChange={setRightView}
            response={response}
            executing={executing}
            execStatus={execStatus}
            schemaInfo={schemaInfo}
            schemaStatus={schemaStatus}
            schemaErrorMessage={schemaErrorMessage}
            onIntrospect={introspect}
            introspecting={introspecting}
            activeOperationType={activeTab?.operationType ?? null}
            onInsertField={handleInsertField}
            snapshots={snapshots}
            onSaveSnapshot={handleSaveSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            onOpenDiff={handleOpenDiff}
            deprecatedUsages={deprecatedUsages}
            onOpenCollectionItem={handleOpenCollectionItem}
            subscriptionLog={
              activeTab?.operationType === 'subscription' && subscription.state !== 'idle'
                ? {
                    state: subscription.state, messages: subscription.messages,
                    stats: subscription.stats, connectedSince: subscription.connectedSince,
                    isPaused: subscription.isPaused, pausedBufferCount: subscription.pausedBufferCount,
                    errorMessage: subscription.errorMessage, reconnectAttempt: subscription.reconnectAttempt,
                    transport: subscription.transport,
                    operationName: selectedOperation ?? activeTab?.label,
                    assertions: activeTab?.subscriptionAssertions, assertionResultMap,
                    onPause: subscription.pause, onResume: subscription.resume,
                    onClear: subscription.clear, onExport: handleExportSubscription,
                    onStop: handleStopSubscription,
                  }
                : null
            }
          />
        )}
      </div>

      {batchResult && (
        <div className="gql-batch-overlay">
          <GraphqlBatchResults result={batchResult} onDismiss={() => setBatchResult(null)} />
        </div>
      )}

      <GqlPageToasts
        schemaDiffToast={schemaDiffToast}
        snapshots={snapshots}
        toastBaselineSnapshotId={toastBaselineSnapshotIdRef.current}
        schemaInfo={schemaInfo}
        onViewDiff={handleOpenDiff}
        onSaveSnapshot={() => setRightView('schema')}
        onDismissSchemaDiff={() => setSchemaDiffToast(false)}
        apqUnsupportedToast={apqUnsupportedToast}
        onDismissApq={() => setApqUnsupportedToast(false)}
        batchUnsupportedToast={batchUnsupportedToast}
        onDismissBatch={() => setBatchUnsupportedToast(false)}
      />

      {diffModal && (
        <GraphqlSchemaDiff
          result={diffModal.result}
          oldSdl={diffModal.oldSdl}
          newSdl={diffModal.newSdl}
          oldLabel={diffModal.oldLabel}
          newLabel={diffModal.newLabel}
          snapshotId={diffModal.snapshotId}
          brokenItemCount={invalidItemIds.size}
          onAcknowledge={handleAcknowledge}
          onUnacknowledge={handleUnacknowledge}
          onClose={() => setDiffModal(null)}
        />
      )}

      {saveToColItem && (
        <SaveToCollectionModal
          defaultName={saveToColItem.operation.name ?? saveToColItem.operation.operationType ?? 'Unnamed operation'}
          trees={collections.trees}
          operationVariables={saveToColItem.operation.variables}
          onSave={(collectionId, folderId, name) => {
            collections.addItem(collectionId, folderId, name, saveToColItem.operation).catch(() => {});
            setSaveToColItem(null);
            setActivityTab('collections');
          }}
          onCancel={() => setSaveToColItem(null)}
        />
      )}
    </div>
  );
}
