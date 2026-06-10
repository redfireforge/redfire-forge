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
import { WebSocketConnectPanel } from './WebSocketConnectPanel';
import { WebSocketMessageLog } from './WebSocketMessageLog';
import { WebSocketSavedConnections, type ProfilePrefillDraft } from './WebSocketSavedConnections';
import { WebSocketTlsPanel } from './WebSocketTlsPanel';
import type { WsConnectionDraft } from '../../shared/websocket/types';
import {
  createDefaultTlsConfig,
  draftToProfileFields,
  hasCustomHeaders,
  hasTlsOverrides,
  resolveBackoffMultiplier,
} from '../../shared/websocket/types';
import { resolveEffectiveProtocol } from '../../shared/websocket/protocols/protocolDetector';
import { buildResolvedEffectiveUrl } from './wsMessageUtils';
import type { UseWebSocketProfilesReturn } from '../../app/hooks/useWebSocketProfiles';
import type { UseWebSocketTemplatesReturn } from '../../app/hooks/useWebSocketTemplates';
import type { ConnectionStateHint } from './WsConnectionTabBar';
import type { WsViewTab, WsConnectionHistoryEntry, WsProtocolMode } from '../../shared/websocket/types';
import { useWebSocketRecording } from './useWebSocketRecording';
import { useWebSocketMetrics } from './useWebSocketMetrics';
import { useWebSocketMockServer } from './useWebSocketMockServer';
import { WebSocketMockServer } from './WebSocketMockServer';
import { useWebSocketLoadTest } from './useWebSocketLoadTest';
import { WebSocketLoadTest } from './WebSocketLoadTest';
import { useWebSocketSchema } from './useWebSocketSchema';

export interface WsConnectionTabContentHandle {
  getConnectionState: () => ConnectionStateHint;
  getUrl: () => string;
  getMessageCount: () => number;
}

export interface WsConnectionTabContentProps {
  tabId: string;
  envVarMap: Record<string, string>;
  profilesHook: UseWebSocketProfilesReturn;
  templatesHook: UseWebSocketTemplatesReturn;
  onConnectionStateChange: (tabId: string, state: ConnectionStateHint) => void;
  onUrlChange: (tabId: string, url: string) => void;
  onViewTabChange?: (tabId: string, viewTab: WsViewTab) => void;
  initialUrl?: string;
  initialViewTab?: WsViewTab;
  history?: WsConnectionHistoryEntry[];
  onClearHistory?: () => void;
}

export const WsConnectionTabContent = forwardRef<
  WsConnectionTabContentHandle,
  WsConnectionTabContentProps
