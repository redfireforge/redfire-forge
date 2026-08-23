import { useState, useEffect, useRef } from 'react';
import type { WebhookDelivery } from '@shared/types/server-api';
import { formatTimestamp, formatPayload } from '../test-runner/utils/serverFormatters';
import { toErrorMessage } from '@shared/utils/helpers';
import { subscribeLogStream } from '../../utils/logStream';
import '../../styles/webhook-logs.css';

export default function WebhookDeliveryLogs() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    loadDeliveries(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const loadDeliveries = async (date: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/webhook-deliveries?date=${date}&_t=${Date.now()}`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      const list = data.deliveries || [];
      setDeliveries(list);
      if (list.length > 0 && !selectedDelivery) setSelectedDelivery(list[0]);
      setError(null);
    } catch (err) {
      console.error('Failed to load webhook deliveries:', err);
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh when new webhook deliveries arrive via SSE
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const loadDeliveriesRef = useRef(loadDeliveries);
  loadDeliveriesRef.current = loadDeliveries;

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const stop = subscribeLogStream(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const today = new Date().toISOString().split('T')[0];
        if (selectedDateRef.current === today) {
          loadDeliveriesRef.current(today);
        }
      }, 500);
    });
    return () => {
      if (debounce) clearTimeout(debounce);
      stop();
    };
  }, []);

  const sortedDeliveries = [...deliveries].sort((a, b) => {
    const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    return sortOrder === 'desc' ? diff : -diff;
  });

  const handleDateChange = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  if (loading) {
    return <div className="whl-loading">Loading webhook deliveries...</div>;
  }

  if (error) {
    return (
      <div className="whl-error-wrap">
        <div className="whl-error-card">
          <div className="whl-error-title">Error Loading Webhook Deliveries</div>
          <div className="whl-error-msg">{error}</div>
          <div className="whl-error-hint">
            Make sure the webhook server is running: <code>npm run server</code>
          </div>
          <button className="whl-btn whl-btn-primary" onClick={() => loadDeliveries(selectedDate)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="whl-container">
      {/* Header */}
      <div className="whl-header">
        <div>
          <h1 className="whl-title">Webhook Delivery Logs</h1>
          <p className="whl-subtitle">
            {deliveries.length} deliver{deliveries.length !== 1 ? 'ies' : 'y'} on {selectedDate}
            {deliveries.length > 1 && (
              <button
                type="button"
                className="sort-toggle-badge"
                onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                title={sortOrder === 'desc' ? 'Newest first — click to reverse' : 'Oldest first — click to reverse'}
              >
                {sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
              </button>
            )}
          </p>
        </div>
        <div className="whl-controls">
          <button className="whl-btn whl-btn-secondary" onClick={() => handleDateChange(-1)}>
            ← Prev
          </button>
          <input
            type="date"
            className="whl-date-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button
            className="whl-btn whl-btn-secondary"
            onClick={() => handleDateChange(1)}
            disabled={selectedDate >= new Date().toISOString().split('T')[0]}
          >
            Next →
          </button>
          <button className="whl-btn whl-btn-primary" onClick={() => loadDeliveries(selectedDate)}>
            Refresh
          </button>
        </div>
      </div>

      {/* Empty state */}
      {deliveries.length === 0 ? (
        <div className="whl-empty">
          <div className="whl-empty-icon">🪝</div>
          <div className="whl-empty-title">No webhook deliveries found</div>
          <div className="whl-empty-hint">Trigger a webhook on {selectedDate} to see deliveries here</div>
        </div>
      ) : (
        <div className={`whl-content ${selectedDelivery ? 'whl-content-split' : ''}`}>
          {/* Delivery list */}
          <div className="whl-list">
            {sortedDeliveries.map((delivery, idx) => (
              <button
                key={idx}
                type="button"
                className={`whl-card ${selectedDelivery?.triggerId === delivery.triggerId && selectedDelivery?.timestamp === delivery.timestamp ? 'whl-card-active' : ''}`}
                onClick={() => setSelectedDelivery(delivery)}
              >
                <div className="whl-card-header">
                  <span className="whl-method">{delivery.method.toUpperCase()}</span>
                  <span className="whl-trigger-id">{delivery.triggerId}</span>
                  <span className={`whl-badge whl-badge-${delivery.status}`}>
                    {delivery.status.toUpperCase()}
                  </span>
                </div>
                <div className="whl-card-meta">
                  <span className="whl-timestamp">{formatTimestamp(delivery.timestamp)}</span>
                  {delivery.duration != null && (
                    <span className="whl-duration">{delivery.duration}ms</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          {selectedDelivery && (
            <div className="whl-detail">
              <div className="whl-detail-header">
                <h2 className="whl-detail-title">Delivery Details</h2>
                <button className="whl-btn whl-btn-ghost" onClick={() => setSelectedDelivery(null)}>✕</button>
              </div>

              <div className="whl-detail-section">
                <h3 className="whl-detail-section-title">Info</h3>
                <div className="whl-info-grid">
                  <span className="whl-info-label">Trigger ID</span>
                  <span className="whl-info-value whl-mono">{selectedDelivery.triggerId}</span>

                  <span className="whl-info-label">Method</span>
                  <span className="whl-info-value">
                    <span className="whl-method">{selectedDelivery.method.toUpperCase()}</span>
                  </span>

                  <span className="whl-info-label">Status</span>
                  <span className="whl-info-value">
                    <span className={`whl-badge whl-badge-${selectedDelivery.status}`}>
                      {selectedDelivery.status.toUpperCase()}
                    </span>
                  </span>

                  {selectedDelivery.duration != null && (
                    <>
                      <span className="whl-info-label">Duration</span>
                      <span className="whl-info-value whl-duration">{selectedDelivery.duration}ms</span>
                    </>
                  )}

                  <span className="whl-info-label">Time</span>
                  <span className="whl-info-value">{formatTimestamp(selectedDelivery.timestamp)}</span>
                </div>
              </div>

              <div className="whl-detail-section">
                <h3 className="whl-detail-section-title">Payload</h3>
                <pre className="whl-payload">{formatPayload(selectedDelivery.payload)}</pre>
              </div>

              {selectedDelivery.error && (
                <div className="whl-detail-section">
                  <h3 className="whl-detail-section-title">Error</h3>
                  <div className="whl-error-block">
                    <code>{selectedDelivery.error}</code>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
