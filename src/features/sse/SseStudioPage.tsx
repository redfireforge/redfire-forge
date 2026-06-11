import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSseConnection } from './useSseConnection';
import { useSseConsole } from './useSseConsole';
import { ConsolePanel } from '../websocket/ConsolePanel';
import { useConsoleCommands } from '../websocket/useConsoleCommands';
import { SSE_CONSOLE_COMMANDS, SSE_CONSOLE_HINT } from '../websocket/wsConsoleCommands';
import { SseMessageLog } from './SseMessageLog';
import { SseStudioShell } from './SseStudioShell';
import SseAuthPanel from './SseAuthPanel';
import { loadSseConfig, saveSseConfig } from './sseStorage';
import { KeyValueEditor } from '../websocket/KeyValueEditor';
import type { WsKeyValueEntry } from '../../shared/websocket/types';
import type { AuthConfig, GlobalAuthProfile } from '../../shared/types';
import type { SseLeftTab, SseRightTab } from './sseTypes';
import '../../styles/sse-studio.css';

interface SseStudioPageProps {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
  /**
   * Renders the redesigned split-pane shell (the only production layout).
   * Retained as an optional prop so the legacy stacked layout stays reachable
   * for tests; production callers always use the default (`true`).
   */
  shellV2?: boolean;
}

