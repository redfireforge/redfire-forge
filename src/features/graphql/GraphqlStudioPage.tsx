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
 *   hooks/useGqlStudioTabs          — tab lifecycle, persistence, content callbacks
 *   hooks/useGqlStudioEditorActions — prettify + insert-field actions
 *   hooks/useGqlPollingPopover      — (used inside GraphqlConnectionBar)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMonaco } from '@monaco-editor/react';
import { isTauri } from '../../shared/utils/platform';
import { readKey, removeKey, writeKey } from '../../shared/utils/storage';
import type { GlobalAuthProfile } from '../../shared/types';
import type { GraphqlAuth } from '../../shared/types/graphql';
import { GraphqlConnectionBar } from './components/GraphqlConnectionBar';
import { GraphqlEditor } from './components/GraphqlEditor';
import { GraphqlEnvModal } from './components/GraphqlEnvModal';
import { GraphqlProfileModal } from './components/GraphqlProfileModal';
import { GqlTabBar } from './components/GqlTabBar';
import { GqlBottomPanel } from './components/GqlBottomPanel';
import { GqlRightPane } from './components/GqlRightPane';
import { GraphqlQueryBuilder } from './components/GraphqlQueryBuilder';
import { GraphqlSubscriptionAssertionPanel } from './components/GraphqlSubscriptionAssertionPanel';
import { useGraphqlExecution } from './hooks/useGraphqlExecution';
import { useGraphqlEnvironments } from './hooks/useGraphqlEnvironments';
import { useGraphqlConnectionProfiles } from './hooks/useGraphqlConnectionProfiles';
import { useQueryValidation } from './hooks/useQueryValidation';
import { useRecentEndpoints } from './hooks/useRecentEndpoints';
import { useGraphqlSchema } from './hooks/useGraphqlSchema';
import { useGraphqlSubscription } from './hooks/useGraphqlSubscription';
import { useSubscriptionOrchestration } from './hooks/useSubscriptionOrchestration';
import { useGqlStudioTabs } from './hooks/useGqlStudioTabs';
import { useGqlStudioEditorActions } from './hooks/useGqlStudioEditorActions';
import { buildAuthHeaders } from './utils/authUtils';
import { findUnresolvedVars, resolveVars } from './utils/envUtils';
import type { FileEntry } from './utils/multipartBuilder';
import { buildMultipartFormData } from './utils/multipartBuilder';
import { computeQueryComplexity } from './utils/complexityEstimator';
import { buildAssertionResultMap } from './utils/subscriptionAssertions';
import {
  buildVarsModelUri,
  clearGraphqlSchema,
  setGraphqlSchema,
} from './utils/monacoGraphqlSetup';
import {
  loadAuth,
  saveAuth,
  DEFAULT_VARS,
  ENDPOINT_BASE_STORAGE_KEY,
  ENDPOINT_STORAGE_KEY,
  POLLING_STORAGE_KEY,
  TLS_STORAGE_KEY,
} from './utils/tabPersistence';
import '../../styles/graphql-studio.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXEC_MARKER_OWNER = 'gql-execution';

// ─── Types ────────────────────────────────────────────────────────────────────

