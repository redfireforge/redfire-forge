import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Workflow, CorrelationWaitNodeData } from '../../workflow/types/workflow';
import type { CorrelationWaitRunnerConfig } from '../../../shared/types';
import { getByPath, setByPath } from '../../../shared/utils/jsonPath';

interface PausedCorrelation {
  correlationId: string;
  webhookPath: string;
  pausedAt: number;
  workflowId?: string;
  pausedNodeId?: string;
}

/** Generate sensible sample values for common field names */
function getSampleValue(fieldName: string): string {
  const lower = fieldName.toLowerCase();
  if (lower.includes('status')) return 'completed';
  if (lower.includes('state')) return 'success';
  if (lower.includes('amount')) return '100.00';
  if (lower.includes('currency')) return 'USD';
  if (lower.includes('timestamp') || lower.includes('date') || lower.includes('time')) return new Date().toISOString();
  if (lower.includes('message') || lower.includes('msg')) return 'Operation completed successfully';
  if (lower.includes('error')) return '';
  if (lower.includes('code')) return '200';
  if (lower.includes('name')) return 'Sample Name';
  if (lower.includes('email')) return 'test@example.com';
  if (lower.includes('url') || lower.includes('link')) return 'https://example.com';
  return `sample_${fieldName}`;
}

/** Build a curl command for testing a webhook with actual correlation ID */
function buildCurlCommand(webhookUrl: string, data: CorrelationWaitNodeData, correlationId: string): string {
  const payload: Record<string, unknown> = {};
  
  // Add correlation ID based on source
  if (data.correlationSource === 'body' && data.correlationJsonPath) {
    const path = data.correlationJsonPath.replace(/^\$\.?/, '');
    const keys = path.split('.');
    let current = payload;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = current[keys[i]] || {};
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = correlationId;
  }
  
  // Add extract variables with realistic sample values
  for (const ev of data.extractVariables ?? []) {
    if (ev.name && ev.jsonPath) {
      const path = ev.jsonPath.replace(/^\$\.?/, '');
      const keys = path.split('.');
      let current = payload;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = current[keys[i]] || {};
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = getSampleValue(ev.name);
    }
  }

  const jsonPayload = JSON.stringify(payload, null, 2);
  
  // Build curl based on correlation source
  if (data.correlationSource === 'header') {
    const header = data.correlationHeader || 'X-Correlation-Id';
    return `curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -H '${header}: ${correlationId}' \\
  -d '${jsonPayload}'`;
  }
  
  if (data.correlationSource === 'query') {
    const param = data.correlationQueryParam || 'correlationId';
    return `curl -X POST '${webhookUrl}?${param}=${correlationId}' \\
  -H 'Content-Type: application/json' \\
  -d '${jsonPayload}'`;
  }
  
  // Default: body
  return `curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -d '${jsonPayload}'`;
}

interface CorrelationWaitNode {
  id: string;
  label: string;
  data: CorrelationWaitNodeData;
}

interface Props {
  workflow: Workflow;
  config: CorrelationWaitRunnerConfig | undefined;
  onChange: (config: CorrelationWaitRunnerConfig | undefined) => void;
  disabled?: boolean;
}

const MODE_OPTIONS: { value: CorrelationWaitRunnerConfig['mode']; label: string; hint: string }[] = [
  { value: 'auto-resume', label: 'Auto-Resume (Skip Wait)', hint: 'Immediately resume with mock payload — for CI/load tests' },
  { value: 'synthetic-inject', label: 'Synthetic Inject (Delayed)', hint: 'Resume with mock payload after configurable delay' },
  { value: 'wait-for-real', label: 'Wait for Real Webhook', hint: 'Actually wait for external callbacks (not recommended for load tests)' },
];

