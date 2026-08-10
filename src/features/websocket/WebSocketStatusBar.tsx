import { formatUptime } from '../../shared/websocket/types';

interface WebSocketStatusBarProps {
  isConnected: boolean;
  connectionUrl?: string;
  uptime?: number | null;
  sentCount: number;
  receivedCount: number;
}

export function WebSocketStatusBar({
  isConnected,
  connectionUrl,
  uptime,
  sentCount,
  receivedCount,
}: WebSocketStatusBarProps) {
  const statusDotClass = isConnected ? 'connected' : 'disconnected';

  return (
    <div className="ws-messages-status-bar" data-testid="messages-status-bar">
      <span className={`ws-status-dot ${statusDotClass}`} aria-hidden="true" />
      <span className="ws-messages-status-label">{isConnected ? 'Connected' : 'Disconnected'}</span>
      {connectionUrl && (
        <span className="ws-messages-status-url" title={connectionUrl}>{connectionUrl}</span>
      )}
      {uptime != null && (
        <span className="ws-messages-status-metric">Uptime: {formatUptime(uptime)}</span>
      )}
      <span className="ws-messages-status-metric">↑ {sentCount} &nbsp; ↓ {receivedCount}</span>
      <span className="ws-messages-status-hints">↑↓ navigate · Esc close detail</span>
    </div>
  );
}
