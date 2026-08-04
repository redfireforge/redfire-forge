import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useWebSocketStudio } from './useWebSocketStudio';
import { useWebSocketConsole } from './useWebSocketConsole';
import { ConsolePanel } from './ConsolePanel';
import { WebSocketConnectPanel } from './WebSocketConnectPanel';
import { WebSocketMessageLog } from './WebSocketMessageLog';
import { WebSocketSendPane } from './WebSocketSendPane';
import { WebSocketStudioShell } from './WebSocketStudioShell';
import {
  WebSocketSavedRail,
  WebSocketSavedDetail,
  useWebSocketSavedUi,
  type ProfilePrefillDraft,
} from './WebSocketSavedConnections';
import { WebSocketTlsPanel } from './WebSocketTlsPanel';
import { KeyValueEditor } from './KeyValueEditor';
import WebSocketAuthPanel from './WebSocketAuthPanel';
import type { AuthConfig, GlobalAuthProfile } from '../../shared/types';
import type { EndpointRowStatus } from '../environments/utils/protocolEndpointUtils';
import type {
  WsConnectionDraft,
  WsKeyValueEntry,
  WsLeftTab,
  WsRightTab,
  WsStudioMode,
  WsTlsConfig,
} from '../../shared/websocket/types';
import {
  createDefaultTlsConfig,
  deriveViewTabFromStudio,
  draftToProfileFields,
  hasCustomHeaders,
  hasTlsOverrides,
  mapViewTabToStudioLocation,
  resolveBackoffMultiplier,
} from '../../shared/websocket/types';
import { resolveEffectiveProtocol } from '../../shared/websocket/protocols/protocolDetector';
import { buildResolvedEffectiveUrl } from './wsMessageUtils';
import type { UseWebSocketProfilesReturn } from '../../app/hooks/useWebSocketProfiles';
import type { UseWebSocketTemplatesReturn } from '../../app/hooks/useWebSocketTemplates';
import type { ConnectionStateHint } from './WsConnectionTabBar';
import type { WsViewTab, WsConnectionHistoryEntry, WsProtocolMode } from '../../shared/websocket/types';
import { useWebSocketRecording } from './useWebSocketRecording';
import { useWebSocketRecordingBridge } from './useWebSocketRecordingBridge';
import { useWebSocketMetrics } from './useWebSocketMetrics';
import { useWebSocketMockServer } from './useWebSocketMockServer';
import { WebSocketMockServerBar, WebSocketMockClientsPane, WebSocketMockRulesPane, useMockServerUi } from './WebSocketMockServer';
import { useWebSocketLoadTest } from './useWebSocketLoadTest';
import { WebSocketLoadTest } from './WebSocketLoadTest';
import { WebSocketStatsPanel } from './WebSocketStatsPanel';
import { WebSocketSchemaPanel } from './WebSocketSchemaPanel';
import { useWebSocketSchema } from './useWebSocketSchema';
import { useConsoleCommands } from './useConsoleCommands';
import { buildWsConsoleCapabilities } from './wsConsoleCapabilities';
import { WS_CONSOLE_COMMANDS, WS_CONSOLE_HINT } from './wsConsoleCommands';

export interface WsConnectionTabContentHandle {
  getConnectionState: () => ConnectionStateHint;
  getUrl: () => string;
  getMessageCount: () => number;
  /** Phase 8 — full draft snapshot for whole-draft persistence. */
  getDraft: () => WsConnectionDraft;
  /**
   * Quiet TLS-lesson prep: reset TLS/auth/headers/protocol/URL and clear
   * messages without opening the TLS modal or flashing the Connect panel.
   */
  prepareForTlsLesson: () => void;
  /** Demo bridge — merge TLS overrides on this tab (skip-cert / CA / mTLS). */
  applyTlsConfig: (patch: Partial<WsTlsConfig>) => void;
}