/** Build a default mock payload based on the CorrelationWait node's extract variables */
function buildDefaultMockPayload(data: CorrelationWaitNodeData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  
  // Add correlation ID field using {{correlationId}} placeholder
  if (data.correlationSource === 'body' && data.correlationJsonPath) {
    const path = data.correlationJsonPath.replace(/^\$\.?/, '');
    const keys = path.split('.');
    let current = payload;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = current[keys[i]] || {};
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = '{{correlationId}}';
  }
  
  // Add extract variables with sample values
  for (const ev of data.extractVariables ?? []) {
    if (ev.name && ev.jsonPath) {
      const path = ev.jsonPath.replace(/^\$\.?/, '');
      const keys = path.split('.');
      let current = payload;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = current[keys[i]] || {};
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = getSampleValue(ev.name);
    }
  }
  
  return payload;
}

export default function CorrelationWaitConfigPanel({ workflow, config, onChange, disabled }: Props) {
  const [curlModal, setCurlModal] = useState<{ node: CorrelationWaitNode; url: string; correlationId: string; isPlaceholder?: boolean } | null>(null);
  const [pausedCorrelations, setPausedCorrelations] = useState<PausedCorrelation[]>([]);
  const [loadingPaused, setLoadingPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Find all CorrelationWait nodes in the workflow
  const correlationNodes = useMemo<CorrelationWaitNode[]>(() => {
    return workflow.nodes
      .filter(n => n.type === 'correlationWait')
      .map(n => ({
        id: n.id,
        label: (n.data as CorrelationWaitNodeData).label || 'CorrelationWait',
        data: n.data as CorrelationWaitNodeData,
      }));
  }, [workflow]);

  // Fetch currently paused correlations from the server
  const fetchPausedCorrelations = useCallback(async () => {
    setLoadingPaused(true);
    try {
      const host = window.location.hostname || 'localhost';
      const res = await fetch(`http://${host}:3001/api/correlations`);
      if (res.ok) {
        const data = await res.json();
        setPausedCorrelations(data.correlations ?? []);
      }
    } catch {
      // Server may not be running
    } finally {
      setLoadingPaused(false);
    }
  }, []);

  // Poll for paused correlations when in wait-for-real mode
  useEffect(() => {
    if (config?.mode !== 'wait-for-real') return;
    fetchPausedCorrelations();
    const interval = setInterval(fetchPausedCorrelations, 3000);
    return () => clearInterval(interval);
  }, [config?.mode, fetchPausedCorrelations]);

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // No CorrelationWait nodes — don't show the section
  if (correlationNodes.length === 0) return null;

  // When config is undefined, we default to 'auto-resume' for load tests
  // But we need to track if user explicitly selected 'wait-for-real'
  const effectiveMode = config?.mode ?? 'auto-resume';

  const handleModeChange = (mode: CorrelationWaitRunnerConfig['mode']) => {
    if (mode === 'wait-for-real') {
      // For wait-for-real, we still store a config object with the mode
      // so the selection is preserved in the UI
      onChange({ mode: 'wait-for-real' });
    } else {
      // Initialize mock payloads for each node
      const mockPayloads: Record<string, Record<string, unknown>> = {};
      for (const node of correlationNodes) {
        mockPayloads[node.id] = config?.mockPayloads?.[node.id] ?? buildDefaultMockPayload(node.data);
      }
      onChange({
        mode,
        mockPayloads,
        syntheticDelayMs: config?.syntheticDelayMs ?? 2000,
        syntheticJitterMs: config?.syntheticJitterMs ?? 500,
      });
    }
  };

  const handleMockPayloadChange = (nodeId: string, payloadStr: string) => {
    if (!config) return;
    try {
      const payload = JSON.parse(payloadStr);
      onChange({
        ...config,
        mockPayloads: {
          ...config.mockPayloads,
          [nodeId]: payload,
        },
      });
    } catch {
      // Invalid JSON — ignore
    }
  };

  // Get mode label for collapsed summary
  const modeLabel = MODE_OPTIONS.find(o => o.value === effectiveMode)?.label ?? 'Auto-Resume';

  return (
    <div className={`config-section wf-runner-correlation-section ${isCollapsed ? 'wf-runner-correlation-collapsed' : ''}`}>
      <div 
        className="config-section-header wf-runner-correlation-header-clickable"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span className="config-section-icon">⚡</span>
        <h3>CorrelationWait Behavior</h3>
        <span className="config-section-badge">{correlationNodes.length} node{correlationNodes.length > 1 ? 's' : ''}</span>
        {isCollapsed && <span className="wf-runner-correlation-summary">({modeLabel})</span>}
        <button
          type="button"
          className="wf-runner-correlation-toggle"
          onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isCollapsed ? (
              <polyline points="6 9 12 15 18 9" />
            ) : (
              <polyline points="18 15 12 9 6 15" />
            )}
          </svg>
        </button>
      </div>
      
      {!isCollapsed && (
        <>
          <p className="config-hint">
            This workflow has CorrelationWait nodes that pause for external webhook callbacks.
            Configure how they behave during load tests.
          </p>

          <div className="wf-runner-correlation-modes">
        {MODE_OPTIONS.map(opt => (
          <label
            key={opt.value}
            className={`wf-runner-correlation-mode ${effectiveMode === opt.value ? 'wf-runner-correlation-mode-selected' : ''}`}
          >
            <input
              type="radio"
              name="correlationWaitMode"
              value={opt.value}
              checked={effectiveMode === opt.value}
              onChange={() => handleModeChange(opt.value)}
              disabled={disabled}
            />
            <span className="wf-runner-correlation-mode-radio" />
            <span className="wf-runner-correlation-mode-content">
              <span className="wf-runner-correlation-mode-label">{opt.label}</span>
              <span className="wf-runner-correlation-mode-hint">{opt.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {/* Synthetic Inject timing options */}
      {effectiveMode === 'synthetic-inject' && (
        <div className="wf-runner-correlation-timing">
          <div className="wf-runner-correlation-field">
            <label>Delay (ms)</label>
            <input
              type="number"
              min={0}
              max={60000}
              value={config?.syntheticDelayMs ?? 2000}
              onChange={(e) => onChange({
                ...config!,
                syntheticDelayMs: parseInt(e.target.value) || 0,
              })}
              disabled={disabled}
            />
            <span className="config-hint">Base delay before injecting mock payload</span>
          </div>
          <div className="wf-runner-correlation-field">
            <label>Jitter (±ms)</label>
            <input
              type="number"
              min={0}
              max={10000}
              value={config?.syntheticJitterMs ?? 500}
              onChange={(e) => onChange({
                ...config!,
                syntheticJitterMs: parseInt(e.target.value) || 0,
              })}
              disabled={disabled}
            />
            <span className="config-hint">Random variance added to delay</span>
          </div>
        </div>
      )}

      {/* Wait for Real Webhook info */}
      {effectiveMode === 'wait-for-real' && (
        <div className="wf-runner-correlation-webhook-info">
          <h4>Webhook Endpoint Information</h4>
          <p className="config-hint">
            For real webhook mode, external systems must POST to the webhook server.
            Ensure the webhook server is running (<code>npm run server</code>).
          </p>
          <div className="wf-runner-webhook-urls">
            {correlationNodes.map(node => {
              const webhookPath = node.data.webhookPath || '/webhooks/callback';
              const fullPath = webhookPath.startsWith('/webhooks/callback') 
                ? webhookPath 
                : `/webhooks/callback${webhookPath.startsWith('/') ? '' : '/'}${webhookPath}`;
              const fullUrl = `http://localhost:3001${fullPath}`;
              // Find first matching paused correlation for this webhook path
              const matchingPaused = pausedCorrelations.find(pc => pc.webhookPath === fullPath);
              return (
                <div key={node.id} className="wf-runner-webhook-url-row">
                  <span className="wf-runner-webhook-label">{node.label}</span>
                  <div className="wf-runner-webhook-url-box">
                    <code className="wf-runner-webhook-url">{fullUrl}</code>
                    <button
                      type="button"
                      className="wf-runner-webhook-copy-btn"
                      onClick={() => navigator.clipboard.writeText(fullUrl)}
                      title="Copy URL"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  </div>
                  <span className="wf-runner-webhook-method">POST</span>
                  <button
                    type="button"
                    className="wf-runner-webhook-curl-btn"
                    onClick={() => setCurlModal({
                      node,
                      url: fullUrl,
                      // Use actual correlation ID if paused, otherwise generate a sample UUID
                      correlationId: matchingPaused?.correlationId ?? crypto.randomUUID(),
                      isPlaceholder: !matchingPaused,
                    })}
                    title={matchingPaused ? 'View curl command with actual correlation ID' : 'View curl command template (start a workflow to get a real correlation ID)'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                    curl
                  </button>
                </div>
              );
            })}
          </div>

          {/* Currently Paused Correlations - only show when there are paused workflows */}
          {pausedCorrelations.length > 0 && (
            <div className="wf-runner-paused-correlations">
              <div className="wf-runner-paused-header">
                <span>Currently Paused Workflows</span>
                <button
                  type="button"
                  className="wf-runner-paused-refresh"
                  onClick={fetchPausedCorrelations}
                  disabled={loadingPaused}
                  title="Refresh"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                </button>
              </div>
              <div className="wf-runner-paused-list">
                {pausedCorrelations.map((pc, idx) => (
                  <div key={`${pc.correlationId}-${idx}`} className="wf-runner-paused-item">
                    <code className="wf-runner-paused-id">{pc.correlationId}</code>
                    <span className="wf-runner-paused-path">{pc.webhookPath}</span>
                    <button
                      type="button"
                      className="wf-runner-paused-use-btn"
                      onClick={() => {
                        // Find the matching node for this webhook path
                        const matchingNode = correlationNodes.find(n => {
                          const nodePath = n.data.webhookPath || '/webhooks/callback';
                          const fullNodePath = nodePath.startsWith('/webhooks/callback')
                            ? nodePath
                            : `/webhooks/callback${nodePath.startsWith('/') ? '' : '/'}${nodePath}`;
                          return pc.webhookPath === fullNodePath;
                        });
                        if (matchingNode) {
                          const webhookPath = matchingNode.data.webhookPath || '/webhooks/callback';
                          const fullPath = webhookPath.startsWith('/webhooks/callback')
                            ? webhookPath
                            : `/webhooks/callback${webhookPath.startsWith('/') ? '' : '/'}${webhookPath}`;
                          const fullUrl = `http://localhost:3001${fullPath}`;
                          setCurlModal({ node: matchingNode, url: fullUrl, correlationId: pc.correlationId });
                        }
                      }}
                      title="Generate curl with this correlation ID"
                    >
                      curl
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="wf-runner-webhook-payload-hint">
            <strong>Payload Requirements:</strong>
            <ul>
              {correlationNodes.map(node => {
                const source = node.data.correlationSource || 'body';
                let hint = '';
                if (source === 'body') {
                  hint = `Include correlation ID at JSONPath: ${node.data.correlationJsonPath || '$.correlationId'}`;
                } else if (source === 'header') {
                  hint = `Include correlation ID in header: ${node.data.correlationHeader || 'X-Correlation-Id'}`;
                } else if (source === 'query') {
                  hint = `Include correlation ID as query param: ${node.data.correlationQueryParam || 'correlationId'}`;
                }
                return <li key={node.id}><strong>{node.label}:</strong> {hint}</li>;
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Mock payloads for each node - simplified UI */}
      {(effectiveMode === 'auto-resume' || effectiveMode === 'synthetic-inject') && (
        <div className="wf-runner-correlation-payloads">
          <h4>Mock Webhook Response</h4>
          <p className="config-hint wf-runner-payload-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            All transactions will use the same mock response values.
          </p>
          {correlationNodes.map(node => {
            const currentPayload = config?.mockPayloads?.[node.id] ?? buildDefaultMockPayload(node.data);
            const extractVars = node.data.extractVariables ?? [];
            
            // Identify dynamic fields (status-like) that users might want to change
            const dynamicFieldNames = ['status', 'paymentstatus', 'state', 'result', 'code', 'outcome'];
            const dynamicFields = extractVars.filter(ev => 
              ev.name && ev.jsonPath && dynamicFieldNames.some(df => ev.name.toLowerCase().includes(df))
            );
            
            return (
              <div key={node.id} className="wf-runner-payload-node">
                <label className="wf-runner-payload-node-label">{node.label}</label>
                
                {/* Dynamic fields - user can configure */}
                {dynamicFields.length > 0 && (
                  <div className="wf-runner-payload-dynamic">
                    <div className="wf-runner-payload-fields">
                      {dynamicFields.map(ev => {
                        const fieldPath = ev.jsonPath.replace(/^\$\.?/, '');
                        const fieldValue = getByPath(currentPayload, fieldPath) ?? '';
                        
                        return (
                          <div key={ev.name} className="wf-runner-payload-field">
                            <label>{ev.name}</label>
                            <input
                              type="text"
                              value={String(fieldValue)}
                              onChange={(e) => {
                                const newPayload = { ...currentPayload };
                                setByPath(newPayload, fieldPath, e.target.value);
                                handleMockPayloadChange(node.id, JSON.stringify(newPayload));
                              }}
                              disabled={disabled}
                              placeholder="e.g., completed, failed, pending"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="wf-runner-payload-hint">
                      💡 Change this value to test different scenarios (e.g., "completed", "failed", "pending")
                    </p>
                  </div>
                )}
                
                {dynamicFields.length === 0 && (
                  <p className="wf-runner-payload-no-fields">No configurable fields. All values are auto-generated.</p>
                )}
                
                {/* JSON Preview */}
                <div className="wf-runner-payload-preview">
                  <span className="wf-runner-payload-section-label">Mock Payload:</span>
                  <pre className="wf-runner-payload-json">{JSON.stringify(currentPayload, null, 2)}</pre>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Curl Command Modal */}
      {curlModal && (
        <div className="wf-curl-modal-overlay" onClick={() => setCurlModal(null)}>
          <div className="wf-curl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wf-curl-modal-header">
              <h3>curl Command — {curlModal.node.label}</h3>
            </div>
            <div className="wf-curl-modal-body">
              {curlModal.isPlaceholder ? (
                <p className="wf-curl-modal-hint wf-curl-modal-hint-placeholder">
                  ⚠️ No active correlation ID yet — this is a sample UUID. Start a workflow run to get
                  the real ID, or replace <code>{curlModal.correlationId}</code> with your own before running.
                </p>
              ) : (
                <p className="wf-curl-modal-hint">
                  Ready to run! This command uses correlation ID: <code>{curlModal.correlationId}</code>
                </p>
              )}
              
              {/* Show other available correlation IDs if there are more */}
              {(() => {
                const nodePath = curlModal.node.data.webhookPath || '/webhooks/callback';
                const fullNodePath = nodePath.startsWith('/webhooks/callback')
                  ? nodePath
                  : `/webhooks/callback${nodePath.startsWith('/') ? '' : '/'}${nodePath}`;
                const otherIds = pausedCorrelations.filter(
                  pc => pc.webhookPath === fullNodePath && pc.correlationId !== curlModal.correlationId
                );
                if (otherIds.length > 0) {
                  return (
                    <div className="wf-curl-modal-ids">
                      <span className="wf-curl-modal-ids-label">Other paused workflows:</span>
                      {otherIds.map((pc, idx) => (
                        <button
                          key={`${pc.correlationId}-${idx}`}
                          type="button"
                          className="wf-curl-modal-id-btn"
                          onClick={() => setCurlModal({ ...curlModal, correlationId: pc.correlationId })}
                          title="Switch to this correlation ID"
                        >
                          {pc.correlationId}
                        </button>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}

              <pre className="wf-curl-modal-code">
                <code>{buildCurlCommand(curlModal.url, curlModal.node.data, curlModal.correlationId)}</code>
              </pre>
            </div>
            <div className="wf-curl-modal-footer">
              <button
                type="button"
                className={`wf-curl-modal-copy ${copied ? 'wf-curl-modal-copied' : ''}`}
                onClick={() => handleCopyToClipboard(buildCurlCommand(curlModal.url, curlModal.node.data, curlModal.correlationId))}
              >
                {copied ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy to Clipboard
                  </>
                )}
              </button>
              <button
                type="button"
                className="wf-curl-modal-close-btn"
                onClick={() => setCurlModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
