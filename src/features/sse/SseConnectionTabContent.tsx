import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useSseConnection } from './useSseConnection';
import { useSseConsole } from './useSseConsole';
import { ConsolePanel } from '../websocket/ConsolePanel';
import { useConsoleCommands } from '../websocket/useConsoleCommands';
import { SSE_CONSOLE_COMMANDS, SSE_CONSOLE_HINT } from '../websocket/wsConsoleCommands';
import { SseMessageLog } from './SseMessageLog';
import { SseStudioShell } from './SseStudioShell';
import SseAuthPanel from './SseAuthPanel';
import { KeyValueEditor } from '../websocket/KeyValueEditor';
import type { WsKeyValueEntry } from '../../shared/websocket/types';
import type { AuthConfig, GlobalAuthProfile, Microservice } from '../../shared/types';
import { buildEnvVarMap } from '../../shared/utils/envVarUtils';
import { ProtocolEndpointPreview } from '../../shared/components/ProtocolEndpointPreview';
import { getRowStatus } from '../environments/utils/protocolEndpointUtils';
import type { SseConnectionState, SseConnectionTab, SseLeftTab, SseRightTab } from './sseTypes';

export interface SseConnectionTabContentHandle {
  disconnect: () => void;
  getConnectionState: () => SseConnectionState;
}

export interface SseConnectionTabContentProps {
  tabId: string;
  tab: SseConnectionTab;
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
  selectedSvc?: Microservice;
  selectedEnvId?: string;
  globalAuthProfiles: GlobalAuthProfile[];
  onConfigChange: (tabId: string, patch: Partial<SseConnectionTab>) => void;
  onConnectionStateChange: (tabId: string, state: SseConnectionState) => void;
}

function buildLegacySseEnvVarMap(
  resolvedBaseUrl?: string,
  envName?: string,
  svcName?: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  if (resolvedBaseUrl) {
    map.baseUrl = resolvedBaseUrl;
    map.sseUrl = resolvedBaseUrl;
  }
  if (envName) map.envName = envName;
  if (svcName) map.svcName = svcName;
  return map;
}

