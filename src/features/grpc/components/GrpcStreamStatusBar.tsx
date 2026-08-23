import type { GrpcStreamLifecycle } from '@shared/grpc/streamLifecycle';

export interface GrpcStreamStatusBarProps {
  lifecycle: GrpcStreamLifecycle;
  inboundCount: number;
  outboundCount: number;
  startedAt?: string;
  endedAt?: string;
  onClear: () => void;
  onExport?: () => void;
  disabled?: boolean;
}

function formatElapsed(startedAt?: string, endedAt?: string): string {
  if (!startedAt) return '—';
  const startMs = Date.parse(startedAt);
  if (Number.isNaN(startMs)) return '—';
  const endMs = endedAt ? Date.parse(endedAt) : Date.now();
  const seconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function lifecycleLabel(lifecycle: GrpcStreamLifecycle): string {
  switch (lifecycle) {
    case 'idle':
      return 'Idle';
    case 'starting':
      return 'Starting…';
    case 'streaming':
      return 'Streaming';
    case 'ending':
      return 'Ending…';
    case 'ended':
      return 'Ended';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
      return 'Error';
    default:
      return lifecycle;
  }
}

export function GrpcStreamStatusBar({
  lifecycle,
  inboundCount,
  outboundCount,
  startedAt,
  endedAt,
  onClear,
  onExport,
  disabled = false,
}: GrpcStreamStatusBarProps) {
  const isLive = lifecycle === 'starting' || lifecycle === 'streaming' || lifecycle === 'ending';

  return (
    <div className="grpc-stream-status-bar" data-testid="grpc-stream-status-bar">
      <span
        className={`grpc-stream-status-badge grpc-stream-status-badge--${lifecycle}`}
        data-testid="grpc-stream-status-badge"
      >
        {lifecycleLabel(lifecycle)}
      </span>
      <span className="grpc-stream-status-count" data-testid="grpc-stream-inbound-count">
        ↓ {inboundCount}
      </span>
      <span className="grpc-stream-status-count" data-testid="grpc-stream-outbound-count">
        ↑ {outboundCount}
      </span>
      <span className="grpc-stream-status-elapsed" data-testid="grpc-stream-elapsed">
        {isLive ? 'Elapsed' : 'Duration'}: {formatElapsed(startedAt, endedAt)}
      </span>
      <button
        type="button"
        className="grpc-stream-export-btn"
        data-testid="grpc-stream-export-log-btn"
        disabled={disabled || inboundCount + outboundCount === 0 || !onExport}
        onClick={() => onExport?.()}
        aria-label="Export stream log as JSON"
      >
        Export log
      </button>
      <button
        type="button"
        className="grpc-stream-clear-btn"
        data-testid="grpc-stream-clear-log"
        disabled={disabled || inboundCount + outboundCount === 0}
        onClick={onClear}
        aria-label="Clear stream log"
      >
        Clear log
      </button>
    </div>
  );
}
