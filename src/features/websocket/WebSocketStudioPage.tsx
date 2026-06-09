import { useCallback, useMemo, useState } from 'react';
import { useWebSocketStudio } from './useWebSocketStudio';
import { useWebSocketProfiles } from '../../app/hooks/useWebSocketProfiles';
import { useWebSocketTemplates } from '../../app/hooks/useWebSocketTemplates';
import { WebSocketConnectPanel } from './WebSocketConnectPanel';
import { WebSocketMessageLog } from './WebSocketMessageLog';
import { WebSocketSavedConnections, type ProfilePrefillDraft } from './WebSocketSavedConnections';
import { WebSocketTlsPanel } from './WebSocketTlsPanel';
import type { WsConnectionDraft } from '../../shared/websocket/types';
import {
  buildEffectiveUrl,
  createDefaultTlsConfig,
  draftToProfileFields,
  hasCustomHeaders,
  hasTlsOverrides,
  resolveBackoffMultiplier,
} from '../../shared/websocket/types';
import { resolveEffectiveProtocol } from '../../shared/websocket/protocols/protocolDetector';
import { resolveEnvVars } from './wsMessageUtils';
import '../../styles/websocket-studio.css';

type WsStudioTab = 'connect' | 'messages' | 'saved';

export function WebSocketStudioPage() {
  const [activeTab, setActiveTab] = useState<WsStudioTab>('connect');
  const [profilePrefill, setProfilePrefill] = useState<ProfilePrefillDraft | null>(null);
  const studio = useWebSocketStudio();
  const profilesHook = useWebSocketProfiles();
  const templatesHook = useWebSocketTemplates();

  const isConnected = studio.connection.state === 'connected';
  const isGuardVisible =
    studio.connection.state === 'disconnected' && studio.draft.url.trim() === '';

  const resolvedUrl = useMemo(() => {
    const effective = buildEffectiveUrl(studio.draft);
    return resolveEnvVars(effective, {});
  }, [studio.draft]);

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
    setActiveTab('saved');
  }, [
    studio.draft,
    studio.maxMessages,
    studio.protocolMode,
    studio.autoReconnect,
    studio.maxReconnectAttempts,
    studio.reconnectIntervalMs,
    studio.backoffMultiplier,
    profilesHook.profiles.length,
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

  const handleSwitchToConnect = useCallback(() => {
    setActiveTab('connect');
  }, []);

  const handleEditConnection = useCallback(() => {
    studio.cancelReconnect();
    setActiveTab('connect');
  }, [studio]);

  const effectiveProtocol = resolveEffectiveProtocol(studio.protocolMode, studio.detectedProtocol);

  const messageLogProps = {
    messages: studio.filteredMessages,
    totalCount: studio.messages.length,
    maxMessages: studio.maxMessages,
    isMaxReached: studio.isMaxReached,
    searchText: studio.searchText,
    setSearchText: studio.setSearchText,
    directionFilter: studio.directionFilter,
    setDirectionFilter: studio.setDirectionFilter,
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
    showStatusBar: activeTab === 'messages',
    connectionUrl: studio.connection.url,
    uptime: studio.uptime,
    sentCount: studio.sentCount,
    receivedCount: studio.receivedCount,
  };

  return (
    <div className="ws-studio-page">
      <div className="ws-studio-tabs">
        <button
          className={`ws-studio-tab ${activeTab === 'connect' ? 'active' : ''}`}
          onClick={() => setActiveTab('connect')}
          data-testid="tab-connect"
        >
          Connect
        </button>
        <button
          className={`ws-studio-tab ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
          data-testid="tab-messages"
        >
          Messages
          {studio.messages.length > 0 && (
            <span className="ws-studio-tab-badge">{studio.messages.length}</span>
          )}
        </button>
        <button
          className={`ws-studio-tab ${activeTab === 'saved' ? 'active' : ''}`}
          onClick={() => setActiveTab('saved')}
          data-testid="tab-saved"
        >
          Saved
          {profilesHook.profiles.length > 0 && (
            <span className="ws-studio-tab-badge ws-studio-tab-badge-muted">
              {profilesHook.profiles.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'connect' && (
        <div className="ws-studio-content">
          {isConnected && (
            <div className="ws-config-lock-banner" data-testid="config-lock-banner">
              <span className="ws-config-lock-icon" aria-hidden="true">⊘</span>
              Connection settings are locked.
              <button
                type="button"
                className="ws-config-lock-disconnect"
                onClick={() => studio.disconnect()}
                data-testid="banner-disconnect-link"
              >
                Disconnect
              </button>
              to edit.
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
          />
          <WebSocketTlsPanel
            tlsConfig={studio.tlsConfig}
            onTlsChange={studio.setTlsConfig}
            isWss={studio.draft.url.trim().toLowerCase().startsWith('wss://')}
            isProxyMode={hasCustomHeaders(studio.draft) || hasTlsOverrides(studio.tlsConfig)}
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

      {activeTab === 'messages' && (
        <div className="ws-studio-content">
          <WebSocketMessageLog {...messageLogProps} />
        </div>
      )}

      {activeTab === 'saved' && (
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
    </div>
  );
}
