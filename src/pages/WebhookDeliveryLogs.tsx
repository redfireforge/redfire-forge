import { useState, useEffect } from 'react';

interface WebhookDelivery {
  triggerId: string;
  method: string;
  payload: unknown;
  status: 'success' | 'failed' | 'error';
  duration?: number;
  timestamp: string;
  error?: string;
}

export default function WebhookDeliveryLogs() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to today in YYYY-MM-DD format
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    loadDeliveries(selectedDate);
  }, [selectedDate]);

  const loadDeliveries = async (date: string) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/webhook-deliveries?date=${date}`);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      setDeliveries(data.deliveries || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load webhook deliveries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load webhook deliveries');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#4caf50';
      case 'failed': return '#ff9800';
      case 'error': return '#f44336';
      default: return '#757575';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatPayload = (payload: unknown) => {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  const handleDateChange = (offset: number) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + offset);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', color: '#666' }}>Loading webhook deliveries...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ backgroundColor: '#ffebee', padding: '16px', borderRadius: '8px', border: '1px solid #ef5350' }}>
          <div style={{ fontWeight: 'bold', color: '#c62828', marginBottom: '8px' }}>
            ❌ Error Loading Webhook Deliveries
          </div>
          <div style={{ color: '#d32f2f' }}>{error}</div>
          <div style={{ marginTop: '12px', fontSize: '0.9rem', color: '#666' }}>
            Make sure the webhook server is running: <code>npm run server</code>
          </div>
          <button
            onClick={() => loadDeliveries(selectedDate)}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.8rem', color: '#333' }}>Webhook Delivery Logs</h1>
          <p style={{ margin: 0, color: '#666' }}>
            {deliveries.length} deliver{deliveries.length !== 1 ? 'ies' : 'y'} on {selectedDate}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => handleDateChange(-1)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            ← Previous Day
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '0.95rem',
            }}
          />
          <button
            onClick={() => handleDateChange(1)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
            disabled={selectedDate >= new Date().toISOString().split('T')[0]}
          >
            Next Day →
          </button>
          <button
            onClick={() => loadDeliveries(selectedDate)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '500',
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {deliveries.length === 0 ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          border: '2px dashed #ddd',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🪝</div>
          <div style={{ fontSize: '1.2rem', color: '#666', marginBottom: '8px' }}>No webhook deliveries found</div>
          <div style={{ fontSize: '0.95rem', color: '#999' }}>
            Trigger a webhook on {selectedDate} to see deliveries here
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedDelivery ? '1fr 1fr' : '1fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {deliveries.map((delivery, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedDelivery(delivery)}
                style={{
                  padding: '16px',
                  backgroundColor: selectedDelivery === delivery ? '#e3f2fd' : 'white',
                  border: `2px solid ${selectedDelivery === delivery ? '#2196f3' : '#e0e0e0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                      {delivery.method.toUpperCase()} 🪝 {delivery.triggerId}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      {formatTimestamp(delivery.timestamp)}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '4px 12px',
                      backgroundColor: getStatusColor(delivery.status),
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                    }}
                  >
                    {delivery.status}
                  </div>
                </div>
                {delivery.duration !== undefined && (
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    ⏱️ {delivery.duration}ms
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedDelivery && (
            <div style={{
              padding: '20px',
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#333' }}>Delivery Details</h2>
                <button
                  onClick={() => setSelectedDelivery(null)}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: '#f5f5f5',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>Info</div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '0.9rem' }}>
                  <div style={{ color: '#666' }}>Trigger ID:</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{selectedDelivery.triggerId}</div>
                  
                  <div style={{ color: '#666' }}>Method:</div>
                  <div style={{ fontWeight: 'bold' }}>{selectedDelivery.method.toUpperCase()}</div>
                  
                  <div style={{ color: '#666' }}>Status:</div>
                  <div style={{ color: getStatusColor(selectedDelivery.status), fontWeight: 'bold' }}>
                    {selectedDelivery.status.toUpperCase()}
                  </div>
                  
                  {selectedDelivery.duration !== undefined && (
                    <>
                      <div style={{ color: '#666' }}>Duration:</div>
                      <div>{selectedDelivery.duration}ms</div>
                    </>
                  )}
                  
                  <div style={{ color: '#666' }}>Time:</div>
                  <div>{formatTimestamp(selectedDelivery.timestamp)}</div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>Payload</div>
                <pre style={{
                  backgroundColor: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  overflow: 'auto',
                  margin: 0,
                  maxHeight: '300px',
                }}>
                  {formatPayload(selectedDelivery.payload)}
                </pre>
              </div>

              {selectedDelivery.error && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#ffebee',
                  borderRadius: '6px',
                  border: '1px solid #ef5350',
                }}>
                  <div style={{ fontWeight: 'bold', color: '#c62828', marginBottom: '4px' }}>Error</div>
                  <div style={{ fontSize: '0.9rem', color: '#d32f2f', fontFamily: 'monospace' }}>
                    {selectedDelivery.error}
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