export interface WsConnectionTabContentProps {
  tabId: string;
  envVarMap: Record<string, string>;
  endpointProtocolStatus?: EndpointRowStatus;
  /** Phase 8 — global auth profiles available for the Auth tab inherit selector. */
  globalAuthProfiles?: GlobalAuthProfile[];
  profilesHook: UseWebSocketProfilesReturn;
  templatesHook: UseWebSocketTemplatesReturn;
  /** Unique port assigned to this tab's mock server (e.g. 9876, 9877, …).
   *  Each tab gets its own port so mock servers are fully isolated. */
  mockPort: number;
  /** Called when the user changes the mock server port via the UI. */
  onMockPortChange?: (tabId: string, newPort: number) => void;
  onConnectionStateChange: (tabId: string, state: ConnectionStateHint, protocolMode?: WsProtocolMode) => void;
  onUrlChange: (tabId: string, url: string) => void;
  /** Phase 8 — fires when persistable draft fields (subprotocols/headers/
   * queryParams/auth) change, so the parent can debounce-save the whole draft. */
  onDraftChange?: (tabId: string) => void;
  initialUrl?: string;
  initialProtocol?: WsProtocolMode;
  /** Phase 8 — seeds the draft (subprotocols/headers/queryParams/auth) on mount
   * for whole-draft persistence restore. `initialUrl` still seeds the URL. */
  initialDraft?: Partial<WsConnectionDraft>;
  /** Selects which left-pane tab is shown (`connect` / `headers` / `params` /
   * `send` / `auth`). When omitted, defaults to `connect`. */
  controlledLeftTab?: WsLeftTab;
  /** Drives the redesigned `WebSocketStudioShell` this component renders
   * (composition inversion) so the studio-owning child can feed both panes from
   * one hook instance. `mode` selects client/mock/saved; the left body follows
   * `controlledLeftTab` and the right body follows `controlledRightTab`. */
  controlledMode: WsStudioMode;
  controlledRightTab?: WsRightTab;
  onModeChange?: (mode: WsStudioMode) => void;
  onLeftTabChange?: (tab: WsLeftTab) => void;
  onRightTabChange?: (tab: WsRightTab) => void;
  history?: WsConnectionHistoryEntry[];
  onClearHistory?: () => void;
}

export const WsConnectionTabContent = forwardRef<
  WsConnectionTabContentHandle,
  WsConnectionTabContentProps