export const SseConnectionTabContent = forwardRef<SseConnectionTabContentHandle, SseConnectionTabContentProps>(
  function SseConnectionTabContent(
    {
      tabId,
      tab,
      resolvedBaseUrl,
      envName,
      svcName,
      selectedSvc,
      selectedEnvId,
      globalAuthProfiles,
      onConfigChange,
      onConnectionStateChange,
    },
    ref,
  ) {
    const envVarMap = useMemo(() => {
      if (selectedSvc && selectedEnvId) {
        return buildEnvVarMap(selectedSvc, selectedEnvId, 'sse', envName);
      }
      return buildLegacySseEnvVarMap(resolvedBaseUrl, envName, svcName);
    }, [selectedSvc, selectedEnvId, resolvedBaseUrl, envName, svcName]);

    const endpointProtocolStatus = useMemo(() => {
      if (selectedSvc && selectedEnvId) {
        return getRowStatus(selectedSvc, 'sse', selectedEnvId);
      }
      return undefined;
    }, [selectedSvc, selectedEnvId]);

    const sse = useSseConnection(envVarMap, globalAuthProfiles);
    const { config, setConfig, connection, events, stats, connect, disconnect } = sse;

    // Sync tab config → connection hook config on mount
    useEffect(() => {
      setConfig({
        url: tab.url,
        headers: tab.headers,
        auth: tab.auth,
        autoReconnect: tab.autoReconnect,
        maxRetries: tab.maxRetries,
      });
      // Only re-sync when the tab identity changes (switching tabs via persistence restore)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabId]);

    // Propagate config changes from the hook back to the tab model.
    // Skip the mount render: at that point config still holds useSseConnection
    // defaults (url: '', etc.) because Effect 1's setConfig hasn't re-rendered
    // yet. Firing onConfigChange with stale defaults would briefly overwrite
    // the tab's persisted values.
    const configSyncReady = useRef(false);
    useEffect(() => {
      if (!configSyncReady.current) {
        configSyncReady.current = true;
        return;
      }
      onConfigChange(tabId, {
        url: config.url,
        headers: config.headers,
        auth: config.auth,
        autoReconnect: config.autoReconnect,
        maxRetries: config.maxRetries,
      });
    }, [tabId, config.url, config.headers, config.auth, config.autoReconnect, config.maxRetries, onConfigChange]);

    // Report connection state changes upward for tab bar indicators
    const prevStateRef = useRef(connection.state);
    useEffect(() => {
      if (connection.state !== prevStateRef.current) {
        prevStateRef.current = connection.state;
        onConnectionStateChange(tabId, connection.state);
      }
    }, [tabId, connection.state, onConnectionStateChange]);

    // Expose imperative handle for parent (close-tab disconnect, etc.)
    useImperativeHandle(ref, () => ({
      disconnect,
      getConnectionState: () => connection.state,
    }), [disconnect, connection.state]);

    const sseConsole = useSseConsole({ connection, config, authProfiles: globalAuthProfiles });

    const isConnected = connection.state === 'connected';
    const isConnecting = connection.state === 'connecting';
    const isBusy = isConnected || isConnecting;

    const { runCommand: runConsoleCommand } = useConsoleCommands({
      append: sseConsole.append,
      clearConsole: sseConsole.clear,
      commands: SSE_CONSOLE_COMMANDS,
      capabilities: {
        isConnected,
        isConnecting,
        connect: (url) => {
          if (url) setConfig({ url });
          connect();
        },
        disconnect: () => disconnect(),
      },
    });

    const handleConnect = useCallback(() => {
      if (isBusy) disconnect();
      else connect();
    }, [isBusy, connect, disconnect]);

    const handleHeadersChange = useCallback(
      (headers: WsKeyValueEntry[]) => setConfig({ headers }),
      [setConfig],
    );

    const handleAuthChange = useCallback(
      (auth: AuthConfig) => setConfig({ auth }),
      [setConfig],
    );

    const handleLeftTabChange = useCallback(
      (lt: SseLeftTab) => onConfigChange(tabId, { leftTab: lt }),
      [tabId, onConfigChange],
    );

    const handleRightTabChange = useCallback(
      (rt: SseRightTab) => onConfigChange(tabId, { rightTab: rt }),
      [tabId, onConfigChange],
    );

    const authConfigured = !!config.auth && config.auth.type !== 'none';

    const stateLabel = (() => {
      switch (connection.state) {
        case 'idle': return 'Disconnected';
        case 'connecting': return 'Connecting\u2026';
        case 'connected': return 'Connected';
        case 'disconnected':
          return connection.reconnectAttempt > 0
            ? `Reconnecting (${connection.reconnectAttempt})\u2026`
            : 'Disconnected';
        case 'error': return `Error: ${connection.error ?? 'Unknown'}`;
        default: return 'Disconnected';
      }
    })();

    const stateClass = (() => {
      switch (connection.state) {
        case 'connected': return 'sse-state-connected';
        case 'connecting': return 'sse-state-connecting';
        case 'error': return 'sse-state-error';
        default: return 'sse-state-disconnected';
      }
    })();

    const urlControls = (
      <div className="sse-url-controls">
        <span className={`sse-state-dot ${stateClass}`} title={stateLabel} />
        <input
          className="sse-url-input"
          type="text"
          placeholder="https://api.example.com/events or {{sseUrl}}/events"
          value={config.url}
          onChange={(e) => setConfig({ url: e.target.value })}
          disabled={isBusy}
          data-testid="sse-url-input"
        />
        <button
          className={`sse-connect-btn ${isBusy ? 'sse-connect-btn-danger' : 'sse-connect-btn-primary'}`}
          onClick={handleConnect}
          disabled={!config.url.trim() && !isBusy}
          data-testid="sse-connect-btn"
        >
          {isBusy ? 'Disconnect' : 'Connect'}
        </button>
      </div>
    );

    const headersSection = (
      <KeyValueEditor
        entries={config.headers}
        onChange={handleHeadersChange}
        onDeleteAll={() => handleHeadersChange([])}
        disabled={isBusy}
        label="Headers"
        testIdPrefix="sse-headers"
        sectionClassName="sse-config-section"
        headerClassName="sse-config-section-head"
        labelClassName="sse-config-section-title"
      />
    );

    const reconnectSection = (
      <div className="sse-config-section">
        <span className="sse-config-section-title">Reconnect</span>
        <div className="sse-reconnect-card" data-testid="sse-reconnect-card">
          <label className="sse-toggle-row">
            <input
              type="checkbox"
              className="sse-toggle-checkbox"
              data-testid="sse-reconnect-toggle"
              checked={config.autoReconnect}
              onChange={(e) => setConfig({ autoReconnect: e.target.checked })}
              disabled={isBusy}
            />
            <span className="sse-toggle-text">
              <span className="sse-toggle-title">Auto-reconnect</span>
              <span className="sse-toggle-sub">Retry automatically on unexpected disconnect</span>
            </span>
          </label>
          {config.autoReconnect && (
            <div className="sse-retry-info">
              Retry interval <strong>{connection.retryMs}ms</strong> · Max <strong>{config.maxRetries}</strong> attempts
            </div>
          )}
        </div>
      </div>
    );

    const configBody = (
      <>
        {headersSection}
        {reconnectSection}
      </>
    );

    const authBody = (
      <SseAuthPanel
        auth={config.auth ?? { type: 'none' }}
        onChange={handleAuthChange}
        globalAuthProfiles={globalAuthProfiles}
      />
    );

    const messageLog = (
      <SseMessageLog
        events={events}
        stats={stats}
        bookmarkedIds={sse.bookmarkedIds}
        onToggleBookmark={sse.toggleBookmark}
        onClear={sse.clearEvents}
        lastEventId={events.length > 0 ? events[events.length - 1].lastEventId : connection.lastEventId}
        uptime={stats.startedAt}
      />
    );

    return (
      <SseStudioShell
        topBar={
          <div className="sse-url-row">
            {urlControls}
            <ProtocolEndpointPreview
              draftUrl={config.url}
              envVarMap={envVarMap}
              protocolRowStatus={endpointProtocolStatus}
              testId="sse-endpoint-preview"
            />
          </div>
        }
        statusStrip={
          <div className="sse-state-label" data-testid="sse-state-label">
            <span className={stateClass}>{stateLabel}</span>
            <span className="sse-auto-reconnect-badge">
              Auto-reconnect: {config.autoReconnect ? 'On' : 'Off'}
            </span>
            <span className="sse-auto-reconnect-badge">Events: {stats.eventCount}</span>
            {connection.lastEventId && (
              <span className="sse-auto-reconnect-badge">
                Last-Event-ID: {connection.lastEventId}
              </span>
            )}
          </div>
        }
        left={
          <div className="sse-config-body" data-testid="sse-config-body">
            {tab.leftTab === 'auth' ? authBody : configBody}
          </div>
        }
        leftTab={tab.leftTab}
        onLeftTabChange={handleLeftTabChange}
        authConfigured={authConfigured}
        rightTab={tab.rightTab}
        onRightTabChange={handleRightTabChange}
        right={
          tab.rightTab === 'console' ? (
            <ConsolePanel
              entries={sseConsole.entries}
              settings={sseConsole.settings}
              onSettingsChange={sseConsole.setSettings}
              onClear={sseConsole.clear}
              variant="sse"
              onCommand={runConsoleCommand}
              commandHint={SSE_CONSOLE_HINT}
            />
          ) : (
            messageLog
          )
        }
      />
    );
  },
);
