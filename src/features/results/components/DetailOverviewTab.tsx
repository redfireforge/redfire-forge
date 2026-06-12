import { useMemo } from 'react';
import type { ExecutionEvent } from '../../../shared/types';
import JsonTreeViewer from '../../../shared/components/JsonTreeViewer';
import { formatDurationMs } from '../../../shared/utils/formatDuration';
import { computeHistogramBins } from '../utils/responseTimeHistogram';

export interface OverviewTabProps {
  events: ExecutionEvent[];
  stats: {
    totalExecutions: number;
    passCount: number;
    failCount: number;
    passRate: number;
    avgDuration?: number;
    minDuration?: number;
    maxDuration?: number;
    p95Duration?: number;
    durations: number[];
    avgWaitDuration?: number;
  } | null;
  currentEvent: ExecutionEvent | null;
  selectedIteration?: number;
  onIterationClick: (iteration: number) => void;
}

export default function OverviewTab({ events, stats, currentEvent, selectedIteration, onIterationClick }: OverviewTabProps) {
  if (!stats) {
    return <div className="explorer-empty">No execution data available</div>;
  }

  return (
    <div className="explorer-overview">
      {/* Hero Stats */}
      <div className="explorer-hero-stats">
        <div className="hero-stat">
          <span className="hero-value" style={{ 
            color: stats.passRate === 100 ? '#22c55e' : stats.passRate === 0 ? '#ef4444' : '#f59e0b' 
          }}>
            {stats.passRate.toFixed(0)}%
          </span>
          <span className="hero-label">Pass Rate</span>
        </div>
        <div className="hero-divider" />
        <div className="hero-stat">
          <span className="hero-value">{stats.totalExecutions}</span>
          <span className="hero-label">Executions</span>
        </div>
        <div className="hero-divider" />
        <div className="hero-stat">
          <span className="hero-value">{formatDurationMs(stats.avgDuration)}</span>
          <span className="hero-label">Avg Duration</span>
        </div>
      </div>

      {/* Status Bar */}
      <div className="explorer-status-bar">
        {stats.passCount > 0 && (
          <div 
            className="status-segment pass" 
            style={{ width: `${(stats.passCount / stats.totalExecutions) * 100}%` }}
            title={`${stats.passCount} passed`}
          />
        )}
        {stats.failCount > 0 && (
          <div 
            className="status-segment fail" 
            style={{ width: `${(stats.failCount / stats.totalExecutions) * 100}%` }}
            title={`${stats.failCount} failed`}
          />
        )}
      </div>
      <div className="explorer-status-legend">
        {stats.passCount > 0 && <span className="legend-pass">✓ {stats.passCount}</span>}
        {stats.failCount > 0 && <span className="legend-fail">✗ {stats.failCount}</span>}
      </div>

      {/* Timing Stats */}
      {stats.avgDuration !== undefined && stats.totalExecutions > 1 && (
        <div className="explorer-timing-stats">
          <div className="timing-stat">
            <span className="timing-label">Min</span>
            <span className="timing-value">{formatDurationMs(stats.minDuration)}</span>
          </div>
          <div className="timing-stat">
            <span className="timing-label">Avg</span>
            <span className="timing-value">{formatDurationMs(stats.avgDuration)}</span>
          </div>
          <div className="timing-stat">
            <span className="timing-label">P95</span>
            <span className="timing-value">{formatDurationMs(stats.p95Duration)}</span>
          </div>
          <div className="timing-stat">
            <span className="timing-label">Max</span>
            <span className="timing-value">{formatDurationMs(stats.maxDuration)}</span>
          </div>
        </div>
      )}

      {/* Mini Duration Histogram */}
      {selectedIteration === undefined && stats.durations.length >= 3 && (
        <MiniDurationHistogram
          durations={stats.durations}
          events={events}
          avgDuration={stats.avgDuration}
          p95Duration={stats.p95Duration}
        />
      )}

      {/* CorrelationWait split timing */}
      {stats.avgWaitDuration !== undefined && (
        <div className="explorer-timing-split">
          <h4>Timing Breakdown</h4>
          <div className="timing-split-bar">
            <div
              className="timing-split-segment wait"
              style={{ flex: stats.avgWaitDuration }}
              title={`Avg wait: ${formatDurationMs(stats.avgWaitDuration)}`}
            />
            <div
              className="timing-split-segment processing"
              style={{ flex: Math.max(0, (stats.avgDuration ?? 0) - stats.avgWaitDuration) }}
              title={`Avg processing: ${formatDurationMs((stats.avgDuration ?? 0) - stats.avgWaitDuration)}`}
            />
          </div>
          <div className="timing-split-legend">
            <span className="legend-wait">Wait for Event: {formatDurationMs(stats.avgWaitDuration)}</span>
            <span className="legend-processing">Processing: {formatDurationMs(Math.max(0, (stats.avgDuration ?? 0) - stats.avgWaitDuration))}</span>
          </div>
        </div>
      )}

      {/* Webhook Input (for webhook trigger nodes) */}
      {currentEvent && currentEvent.details?.webhookInput && (
        <div className="explorer-webhook-input">
          <h4>Webhook Input</h4>
          {currentEvent.details.webhookInput.method && currentEvent.details.webhookInput.path && (
            <div className="webhook-endpoint">
              <span className="webhook-method">{currentEvent.details.webhookInput.method}</span>
              <span className="webhook-path">{currentEvent.details.webhookInput.path}</span>
            </div>
          )}
          <div className="webhook-payload">
            <JsonTreeViewer data={currentEvent.details.webhookInput.payload} defaultExpandDepth={3} maxHeight={300} />
          </div>
        </div>
      )}

      {/* WebSocket Details */}
      {currentEvent && currentEvent.details?.wsDetails && (
        <div className="exec-card">
          <div className="exec-card-header">
            <span className="exec-card-title">WebSocket Details</span>
            <span className={`exec-status-badge ${currentEvent.state === 'pass' ? 'success' : 'error'}`}>
              {currentEvent.nodeType === 'wsConnect' ? 'CONNECT' : currentEvent.nodeType === 'wsSend' ? 'SEND' : 'RECEIVE'}
            </span>
          </div>
          {currentEvent.details.wsDetails.url && (
            <div className="exec-endpoint">
              <span className="exec-method">WS</span>
              <span className="exec-url">{currentEvent.details.wsDetails.url}</span>
            </div>
          )}
          <div className="exec-kv-grid">
            <span className="exec-kv-label">Connection ID</span>
            <span className="exec-kv-value">{currentEvent.details.wsDetails.connectionId}</span>
            {currentEvent.details.wsDetails.protocol && (
              <>
                <span className="exec-kv-label">Protocol</span>
                <span className="exec-kv-value">{currentEvent.details.wsDetails.protocol}</span>
              </>
            )}
            {currentEvent.details.wsDetails.extensions && (
              <>
                <span className="exec-kv-label">Extensions</span>
                <span className="exec-kv-value">{currentEvent.details.wsDetails.extensions}</span>
              </>
            )}
            {currentEvent.details.wsDetails.messageType && (
              <>
                <span className="exec-kv-label">Message Type</span>
                <span className="exec-kv-value">{currentEvent.details.wsDetails.messageType}</span>
              </>
            )}
          </div>
          {currentEvent.details.wsDetails.bodyPreview && (
            <div className="exec-body-preview">
              <span className="exec-kv-label">Message</span>
              <pre className="exec-body-text">{currentEvent.details.wsDetails.bodyPreview}</pre>
            </div>
          )}
          {currentEvent.details.wsDetails.durationMs !== undefined && (
            <div className="exec-timing-row">
              <div className="exec-timing-bar-track">
                <div
                  className={`exec-timing-bar-fill ${currentEvent.state === 'fail' ? 'error' : ''}`}
                  style={{ width: `${Math.min(100, (currentEvent.details.wsDetails.durationMs / Math.max(stats?.maxDuration ?? 1, 1)) * 100)}%` }}
                />
              </div>
              <span className="exec-timing-label">{formatDurationMs(currentEvent.details.wsDetails.durationMs)}</span>
            </div>
          )}
          {currentEvent.details.wsDetails.failureClass && (
            <div className="exec-error">
              <span className="exec-error-icon">!</span>
              <span className="exec-error-text">Failure: {currentEvent.details.wsDetails.failureClass}</span>
            </div>
          )}
          {currentEvent.details.error && (
            <div className="exec-error">
              <span className="exec-error-icon">!</span>
              <span className="exec-error-text">{currentEvent.details.error}</span>
            </div>
          )}
        </div>
      )}

      {/* WS Trigger Details */}
      {currentEvent && currentEvent.details?.wsTriggerDetails && (
        <div className="exec-card">
          <div className="exec-card-header">
            <span className="exec-card-title">WS Trigger</span>
            <span className={`exec-status-badge ${currentEvent.state === 'pass' ? 'success' : 'error'}`}>
              {currentEvent.state === 'pass' ? 'MATCHED' : 'FAILED'}
            </span>
          </div>
          <div className="exec-endpoint">
            <span className="exec-method">WS</span>
            <span className="exec-url">{currentEvent.details.wsTriggerDetails.url}</span>
          </div>
          <div className="exec-kv-grid">
            <span className="exec-kv-label">Connection ID</span>
            <span className="exec-kv-value">{currentEvent.details.wsTriggerDetails.connectionId}</span>
            {currentEvent.details.wsTriggerDetails.messageType && (
              <>
                <span className="exec-kv-label">Message Type</span>
                <span className="exec-kv-value">{currentEvent.details.wsTriggerDetails.messageType}</span>
              </>
            )}
          </div>
          {currentEvent.details.error && (
            <div className="exec-error-banner">
              <span className="exec-error-icon">!</span>
              <span className="exec-error-text">{currentEvent.details.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Kafka Details */}
      {currentEvent && currentEvent.details?.kafkaDetails && (
        <div className="exec-card">
          <div className="exec-card-header">
            <span className="exec-card-title">Kafka Details</span>
            <span className={`exec-status-badge ${currentEvent.state === 'pass' ? 'success' : 'error'}`}>
              {currentEvent.nodeType === 'kafkaProduce' ? 'PRODUCE' : 'CONSUME'}
            </span>
          </div>
          <div className="exec-kv-grid">
            <span className="exec-kv-label">Topic</span>
            <span className="exec-kv-value">{currentEvent.details.kafkaDetails.topic}</span>
            {currentEvent.details.kafkaDetails.partition !== undefined && (
              <>
                <span className="exec-kv-label">Partition</span>
                <span className="exec-kv-value">{currentEvent.details.kafkaDetails.partition}</span>
              </>
            )}
            {currentEvent.details.kafkaDetails.durationMs !== undefined && (
              <>
                <span className="exec-kv-label">Duration</span>
                <span className="exec-kv-value">{formatDurationMs(currentEvent.details.kafkaDetails.durationMs)}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Current Event Details — Card Layout (skip for nodes with transport-specific cards above) */}
      {currentEvent && currentEvent.details && !currentEvent.details.wsDetails && !currentEvent.details.wsTriggerDetails && !currentEvent.details.kafkaDetails && !currentEvent.details.kafkaTriggerDetails && (
        <div className="exec-card">
          <div className="exec-card-header">
            <span className="exec-card-title">Last Execution</span>
            {currentEvent.details.statusCode !== undefined && (
              <span className={`exec-status-badge ${currentEvent.details.statusCode < 400 ? 'success' : 'error'}`}>
                {currentEvent.details.statusCode}
              </span>
            )}
          </div>

          {currentEvent.details.method && currentEvent.details.url && (
            <div className="exec-endpoint">
              <span className="exec-method">{currentEvent.details.method}</span>
              <span className="exec-url">{currentEvent.details.url}</span>
            </div>
          )}

          {(currentEvent.durationMs !== undefined || currentEvent.details.responseTimeMs !== undefined) && (
            <div className="exec-timing-row">
              <div className="exec-timing-bar-track">
                <div
                  className={`exec-timing-bar-fill ${currentEvent.details.statusCode !== undefined && currentEvent.details.statusCode >= 400 ? 'error' : ''}`}
                  style={{ width: `${Math.min(100, ((currentEvent.durationMs ?? 0) / Math.max(stats?.maxDuration ?? 1, 1)) * 100)}%` }}
                />
              </div>
              <span className="exec-timing-label">{formatDurationMs(currentEvent.durationMs)}</span>
            </div>
          )}

          {currentEvent.details.error && (
            <div className="exec-error">
              <span className="exec-error-icon">!</span>
              <span className="exec-error-text">{currentEvent.details.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Per-Iteration List (in aggregate view) */}
      {selectedIteration === undefined && events.length > 1 && (
        <div className="explorer-iteration-list">
          <h4>Per-Iteration Breakdown</h4>
          <div className="iteration-list-scroll">
            {events.map((event, i) => (
              <div 
                key={i}
                className={`iteration-row ${event.state}`}
                onClick={() => onIterationClick(i)}
              >
                <span className="iteration-num">#{i + 1}</span>
                <span className={`iteration-status ${event.state}`}>
                  {event.state === 'pass' ? '✓' : event.state === 'fail' ? '✗' : '○'}
                </span>
                <span className="iteration-duration">{formatDurationMs(event.durationMs)}</span>
                <span className="iteration-arrow">→</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mini Duration Histogram ──────────────────────────────────────────────────

interface MiniHistogramProps {
  durations: number[];
  events: ExecutionEvent[];
  avgDuration?: number;
  p95Duration?: number;
}

function MiniDurationHistogram({ durations, events, avgDuration, p95Duration }: MiniHistogramProps) {
  const bins = useMemo(() => computeHistogramBins(durations, 12), [durations]);
  const maxCount = useMemo(() => Math.max(...bins.map(b => b.count), 1), [bins]);

  const failDurations = useMemo(() => {
    return new Set(
      events.filter(e => e.state === 'fail' && e.durationMs !== undefined).map(e => e.durationMs!)
    );
  }, [events]);

  const binsWithFailRatio = useMemo(() => {
    if (failDurations.size === 0) return bins.map(b => ({ ...b, failCount: 0 }));
    return bins.map(bin => {
      let failCount = 0;
      for (const d of failDurations) {
        if (d >= bin.min && (d < bin.max || (bin === bins[bins.length - 1] && d <= bin.max))) {
          failCount++;
        }
      }
      return { ...bin, failCount };
    });
  }, [bins, failDurations]);

  if (bins.length === 0) return null;

  const rangeMin = bins[0].min;
  const rangeMax = bins[bins.length - 1].max;
  const rangeSpan = rangeMax - rangeMin || 1;

  const avgPct = avgDuration !== undefined ? ((avgDuration - rangeMin) / rangeSpan) * 100 : undefined;
  const p95Pct = p95Duration !== undefined ? ((p95Duration - rangeMin) / rangeSpan) * 100 : undefined;

  return (
    <div className="mini-histogram" data-testid="mini-histogram">
      <h4>Duration Distribution</h4>
      <div className="mini-histogram-chart">
        {binsWithFailRatio.map((bin, i) => {
          const heightPct = (bin.count / maxCount) * 100;
          const failPct = bin.count > 0 ? (bin.failCount / bin.count) * 100 : 0;
          return (
            <div
              key={i}
              className="mini-histogram-bar-wrap"
              title={`${formatDurationMs(bin.min)}–${formatDurationMs(bin.max)}: ${bin.count} exec (${bin.percent}%)${bin.failCount > 0 ? `, ${bin.failCount} failed` : ''}`}
            >
              <div className="mini-histogram-bar" style={{ height: `${heightPct}%` }}>
                {failPct > 0 && (
                  <div className="mini-histogram-bar-fail" style={{ height: `${failPct}%` }} />
                )}
              </div>
            </div>
          );
        })}
        {avgPct !== undefined && avgPct >= 0 && avgPct <= 100 && (
          <div
            className="mini-histogram-marker avg"
            style={{ left: `${avgPct}%` }}
            title={`Avg: ${formatDurationMs(avgDuration)}`}
          />
        )}
        {p95Pct !== undefined && p95Pct >= 0 && p95Pct <= 100 && (
          <div
            className="mini-histogram-marker p95"
            style={{ left: `${p95Pct}%` }}
            title={`P95: ${formatDurationMs(p95Duration)}`}
          />
        )}
      </div>
      <div className="mini-histogram-x-axis">
        <span>{formatDurationMs(rangeMin)}</span>
        <span>{formatDurationMs(rangeMax)}</span>
      </div>
      <div className="mini-histogram-legend">
        <span className="mini-legend-item pass-legend">Pass</span>
        {failDurations.size > 0 && <span className="mini-legend-item fail-legend">Fail</span>}
        <span className="mini-legend-item avg-legend">Avg</span>
        <span className="mini-legend-item p95-legend">P95</span>
      </div>
    </div>
  );
}
