import type { WsReplaySpeed } from '@shared/websocket/types';
import { CustomSelect } from '@shared/components/CustomSelect';

interface WebSocketReplayBarProps {
  recordingState: 'idle' | 'recording' | 'replaying' | 'paused';
  replaySpeed: WsReplaySpeed;
  onSetReplaySpeed?: (speed: WsReplaySpeed) => void;
  replayProgress: { current: number; total: number; elapsedMs: number; durationMs: number } | null;
  onPauseReplay?: () => void;
  onResumeReplay?: () => void;
  onStopReplay?: () => void;
}

export function WebSocketReplayBar({
  recordingState,
  replaySpeed,
  onSetReplaySpeed,
  replayProgress,
  onPauseReplay,
  onResumeReplay,
  onStopReplay,
}: WebSocketReplayBarProps) {
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
          <CustomSelect
            className="ws-replay-speed"
            value={String(replaySpeed)}
            onChange={(value) => onSetReplaySpeed?.(Number(value) as WsReplaySpeed)}
            options={[
              { value: '1', label: '1×' },
              { value: '2', label: '2×' },
              { value: '5', label: '5×' },
              { value: '10', label: '10×' },
              { value: '0', label: 'Max' },
            ]}
            data-testid="replay-speed-select"
            aria-label="Replay speed"
          />
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
