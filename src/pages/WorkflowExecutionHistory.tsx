import { useState, useEffect } from 'react';

interface ExecutionResult {
  id: string;
  workflowId: string;
  triggerId: string;
  triggerType: 'webhook' | 'schedule';
  status: 'success' | 'failed' | 'error';
  duration: number;
  results: Array<{
    url: string;
    statusCode: number;
    responseTime: number;
    body?: string;
  }>;
  variables: Record<string, unknown>;
  timestamp: string;
  error?: string;
}

export default function WorkflowExecutionHistory() {
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'webhook' | 'schedule'>('all');

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/executions?limit=100');
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      setExecutions(data.executions || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load executions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load executions');
    } finally {
      setLoading(false);
    }
  };

  const filteredExecutions = executions.filter(exec => {
    if (filter === 'all') return true;
    return exec.triggerType === filter;
  });

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

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', color: '#666' }}>Loading executions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ backgroundColor: '#ffebee', padding: '16px', borderRadius: '8px', border: '1px solid #ef5350' }}>
          <div style={{ fontWeight: 'bold', color: '#c62828', marginBottom: '8px' }}>
            ❌ Error Loading Executions
          </div>
          <div style={{ color: '#d32f2f' }}>{error}</div>
          <div style={{ marginTop: '12px', fontSize: '0.9rem', color: '#666' }}>
            Make sure the webhook server is running: <code>npm run server</code>
          </div>
          <button
            onClick={loadExecutions}
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
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.8rem', color: '#333' }}>Workflow Execution History</h1>
          <p style={{ margin: 0, color: '#666' }}>
            {filteredExecutions.length} execution{filteredExecutions.length !== 1 ? 's' : ''}
            {executions.length > 0 && filter !== 'all' && ` (${executions.length} total)`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'webhook' | 'schedule')}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '0.95rem',
            }}
          >
            <option value="all">All Types</option>
            <option value="webhook">🪝 Webhooks</option>
            <option value="schedule">⏰ Schedules</option>
          </select>
          <button
            onClick={loadExecutions}
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

      {filteredExecutions.length === 0 ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          border: '2px dashed #ddd',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '1.2rem', color: '#666', marginBottom: '8px' }}>No executions found</div>
          <div style={{ fontSize: '0.95rem', color: '#999' }}>
            Trigger a webhook or wait for a schedule to see executions here
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedExecution ? '1fr 1fr' : '1fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredExecutions.map((exec) => (
              <div
                key={exec.id}
                onClick={() => setSelectedExecution(exec)}
                style={{
                  padding: '16px',
                  backgroundColor: selectedExecution?.id === exec.id ? '#e3f2fd' : 'white',
                  border: `2px solid ${selectedExecution?.id === exec.id ? '#2196f3' : '#e0e0e0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                      {exec.triggerType === 'webhook' ? '🪝' : '⏰'} {exec.workflowId}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      {formatTimestamp(exec.timestamp)}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '4px 12px',
                      backgroundColor: getStatusColor(exec.status),
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                    }}
                  >
                    {exec.status}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: '#666' }}>
                  <span>⏱️ {exec.duration}ms</span>
                  <span>📊 {exec.results.length} step{exec.results.length !== 1 ? 's' : ''}</span>
                  <span>🔑 {Object.keys(exec.variables).length} var{Object.keys(exec.variables).length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>

          {selectedExecution && (
            <div style={{
              padding: '20px',
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#333' }}>Execution Details</h2>
                <button
                  onClick={() => setSelectedExecution(null)}
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
                  <div style={{ color: '#666' }}>ID:</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{selectedExecution.id}</div>
                  
                  <div style={{ color: '#666' }}>Workflow:</div>
                  <div>{selectedExecution.workflowId}</div>
                  
                  <div style={{ color: '#666' }}>Trigger:</div>
                  <div>{selectedExecution.triggerType === 'webhook' ? '🪝 Webhook' : '⏰ Schedule'}</div>
                  
                  <div style={{ color: '#666' }}>Status:</div>
                  <div style={{ color: getStatusColor(selectedExecution.status), fontWeight: 'bold' }}>
                    {selectedExecution.status.toUpperCase()}
                  </div>
                  
                  <div style={{ color: '#666' }}>Duration:</div>
                  <div>{selectedExecution.duration}ms</div>
                  
                  <div style={{ color: '#666' }}>Time:</div>
                  <div>{formatTimestamp(selectedExecution.timestamp)}</div>
                </div>
              </div>

              {Object.keys(selectedExecution.variables).length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>Variables</div>
                  <pre style={{
                    backgroundColor: '#f5f5f5',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    overflow: 'auto',
                    margin: 0,
                  }}>
                    {JSON.stringify(selectedExecution.variables, null, 2)}
                  </pre>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>
                  Results ({selectedExecution.results.length})
                </div>
                {selectedExecution.results.map((result, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom: '12px',
                      padding: '12px',
                      backgroundColor: '#f9f9f9',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${result.statusCode >= 200 && result.statusCode < 300 ? '#4caf50' : '#f44336'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#333' }}>{result.url}</div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem' }}>
                        <span style={{ color: result.statusCode >= 200 && result.statusCode < 300 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
                          {result.statusCode}
                        </span>
                        <span style={{ color: '#666' }}>{result.responseTime.toFixed(2)}ms</span>
                      </div>
                    </div>
                    {result.body && (
                      <details>
                        <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>Response Body</summary>
                        <pre style={{
                          marginTop: '8px',
                          padding: '8px',
                          backgroundColor: '#fff',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          overflow: 'auto',
                          maxHeight: '200px',
                        }}>
                          {result.body}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              {selectedExecution.error && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#ffebee',
                  borderRadius: '6px',
                  border: '1px solid #ef5350',
                }}>
                  <div style={{ fontWeight: 'bold', color: '#c62828', marginBottom: '4px' }}>Error</div>
                  <div style={{ fontSize: '0.9rem', color: '#d32f2f', fontFamily: 'monospace' }}>
                    {selectedExecution.error}
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
