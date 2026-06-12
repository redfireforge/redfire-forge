import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WsBackoffMultiplier,
  WsCloseDetail,
  WsConnectionDraft,
  WsConnectionHistoryEntry,
  WsConnectionSnapshot,
  WsKeyValueEntry,
  WsReconnectState,
} from '../../shared/websocket/types';
import { formatUptime, WS_CLOSE_CODE_PRESETS } from '../../shared/websocket/types';
import type { WsProtocolMode, WsProtocolDetectionResult } from '../../shared/websocket/protocols/protocolTypes';
import type { SioServerParams } from './wsProtocolHelpers';
import { WebSocketProtocolSelector } from './WebSocketProtocolSelector';
import { resolveEffectiveProtocol } from '../../shared/websocket/protocols/protocolDetector';
import { getProtocolInfo } from '../../shared/websocket/protocols/protocolTypes';
import { isValidWsUrl, byteLength, hasUnresolvedVars, resolveEnvVars } from './wsMessageUtils';
import { useDropdownClose } from './useDropdownClose';
import { KeyValueEditor } from './KeyValueEditor';

const MAX_REASON_BYTES = 123;

interface WebSocketConnectPanelProps {
  draft: WsConnectionDraft;
  setDraft: (patch: Partial<WsConnectionDraft>) => void;
  connection: WsConnectionSnapshot;
  onConnect: () => void;
  onDisconnect: (detail?: WsCloseDetail) => void;
  uptime: number | null;
  sentCount: number;
  receivedCount: number;
  onSaveAsProfile?: () => void;
  configLocked?: boolean;
  autoReconnect?: boolean;
  onAutoReconnectChange?: (enabled: boolean) => void;
  reconnectState?: WsReconnectState;
  onCancelReconnect?: () => void;
  maxReconnectAttempts?: number;
  reconnectIntervalMs?: number;
  backoffMultiplier?: WsBackoffMultiplier;
  onMaxReconnectAttemptsChange?: (n: number) => void;
  onReconnectIntervalMsChange?: (ms: number) => void;
  onBackoffMultiplierChange?: (v: WsBackoffMultiplier) => void;
  onRetryNow?: () => void;
  onEditConnection?: () => void;
  resolvedUrl?: string;
  protocolMode?: WsProtocolMode;
  onProtocolModeChange?: (mode: WsProtocolMode) => void;
  detectedProtocol?: WsProtocolDetectionResult | null;
  sioServerParams?: SioServerParams | null;
  transportMode?: 'direct' | 'proxy' | 'native';
  envVarMap?: Record<string, string>;
  history?: WsConnectionHistoryEntry[];
  onHistorySelect?: (url: string, protocol: string) => void;
  onClearHistory?: () => void;
  /** When false, the Headers section is not rendered inline (it has been
   * relocated to a dedicated left-pane tab by the studio shell). Defaults to
   * true so the uncontrolled / flag-off layout is unchanged. */
  showHeaders?: boolean;
  /** When false, the Query Parameters section is not rendered inline (relocated
   * to a dedicated left-pane tab). Defaults to true. */
  showQueryParams?: boolean;
}

const STATE_LABELS: Record<string, { label: string; className: string }> = {
  disconnected: { label: 'Disconnected', className: 'state-disconnected' },
  connecting: { label: 'Connecting\u2026', className: 'state-connecting' },
  connected: { label: 'Connected', className: 'state-connected' },
  closing: { label: 'Closing\u2026', className: 'state-closing' },
  error: { label: 'Error', className: 'state-error' },
};

