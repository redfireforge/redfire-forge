import { formatUptime } from '../../shared/websocket/types';
import type { WsReplaySpeed } from '../../shared/websocket/types';

export function WebSocketMessagesStatusBar({
  isConnected,
  connectionUrl,
  uptime,
  sentCount,
  receivedCount,
}: {
  isConnected: boolean;
  connectionUrl?: string;
  uptime: number | null;
  sentCount: number;
  receivedCount: number;
}) {
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

export function WebSocketReplayBar({
  recordingState,
  replaySpeed,
  onSetReplaySpeed,
  replayProgress,
  onResumeReplay,
  onPauseReplay,
  onStopReplay,
}: {
  recordingState: 'idle' | 'recording' | 'replaying' | 'paused';
  replaySpeed: WsReplaySpeed;
  onSetReplaySpeed?: (speed: WsReplaySpeed) => void;
  replayProgress: { current: number; total: number; elapsedMs: number; durationMs: number } | null;
  onResumeReplay?: () => void;
  onPauseReplay?: () => void;
  onStopReplay?: () => void;
}) {
  return (
    <div className="ws-replay-bar" data-testid="replay-bar">
      <div className="ws-replay-bar-left">
        <span className="ws-replay-badge">
          <span className="ws-replay-dot" />
          REPLAY
        </span>
        <button
          className="ws-replay-playpause"
          onClick={recordingState === 'paused' ? onResumeReplay : onPauseReplay}
          data-testid="replay-playpause-btn"
          title={recordingState === 'paused' ? 'Resume replay' : 'Pause replay'}
          aria-label={recordingState === 'paused' ? 'Resume replay' : 'Pause replay'}
        >
          {recordingState === 'paused' ? '▶' : '⏸'}
        </button>
        <div className="ws-replay-speed-group">
          <span className="ws-replay-speed-label">Speed</span>
          <select
            className="ws-replay-speed"
            value={replaySpeed}
            onChange={(e) => onSetReplaySpeed?.(Number(e.target.value) as WsReplaySpeed)}
            data-testid="replay-speed-select"
            aria-label="Replay speed"
          >
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={5}>5×</option>
            <option value={10}>10×</option>
            <option value={0}>Max</option>
          </select>
        </div>
      </div>

      {replayProgress && (
        <div className="ws-replay-center" data-testid="replay-progress">
          <div className="ws-replay-track">
            <div
              className="ws-replay-fill"
              style={{ width: `${Math.min(100, (replayProgress.current / Math.max(replayProgress.total, 1)) * 100)}%` }}
            />
          </div>
          <span className="ws-replay-counter">
            <span className="ws-replay-counter-current">{replayProgress.current}</span>
            <span className="ws-replay-counter-sep">/</span>
            <span className="ws-replay-counter-total">{replayProgress.total}</span>
            <span className="ws-replay-counter-label">events</span>
          </span>
        </div>
      )}

      <button
        className="ws-replay-exit-btn"
        onClick={onStopReplay}
        data-testid="replay-exit-btn"
        title="Stop replay and return to live view"
        aria-label="Exit replay"
      >
        <span className="ws-replay-exit-icon">✕</span>
        Exit Replay
      </button>
    </div>
  );
}

export function WebSocketCompareBanner({
  compareIds,
  onCancel,
}: {
  compareIds: [string | null, string | null];
  onCancel: () => void;
}) {
  return (
    <div className="ws-compare-banner" data-testid="compare-banner">
      <span>
        {compareIds[0] === null
          ? 'Click a message to select it for comparison'
          : compareIds[1] === null
            ? 'Click a second message to compare'
            : 'Comparison ready'}
      </span>
      <button className="ws-compare-banner-cancel" onClick={onCancel} data-testid="compare-cancel">
        Cancel
      </button>
    </div>
  );
}
