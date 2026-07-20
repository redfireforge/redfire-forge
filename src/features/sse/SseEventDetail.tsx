import type { SseEvent } from './sseTypes';

interface SseEventDetailProps {
  event: SseEvent;
  onClose: () => void;
}

function tryPrettyJson(data: string): { json: boolean; formatted: string } {
  try {
    const parsed = JSON.parse(data);
    return { json: true, formatted: JSON.stringify(parsed, null, 2) };
  } catch {
    return { json: false, formatted: data };
  }
}

export function SseEventDetail({ event, onClose }: SseEventDetailProps) {
  const { json, formatted } = tryPrettyJson(event.data);

  return (
    <div className="sse-detail" data-testid="sse-event-detail">
      <div className="sse-detail-header">
        <span className="sse-detail-title">Event Detail</span>
      </div>
      <div className="sse-detail-body">
        <div className="sse-detail-meta">
          <div className="sse-detail-row">
            <span className="sse-detail-label">Type</span>
            <span className={`sse-type-badge sse-type-${event.eventType}`}>{event.eventType}</span>
          </div>
          {event.lastEventId && (
            <div className="sse-detail-row">
              <span className="sse-detail-label">Last-Event-ID</span>
              <span className="sse-detail-value">{event.lastEventId}</span>
            </div>
          )}
          <div className="sse-detail-row">
            <span className="sse-detail-label">Size</span>
            <span className="sse-detail-value">{event.size} bytes</span>
          </div>
          <div className="sse-detail-row">
            <span className="sse-detail-label">Timestamp</span>
            <span className="sse-detail-value">{new Date(event.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
        <div className="sse-detail-data-header">Data {json && <span className="sse-detail-json-badge">JSON</span>}</div>
        <pre className="sse-detail-data">{formatted}</pre>
      </div>
      <div className="sse-detail-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
