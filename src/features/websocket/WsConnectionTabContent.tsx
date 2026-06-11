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
import { WebSocketComposePane } from './WebSocketComposePane';
import { WebSocketStudioShell } from './WebSocketStudioShell';
import {
  WebSocketSavedConnections,
  WebSocketSavedRail,
  WebSocketSavedDetail,
  useWebSocketSavedUi,
  type ProfilePrefillDraft,
} from './WebSocketSavedConnections';
import { WebSocketTlsPanel } from './WebSocketTlsPanel';
import { KeyValueEditor } from './KeyValueEditor';
import WebSocketAuthPanel from './WebSocketAuthPanel';
import type { AuthConfig, GlobalAuthProfile } from '../../shared/types';
import type { WsConnectionDraft, WsKeyValueEntry, WsLeftTab, WsRightTab, WsStudioMode } from '../../shared/websocket/types';
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
import { WebSocketMockServer, WebSocketMockServerBar, WebSocketMockClientsPane, WebSocketMockRulesPane, useMockServerUi } from './WebSocketMockServer';
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
}

export interface WsConnectionTabContentProps {
  tabId: string;
  envVarMap: Record<string, string>;
  /** Phase 8 — global auth profiles available for the Auth tab inherit selector. */
  globalAuthProfiles?: GlobalAuthProfile[];
  profilesHook: UseWebSocketProfilesReturn;
  templatesHook: UseWebSocketTemplatesReturn;
  onConnectionStateChange: (tabId: string, state: ConnectionStateHint, protocolMode?: WsProtocolMode) => void;
  onUrlChange: (tabId: string, url: string) => void;
  onViewTabChange?: (tabId: string, viewTab: WsViewTab) => void;
  /** Phase 8 — fires when persistable draft fields (subprotocols/headers/
   * queryParams/auth) change, so the parent can debounce-save the whole draft. */
  onDraftChange?: (tabId: string) => void;
  initialUrl?: string;
  initialProtocol?: WsProtocolMode;
  initialViewTab?: WsViewTab;
  /** Phase 8 — seeds the draft (subprotocols/headers/queryParams/auth) on mount
   * for whole-draft persistence restore. `initialUrl` still seeds the URL. */
  initialDraft?: Partial<WsConnectionDraft>;
  /** When provided, the studio is *controlled* by the parent shell: this view
   * is rendered instead of the internal state and the internal tab bar is
   * hidden (the parent owns navigation). When omitted, the component is
   * uncontrolled and behaves exactly as before. */
  controlledViewTab?: WsViewTab;
  /** When provided (shell mode), the `connect` view is split into the
   * `Connect` / `Headers` / `Params` left-pane tabs and this selects which one
   * is shown. When omitted, headers and params render inline in the connect
   * panel exactly as before. */
  controlledLeftTab?: WsLeftTab;
  /** Phase 4 (shell mode): when provided, the component renders the redesigned
   * `WebSocketStudioShell` itself (composition inversion) so the studio-owning
   * child can feed both panes from one hook instance. `mode` selects
   * client/mock/saved; the left body follows `controlledLeftTab` and the right
   * body follows `controlledRightTab`. When omitted, the legacy flat rendering
   * is used (uncontrolled tab bar, or the `controlledViewTab` single view). */
  controlledMode?: WsStudioMode;
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
    tabId, envVarMap, globalAuthProfiles = [], profilesHook, templatesHook,
    onConnectionStateChange, onUrlChange, onViewTabChange,
    onDraftChange,
    initialUrl, initialProtocol, initialViewTab,
    initialDraft,
    controlledViewTab,
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
  const [internalViewTab, setInternalViewTab] = useState<WsViewTab>(initialViewTab ?? 'connect');
  // Shell mode (Phase 4): the parent drives mode/leftTab/rightTab and the
  // component renders the split-pane shell itself. The legacy view is derived
  // from mode + leftTab so the rest of the component (mock polling, status bar,
  // etc.) keeps working unchanged.
  const shellMode = controlledMode !== undefined;
  const shellLeftTab = controlledLeftTab ?? 'connect';
  const shellRightTab = controlledRightTab ?? 'events';
  const derivedShellViewTab = controlledMode !== undefined
    ? deriveViewTabFromStudio(controlledMode, shellLeftTab)
    : undefined;
  const isControlled = controlledViewTab !== undefined || shellMode;
  const viewTab = derivedShellViewTab ?? controlledViewTab ?? internalViewTab;
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
  const mockServer = useWebSocketMockServer(viewTab === 'mock');

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
      if (controlledMode !== undefined) {
        // Shell mode: the legacy view-tab bar is hidden and `viewTab` is derived
        // from mode + leftTab, so translate the intent into shell navigation
        // (e.g. "Save as profile" → Saved mode, "Use connection" → Connect tab).
        const target = mapViewTabToStudioLocation(next);
        onModeChange?.(target.mode);
        if (target.mode === 'client') onLeftTabChange?.(target.leftTab);
        return;
      }
      setInternalViewTab(next);
      onViewTabChange?.(tabId, next);
    },
    [controlledMode, onModeChange, onLeftTabChange, tabId, onViewTabChange],
  );

  const prevConnStateRef = useRef(studio.connection.state);
  useEffect(() => {
    if (prevConnStateRef.current !== studio.connection.state) {
      prevConnStateRef.current = studio.connection.state;
      const hint: ConnectionStateHint =
        studio.connection.state === 'closing' ? 'connected' : studio.connection.state;
      onConnectionStateChange(tabId, hint, studio.protocolMode);
    }
  }, [studio.connection.state, tabId, onConnectionStateChange, studio.protocolMode]);

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
    }),
    [studio.connection.state, studio.messages.length, studio.draft],
  );

  const isGuardVisible =
    studio.connection.state === 'disconnected' && studio.draft.url.trim() === '';

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
  // These are reused by both the legacy flat render (below) and the Phase 4
  // split-pane shell render, so the two paths can never drift apart.
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
        history={history}
        onHistorySelect={handleLocalHistorySelect}
        onClearHistory={onClearHistory}
        showHeaders={controlledLeftTab === undefined && controlledMode === undefined}
        showQueryParams={controlledLeftTab === undefined && controlledMode === undefined}
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

  const composePaneNode = (
    <WebSocketComposePane
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
  // stay in sync (Phase 6a). The legacy flat path uses its own internal state
  // via the WebSocketSavedConnections wrapper below.
  const savedUi = useWebSocketSavedUi(savedProps);

  const savedConnectionsNode = <WebSocketSavedConnections {...savedProps} />;

  // Shared Mock UI state so the shell server bar (topBar), clients pane (left)
  // and rules pane (right) render from one source of truth (Phase 6b). The
  // legacy flat path uses the WebSocketMockServer wrapper below.
  const mockUi = useMockServerUi(mockServer);

  const mockServerNode = <WebSocketMockServer mock={mockServer} />;

  // ── Phase 4: split-pane shell render (composition inversion) ─────────────
  // When the parent drives the shell (controlledMode set), this component owns
  // the studio hook AND renders the shell, feeding the left body via children
  // and the right (Events) pane via the rightPane slot.
  if (controlledMode !== undefined) {
    const leftBody =
      controlledMode === 'mock' ? (
        <WebSocketMockClientsPane ui={mockUi} />
      ) : controlledMode === 'saved' ? (
        <WebSocketSavedRail ui={savedUi} />
      ) : shellLeftTab === 'compose' ? (
        <div className="ws-studio-content">{composePaneNode}</div>
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
      ) : (
        <div className="ws-studio-content">
          {lockBannerNode}
          {connectPanelNode}
        </div>
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
          topBar={controlledMode === 'mock' ? <WebSocketMockServerBar ui={mockUi} /> : undefined}
          rightPane={rightBody}
        >
          {leftBody}
        </WebSocketStudioShell>
      </div>
    );
  }

  return (
    <div className="ws-conn-tab-content" data-testid={`conn-tab-content-${tabId}`}>
      {!isControlled && (
      <div className="ws-studio-tabs">
        <button
          className={`ws-studio-tab ${viewTab === 'connect' ? 'active' : ''}`}
          onClick={() => changeViewTab('connect')}
          data-testid="tab-connect"
        >
          Connect
        </button>
        <button
          className={`ws-studio-tab ${viewTab === 'messages' ? 'active' : ''}`}
          onClick={() => changeViewTab('messages')}
          data-testid="tab-messages"
        >
          Messages
          {studio.messages.length > 0 && (
            <span className="ws-studio-tab-badge">{studio.messages.length}</span>
          )}
        </button>
        <button
          className={`ws-studio-tab ${viewTab === 'saved' ? 'active' : ''}`}
          onClick={() => changeViewTab('saved')}
          data-testid="tab-saved"
        >
          Saved
          {profilesHook.profiles.length > 0 && (
            <span className="ws-studio-tab-badge ws-studio-tab-badge-muted">
              {profilesHook.profiles.length}
            </span>
          )}
        </button>
        <button
          className={`ws-studio-tab ${viewTab === 'mock' ? 'active' : ''}`}
          onClick={() => changeViewTab('mock')}
          data-testid="tab-mock"
        >
          Mock
          {mockServer.status.running && (
            <span className="ws-studio-tab-badge ws-studio-tab-badge-running" aria-label="Mock server running">●</span>
          )}
        </button>
      </div>
      )}

      {viewTab === 'connect' && (
        <div className="ws-studio-content">
          {lockBannerNode}
          {controlledLeftTab === 'headers' ? (
            headersEditorNode
          ) : controlledLeftTab === 'params' ? (
            queryParamsEditorNode
          ) : controlledLeftTab === 'auth' ? (
            authPanelNode
          ) : (
            <>
              {connectPanelNode}
              {isGuardVisible ? (
                <div className="ws-guard">
                  <div className="ws-guard-inner">
                    <p className="ws-guard-title">No WebSocket connection</p>
                    <p className="ws-guard-subtitle">
                      Enter a WebSocket URL and click Connect to get started.
                    </p>
                  </div>
                </div>
              ) : (
                <WebSocketMessageLog {...messageLogProps} showStatusBar={false} />
              )}
            </>
          )}
        </div>
      )}

      {viewTab === 'messages' && (
        <div className="ws-studio-content">
          <WebSocketMessageLog
            {...messageLogProps}
            showComposer={controlledLeftTab !== 'compose'}
          />
          {controlledLeftTab === 'compose' && composePaneNode}
          {showLoadTest && (
            <WebSocketLoadTest
              loadTest={loadTest}
              isConnected={isConnected}
              statsPanel={<WebSocketStatsPanel metrics={metrics} />}
            />
          )}
        </div>
      )}

      {viewTab === 'saved' && (
        <div className="ws-studio-content">
          {savedConnectionsNode}
        </div>
      )}

      {viewTab === 'mock' && (
        <div className="ws-studio-content">
          {mockServerNode}
        </div>
      )}
    </div>
  );
});
