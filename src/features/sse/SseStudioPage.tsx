import { useCallback, useMemo, useState } from 'react';
import { useSseConnection } from './useSseConnection';
import { SseMessageLog } from './SseMessageLog';
import '../../styles/sse-studio.css';

interface SseStudioPageProps {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
}

export function SseStudioPage({ resolvedBaseUrl, envName, svcName }: SseStudioPageProps) {
  const envVarMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (resolvedBaseUrl) map.baseUrl = resolvedBaseUrl;
    if (envName) map.envName = envName;
    if (svcName) map.svcName = svcName;
    return map;
  }, [resolvedBaseUrl, envName, svcName]);

  const sse = useSseConnection(envVarMap);
  const { config, setConfig, connection, events, stats, connect, disconnect } = sse;
  const [showHeaders, setShowHeaders] = useState(false);

  const isConnected = connection.state === 'connected';
  const isConnecting = connection.state === 'connecting';
  const isBusy = isConnected || isConnecting;

  const handleConnect = useCallback(() => {
    if (isBusy) {
      disconnect();
    } else {
      connect();
    }
  }, [isBusy, connect, disconnect]);

  const handleAddHeader = useCallback(() => {
    setConfig({
      headers: [...config.headers, { key: '', value: '' }],
    });
  }, [config.headers, setConfig]);

  const handleUpdateHeader = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      const next = [...config.headers];
      next[index] = { ...next[index], [field]: value };
      setConfig({ headers: next });
    },
    [config.headers, setConfig],
  );

  const handleRemoveHeader = useCallback(
    (index: number) => {
      setConfig({ headers: config.headers.filter((_, i) => i !== index) });
    },
    [config.headers, setConfig],
  );

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

  return (
    <div className="sse-studio" data-testid="sse-studio">
      {/* Connection panel */}
      <div className="sse-connect-panel" data-testid="sse-connect-panel">
        <div className="sse-url-row">
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
          <button
            className={`sse-headers-toggle ${showHeaders ? 'active' : ''}`}
            onClick={() => setShowHeaders((v) => !v)}
            title="Toggle headers"
            data-testid="sse-headers-toggle"
          >
            Headers {config.headers.length > 0 && `(${config.headers.length})`}
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
            {config.headers.map((h, i) => (
              <div key={i} className="sse-header-row">
                <input
                  className="sse-header-key"
                  placeholder="Header name"
                  value={h.key}
                  onChange={(e) => handleUpdateHeader(i, 'key', e.target.value)}
                  disabled={isBusy}
                />
                <input
                  className="sse-header-value"
                  placeholder="Value"
                  value={h.value}
                  onChange={(e) => handleUpdateHeader(i, 'value', e.target.value)}
                  disabled={isBusy}
                />
                <button
                  className="sse-header-remove"
                  onClick={() => handleRemoveHeader(i)}
                  disabled={isBusy}
                  aria-label="Remove header"
                  title="Remove header"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              className="sse-add-header-btn"
              onClick={handleAddHeader}
              disabled={isBusy}
              data-testid="sse-add-header"
            >
              + Add Header
            </button>
            <div className="sse-reconnect-row">
              <label className="sse-checkbox-label">
                <input
                  type="checkbox"
                  checked={config.autoReconnect}
                  onChange={(e) => setConfig({ autoReconnect: e.target.checked })}
                  disabled={isBusy}
                />
                Auto-reconnect
              </label>
              {config.autoReconnect && (
                <span className="sse-retry-info">
                  Retry: {connection.retryMs}ms / Max: {config.maxRetries}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Message log */}
      <SseMessageLog
        events={events}
        stats={stats}
        bookmarkedIds={sse.bookmarkedIds}
        onToggleBookmark={sse.toggleBookmark}
        onClear={sse.clearEvents}
        lastEventId={events.length > 0 ? events[events.length - 1].lastEventId : connection.lastEventId}
        uptime={stats.startedAt}
      />
    </div>
  );
}