export function SseStudioPage({ resolvedBaseUrl, envName, svcName, globalAuthProfiles = [], shellV2 = true }: SseStudioPageProps) {
  const envVarMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (resolvedBaseUrl) map.baseUrl = resolvedBaseUrl;
    if (envName) map.envName = envName;
    if (svcName) map.svcName = svcName;
    return map;
  }, [resolvedBaseUrl, envName, svcName]);

  const sse = useSseConnection(envVarMap, globalAuthProfiles);
  const { config, setConfig, connection, events, stats, connect, disconnect } = sse;
  const sseConsole = useSseConsole({ connection, config, authProfiles: globalAuthProfiles });
  const [showHeaders, setShowHeaders] = useState(false);
  const [showReconnect, setShowReconnect] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  // Phase 8 — left-pane tab (Connect / Auth) for the shell-v2 layout.
  const [leftTab, setLeftTab] = useState<SseLeftTab>('connect');
  // Phase 9 — right-pane tab (Events / Console) for the shell-v2 layout.
  const [rightTab, setRightTab] = useState<SseRightTab>('events');

  // Phase 8: persist the whole SSE config (url/headers/reconnect/auth). Load
  // once on mount; only start saving after the load resolves so we never
  // overwrite a stored config with the initial defaults.
  const sseConfigLoadedRef = useRef(false);
  const sseSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSseConfig()
      .then((stored) => {
        if (cancelled) return;
        if (stored) setConfig(stored);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) sseConfigLoadedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [setConfig]);

  useEffect(() => {
    if (!sseConfigLoadedRef.current) return;
    if (sseSaveTimerRef.current) clearTimeout(sseSaveTimerRef.current);
    sseSaveTimerRef.current = setTimeout(() => {
      saveSseConfig(config);
    }, 300);
    return () => {
      if (sseSaveTimerRef.current) clearTimeout(sseSaveTimerRef.current);
    };
  }, [config]);

  // Flush the latest config on unmount so an edit made within the 300ms debounce
  // window isn't lost when navigating away (mirrors the WebSocket studio).
  const configRef = useRef(config);
  configRef.current = config;
  useEffect(() => {
    return () => {
      if (sseSaveTimerRef.current) clearTimeout(sseSaveTimerRef.current);
      if (!sseConfigLoadedRef.current) return;
      saveSseConfig(configRef.current);
    };
  }, []);


  const isConnected = connection.state === 'connected';
  const isConnecting = connection.state === 'connecting';
  const isBusy = isConnected || isConnecting;

  // Phase 10 — console command line (SSE: limited set — /connect /disconnect
  // /clear /help; the one-way stream has no /ping /send /template).
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
    if (isBusy) {
      disconnect();
    } else {
      connect();
    }
  }, [isBusy, connect, disconnect]);

  const handleHeadersChange = useCallback(
    (headers: WsKeyValueEntry[]) => {
      setConfig({ headers });
    },
    [setConfig],
  );

  const handleAuthChange = useCallback(
    (auth: AuthConfig) => {
      setConfig({ auth });
    },
    [setConfig],
  );

  const authConfigured = !!config.auth && config.auth.type !== 'none';

  const stateLabel = (() => {
    switch (connection.state) {
      case 'idle': return 'Disconnected';
      case 'connecting': return 'Connecting…';
      case 'connected': return 'Connected';
      case 'disconnected':
        return connection.reconnectAttempt > 0
          ? `Reconnecting (${connection.reconnectAttempt})…`
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

  // Shared between the legacy stacked layout and the Phase 7 split-pane shell.
  const urlControls = (
    <>
      <span className={`sse-state-dot ${stateClass}`} title={stateLabel} />
      <input
        className="sse-url-input"
        type="text"
        placeholder="https://api.example.com/events"
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
    </>
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
      <div className="sse-reconnect-card">
        <label className="sse-toggle-row">
          <input
            type="checkbox"
            className="sse-toggle-checkbox"
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

  // Both config sections, stacked. Used in the shell-v2 left pane where the
  // config is always visible.
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

  // Phase 7 split-pane shell (flag-gated): config on the left, events on the right.
  if (shellV2) {
    return (
      <div className="sse-studio" data-testid="sse-studio">
        <SseStudioShell
          topBar={<div className="sse-url-row">{urlControls}</div>}
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
              {leftTab === 'auth' ? authBody : configBody}
            </div>
          }
          leftTab={leftTab}
          onLeftTabChange={setLeftTab}
          authConfigured={authConfigured}
          rightTab={rightTab}
          onRightTabChange={setRightTab}
          right={
            rightTab === 'console' ? (
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
      </div>
    );
  }

  return (
    <div className="sse-studio" data-testid="sse-studio">
      {/* Connection panel */}
      <div className="sse-connect-panel" data-testid="sse-connect-panel">
        <div className="sse-url-row">
          {urlControls}
          <button
            className={`sse-headers-toggle ${showHeaders ? 'active' : ''}`}
            onClick={() => setShowHeaders((v) => !v)}
            title="Toggle headers"
            data-testid="sse-headers-toggle"
          >
            Headers {config.headers.length > 0 && `(${config.headers.length})`}
          </button>
          <button
            className={`sse-headers-toggle ${showReconnect ? 'active' : ''}`}
            onClick={() => setShowReconnect((v) => !v)}
            title="Toggle reconnect settings"
            data-testid="sse-reconnect-toggle"
          >
            Reconnect
          </button>
          <button
            className={`sse-headers-toggle ${showAuth ? 'active' : ''}`}
            onClick={() => setShowAuth((v) => !v)}
            title="Toggle auth settings"
            data-testid="sse-auth-toggle"
          >
            Auth {authConfigured && '●'}
          </button>
        </div>

        {/* Connection state label */}
        <div className="sse-state-label" data-testid="sse-state-label">
          <span className={stateClass}>{stateLabel}</span>
          {connection.state === 'connected' && (
            <span className="sse-auto-reconnect-badge">
              Auto-reconnect: {config.autoReconnect ? 'On' : 'Off'}
            </span>
          )}
        </div>

        {/* Headers panel */}
        {showHeaders && (
          <div className="sse-headers-panel" data-testid="sse-headers-panel">
            {headersSection}
          </div>
        )}

        {/* Reconnect panel */}
        {showReconnect && (
          <div className="sse-headers-panel" data-testid="sse-reconnect-panel">
            {reconnectSection}
          </div>
        )}

        {/* Auth panel */}
        {showAuth && (
          <div className="sse-headers-panel" data-testid="sse-auth-panel">
            {authBody}
          </div>
        )}
      </div>

      {/* Message log */}
      {messageLog}
    </div>
  );

}