>(function WsConnectionTabContent(
  {
    tabId, envVarMap, profilesHook, templatesHook,
    onConnectionStateChange, onUrlChange, onViewTabChange,
    initialUrl, initialViewTab,
    history,
    onClearHistory,
  },
  ref,
) {
  const [viewTab, setViewTab] = useState<WsViewTab>(initialViewTab ?? 'connect');
  const [profilePrefill, setProfilePrefill] = useState<ProfilePrefillDraft | null>(null);

  const studio = useWebSocketStudio(envVarMap);
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

  const prevMsgCountRef = useRef(0);
  const lastSeenMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    const msgs = studio.messages;
    const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
    if (recordingState !== 'recording') {
      prevMsgCountRef.current = msgs.length;
      lastSeenMsgIdRef.current = lastId;
      return;
    }
    if (msgs.length === 0 || lastId === lastSeenMsgIdRef.current) {
      prevMsgCountRef.current = msgs.length;
      return;
    }
    if (msgs.length > prevMsgCountRef.current) {
      for (let i = prevMsgCountRef.current; i < msgs.length; i++) {
        recordMessage(msgs[i]);
      }
    } else {
      // Cap eviction: array didn't grow but new messages exist
      const lastSeenIdx = lastSeenMsgIdRef.current
        ? msgs.findIndex((m) => m.id === lastSeenMsgIdRef.current)
        : -1;
      const startIdx = lastSeenIdx >= 0 ? lastSeenIdx + 1 : msgs.length - 1;
      for (let i = startIdx; i < msgs.length; i++) {
        recordMessage(msgs[i]);
      }
    }
    prevMsgCountRef.current = msgs.length;
    lastSeenMsgIdRef.current = lastId;
  }, [studio.messages, recordingState, recordMessage]);

  const prevConnState2Ref = useRef(studio.connection.state);
  useEffect(() => {
    if (recordingState !== 'recording') {
      prevConnState2Ref.current = studio.connection.state;
      return;
    }
    if (prevConnState2Ref.current !== studio.connection.state) {
      prevConnState2Ref.current = studio.connection.state;
      recordStateChange(studio.connection.state, studio.draft.url);
    }
  }, [studio.connection.state, studio.draft.url, recordingState, recordStateChange]);

  const initialUrlApplied = useRef(false);
  useEffect(() => {
    if (initialUrl && !initialUrlApplied.current) {
      initialUrlApplied.current = true;
      studio.setDraft({ url: initialUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeViewTab = useCallback(
    (next: WsViewTab) => {
      setViewTab(next);
      onViewTabChange?.(tabId, next);
    },
    [tabId, onViewTabChange],
  );

  const prevConnStateRef = useRef(studio.connection.state);
  useEffect(() => {
    if (prevConnStateRef.current !== studio.connection.state) {
      prevConnStateRef.current = studio.connection.state;
      const hint: ConnectionStateHint =
        studio.connection.state === 'closing' ? 'connected' : studio.connection.state;
      onConnectionStateChange(tabId, hint);
    }
  }, [studio.connection.state, tabId, onConnectionStateChange]);

  const prevUrlRef = useRef(studio.draft.url);
  useEffect(() => {
    if (prevUrlRef.current !== studio.draft.url) {
      prevUrlRef.current = studio.draft.url;
      onUrlChange(tabId, studio.draft.url);
    }
  }, [studio.draft.url, tabId, onUrlChange]);

  useImperativeHandle(
    ref,
    () => ({
      getConnectionState: () => {
        const s = studio.connection.state;
        return s === 'closing' ? 'connected' : s;
      },
      getUrl: () => studio.draft.url,
      getMessageCount: () => studio.messages.length,
    }),
    [studio.connection.state, studio.draft.url, studio.messages.length],
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

  const handleSwitchToConnect = useCallback(() => {
    changeViewTab('connect');
  }, [changeViewTab]);

  const handleEditConnection = useCallback(() => {
    studio.cancelReconnect();
    changeViewTab('connect');
  }, [studio, changeViewTab]);

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
    onStopReplay: recording.stopReplay,
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

  return (
    <div className="ws-conn-tab-content" data-testid={`conn-tab-content-${tabId}`}>
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

      {viewTab === 'connect' && (
        <div className="ws-studio-content">
          {isConnected && (
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
          )}
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
          />
          <WebSocketTlsPanel
            tlsConfig={studio.tlsConfig}
            onTlsChange={studio.setTlsConfig}
            isWss={resolvedUrl.toLowerCase().startsWith('wss://')}
            isProxyMode={hasCustomHeaders(studio.draft) || hasTlsOverrides(studio.tlsConfig)}
            disabled={isConnected}
          />
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
        </div>
      )}

      {viewTab === 'messages' && (
        <div className="ws-studio-content">
          <WebSocketMessageLog {...messageLogProps} />
          {showLoadTest && (
            <WebSocketLoadTest loadTest={loadTest} isConnected={isConnected} />
          )}
        </div>
      )}

      {viewTab === 'saved' && (
        <div className="ws-studio-content">
          <WebSocketSavedConnections
            profiles={profilesHook.profiles}
            loading={profilesHook.loading}
            error={profilesHook.error}
            onSaveProfile={profilesHook.saveProfile}
            onUpdateProfile={profilesHook.updateProfile}
            onDeleteProfile={profilesHook.deleteProfile}
            onDuplicateProfile={profilesHook.duplicateProfile}
            onImportProfiles={profilesHook.importProfiles}
            onExportProfiles={profilesHook.exportProfiles}
            onLoadProfile={handleLoadProfile}
            onApplyDraft={handleApplyDraft}
            onSwitchToConnect={handleSwitchToConnect}
            prefillDraft={profilePrefill}
            onPrefillDraftConsumed={handlePrefillConsumed}
          />
        </div>
      )}

      {viewTab === 'mock' && (
        <div className="ws-studio-content">
          <WebSocketMockServer mock={mockServer} />
        </div>
      )}
    </div>
  );
});