>(function WsConnectionTabContent(
  {
    tabId, envVarMap, endpointProtocolStatus, globalAuthProfiles = [], profilesHook, templatesHook,
    mockPort,
    onMockPortChange,
    onConnectionStateChange, onUrlChange,
    onDraftChange,
    initialUrl, initialProtocol,
    initialDraft,
    controlledLeftTab,
    controlledMode,
    controlledRightTab,
    onModeChange,
    onLeftTabChange,
    onRightTabChange,
    history,
    onClearHistory,
  },
  ref,
) {
  // The parent drives mode/leftTab/rightTab and this component renders the
  // split-pane shell. The legacy `viewTab` is derived from mode + leftTab so the
  // rest of the component (mock polling, status bar, etc.) keeps working.
  const shellLeftTab = controlledLeftTab ?? 'connect';
  const shellRightTab = controlledRightTab ?? 'events';
  const viewTab = deriveViewTabFromStudio(controlledMode, shellLeftTab);
  const [profilePrefill, setProfilePrefill] = useState<ProfilePrefillDraft | null>(null);

  const studio = useWebSocketStudio(envVarMap, globalAuthProfiles);
  const wsConsole = useWebSocketConsole({
    connection: studio.connection,
    reconnectState: studio.reconnectState,
    detectedProtocol: studio.detectedProtocol,
    draft: studio.draft,
    authProfiles: globalAuthProfiles,
  });
  const recording = useWebSocketRecording();
  const { recordMessage, recordStateChange, state: recordingState } = recording;
  const metrics = useWebSocketMetrics(studio.messages, studio.connection.state);
  // Each tab has its own mock server scoped to its assigned port.
  // Local state lets an in-progress edit apply immediately; sync from the parent
  // prop so conflict swaps / restore / demo pinning actually reach this tab.
  const [localMockPort, setLocalMockPort] = useState(mockPort);
  useEffect(() => {
    setLocalMockPort(mockPort);
  }, [mockPort]);
  const handleMockPortChange = useCallback((newPort: number) => {
    setLocalMockPort(newPort);
    onMockPortChange?.(tabId, newPort);
  }, [tabId, onMockPortChange]);

  const mockServer = useWebSocketMockServer(localMockPort, viewTab === 'mock');

  const schemaHook = useWebSocketSchema();

  const isConnected = studio.connection.state === 'connected';
  const loadTest = useWebSocketLoadTest(
    isConnected ? studio.send : null,
    studio.messages,
    isConnected,
  );
  const [showLoadTest, setShowLoadTest] = useState(false);
  const handleToggleLoadTest = useCallback(() => {
    setShowLoadTest((v) => !v);
  }, []);

  // Phase 10 — console command line. Dispatch slash commands to the studio
  // actions; `/template <name>` resolves against the saved templates.
  const { runCommand: runConsoleCommand } = useConsoleCommands({
    append: wsConsole.append,
    clearConsole: wsConsole.clear,
    commands: WS_CONSOLE_COMMANDS,
    capabilities: buildWsConsoleCapabilities({
      isConnected,
      connectionState: studio.connection.state,
      transportMode: studio.transportMode,
      setDraft: studio.setDraft,
      connect: studio.connect,
      disconnect: studio.disconnect,
      sendPing: studio.sendPing,
      send: studio.send,
      templates: templatesHook.templates,
    }),
  });

  useWebSocketRecordingBridge({
    messages: studio.messages,
    connectionState: studio.connection.state,
    draftUrl: studio.draft.url,
    recordingState,
    recordMessage,
    recordStateChange,
  });

  const initialUrlApplied = useRef(false);
  useEffect(() => {
    if (!initialUrlApplied.current) {
      initialUrlApplied.current = true;
      const seed: Partial<WsConnectionDraft> = {};
      if (initialDraft) {
        if (initialDraft.subprotocols !== undefined) seed.subprotocols = initialDraft.subprotocols;
        if (initialDraft.headers !== undefined) seed.headers = initialDraft.headers;
        if (initialDraft.queryParams !== undefined) seed.queryParams = initialDraft.queryParams;
        if (initialDraft.auth !== undefined) seed.auth = initialDraft.auth;
      }
      if (initialUrl) seed.url = initialUrl;
      if (Object.keys(seed).length > 0) studio.setDraft(seed);
      if (initialProtocol) studio.setProtocolMode(initialProtocol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeViewTab = useCallback(
    (next: WsViewTab) => {
      // The legacy view-tab bar is gone and `viewTab` is derived from mode +
      // leftTab, so translate the intent into shell navigation (e.g. "Save as
      // profile" → Saved mode, "Use connection" → Connect tab).
      const target = mapViewTabToStudioLocation(next);
      onModeChange?.(target.mode);
      if (target.mode === 'client') onLeftTabChange?.(target.leftTab);
    },
    [onModeChange, onLeftTabChange],
  );

  const prevConnStateRef = useRef(studio.connection.state);
  useEffect(() => {
    if (prevConnStateRef.current !== studio.connection.state) {
      prevConnStateRef.current = studio.connection.state;
      const hint: ConnectionStateHint =
        studio.connection.state === 'closing' ? 'connected' : studio.connection.state;
      onConnectionStateChange(tabId, hint, studio.protocolMode);
    }
  }, [studio.connection.state, tabId, onConnectionStateChange, studio.protocolMode, onLeftTabChange]);

  const prevUrlRef = useRef(studio.draft.url);
  useEffect(() => {
    if (prevUrlRef.current !== studio.draft.url) {
      prevUrlRef.current = studio.draft.url;
      onUrlChange(tabId, studio.draft.url);
    }
  }, [studio.draft.url, tabId, onUrlChange]);

  // Phase 8: notify the parent when persistable draft fields change so it can
  // debounce-save the whole draft (the URL has its own dedicated channel above).
  const draftSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    const snapshot = JSON.stringify({
      subprotocols: studio.draft.subprotocols,
      headers: studio.draft.headers,
      queryParams: studio.draft.queryParams,
      auth: studio.draft.auth,
    });
    if (draftSnapshotRef.current === null) {
      draftSnapshotRef.current = snapshot;
      return;
    }
    if (draftSnapshotRef.current !== snapshot) {
      draftSnapshotRef.current = snapshot;
      onDraftChange?.(tabId);
    }
  }, [
    studio.draft.subprotocols,
    studio.draft.headers,
    studio.draft.queryParams,
    studio.draft.auth,
    tabId,
    onDraftChange,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      getConnectionState: () => {
        const s = studio.connection.state;
        return s === 'closing' ? 'connected' : s;
      },
      getUrl: () => studio.draft.url,
      getMessageCount: () => studio.messages.length,
      getDraft: () => studio.draft,
      prepareForTlsLesson: () => {
        const state = studio.connection.state;
        if (state === 'connected' || state === 'connecting' || state === 'closing') {
          studio.disconnect();
        }
        studio.clearMessages();
        studio.setProtocolMode('raw');
        studio.setTlsConfig({
          ...createDefaultTlsConfig(),
          caCert: undefined,
          clientCert: undefined,
          clientKey: undefined,
        });
        studio.setDraft({
          url: '',
          subprotocols: '',
          headers: [],
          queryParams: [],
          auth: { type: 'none' },
        });
      },
      applyTlsConfig: (patch) => {
        studio.setTlsConfig(patch);
      },
    }),
    [studio],
  );

  const resolvedUrl = useMemo(
    () => buildResolvedEffectiveUrl(studio.draft, envVarMap),
    [studio.draft, envVarMap],
  );

  const effectiveProtocol = resolveEffectiveProtocol(studio.protocolMode, studio.detectedProtocol);

  const handleSaveAsProfile = useCallback(() => {
    const fields = draftToProfileFields(studio.draft);
    setProfilePrefill({
      ...fields,
      name: `Profile ${profilesHook.profiles.length + 1}`,
      protocolMode: studio.protocolMode,
      autoReconnect: studio.autoReconnect,
      maxReconnectAttempts: studio.maxReconnectAttempts,
      reconnectIntervalMs: studio.reconnectIntervalMs,
      backoffMultiplier: studio.backoffMultiplier,
      maxMessages: studio.maxMessages,
    });
    changeViewTab('saved');
  }, [
    studio.draft,
    studio.maxMessages,
    studio.protocolMode,
    studio.autoReconnect,
    studio.maxReconnectAttempts,
    studio.reconnectIntervalMs,
    studio.backoffMultiplier,
    profilesHook.profiles.length,
    changeViewTab,
  ]);

  const handlePrefillConsumed = useCallback(() => {
    setProfilePrefill(null);
  }, []);

  const handleLoadProfile = useCallback(
    (id: string) => {
      const profile = profilesHook.profiles.find((p) => p.id === id);
      if (profile) {
        studio.setProtocolMode(profile.protocolMode ?? 'auto');
        studio.setAutoReconnect(profile.autoReconnect);
        studio.setMaxReconnectAttempts(profile.maxReconnectAttempts);
        studio.setReconnectIntervalMs(profile.reconnectIntervalMs);
        studio.setBackoffMultiplier(resolveBackoffMultiplier(profile.backoffMultiplier));
        studio.setMaxMessages(profile.maxMessages);
        const baseTls = createDefaultTlsConfig();
        studio.setTlsConfig({
          ...baseTls,
          caCert: undefined,
          clientCert: undefined,
          clientKey: undefined,
          ...(profile.tlsConfig ?? {}),
        });
      }
      return profilesHook.loadProfileAsDraft(id);
    },
    [profilesHook, studio],
  );

  const handleApplyDraft = useCallback(
    (draft: WsConnectionDraft) => {
      studio.setDraft(draft);
    },
    [studio],
  );

  const handleLocalHistorySelect = useCallback(
    (url: string, protocol: string) => {
      studio.setDraft({ url });
      if (protocol && protocol !== 'auto' && protocol !== 'raw') {
        studio.setProtocolMode(protocol as WsProtocolMode);
      }
    },
    [studio],
  );

  const { startRecording, stopRecording, loadRecording, startReplay: recStartReplay } = recording;

  const handleStartRecording = useCallback(() => {
    startRecording(studio.draft.url, studio.protocolMode);
  }, [startRecording, studio.draft.url, studio.protocolMode]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handleLoadRecordingFile = useCallback(async (file: File) => {
    return loadRecording(file);
  }, [loadRecording]);

  const handleStartReplay = useCallback(() => {
    studio.clearMessages();
    recStartReplay(studio.appendReplayFrame);
  }, [studio, recStartReplay]);

  const handleStopReplay = useCallback(() => {
    recording.stopReplay();
    studio.clearMessages();
  }, [recording, studio]);

  const handleSwitchToConnect = useCallback(() => {
    changeViewTab('connect');
  }, [changeViewTab]);

  const handleEditConnection = useCallback(() => {
    studio.cancelReconnect();
    changeViewTab('connect');
  }, [studio, changeViewTab]);

  // Disabled state for the relocated Headers/Params editors — mirrors the
  // `inputsDisabled` logic inside WebSocketConnectPanel (busy or reconnecting).
  const wsState = studio.connection.state;
  const connectInputsDisabled =
    wsState === 'connected' ||
    wsState === 'connecting' ||
    wsState === 'closing' ||
    (studio.reconnectState?.active ?? false);
  const handleHeadersChange = useCallback(
    (headers: WsKeyValueEntry[]) => studio.setDraft({ headers }),
    [studio],
  );
  const handleQueryParamsChange = useCallback(
    (queryParams: WsKeyValueEntry[]) => studio.setDraft({ queryParams }),
    [studio],
  );
  const handleAuthChange = useCallback(
    (auth: AuthConfig) => studio.setDraft({ auth }),
    [studio],
  );

  const messageLogProps = {
    messages: studio.filteredMessages,
    totalCount: studio.messages.length,
    maxMessages: studio.maxMessages,
    isMaxReached: studio.isMaxReached,
    searchText: studio.searchText,
    setSearchText: studio.setSearchText,
    searchMode: studio.searchMode,
    setSearchMode: studio.setSearchMode,
    directionFilter: studio.directionFilter,
    setDirectionFilter: studio.setDirectionFilter,
    sizeFilter: studio.sizeFilter,
    setSizeFilter: studio.setSizeFilter,
    timeFilter: studio.timeFilter,
    setTimeFilter: studio.setTimeFilter,
    contentTypeFilter: studio.contentTypeFilter,
    setContentTypeFilter: studio.setContentTypeFilter,
    onClear: studio.clearMessages,
    onSend: studio.send,
    onPing: studio.sendPing,
    isConnected,
    templates: templatesHook.templates,
    onSaveTemplate: templatesHook.saveTemplate,
    onDeleteTemplate: templatesHook.deleteTemplate,
    onLoadTemplate: templatesHook.loadTemplate,
    effectiveProtocol,
    allMessages: studio.messages,
    transportMode: studio.transportMode,
    showStatusBar: viewTab === 'messages',
    connectionUrl: studio.connection.url,
    uptime: studio.uptime,
    sentCount: studio.sentCount,
    receivedCount: studio.receivedCount,
    bookmarkedIds: studio.bookmarkedIds,
    onToggleBookmark: studio.toggleBookmark,
    bookmarkCount: studio.bookmarkedMessages.length,
    recordingState: recording.state,
    onStartRecording: handleStartRecording,
    onStopRecording: handleStopRecording,
    onLoadRecordingFile: handleLoadRecordingFile,
    onStartReplay: handleStartReplay,
    onPauseReplay: recording.pauseReplay,
    onResumeReplay: recording.resumeReplay,
    onStopReplay: handleStopReplay,
    replaySpeed: recording.replaySpeed,
    onSetReplaySpeed: recording.setReplaySpeed,
    replayProgress: recording.replayProgress,
    hasLoadedRecording: recording.loadedRecording !== null,
    metrics,
    onToggleLoadTest: handleToggleLoadTest,
    loadTestActive: showLoadTest,
    getValidation: schemaHook.getValidation,
    validationFilter: schemaHook.validationFilter,
    setValidationFilter: schemaHook.setValidationFilter,
    validationEnabled: schemaHook.validationEnabled,
    setValidationEnabled: schemaHook.setValidationEnabled,
    schemas: schemaHook.schemas,
    onAddSchema: schemaHook.addSchema,
    onUpdateSchema: schemaHook.updateSchema,
    onRemoveSchema: schemaHook.removeSchema,
    onToggleSchema: schemaHook.toggleSchema,
    onGenerateSchema: schemaHook.generateSchema,
    schemasVisible: schemaHook.schemasVisible,
    onToggleSchemasVisible: () => schemaHook.setSchemasVisible(!schemaHook.schemasVisible),
    hasEnabledSchemas: schemaHook.hasEnabledSchemas,
  };

  // ── Shared content nodes ─────────────────────────────────────────────────
  // Reusable nodes composed into the split-pane shell's left/right panes below.
  const lockBannerNode = isConnected ? (
    <div className="ws-config-lock-banner" data-testid="config-lock-banner">
      <span className="ws-config-lock-icon" aria-hidden="true">🔒</span>
      Connection settings are locked while connected.{' '}
      <button
        type="button"
        className="ws-config-lock-disconnect"
        onClick={() => studio.disconnect()}
        data-testid="banner-disconnect-link"
      >
        Disconnect
      </button>
      {' '}to edit.
    </div>
  ) : null;

  const headersEditorNode = (
    <KeyValueEditor
      entries={studio.draft.headers}
      onChange={handleHeadersChange}
      onDeleteAll={() => handleHeadersChange([])}
      disabled={connectInputsDisabled}
      label="Headers"
      testIdPrefix="headers"
    />
  );

  const queryParamsEditorNode = (
    <KeyValueEditor
      entries={studio.draft.queryParams}
      onChange={handleQueryParamsChange}
      onDeleteAll={() => handleQueryParamsChange([])}
      disabled={connectInputsDisabled}
      label="Query Parameters"
      testIdPrefix="query-params"
    />
  );

  const authPanelNode = (
    <WebSocketAuthPanel
      auth={studio.draft.auth ?? { type: 'none' }}
      onChange={handleAuthChange}
      globalAuthProfiles={globalAuthProfiles}
    />
  );

  const connectPanelNode = (
    <>
      <WebSocketConnectPanel
        draft={studio.draft}
        setDraft={studio.setDraft}
        connection={studio.connection}
        onConnect={studio.connect}
        onDisconnect={studio.disconnect}
        uptime={studio.uptime}
        sentCount={studio.sentCount}
        receivedCount={studio.receivedCount}
        onSaveAsProfile={handleSaveAsProfile}
        configLocked={isConnected}
        autoReconnect={studio.autoReconnect}
        onAutoReconnectChange={studio.setAutoReconnect}
        reconnectState={studio.reconnectState}
        onCancelReconnect={studio.cancelReconnect}
        maxReconnectAttempts={studio.maxReconnectAttempts}
        reconnectIntervalMs={studio.reconnectIntervalMs}
        backoffMultiplier={studio.backoffMultiplier}
        onMaxReconnectAttemptsChange={studio.setMaxReconnectAttempts}
        onReconnectIntervalMsChange={studio.setReconnectIntervalMs}
        onBackoffMultiplierChange={studio.setBackoffMultiplier}
        onRetryNow={studio.retryNow}
        onEditConnection={handleEditConnection}
        resolvedUrl={resolvedUrl}
        protocolMode={studio.protocolMode}
        onProtocolModeChange={studio.setProtocolMode}
        detectedProtocol={studio.detectedProtocol}
        sioServerParams={studio.sioServerParams}
        transportMode={studio.transportMode}
        envVarMap={envVarMap}
        endpointProtocolStatus={endpointProtocolStatus}
        history={history}
        onHistorySelect={handleLocalHistorySelect}
        onClearHistory={onClearHistory}
        showHeaders={false}
        showQueryParams={false}
      />
      <WebSocketTlsPanel
        tlsConfig={studio.tlsConfig}
        onTlsChange={studio.setTlsConfig}
        isWss={resolvedUrl.toLowerCase().startsWith('wss://')}
        isProxyMode={hasCustomHeaders(studio.draft) || hasTlsOverrides(studio.tlsConfig)}
        disabled={isConnected}
      />
    </>
  );

  const sendPaneNode = (
    <WebSocketSendPane
      isConnected={isConnected}
      effectiveProtocol={effectiveProtocol}
      onSend={studio.send}
      onPing={studio.sendPing}
      templates={templatesHook.templates}
      onSaveTemplate={templatesHook.saveTemplate}
      onDeleteTemplate={templatesHook.deleteTemplate}
      onLoadTemplate={templatesHook.loadTemplate}
      transportMode={studio.transportMode}
      totalCount={studio.messages.length}
      maxMessages={studio.maxMessages}
      hidden={recordingState === 'replaying' || recordingState === 'paused'}
    />
  );

  const savedProps = {
    profiles: profilesHook.profiles,
    loading: profilesHook.loading,
    error: profilesHook.error,
    onSaveProfile: profilesHook.saveProfile,
    onUpdateProfile: profilesHook.updateProfile,
    onDeleteProfile: profilesHook.deleteProfile,
    onDuplicateProfile: profilesHook.duplicateProfile,
    onImportProfiles: profilesHook.importProfiles,
    onExportProfiles: profilesHook.exportProfiles,
    onLoadProfile: handleLoadProfile,
    onApplyDraft: handleApplyDraft,
    onSwitchToConnect: handleSwitchToConnect,
    prefillDraft: profilePrefill,
    onPrefillDraftConsumed: handlePrefillConsumed,
  };

  // Shared Saved UI state so the shell rail (left) and detail (right) panes
  // stay in sync (Phase 6a).
  const savedUi = useWebSocketSavedUi(savedProps);

  // Shared Mock UI state so the shell server bar (topBar), clients pane (left)
  // and rules pane (right) render from one source of truth (Phase 6b).
  const mockUi = useMockServerUi(mockServer);

  // Detect the confusing case where the Client is connected to a *local* mock
  // server on a DIFFERENT port than the one this tab's own Mock Server panel
  // is running on (each tab gets its own isolated port — see assignNextPort in
  // WebSocketStudioPage.tsx). When that happens, this tab's Activity Log
  // legitimately shows no traffic, because the client is actually talking to
  // a different server instance (e.g. another tab's, still running in the
  // background). Surface a warning instead of silently confusing the user.
  const clientPortMismatch = useMemo(() => {
    if (studio.connection.state !== 'connected' || !mockServer.status.running) return null;
    const connectedUrl = studio.connection.url;
    if (!connectedUrl) return null;
    let parsed: URL;
    try {
      parsed = new URL(connectedUrl);
    } catch {
      return null;
    }
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
    if (!isLocalHost) return null;
    const clientPort = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'wss:' ? 443 : 80);
    if (clientPort === mockServer.status.port) return null;
    return { connectedUrl, clientPort };
  }, [studio.connection.state, studio.connection.url, mockServer.status.running, mockServer.status.port]);

  // ── Split-pane shell render (composition inversion) ─────────────────────
  // This component owns the studio hook AND renders the shell, feeding the left
  // body via children and the right (Events) pane via the rightPane slot.
  // Send pane is always mounted (never conditionally removed) so compose text,
  // format selection, and STOMP fields survive tab switches.
  const sendPaneVisible =
    controlledMode !== 'mock' && controlledMode !== 'saved' && shellLeftTab === 'send';

  const leftBody = (
    <>
      {/* Always mounted — hidden via CSS when not on Send tab */}
      <div className="ws-studio-content" style={{ display: sendPaneVisible ? undefined : 'none' }}>
        {sendPaneNode}
      </div>

      {controlledMode === 'mock' ? (
        <WebSocketMockClientsPane ui={mockUi} />
      ) : controlledMode === 'saved' ? (
        <WebSocketSavedRail ui={savedUi} />
      ) : shellLeftTab === 'params' ? (
        <div className="ws-studio-content">
          {lockBannerNode}
          {queryParamsEditorNode}
        </div>
      ) : shellLeftTab === 'headers' ? (
        <div className="ws-studio-content">
          {lockBannerNode}
          {headersEditorNode}
        </div>
      ) : shellLeftTab === 'auth' ? (
        <div className="ws-studio-content">
          {lockBannerNode}
          {authPanelNode}
        </div>
      ) : shellLeftTab !== 'send' ? (
        <div className="ws-studio-content">
          {lockBannerNode}
          {connectPanelNode}
        </div>
      ) : null}
    </>
  );

  const rightBody =
    controlledMode === 'saved' ? (
      <WebSocketSavedDetail ui={savedUi} />
    )
    : controlledMode === 'mock' ? (
      <WebSocketMockRulesPane ui={mockUi} />
    )
    : controlledMode !== 'client' ? undefined
    : shellRightTab === 'events' ? (
      <div className="ws-studio-content">
        <WebSocketMessageLog {...messageLogProps} showComposer={false} showStatusBar showAuxPanels={false} />
      </div>
    )
    : shellRightTab === 'stats' ? (
      <div className="ws-studio-tab-pane" data-testid="ws-studio-stats-pane">
        <WebSocketStatsPanel metrics={metrics} />
      </div>
    )
    : shellRightTab === 'loadtest' ? (
      <div className="ws-studio-tab-pane" data-testid="ws-studio-loadtest-pane">
        <WebSocketLoadTest
          loadTest={loadTest}
          isConnected={isConnected}
          statsPanel={<WebSocketStatsPanel metrics={metrics} />}
        />
      </div>
    )
    : shellRightTab === 'schema' ? (
      <div className="ws-studio-tab-pane" data-testid="ws-studio-schema-pane">
        <WebSocketSchemaPanel
          schemas={schemaHook.schemas}
          validationEnabled={schemaHook.validationEnabled}
          onSetValidationEnabled={schemaHook.setValidationEnabled}
          onAddSchema={schemaHook.addSchema}
          onUpdateSchema={schemaHook.updateSchema}
          onRemoveSchema={schemaHook.removeSchema}
          onToggleSchema={schemaHook.toggleSchema}
          onGenerateSchema={schemaHook.generateSchema}
          messages={studio.messages}
        />
      </div>
    )
    : shellRightTab === 'console' ? (
      <div className="ws-studio-tab-pane" data-testid="ws-studio-console-pane">
        <ConsolePanel
          entries={wsConsole.entries}
          settings={wsConsole.settings}
          onSettingsChange={wsConsole.setSettings}
          onClear={wsConsole.clear}
          variant="ws"
          onCommand={runConsoleCommand}
          commandHint={WS_CONSOLE_HINT}
        />
      </div>
    )
    : undefined; // unknown right tab → shell placeholder

  return (
    <div className="ws-conn-tab-content" data-testid={`conn-tab-content-${tabId}`}>
      <WebSocketStudioShell
        mode={controlledMode}
        onModeChange={(m) => onModeChange?.(m)}
        leftTab={shellLeftTab}
        onLeftTabChange={(t) => onLeftTabChange?.(t)}
        rightTab={shellRightTab}
        onRightTabChange={(t) => onRightTabChange?.(t)}
        profileCount={profilesHook.profiles.length}
        messageCount={studio.messages.length}
        mockRunning={mockServer.status.running}
        topBar={controlledMode === 'mock' ? <WebSocketMockServerBar ui={mockUi} onPortChange={handleMockPortChange} clientPortMismatch={clientPortMismatch} /> : undefined}
        rightPane={rightBody}
      >
        {leftBody}
      </WebSocketStudioShell>
    </div>
  );
});