type BottomPanelTab = 'variables' | 'headers' | 'files';
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
  // ── UI state ───────────────────────────────────────────────────────────────
  const [bottomTab, setBottomTab]   = useState<BottomPanelTab>('variables');
  const [rightView, setRightView]   = useState<RightPaneView>('response');
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [builderMode, setBuilderMode] = useState(false);

  // ── Execution engine ───────────────────────────────────────────────────────
  const { status: execStatus, response, execute, cancel } = useGraphqlExecution();
  const executing = execStatus === 'loading';

  useEffect(() => { if (!executing) setUploadProgress(null); }, [executing]);

  // ── Subscription engine ────────────────────────────────────────────────────
  const subscription = useGraphqlSubscription();

  // ── TLS + polling settings ─────────────────────────────────────────────────
  const [skipTlsVerify, setSkipTlsVerify]               = useState(false);
  const [pollingEnabled, setPollingEnabled]             = useState(false);
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState(30);

  const handleSkipTlsVerifyChange = useCallback((skip: boolean) => {
    setSkipTlsVerify(skip);
    writeKey(TLS_STORAGE_KEY, String(skip)).catch(() => { /* no-op */ });
  }, []);

  const handlePollingChange = useCallback((enabled: boolean, intervalSeconds: number) => {
    setPollingEnabled(enabled);
    setPollingIntervalSeconds(intervalSeconds);
    writeKey(POLLING_STORAGE_KEY, JSON.stringify({ enabled, intervalSeconds })).catch(() => { /* no-op */ });
  }, []);

  const pollingIntervalMs = pollingEnabled ? pollingIntervalSeconds * 1000 : 0;

  // ── Auth ───────────────────────────────────────────────────────────────────
  const [auth, setAuth] = useState<GraphqlAuth | null>(null);
  const handleAuthChange = useCallback((newAuth: GraphqlAuth | null) => {
    setAuth(newAuth);
    saveAuth(newAuth);
  }, []);

  // ── Recent endpoints ───────────────────────────────────────────────────────
  const { endpoints: recentEndpoints, push: pushRecentEndpoint, remove: removeRecentEndpoint } = useRecentEndpoints();

  // ── Connection profiles ────────────────────────────────────────────────────
  const { profiles, saveProfile, deleteProfile } = useGraphqlConnectionProfiles();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // ── Environments ───────────────────────────────────────────────────────────
  const {
    environments, activeEnvironment,
    createEnvironment, deleteEnvironment, setActiveEnvironment,
    updateEnvironmentName, updateVariables, importEnvironment, exportEnvironment,
  } = useGraphqlEnvironments();
  const [envModalOpen, setEnvModalOpen] = useState(false);

  // ── Endpoint state ─────────────────────────────────────────────────────────
  const [endpoint, setEndpoint] = useState(resolvedBaseUrl ?? '');
  const initialResolvedBaseUrl  = useRef(resolvedBaseUrl);
  const prevBaseUrlRef          = useRef<string | undefined>(resolvedBaseUrl);

  useEffect(() => {
    if (resolvedBaseUrl === undefined) return;
    const prev = prevBaseUrlRef.current;
    prevBaseUrlRef.current = resolvedBaseUrl;
    setEndpoint((cur) => {
      if (cur === '' || cur === prev) {
        writeKey(ENDPOINT_BASE_STORAGE_KEY, resolvedBaseUrl).catch(() => { /* silent */ });
        return resolvedBaseUrl;
      }
      return cur;
    });
  }, [resolvedBaseUrl]);

  useEffect(() => {
    writeKey(ENDPOINT_STORAGE_KEY, endpoint).catch(() => { /* quota / unavailable — silent */ });
  }, [endpoint]);

  // ── Monaco instance ────────────────────────────────────────────────────────
  const monacoInstance = useMonaco();
  const monacoRef      = useRef(monacoInstance);
  monacoRef.current    = monacoInstance;
  const responseModelUriRef = useRef<string>('');

  // ── Tab management (hook) ──────────────────────────────────────────────────
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
    executing,
    responseModelUriRef,
    onClearFileEntries: () => setFileEntries([]),
    onResetSubscription: () => subscription.reset(),
    monacoRef: monacoRef as React.MutableRefObject<import('@monaco-editor/react').Monaco | null>,
  });

  // ── Editor actions (prettify + insert field) ───────────────────────────────
  const {
    editorMountRef, prettifyError, insertToast, handlePrettify, handleInsertField,
  } = useGqlStudioEditorActions({
    activeQuery: activeTab?.query ?? '',
    onQueryChange: handleQueryChange,
  });

  // ── Restore settings from storage ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await readKey(ENDPOINT_STORAGE_KEY);
        if (saved) {
          const savedBase = await readKey(ENDPOINT_BASE_STORAGE_KEY);
          const rbUrl = initialResolvedBaseUrl.current;
          if (saved === savedBase && rbUrl && rbUrl !== savedBase) {
            setEndpoint(rbUrl);
          } else {
            setEndpoint(saved);
          }
        }
      } catch { /* fall through */ }

      try {
        const tlsRaw = await readKey(TLS_STORAGE_KEY);
        if (tlsRaw !== null) setSkipTlsVerify(tlsRaw === 'true');
      } catch { /* ignore */ }

      try {
        const raw = await readKey(POLLING_STORAGE_KEY);
        if (raw) {
          const p = JSON.parse(raw) as { enabled?: boolean; intervalSeconds?: number };
          if (p.enabled === true) setPollingEnabled(true);
          const s = p.intervalSeconds;
          if (typeof s === 'number' && s >= 10) setPollingIntervalSeconds(s);
        }
      } catch { /* ignore */ }

      const savedAuth = await loadAuth();
      if (savedAuth) setAuth(savedAuth);
    })();
  }, []);

  // ── Schema introspection ───────────────────────────────────────────────────
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
  } = useGraphqlSchema(resolveVars(endpoint, activeEnvironment), schemaHeaders, {
    pollingIntervalMs,
    skipTlsVerify,
  });

  useEffect(() => {
    if (rawIntrospection) {
      try { setGraphqlSchema(rawIntrospection); } catch { /* non-fatal */ }
    } else {
      try { clearGraphqlSchema(); } catch { /* non-fatal */ }
    }
  }, [rawIntrospection]);

  // Auto-switch to Schema view after manual introspect succeeds
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
    schemaStatus === 'loaded' ? 'loaded'
    : (schemaStatus === 'error' || schemaStatus === 'introspection-disabled') ? 'error'
    : 'none';

  // ── Monaco execution error markers ────────────────────────────────────────
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
  }, [response, monacoInstance]);

  // ── Query AST validation ───────────────────────────────────────────────────
  const queryValidationErrorCount = useQueryValidation(
    activeTab?.query ?? '',
    activeTab?.modelUri ?? '',
    rawIntrospection,
    schemaStatus === 'loaded',
  );

  // ── Query complexity estimation ────────────────────────────────────────────
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
    if (q !== prevComplexityQueryRef.current) {
      prevComplexityQueryRef.current = q;
      setComplexityWarningPending(false);
    }
  }, [activeTab?.query]);

  // ── Variables JSON validation ──────────────────────────────────────────────
  const [varsError, setVarsError] = useState<string | null>(null);
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

  // ── Assertion results ──────────────────────────────────────────────────────
  const assertionResultMap = useMemo(
    () => buildAssertionResultMap(
      subscription.messages,
      activeTab?.subscriptionAssertions ?? [],
    ),
    [subscription.messages, activeTab?.subscriptionAssertions],
  );

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
        endpoint: resolvedEndpoint,
        query: activeTab.query,
        variables: resolvedVariables,
        operationName: selectedOperation,
        headers: resolvedHeaders,
        skipTlsVerify,
        formData,
        onUploadProgress: (loaded, total) => {
          if (!executingRef.current && loaded !== 0) return;
          if (total > 0) {
            setUploadProgress(Math.min(98, Math.round((loaded / total) * 100)));
          }
        },
      });
    } else {
      execute({
        endpoint: resolvedEndpoint,
        query: activeTab.query,
        variables: resolvedVariables,
        operationName: selectedOperation,
        headers: resolvedHeaders,
        skipTlsVerify,
      });
    }
  }, [activeTab, endpoint, execute, executing, selectedOperation, activeTabHeaders, auth,
      pushRecentEndpoint, activeEnvironment, skipTlsVerify, fileEntries, complexityResult,
      complexityWarningPending, executingRef]);

  // ── Builder → Editor promotion ─────────────────────────────────────────────
  const handleExecuteRef = useRef(handleExecute);
  handleExecuteRef.current = handleExecute;

  const handleEditInEditor = useCallback(
    (sdl: string, variablesJson: string) => {
      if (editorMountRef.current) editorMountRef.current.setValue(sdl);
      handleQueryChange(sdl);
      if (variablesJson && variablesJson !== '{}') handleVariablesChange(variablesJson);
      setBuilderMode(false);
    },
    [handleQueryChange, handleVariablesChange, editorMountRef],
  );

  const handleBuilderExecute = useCallback(
    (sdl: string, variablesJson: string) => {
      if (editorMountRef.current) editorMountRef.current.setValue(sdl);
      handleQueryChange(sdl);
      if (variablesJson && variablesJson !== '{}') handleVariablesChange(variablesJson);
      setBuilderMode(false);
      requestAnimationFrame(() => { handleExecuteRef.current(); });
    },
    [handleQueryChange, handleVariablesChange, editorMountRef],
  );

  // ── Subscription orchestration ─────────────────────────────────────────────
  const { handleSubscribe: _handleSubscribe, handleStopSubscription, handleExportSubscription } = useSubscriptionOrchestration({
    activeTab,
    endpoint,
    auth,
    activeEnvironment,
    activeTabHeaders,
    selectedOperation,
    skipTlsVerify,
    subscription,
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
  const handleSubscribeRef        = useRef(handleSubscribe);
  handleSubscribeRef.current      = handleSubscribe;
  const handleStopSubRef          = useRef(handleStopSubscription);
  handleStopSubRef.current        = handleStopSubscription;
  const introspectRef             = useRef(introspect);
  introspectRef.current           = introspect;
  const introspectingRef          = useRef(introspecting);
  introspectingRef.current        = introspecting;
  const endpointRef               = useRef(endpoint);
  endpointRef.current             = endpoint;
  const activeEnvironmentRef      = useRef(activeEnvironment);
  activeEnvironmentRef.current    = activeEnvironment;
  const profileModalOpenRef       = useRef(profileModalOpen);
  profileModalOpenRef.current     = profileModalOpen;
  const envModalOpenRef           = useRef(envModalOpen);
  envModalOpenRef.current         = envModalOpen;
  const activeTabOpTypeRef        = useRef(activeTab?.operationType);
  activeTabOpTypeRef.current      = activeTab?.operationType;
  const subDisconnectRef          = useRef(subscription.disconnect);
  subDisconnectRef.current        = subscription.disconnect;
  const subStateRef               = useRef(subscription.state);
  subStateRef.current             = subscription.state;
  const execStatusRef             = useRef(execStatus);
  execStatusRef.current           = execStatus;
  const cancelKbdRef              = useRef(cancel);
  cancelKbdRef.current            = cancel;
  const addTabRef                 = useRef(addTab);
  addTabRef.current               = addTab;

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
        if (activeTabOpTypeRef.current === 'subscription') {
          const subState = subStateRef.current;
          if (subState === 'connecting' || subState === 'active' || subState === 'reconnecting') {
            handleStopSubRef.current();
          } else {
            handleSubscribeRef.current();
          }
        } else {
          handleExecuteRef.current();
        }
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
      if (e.key === 'Escape' && execStatusRef.current === 'loading') {
        cancelKbdRef.current();
      }
      if (e.key === 'Escape') {
        const subState = subStateRef.current;
        if (subState === 'active' || subState === 'connecting' || subState === 'reconnecting') {
          subDisconnectRef.current();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeActiveTabRef]);

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
      />

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
            removeKey(ENDPOINT_BASE_STORAGE_KEY).catch(() => { /* silent */ });
          }}
          onDelete={deleteProfile}
        />
      )}

      {envModalOpen && (
        <GraphqlEnvModal
          environments={environments}
          activeEnvironmentId={activeEnvironment?.id ?? null}
          onClose={() => {
            setEnvModalOpen(false);
            requestAnimationFrame(() => {
              (document.querySelector<HTMLButtonElement>('[data-testid="gql-env-badge"]'))?.focus();
            });
          }}
          onCreate={createEnvironment}
          onDelete={deleteEnvironment}
          onSetActive={setActiveEnvironment}
          onRename={updateEnvironmentName}
          onUpdateVariables={updateVariables}
          onImport={importEnvironment}
          onExport={exportEnvironment}
        />
      )}

      <GqlTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        confirmingCloseTabId={confirmingCloseTabId}
        onTabClick={handleTabClick}
        onTabClose={closeTab}
        onAddTab={addTab}
      />

      <div className={`gql-main${builderMode ? ' gql-main--builder' : ''}`} data-testid="gql-main">
        <div className="gql-left-pane">
          <div className="gql-editor-mode-bar" data-testid="gql-editor-mode-bar">
            <div className="gql-mode-toggle" role="group" aria-label="Edit mode">
              <button
                type="button"
                className={`gql-mode-btn${!builderMode ? ' gql-mode-btn--active' : ''}`}
                onClick={() => setBuilderMode(false)}
                aria-pressed={!builderMode}
                data-testid="gql-mode-editor"
              >
                Editor
              </button>
              <button
                type="button"
                className={`gql-mode-btn${builderMode ? ' gql-mode-btn--active' : ''}`}
                onClick={() => setBuilderMode(true)}
                aria-pressed={builderMode}
                data-testid="gql-mode-builder"
                title={schemaInfo ? undefined : 'Introspect a schema to use the builder'}
              >
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

              {complexityWarningPending && complexityResult && (
                <div
                  className="gql-complexity-warning-banner"
                  role="alert"
                  aria-live="assertive"
                  data-testid="gql-complexity-warning-banner"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span className="gql-complexity-warning-text">
                    Very expensive query (cost ~{complexityResult.score}, threshold {complexityResult.threshold}). This may cause high server load.
                  </span>
                  <button type="button" className="gql-complexity-warning-confirm" onClick={handleExecute} data-testid="gql-complexity-warning-confirm">
                    Run anyway
                  </button>
                  <button type="button" className="gql-complexity-warning-dismiss" onClick={() => setComplexityWarningPending(false)} aria-label="Dismiss complexity warning" data-testid="gql-complexity-warning-dismiss">
                    ✕
                  </button>
                </div>
              )}

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
                fileEntries={fileEntries}
                onFileEntriesChange={setFileEntries}
                uploadProgress={uploadProgress}
              />
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
            subscriptionLog={
              activeTab?.operationType === 'subscription' && subscription.state !== 'idle'
                ? {
                    state: subscription.state,
                    messages: subscription.messages,
                    stats: subscription.stats,
                    connectedSince: subscription.connectedSince,
                    isPaused: subscription.isPaused,
                    pausedBufferCount: subscription.pausedBufferCount,
                    errorMessage: subscription.errorMessage,
                    reconnectAttempt: subscription.reconnectAttempt,
                    transport: subscription.transport,
                    operationName: selectedOperation ?? activeTab?.label,
                    assertions: activeTab?.subscriptionAssertions,
                    assertionResultMap,
                    onPause: subscription.pause,
                    onResume: subscription.resume,
                    onClear: subscription.clear,
                    onExport: handleExportSubscription,
                    onStop: handleStopSubscription,
                  }
                : null
            }
          />
        )}
      </div>
    </div>
  );
}
