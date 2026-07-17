import { memo } from 'react';
import type { WsMetricsSnapshot } from './useWebSocketMetrics';
import { formatBytes } from '../../shared/websocket/types';

function Sparkline({ data, width = 120, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg className="ws-stats-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke="var(--ws-sparkline-color, #4fc3f7)" strokeWidth="1.5" />
    </svg>
  );
}

function FrameTypeBar({ text, binary, control }: { text: number; binary: number; control: number }) {
  const total = text + binary + control;
  if (total === 0) return <span className="ws-stats-no-data">No frames</span>;
  const pctText = Math.round((text / total) * 100);
  const pctBinary = Math.round((binary / total) * 100);
  const pctControl = 100 - pctText - pctBinary;
  return (
    <div className="ws-stats-frame-bar" data-testid="frame-type-bar">
      {pctText > 0 && (
        <div className="ws-stats-frame-seg ws-stats-frame-text" style={{ width: `${pctText}%` }} title={`Text: ${text} (${pctText}%)`}>
          {pctText >= 15 && `${pctText}%`}
        </div>
      )}
      {pctBinary > 0 && (
        <div className="ws-stats-frame-seg ws-stats-frame-binary" style={{ width: `${pctBinary}%` }} title={`Binary: ${binary} (${pctBinary}%)`}>
          {pctBinary >= 15 && `${pctBinary}%`}
        </div>
      )}
      {pctControl > 0 && (
        <div className="ws-stats-frame-seg ws-stats-frame-control" style={{ width: `${pctControl}%` }} title={`Control: ${control} (${pctControl}%)`}>
          {pctControl >= 15 && `${pctControl}%`}
        </div>
      )}
    </div>
  );
}

interface WebSocketStatsPanelProps {
  metrics: WsMetricsSnapshot;
}

export const WebSocketStatsPanel = memo(function WebSocketStatsPanel({ metrics }: WebSocketStatsPanelProps) {
  return (
    <div className="ws-stats-panel" data-testid="stats-panel">
      <div className="ws-stats-cards">
        <div className="ws-stats-card" data-testid="stats-msg-rate">
          <div className="ws-stats-card-label"><span className="ws-stats-card-icon">⚡</span> Msg/s</div>
          <div className="ws-stats-card-value">{metrics.msgPerSec}</div>
          <div className="ws-stats-card-detail">↑ {metrics.sentPerSec} &nbsp; ↓ {metrics.receivedPerSec}</div>
          <Sparkline data={metrics.history} />
        </div>

        <div className="ws-stats-card" data-testid="stats-bytes-in">
          <div className="ws-stats-card-label"><span className="ws-stats-card-icon">📥</span> Bytes In</div>
          <div className="ws-stats-card-value">{formatBytes(metrics.totalBytesIn)}</div>
          <div className="ws-stats-card-detail">{formatBytes(metrics.bytesInPerSec)}/s</div>
        </div>

        <div className="ws-stats-card" data-testid="stats-bytes-out">
          <div className="ws-stats-card-label"><span className="ws-stats-card-icon">📤</span> Bytes Out</div>
          <div className="ws-stats-card-value">{formatBytes(metrics.totalBytesOut)}</div>
          <div className="ws-stats-card-detail">{formatBytes(metrics.bytesOutPerSec)}/s</div>
        </div>

        <div className="ws-stats-card ws-stats-card-wide" data-testid="stats-frames">
          <div className="ws-stats-card-label"><span className="ws-stats-card-icon">📊</span> Frame Types</div>
          <FrameTypeBar text={metrics.textFrames} binary={metrics.binaryFrames} control={metrics.controlFrames} />
          <div className="ws-stats-card-legend">
            <span className="ws-stats-legend-item"><span className="ws-stats-legend-dot ws-stats-frame-text" /> Text {metrics.textFrames}</span>
            <span className="ws-stats-legend-item"><span className="ws-stats-legend-dot ws-stats-frame-binary" /> Binary {metrics.binaryFrames}</span>
            <span className="ws-stats-legend-item"><span className="ws-stats-legend-dot ws-stats-frame-control" /> Control {metrics.controlFrames}</span>
          </div>
        </div>

        {metrics.errorCount > 0 && (
          <div className="ws-stats-card ws-stats-card-error" data-testid="stats-errors">
            <div className="ws-stats-card-label">Errors</div>
            <div className="ws-stats-card-value">{metrics.errorCount}</div>
          </div>
        )}
      </div>
    </div>
  );
});
