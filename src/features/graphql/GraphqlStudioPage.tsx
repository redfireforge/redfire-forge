/**
 * GraphqlStudioPage — main page for the GraphQL Studio feature.
 *
 * Phase 1A: multi-tab editor + variables panel + headers panel + layout.
 *           Close-tab confirmation for unsaved changes (two-click pattern).
 * Phase 1B: introspection, schema explorer, schema status badge.
 * Phase 1C: query/mutation execution engine + AST validation squiggles.
 * Phase 1D: connection management (auth, profiles, saved connections).
 * Phase 1E: environment variable management with {{var}} interpolation.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMonaco } from '@monaco-editor/react';
import { parse as gqlParse, print as gqlPrint } from 'graphql';
import { isTauri } from '../../shared/utils/platform';
import type { GlobalAuthProfile } from '../../shared/types';
import type { GraphqlAuth, GraphqlHeaderRow } from '../../shared/types/graphql';
import { GraphqlConnectionBar } from './components/GraphqlConnectionBar';
import { GraphqlEditor } from './components/GraphqlEditor';
import { GraphqlEnvModal } from './components/GraphqlEnvModal';
import { GraphqlProfileModal } from './components/GraphqlProfileModal';
import { GqlTabBar } from './components/GqlTabBar';
import { GqlBottomPanel } from './components/GqlBottomPanel';
import { GqlRightPane } from './components/GqlRightPane';
import { useGraphqlExecution } from './hooks/useGraphqlExecution';
import { useGraphqlEnvironments } from './hooks/useGraphqlEnvironments';
import { useGraphqlConnectionProfiles } from './hooks/useGraphqlConnectionProfiles';
import { useQueryValidation } from './hooks/useQueryValidation';
import { useRecentEndpoints } from './hooks/useRecentEndpoints';
import { useGraphqlSchema } from './hooks/useGraphqlSchema';
import { buildAuthHeaders } from './utils/authUtils';
import { findUnresolvedVars, resolveVars } from './utils/envUtils';
import {
  buildVarsModelUri,
  clearGraphqlSchema,
  deriveOperationType,
  deriveTabLabel,
  extractOperations,
  setGraphqlSchema,
} from './utils/monacoGraphqlSetup';
import {
  type GqlStudioTab,
  advanceSeqPastRestoredIds,
  disposeTabModels,
  loadActiveTabId,
  loadAuth,
  loadTabs,
  makeBlankTab,
  saveAuth,
  saveTabs,
  DEFAULT_VARS,
  ENDPOINT_BASE_STORAGE_KEY,
  ENDPOINT_STORAGE_KEY,
  POLLING_STORAGE_KEY,
  SAVE_DEBOUNCE_MS,
  TLS_STORAGE_KEY,
} from './utils/tabPersistence';
import '../../styles/graphql-studio.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXEC_MARKER_OWNER = 'gql-execution';

// ─── Types ────────────────────────────────────────────────────────────────────

type BottomPanelTab = 'variables' | 'headers';
type RightPaneView = 'response' | 'schema';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GraphqlStudioPageProps {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphqlStudioPage({
  resolvedBaseUrl,
}: GraphqlStudioPageProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<GqlStudioTab[]>([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [bottomTab, setBottomTab] = useState<BottomPanelTab>('variables');
  const [rightView, setRightView] = useState<RightPaneView>('response');

  // BUG-GQL-R17-2 fix: restore endpoint from localStorage. Fall back to resolvedBaseUrl.
  // BUG-GQL-R18-1 fix: if saved endpoint was auto-synced from a base URL that has since
  // changed (user switched env while GraphQL Studio was unmounted), use the new URL.
  const [endpoint, setEndpoint] = useState(() => {
    try {
      const saved = localStorage.getItem(ENDPOINT_STORAGE_KEY);
      if (saved) {
        const savedBase = localStorage.getItem(ENDPOINT_BASE_STORAGE_KEY);
        if (saved === savedBase && resolvedBaseUrl && resolvedBaseUrl !== savedBase) {
          return resolvedBaseUrl;
        }
        return saved;
      }
    } catch { /* quota / SecurityError — fall through */ }
    return resolvedBaseUrl ?? '';
  });

  // Phase 1C: variables JSON validation
  const [varsError, setVarsError] = useState<string | null>(null);

  // Phase 1C: execution engine
  const { status: execStatus, response, execute, cancel } = useGraphqlExecution();
  const executing = execStatus === 'loading';

  // Phase 1A: close-tab confirmation (two-click pattern for unsaved tabs)
  const [confirmingCloseTabId, setConfirmingCloseTabId] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 1 Gap: TLS certificate skip (persisted)
  const [skipTlsVerify, setSkipTlsVerify] = useState<boolean>(() => {
    try { return localStorage.getItem(TLS_STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const handleSkipTlsVerifyChange = useCallback((skip: boolean) => {
    setSkipTlsVerify(skip);
    try { localStorage.setItem(TLS_STORAGE_KEY, String(skip)); } catch { /* no-op */ }
  }, []);

  // Phase 1 Gap: Schema polling config (persisted)
  const [pollingEnabled, setPollingEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(POLLING_STORAGE_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw) as { enabled?: boolean };
      return p.enabled === true;
    } catch { return false; }
  });
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(POLLING_STORAGE_KEY);
      if (!raw) return 30;
      const p = JSON.parse(raw) as { intervalSeconds?: number };
      const s = p.intervalSeconds;
      return typeof s === 'number' && s >= 10 ? s : 30;
    } catch { return 30; }
  });
  const handlePollingChange = useCallback((enabled: boolean, intervalSeconds: number) => {
    setPollingEnabled(enabled);
    setPollingIntervalSeconds(intervalSeconds);
    try {
      localStorage.setItem(POLLING_STORAGE_KEY, JSON.stringify({ enabled, intervalSeconds }));
    } catch { /* no-op */ }
  }, []);
  const pollingIntervalMs = pollingEnabled ? pollingIntervalSeconds * 1000 : 0;

  // Phase 1D: auth config (persisted per-endpoint across sessions)
  const [auth, setAuth] = useState<GraphqlAuth | null>(loadAuth);
  const handleAuthChange = useCallback((newAuth: GraphqlAuth | null) => {
    setAuth(newAuth);
    saveAuth(newAuth);
  }, []);

  // Phase 1D: recent endpoints
  const { endpoints: recentEndpoints, push: pushRecentEndpoint, remove: removeRecentEndpoint } = useRecentEndpoints();

  // Phase 1D: connection profiles
  const { profiles, saveProfile, deleteProfile } = useGraphqlConnectionProfiles();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Phase 1E: environment variables
  const {
    environments,
    activeEnvironment,
    createEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
    updateEnvironmentName,
    updateVariables,
    importEnvironment,
    exportEnvironment,
  } = useGraphqlEnvironments();
  const [envModalOpen, setEnvModalOpen] = useState(false);

  // Sync endpoint when resolvedBaseUrl changes
  const prevBaseUrlRef = useRef<string | undefined>(resolvedBaseUrl);
  useEffect(() => {
    if (resolvedBaseUrl === undefined) return;
    const prev = prevBaseUrlRef.current;
    prevBaseUrlRef.current = resolvedBaseUrl;
    setEndpoint((cur) => {
      if (cur === '' || cur === prev) {
        try { localStorage.setItem(ENDPOINT_BASE_STORAGE_KEY, resolvedBaseUrl); }
        catch { /* silent */ }
        return resolvedBaseUrl;
      }
      return cur;
    });
  }, [resolvedBaseUrl]);

  // Persist endpoint to localStorage on change
  useEffect(() => {
    try { localStorage.setItem(ENDPOINT_STORAGE_KEY, endpoint); }
    catch { /* quota / SecurityError — silent */ }
  }, [endpoint]);

  // ── Schema introspection (Phase 1B) ───────────────────────────────────────
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
    status: schemaStatus,
    schemaInfo,
    rawIntrospection,
    errorMessage: schemaErrorMessage,
    introspecting,
    introspect,
    pollErrorMessage,
  } = useGraphqlSchema(resolveVars(endpoint, activeEnvironment), schemaHeaders, {
    pollingIntervalMs,
    skipTlsVerify,
  });

  // Feed introspection JSON to monaco-graphql whenever schema is (re)loaded
  useEffect(() => {
    if (rawIntrospection) {
      try { setGraphqlSchema(rawIntrospection); } catch { /* non-fatal */ }
    } else {
      try { clearGraphqlSchema(); } catch { /* non-fatal */ }
    }
  }, [rawIntrospection]);

  // Auto-switch to Schema view after a manual introspect succeeds
  const prevIntrospectingRef = useRef(introspecting);
  const introspectStartResolvedRef = useRef('');
  useEffect(() => {
    const resolved = resolveVars(endpoint, activeEnvironment);
    if (introspecting && !prevIntrospectingRef.current) {
      introspectStartResolvedRef.current = resolved;
    }
    if (prevIntrospectingRef.current && !introspecting && schemaStatus === 'loaded'
        && resolved === introspectStartResolvedRef.current) {
      setRightView('schema');
    }
    prevIntrospectingRef.current = introspecting;
  }, [introspecting, schemaStatus, endpoint, activeEnvironment]);

  const connectionBarSchemaStatus: 'loaded' | 'error' | 'none' =
    schemaStatus === 'loaded'
      ? 'loaded'
      : schemaStatus === 'error' || schemaStatus === 'introspection-disabled'
      ? 'error'
      : 'none';

  // ── Refs ───────────────────────────────────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // ── Restore from localStorage ──────────────────────────────────────────────
  useEffect(() => {
    const stored = loadTabs();
    if (stored.length > 0) {
      advanceSeqPastRestoredIds(stored);
      const savedActiveId = loadActiveTabId();
      const activeExists = stored.some((t) => t.id === savedActiveId);
      setTabs(stored);
      setActiveTabId(activeExists ? savedActiveId : stored[0].id);
    } else {
      const blank = makeBlankTab();
      setTabs([blank]);
      setActiveTabId(blank.id);
    }
    loadedRef.current = true;
  }, []);

  // ── Flush on unmount ───────────────────────────────────────────────────────
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  tabsRef.current = tabs;
  activeTabIdRef.current = activeTabId;
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      // Guard: only flush if tabs have been restored. In React 18 StrictMode,
      // the fake-unmount cleanup can fire before setTabs([restored]) is processed,
      // leaving tabsRef.current as [] and incorrectly wiping saved state.
      // Since closeTab prevents closing the last tab, empty tabs only occurs
      // before the initial restore effect has completed its async state update.
      if (loadedRef.current && tabsRef.current.length > 0) {
        saveTabs(tabsRef.current, activeTabIdRef.current);
      }
    };
  }, []);

  // ── Persist on change ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current) return;
    // Don't schedule a save with the empty initial state (before restore completes).
    // In React 18 StrictMode the remount sees loadedRef=true but tabs=[] temporarily.
    if (tabs.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTabs(tabs, activeTabId);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tabs, activeTabId]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const operations = activeTab ? extractOperations(activeTab.query).map((o) => o.name) : [];

  // ── Execution error Monaco markers ────────────────────────────────────────
  const monacoInstance = useMonaco();
  const monacoRef = useRef(monacoInstance);
  monacoRef.current = monacoInstance;
  const responseModelUriRef = useRef<string>('');

  useEffect(() => {
    if (!monacoInstance) return;
    const ownerUri = responseModelUriRef.current;
    if (!ownerUri) return;
    let model: ReturnType<typeof monacoInstance.editor.getModel>;
    try {
      model = monacoInstance.editor.getModel(monacoInstance.Uri.parse(ownerUri));
    } catch { return; }
    if (!model) return;

    if (response?.errors && response.errors.length > 0) {
      const lineCount = model.getLineCount();
      const markers = response.errors
        .filter((e) => e.locations && e.locations.length > 0)
        .flatMap((e) =>
          (e.locations ?? [])
            .filter((loc) => loc.line >= 1 && loc.line <= lineCount)
            .map((loc) => {
              const lineLen = model.getLineLength(loc.line) ?? 0;
              return {
                severity: monacoInstance.MarkerSeverity.Error,
                startLineNumber: loc.line,
                startColumn: loc.column,
                endLineNumber: loc.line,
                endColumn: Math.max(loc.column + 1, lineLen + 1),
                message: e.message,
                source: 'GraphQL Server',
              };
            }),
        );
      monacoInstance.editor.setModelMarkers(model, EXEC_MARKER_OWNER, markers);
    } else {
      monacoInstance.editor.setModelMarkers(model, EXEC_MARKER_OWNER, []);
    }
  // responseModelUriRef is a ref (stable identity) — no dep entry needed.
  }, [response, monacoInstance]);

  // ── Query AST validation ───────────────────────────────────────────────────
  const queryValidationErrorCount = useQueryValidation(
    activeTab?.query ?? '',
    activeTab?.modelUri ?? '',
    rawIntrospection,
    schemaStatus === 'loaded',
  );

  // ── Tab management ─────────────────────────────────────────────────────────
  const addTab = useCallback(() => {
    if (tabs.length >= 8) return; // MAX_TABS
    const tab = makeBlankTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingCloseTabId(null);
  }, [tabs.length]);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    if (confirmingCloseTabId && confirmingCloseTabId !== tabId) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingCloseTabId(null);
    }
  }, [confirmingCloseTabId]);

  const activeTabIdForClose = useRef(activeTabId);
  activeTabIdForClose.current = activeTabId;
  const closeActiveTabRef = useRef<() => void>(() => {});

  const executingRef = useRef(executing);
  executingRef.current = executing;
  const executionLockRef = useRef(false);
  if (!executing) executionLockRef.current = false;
  const cancelForCloseRef = useRef(cancel);
  cancelForCloseRef.current = cancel;

  const closeTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      const tab = tabs.find((t) => t.id === tabId);
      if (tab?.unsavedChanges && tabs.length > 1 && confirmingCloseTabId !== tabId) {
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        setConfirmingCloseTabId(tabId);
        confirmTimerRef.current = setTimeout(() => setConfirmingCloseTabId(null), 2500);
        return;
      }

      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingCloseTabId(null);

      const closedTab = tabs.find((t) => t.id === tabId);
      if (closedTab && responseModelUriRef.current === closedTab.modelUri && executingRef.current) {
        cancelForCloseRef.current();
      }

      const mc = monacoRef.current;
      if (mc && closedTab) disposeTabModels(mc as Parameters<typeof disposeTabModels>[0], closedTab);

      setTabs((prev) => {
        if (prev.length === 1) return prev;
        const next = prev.filter((t) => t.id !== tabId);
        if (activeTabIdRef.current === tabId) {
          const idx = prev.findIndex((t) => t.id === tabId);
          const newActive = next[Math.min(idx, next.length - 1)];
          setActiveTabId(newActive.id);
        }
        return next;
      });
    },
    [tabs, confirmingCloseTabId],
  );

  closeActiveTabRef.current = () => {
    const tid = activeTabIdForClose.current;
    if (tid) closeTab(tid, { stopPropagation: () => {} } as React.MouseEvent);
  };

  const updateActiveTab = useCallback(
    (patch: Partial<GqlStudioTab>) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabIdRef.current ? { ...t, ...patch, unsavedChanges: true } : t,
        ),
      );
    },
    [],
  );

  // ── Per-tab selected operation ────────────────────────────────────────────
  const selectedOperation: string | undefined =
    operations.length > 1
      ? (operations.includes(activeTab?.selectedOperation ?? '') ? activeTab?.selectedOperation : operations[0])
      : undefined;

  const handleSelectOperation = useCallback(
    (name: string) => updateActiveTab({ selectedOperation: name }),
    [updateActiveTab],
  );

  const prevTabQueryRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!activeTab || activeTab.query === prevTabQueryRef.current) return;
    prevTabQueryRef.current = activeTab.query;
    if (operations.length > 1) {
      if (!operations.includes(activeTab.selectedOperation ?? '')) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabIdRef.current ? { ...t, selectedOperation: operations[0] } : t,
          ),
        );
      }
    } else if (activeTab.selectedOperation !== undefined) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabIdRef.current ? { ...t, selectedOperation: undefined } : t,
        ),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.query]);

  // ── Query change ───────────────────────────────────────────────────────────
  const handleQueryChange = useCallback(
    (value: string) => {
      const label = deriveTabLabel(value);
      const operationType = deriveOperationType(value);
      updateActiveTab({ query: value, label, operationType });
    },
    [updateActiveTab],
  );

  // ── Prettify query ────────────────────────────────────────────────────────
  const [prettifyError, setPrettifyError] = useState(false);
  const prettifyErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePrettify = useCallback(() => {
    const query = activeTab?.query ?? '';
    if (!query.trim()) return;
    try {
      const formatted = gqlPrint(gqlParse(query));
      if (formatted === query) return;
      handleQueryChange(formatted);
    } catch {
      setPrettifyError(true);
      if (prettifyErrorTimerRef.current) clearTimeout(prettifyErrorTimerRef.current);
      prettifyErrorTimerRef.current = setTimeout(() => setPrettifyError(false), 1000);
    }
  }, [activeTab?.query, handleQueryChange]);
  useEffect(() => () => {
    if (prettifyErrorTimerRef.current) clearTimeout(prettifyErrorTimerRef.current);
  }, []);

  // ── Variables / Headers change ────────────────────────────────────────────
  const handleVariablesChange = useCallback(
    (value: string) => updateActiveTab({ variables: value }),
    [updateActiveTab],
  );
  const handleHeadersChange = useCallback(
    (headers: GraphqlHeaderRow[]) => updateActiveTab({ headers }),
    [updateActiveTab],
  );

  // ── Variables JSON validation ─────────────────────────────────────────────
  const prevVarsTabIdRef = useRef(activeTabId);
  useEffect(() => {
    const vars = activeTab?.variables ?? '';
    const isTabSwitch = activeTabId !== prevVarsTabIdRef.current;
    prevVarsTabIdRef.current = activeTabId;

    const validate = () => {
      const trimmed = vars.trim();
      if (!trimmed || trimmed === '{}') { setVarsError(null); return; }
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
          setVarsError('Variables must be a JSON object — e.g. {"id": "1"}');
        } else {
          setVarsError(null);
        }
      } catch {
        setVarsError('Invalid JSON');
      }
    };

    if (isTabSwitch) { validate(); return; }
    const timer = setTimeout(validate, 300);
    return () => clearTimeout(timer);
  }, [activeTab?.variables, activeTabId]);

  // ── Execute handler ────────────────────────────────────────────────────────
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
    if (executing || executionLockRef.current) return;
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
    execute({
      endpoint: resolvedEndpoint,
      query: activeTab.query,
      variables: resolvedVariables,
      operationName: selectedOperation,
      headers: resolvedHeaders,
      skipTlsVerify,
    });
  }, [activeTab, endpoint, execute, executing, selectedOperation, activeTabHeaders, auth, pushRecentEndpoint, activeEnvironment, skipTlsVerify]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const handleExecuteRef = useRef(handleExecute);
  handleExecuteRef.current = handleExecute;
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  const executionStatusRef = useRef(execStatus);
  executionStatusRef.current = execStatus;
  const addTabRef = useRef(addTab);
  addTabRef.current = addTab;
  const introspectRef = useRef(introspect);
  introspectRef.current = introspect;
  const introspectingRef = useRef(introspecting);
  introspectingRef.current = introspecting;
  const endpointRef = useRef(endpoint);
  endpointRef.current = endpoint;
  const activeEnvironmentRef = useRef(activeEnvironment);
  activeEnvironmentRef.current = activeEnvironment;
  const profileModalOpenRef = useRef(profileModalOpen);
  profileModalOpenRef.current = profileModalOpen;
  const envModalOpenRef = useRef(envModalOpen);
  envModalOpenRef.current = envModalOpen;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        const hasOpenDialog =
          profileModalOpenRef.current ||
          envModalOpenRef.current ||
          !!document.querySelector('.gql-studio [role="dialog"][aria-modal="true"]');
        if (hasOpenDialog) return;
      }

      const isCmd = e.metaKey || e.ctrlKey;

      if (isCmd && e.key === 'Enter') {
        e.preventDefault();
        handleExecuteRef.current();
        return;
      }
      if (isCmd && e.key === 'w' && isTauri()) {
        e.preventDefault();
        closeActiveTabRef.current();
        return;
      }
      if (isCmd && e.key === 't' && isTauri()) {
        e.preventDefault();
        addTabRef.current();
        return;
      }
      if (isCmd && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        if (introspectingRef.current) return;
        if (findUnresolvedVars(endpointRef.current, activeEnvironmentRef.current).length > 0) return;
        introspectRef.current();
        return;
      }
      if (e.key === 'Escape' && executionStatusRef.current === 'loading') {
        cancelRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  if (tabs.length === 0 || !activeTab) return null;

  const varsModelPath = buildVarsModelUri(activeTab.id);

  return (
    <div className="gql-studio" data-testid="gql-studio-page">
      {/* Connection bar */}
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
      />

      {/* Connection Profiles modal */}
      {profileModalOpen && (
        <GraphqlProfileModal
          profiles={profiles}
          currentEndpoint={endpoint}
          currentAuth={auth}
          onClose={() => {
            setProfileModalOpen(false);
            requestAnimationFrame(() => {
              (document.querySelector<HTMLButtonElement>('[data-testid="gql-profile-badge"]'))?.focus();
            });
          }}
          onSave={(name) => saveProfile(name, endpoint, auth)}
          onLoad={(profile) => {
            setEndpoint(profile.endpoint);
            handleAuthChange(profile.auth);
            setProfileModalOpen(false);
            prevBaseUrlRef.current = '\0profile-pinned';
            try { localStorage.removeItem(ENDPOINT_BASE_STORAGE_KEY); }
            catch { /* silent */ }
          }}
          onDelete={deleteProfile}
        />
      )}

      {/* Environment manager modal */}
      {envModalOpen && (
        <GraphqlEnvModal
          environments={environments}
          activeEnvironmentId={activeEnvironment?.id ?? null}
          onClose={() => setEnvModalOpen(false)}
          onCreate={createEnvironment}
          onDelete={deleteEnvironment}
          onSetActive={setActiveEnvironment}
          onRename={updateEnvironmentName}
          onUpdateVariables={updateVariables}
          onImport={importEnvironment}
          onExport={exportEnvironment}
        />
      )}

      {/* Tab bar */}
      <GqlTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        confirmingCloseTabId={confirmingCloseTabId}
        onTabClick={handleTabClick}
        onTabClose={closeTab}
        onAddTab={addTab}
      />

      {/* Main content: editor (left) + response (right) */}
      <div className="gql-main" data-testid="gql-main">
        {/* Left pane: editor + bottom panel */}
        <div className="gql-left-pane">
          <div className="gql-editor-pane" data-testid="gql-editor-pane">
            <GraphqlEditor
              modelPath={activeTab.modelUri}
              defaultValue={activeTab.query}
              onChange={handleQueryChange}
              height="100%"
              data-testid="gql-editor"
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

          <GqlBottomPanel
            activeTab={bottomTab}
            onTabChange={setBottomTab}
            varsModelPath={varsModelPath}
            defaultVarsValue={activeTab.variables ?? DEFAULT_VARS}
            onVariablesChange={handleVariablesChange}
            varsError={varsError}
            headers={activeTab.headers}
            onHeadersChange={handleHeadersChange}
            activeEnvironment={activeEnvironment}
          />
        </div>

        {/* Right pane: response viewer | schema explorer */}
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
        />
      </div>
    </div>
  );
}