function useReconnectCountdown(nextRetryAt: number | null | undefined): number | null {
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  useEffect(() => {
    if (nextRetryAt == null) {
      setRemainingSec(null);
      return;
    }

    const tick = () => {
      const sec = Math.max(0, Math.ceil((nextRetryAt - Date.now()) / 1000));
      setRemainingSec(sec);
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [nextRetryAt]);

  return remainingSec;
}

export function WebSocketConnectPanel({
  draft,
  setDraft,
  connection,
  onConnect,
  onDisconnect,
  uptime,
  sentCount,
  receivedCount,
  onSaveAsProfile,
  configLocked = false,
  autoReconnect = false,
  onAutoReconnectChange,
  reconnectState,
  onCancelReconnect,
  maxReconnectAttempts = 5,
  reconnectIntervalMs = 3000,
  backoffMultiplier = 2,
  onMaxReconnectAttemptsChange,
  onReconnectIntervalMsChange,
  onBackoffMultiplierChange,
  onRetryNow,
  onEditConnection,
  resolvedUrl,
  protocolMode = 'auto',
  onProtocolModeChange,
  detectedProtocol = null,
  sioServerParams = null,
  transportMode = 'direct',
  envVarMap,
  history,
  onHistorySelect,
  onClearHistory,
  showHeaders = true,
  showQueryParams = true,
}: WebSocketConnectPanelProps) {
  const stateInfo = STATE_LABELS[connection.state] ?? STATE_LABELS.disconnected;
  const isConnected = connection.state === 'connected';
  const isConnecting = connection.state === 'connecting';
  const isBusy = isConnected || isConnecting || connection.state === 'closing';
  const isReconnecting = reconnectState?.active ?? false;
  const reconnectFailed =
    !isReconnecting &&
    reconnectState != null &&
    reconnectState.attempt > 0 &&
    reconnectState.attempt >= reconnectState.maxAttempts;
  const [downtimeLabel, setDowntimeLabel] = useState<string | null>(null);
  useEffect(() => {
    if (reconnectFailed && reconnectState?.lostAt) {
      setDowntimeLabel(formatUptime(Date.now() - reconnectState.lostAt));
    } else {
      setDowntimeLabel(null);
    }
  }, [reconnectFailed, reconnectState?.lostAt]);
  const inputsDisabled = isBusy || configLocked || isReconnecting;
  const rawUrlValid = isValidWsUrl(draft.url);
  const resolvedUrlValid = resolvedUrl ? isValidWsUrl(resolvedUrl) : false;
  const urlIsValid = rawUrlValid || resolvedUrlValid;
  const canConnect = draft.url.trim().length > 0 && urlIsValid && !isBusy && !isReconnecting;
  const canDisconnect = isConnected || isConnecting;
  const urlError = draft.url.trim().length > 0 && !urlIsValid;
  const canSaveAsProfile = draft.url.trim().length > 0 && rawUrlValid;
  const countdownSec = useReconnectCountdown(isReconnecting ? reconnectState?.nextRetryAt : null);
  const showEnvPreview = resolvedUrl && resolvedUrl !== draft.url.trim();
  const hasEnvVars = Object.keys(envVarMap ?? {}).length > 0;
  const urlHasUnresolved = resolvedUrl ? hasUnresolvedVars(resolvedUrl) : false;
  const evm = envVarMap ?? {};
  const headersHaveUnresolved = draft.headers.some(
    (h) => h.enabled && h.key.trim().length > 0 &&
      (hasUnresolvedVars(resolveEnvVars(h.key.trim(), evm)) || hasUnresolvedVars(resolveEnvVars(h.value, evm))),
  );
  const queryParamsHaveUnresolved = draft.queryParams.some(
    (p) => p.enabled && p.key.trim().length > 0 &&
      (hasUnresolvedVars(resolveEnvVars(p.key.trim(), evm)) || hasUnresolvedVars(resolveEnvVars(p.value, evm))),
  );
  const anyUnresolved = urlHasUnresolved || headersHaveUnresolved || queryParamsHaveUnresolved;
  const draftHasTemplates = draft.url.includes('{{') ||
    draft.headers.some((h) => h.value.includes('{{') || h.key.includes('{{')) ||
    draft.queryParams.some((p) => p.value.includes('{{') || p.key.includes('{{'));

  const [urlHistoryOpen, setUrlHistoryOpen] = useState(false);
  const urlHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!urlHistoryOpen) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (urlHistoryRef.current && !urlHistoryRef.current.contains(e.target as Node)) {
        setUrlHistoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [urlHistoryOpen]);

  const [closeDropdownOpen, setCloseDropdownOpen] = useState(false);
  const [closeCode, setCloseCode] = useState(1000);
  const [closeReason, setCloseReason] = useState('');
  const closeDropdownRef = useDropdownClose(
    closeDropdownOpen,
    useCallback(() => setCloseDropdownOpen(false), []),
  );

  const handleCloseWithCode = useCallback(() => {
    const reason = closeReason.trim();
    onDisconnect({ code: closeCode, reason: reason || undefined });
    setCloseDropdownOpen(false);
    setCloseCode(1000);
    setCloseReason('');
  }, [closeCode, closeReason, onDisconnect]);

  const reasonBytes = byteLength(closeReason);
  const isCodeValid = closeCode >= 1000 && closeCode <= 4999;
  const isReasonValid = reasonBytes <= MAX_REASON_BYTES;
  const canCloseWithCode = isConnected && isCodeValid && isReasonValid;

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ url: e.target.value }),
    [setDraft],
  );

  const handleSubprotocolsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ subprotocols: e.target.value }),
    [setDraft],
  );

  const handleClearUrl = useCallback(() => setDraft({ url: '' }), [setDraft]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canConnect) {
        e.preventDefault();
        onConnect();
      }
    },
    [canConnect, onConnect],
  );

  const handleHeadersChange = useCallback(
    (headers: WsKeyValueEntry[]) => setDraft({ headers }),
    [setDraft],
  );

  const handleQueryParamsChange = useCallback(
    (queryParams: WsKeyValueEntry[]) => setDraft({ queryParams }),
    [setDraft],
  );

  const statusDotClass = connection.state === 'connected' ? 'connected'
    : connection.state === 'connecting' ? 'connecting'
    : connection.state === 'closing' ? 'closing'
    : connection.state === 'error' ? 'error'
    : 'disconnected';

  return (
    <div className="ws-connect-panel">
      {/* URL row */}
      <div className="ws-connect-url-row">
        <label className="ws-connect-label" htmlFor="ws-url-input">URL</label>
        <div className="ws-connect-url-wrapper">
          <input
            id="ws-url-input"
            className="ws-connect-url-input"
            type="text"
            value={draft.url}
            onChange={handleUrlChange}
            onKeyDown={handleKeyDown}
            placeholder="ws://localhost:8765 or wss://..."
            disabled={inputsDisabled}
            autoComplete="off"
            spellCheck={false}
            aria-label="WebSocket URL"
          />
          {draft.url.length > 0 && !inputsDisabled && (
            <button
              className="ws-connect-clear-btn"
              onClick={handleClearUrl}
              title="Clear URL"
              aria-label="Clear URL"
            >
              ×
            </button>
          )}
          {history && history.length > 0 && !inputsDisabled && (
            <div className="ws-url-history-wrapper" ref={urlHistoryRef}>
              <button
                type="button"
                className="ws-url-history-trigger"
                onClick={() => setUrlHistoryOpen((p) => !p)}
                aria-label="Recent connections"
                data-testid="url-history-trigger"
                title="Recent connections"
              >
                ▾
              </button>
              {urlHistoryOpen && (
                <div className="ws-url-history-dropdown" data-testid="url-history-dropdown">
                  {history.map((entry) => (
                    <button
                      key={entry.url}
                      type="button"
                      className="ws-url-history-item"
                      onClick={() => {
                        setUrlHistoryOpen(false);
                        onHistorySelect?.(entry.url, entry.protocol);
                      }}
                      title={entry.url}
                      data-testid={`url-history-item`}
                    >
                      <span className="ws-url-history-item-url">{entry.url}</span>
                      {entry.protocol !== 'auto' && entry.protocol !== 'raw' && (
                        <span className="ws-url-history-item-protocol">{entry.protocol}</span>
                      )}
                    </button>
                  ))}
                  {onClearHistory && (
                    <button
                      type="button"
                      className="ws-url-history-clear"
                      onClick={() => {
                        onClearHistory();
                        setUrlHistoryOpen(false);
                      }}
                      data-testid="url-history-clear-btn"
                    >
                      Clear History
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {showEnvPreview && (
          <div className="ws-connect-env-preview" data-testid="env-preview">
            → Resolved: {resolvedUrl}
          </div>
        )}
        {anyUnresolved && hasEnvVars && (
          <div className="ws-connect-env-warning" data-testid="env-unresolved-warning">
            ⚠ Unresolved variables — check variable names match your environment
          </div>
        )}
        {!hasEnvVars && draftHasTemplates && (
          <div className="ws-connect-env-warning" data-testid="env-no-env-warning">
            No environment selected — variables will not be resolved
          </div>
        )}
        {urlError && (
          <span className="ws-connect-url-hint" data-testid="url-hint">
            URL must start with ws:// or wss://
          </span>
        )}
      </div>

      {/* Subprotocols */}
      <div className="ws-connect-field-row">
        <label className="ws-connect-label" htmlFor="ws-subprotocols-input">
          Subprotocols
        </label>
        <input
          id="ws-subprotocols-input"
          className="ws-connect-subprotocols"
          type="text"
          value={draft.subprotocols}
          onChange={handleSubprotocolsChange}
          placeholder="e.g. graphql-ws, json (comma-separated)"
          disabled={inputsDisabled}
          aria-label="Subprotocols"
        />
      </div>

      {/* Headers */}
      {showHeaders && (
        <KeyValueEditor
          entries={draft.headers}
          onChange={handleHeadersChange}
          onDeleteAll={() => handleHeadersChange([])}
          disabled={inputsDisabled}
          label="Headers"
          testIdPrefix="headers"
        />
      )}

      {/* Query Parameters */}
      {showQueryParams && (
        <KeyValueEditor
          entries={draft.queryParams}
          onChange={handleQueryParamsChange}
          onDeleteAll={() => handleQueryParamsChange([])}
          disabled={inputsDisabled}
          label="Query Parameters"
          testIdPrefix="query-params"
        />
      )}

      {/* Protocol */}
      <WebSocketProtocolSelector
        protocolMode={protocolMode}
        onProtocolModeChange={onProtocolModeChange ?? (() => {})}
        detectedProtocol={detectedProtocol}
        disabled={inputsDisabled}
      />

      {/* Auto-Reconnect Settings */}
      <div className="ws-reconnect-settings" data-testid="reconnect-settings">
        <div className="ws-reconnect-settings-header">
          <span className="ws-reconnect-settings-title">Auto-Reconnect Settings</span>
          <span className="ws-reconnect-settings-subtitle">Saved with connection profile</span>
        </div>
        <div className="ws-reconnect-settings-body">
          <label className="ws-connect-label ws-reconnect-label">
            <input
              type="checkbox"
              checked={autoReconnect}
              onChange={(e) => onAutoReconnectChange?.(e.target.checked)}
              disabled={inputsDisabled}
              className="ws-connect-kv-checkbox"
              data-testid="auto-reconnect-toggle"
            />
            <span>
              Auto-reconnect on unexpected disconnect
              <span className="ws-reconnect-label-sub">
                Automatically retry when the connection drops (close code ≠ 1000)
              </span>
            </span>
          </label>

          <div
            className={`ws-reconnect-settings-row${autoReconnect ? '' : ' ws-reconnect-settings-disabled'}`}
          >
            <div className="ws-reconnect-settings-field">
              <label className="ws-connect-label" htmlFor="ws-max-attempts">Max Attempts</label>
              <input
                id="ws-max-attempts"
                type="number"
                className="ws-connect-subprotocols"
                value={maxReconnectAttempts}
                onChange={(e) => onMaxReconnectAttemptsChange?.(Number(e.target.value) || 5)}
                min={1}
                max={50}
                disabled={inputsDisabled || !autoReconnect}
                data-testid="max-reconnect-attempts"
              />
              <span className="ws-reconnect-field-hint">Stop retrying after this many failures</span>
            </div>
            <div className="ws-reconnect-settings-field">
              <label className="ws-connect-label" htmlFor="ws-retry-interval">Retry Interval (ms)</label>
              <input
                id="ws-retry-interval"
                type="number"
                className="ws-connect-subprotocols"
                value={reconnectIntervalMs}
                onChange={(e) => onReconnectIntervalMsChange?.(Number(e.target.value) || 3000)}
                min={500}
                max={60000}
                step={500}
                disabled={inputsDisabled || !autoReconnect}
                data-testid="reconnect-interval-ms"
              />
              <span className="ws-reconnect-field-hint">Wait time between retry attempts</span>
            </div>
            <div className="ws-reconnect-settings-field">
              <label className="ws-connect-label" htmlFor="ws-backoff-multiplier">Backoff Multiplier</label>
              <select
                id="ws-backoff-multiplier"
                className="ws-connect-subprotocols"
                value={backoffMultiplier}
                onChange={(e) => onBackoffMultiplierChange?.(Number(e.target.value) as WsBackoffMultiplier)}
                disabled={inputsDisabled || !autoReconnect}
                data-testid="backoff-multiplier"
              >
                <option value={1}>None (fixed interval)</option>
                <option value={1.5}>1.5×</option>
                <option value={2}>2× (recommended)</option>
              </select>
              <span className="ws-reconnect-field-hint">Multiply interval after each failure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reconnect indicator */}
      {isReconnecting && reconnectState && (
        <div className="ws-reconnect-banner" data-testid="reconnect-banner">
          <span className="ws-reconnect-spinner" aria-hidden="true" />
          <div className="ws-reconnect-text">
            <strong>
              Reconnecting (attempt {reconnectState.attempt}/{reconnectState.maxAttempts})…
            </strong>
            <span className="ws-reconnect-countdown">
              {reconnectState.lostAt && (
                <>Connection lost at {new Date(reconnectState.lostAt).toLocaleTimeString()}. </>
              )}
              {countdownSec != null && (
                <>
                  Next retry in {countdownSec.toFixed(countdownSec < 10 ? 1 : 0)}s
                  {backoffMultiplier !== 1 ? ` (backoff: ${backoffMultiplier}×)` : ''}
                </>
              )}
            </span>
          </div>
          <div className="ws-reconnect-progress" data-testid="reconnect-progress">
            {Array.from({ length: reconnectState.maxAttempts }, (_, i) => {
              const attemptNum = i + 1;
              let dotClass = 'ws-reconnect-dot pending';
              if (attemptNum < reconnectState.attempt) dotClass = 'ws-reconnect-dot done';
              else if (attemptNum === reconnectState.attempt) dotClass = 'ws-reconnect-dot current';
              return <span key={attemptNum} className={dotClass} title={`Attempt ${attemptNum}`} />;
            })}
          </div>
          <button
            className="ws-reconnect-cancel-btn"
            onClick={onCancelReconnect}
            data-testid="cancel-reconnect-btn"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Reconnect failed indicator */}
      {reconnectFailed && reconnectState && (
        <div className="ws-reconnect-failed" data-testid="reconnect-failed">
          <span className="ws-reconnect-failed-icon" aria-hidden="true">⚠</span>
          <div className="ws-reconnect-failed-content">
            <div className="ws-reconnect-failed-title">
              Auto-reconnect failed after {reconnectState.maxAttempts} attempts
            </div>
            <div className="ws-reconnect-failed-error">
              {reconnectState.lastError && <>Last error: {reconnectState.lastError}. </>}
              {reconnectState.lostAt && downtimeLabel && (
                <>Total downtime: {downtimeLabel}</>
              )}
            </div>
          </div>
          <div className="ws-reconnect-failed-actions">
            {onRetryNow && (
              <button
                className="ws-connect-btn ws-connect-btn-primary"
                onClick={onRetryNow}
                data-testid="retry-now-btn"
              >
                Retry Now
              </button>
            )}
            {onEditConnection && (
              <button
                className="ws-connect-btn ws-connect-btn-secondary"
                onClick={onEditConnection}
                data-testid="edit-connection-btn"
              >
                Edit Connection
              </button>
            )}
          </div>
          <div className="ws-reconnect-progress ws-reconnect-progress-failed">
            {Array.from({ length: reconnectState.maxAttempts }, (_, i) => (
              <span key={i + 1} className="ws-reconnect-dot done" title={`Attempt ${i + 1} — failed`} />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="ws-connect-actions">
        <button
          className="ws-connect-btn ws-connect-btn-primary"
          onClick={onConnect}
          disabled={!canConnect}
          data-testid="connect-btn"
        >
          {isConnecting ? 'Connecting\u2026' : 'Connect'}
        </button>
        <div className="ws-disconnect-group" ref={closeDropdownRef}>
          <button
            className="ws-connect-btn ws-connect-btn-danger"
            onClick={() => onDisconnect()}
            disabled={!canDisconnect}
            data-testid="disconnect-btn"
          >
            Disconnect
          </button>
          <button
            className="ws-disconnect-caret"
            onClick={() => setCloseDropdownOpen((v) => !v)}
            disabled={!canDisconnect}
            title="Close with code..."
            data-testid="disconnect-caret"
            aria-label="Close with code"
          >
            ▾
          </button>
          {closeDropdownOpen && (
            <div className="ws-close-code-dropdown" data-testid="close-code-dropdown">
              <div className="ws-close-code-title">Close Connection with Code</div>
              <div className="ws-close-code-field">
                <label className="ws-close-code-label" htmlFor="ws-close-code-input">Code</label>
                <input
                  id="ws-close-code-input"
                  type="number"
                  className="ws-close-code-input"
                  value={closeCode}
                  onChange={(e) => setCloseCode(parseInt(e.target.value, 10) || 1000)}
                  min={1000}
                  max={4999}
                  data-testid="close-code-input"
                />
              </div>
              <div className="ws-close-code-presets" data-testid="close-code-presets">
                {WS_CLOSE_CODE_PRESETS.map((p) => (
                  <button
                    key={p.code}
                    className={`ws-close-preset-btn ${closeCode === p.code ? 'active' : ''}`}
                    onClick={() => setCloseCode(p.code)}
                    title={p.description}
                  >
                    {p.code} {p.label}
                  </button>
                ))}
              </div>
              <div className="ws-close-code-field">
                <label className="ws-close-code-label" htmlFor="ws-close-reason-input">Reason</label>
                <input
                  id="ws-close-reason-input"
                  type="text"
                  className="ws-close-reason-input"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="Optional close reason..."
                  maxLength={123}
                  data-testid="close-reason-input"
                />
                <span className={`ws-close-reason-counter ${!isReasonValid ? 'over' : ''}`}>
                  {reasonBytes}/{MAX_REASON_BYTES} bytes
                </span>
              </div>
              {!isCodeValid && (
                <span className="ws-close-code-error">Code must be 1000–4999</span>
              )}
              <div className="ws-close-code-actions">
                <button
                  className="ws-connect-btn ws-connect-btn-secondary"
                  onClick={() => setCloseDropdownOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="ws-connect-btn ws-connect-btn-danger"
                  onClick={handleCloseWithCode}
                  disabled={!canCloseWithCode}
                  data-testid="close-with-code-btn"
                >
                  Close with Code
                </button>
              </div>
            </div>
          )}
        </div>
        {onSaveAsProfile && (
          <button
            className="ws-connect-btn ws-connect-btn-secondary"
            onClick={onSaveAsProfile}
            disabled={!canSaveAsProfile}
            data-testid="save-as-profile-btn"
          >
            Save as Profile
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="ws-status-bar" data-testid="status-bar">
        <span className={`ws-status-dot ${statusDotClass}`} aria-hidden="true" />
        <span className={`ws-status-badge ${stateInfo.className}`} data-testid="status-badge">
          {stateInfo.label}
        </span>
        {isConnected && connection.url && (
          <span className="ws-status-metric ws-status-url" data-testid="connected-url" title={connection.url}>
            {connection.url}
          </span>
        )}
        {connection.latencyMs != null && (
          <span className="ws-status-metric" data-testid="latency">
            {connection.latencyMs}ms
          </span>
        )}
        {uptime != null && (
          <span className="ws-status-metric" data-testid="uptime">
            Uptime: {formatUptime(uptime)}
          </span>
        )}
        <span className="ws-status-metric" data-testid="counters">
          ↑ {sentCount} &nbsp; ↓ {receivedCount}
        </span>
        {connection.protocol && (
          <span className="ws-status-metric" data-testid="protocol">
            {connection.protocol}
          </span>
        )}
        {isConnected && (
          <span className="ws-protocol-badge" data-testid="protocol-badge">
            {getProtocolInfo(resolveEffectiveProtocol(protocolMode, detectedProtocol)).label}
          </span>
        )}
        {isConnected && (
          <span
            className={`ws-transport-badge ws-transport-${transportMode}`}
            data-testid="transport-badge"
          >
            {transportMode === 'native' ? 'Native' : transportMode === 'proxy' ? 'Proxy' : 'Direct'}
          </span>
        )}
        {isConnected && sioServerParams && (
          <span
            className="ws-status-metric ws-sio-params"
            data-testid="sio-server-params"
            title={`SID: ${sioServerParams.sid}\nPing interval: ${sioServerParams.pingInterval}ms\nPing timeout: ${sioServerParams.pingTimeout}ms`}
          >
            ping {sioServerParams.pingInterval / 1000}s / timeout {sioServerParams.pingTimeout / 1000}s
          </span>
        )}
      </div>

      {/* Error display */}
      {connection.state === 'error' && connection.lastError && (
        <div className="ws-connect-error" data-testid="connection-error">
          {connection.lastError}
        </div>
      )}
    </div>
  );
}
