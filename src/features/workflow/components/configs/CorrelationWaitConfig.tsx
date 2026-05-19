import { useState, useMemo, useCallback, useEffect } from 'react';
import type { CorrelationWaitNodeData } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import AvailableVariables from '../expression/AvailableVariables';
import { DataMapperModal, createWebhookExtractionAdapter } from '../../../../shared/components/data-mapper';
import type { WebhookExtractionOutput } from '../../../../shared/components/data-mapper';
import { getByPath, setByPath } from '../../../../shared/utils/jsonPath';
import { toErrorMessage } from '../../../../shared/utils/helpers';

const EMPTY_EXTRACT_VARS: WebhookExtractionOutput = [];

const SOURCE_OPTIONS: { value: CorrelationWaitNodeData['correlationSource']; label: string }[] = [
  { value: 'body', label: 'Request Body (JSONPath)' },
  { value: 'header', label: 'HTTP Header' },
  { value: 'query', label: 'Query Parameter' },
];

interface PausedCorrelation {
  correlationId: string;
  webhookPath: string;
  pausedAt: number;
}

export default function CorrelationWaitConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: CorrelationWaitNodeData;
  onChange: (d: CorrelationWaitNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  // ── Test Webhook state ──
  const [testPayload, setTestPayload] = useState<string>('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pausedCorrelations, setPausedCorrelations] = useState<PausedCorrelation[]>([]);
  const [loadingPaused, setLoadingPaused] = useState(false);

  // ── Data Mapper state ──
  const [showMapper, setShowMapper] = useState(false);

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

  // Poll for paused correlations while the panel is open
  useEffect(() => {
    fetchPausedCorrelations();
    const interval = setInterval(fetchPausedCorrelations, 3000);
    return () => clearInterval(interval);
  }, [fetchPausedCorrelations]);

  // Build a default payload structure based on correlation source and extract variables
  const buildDefaultPayload = useCallback(() => {
    const payload: Record<string, unknown> = {};
    if (data.correlationSource === 'body' && data.correlationJsonPath) {
      setByPath(payload, data.correlationJsonPath, data.correlationIdExpression || '<correlationId>');
    }
    for (const ev of data.extractVariables ?? []) {
      if (ev.name && ev.jsonPath) {
        setByPath(payload, ev.jsonPath, `<${ev.name}>`);
      }
    }
    return payload;
  }, [data.correlationSource, data.correlationJsonPath, data.correlationIdExpression, data.extractVariables]);

  // Default payload for Test Webhook
  const defaultPayload = useMemo(() => {
    return JSON.stringify(buildDefaultPayload(), null, 2);
  }, [buildDefaultPayload]);

  const mapperAdapter = useMemo(
    () => createWebhookExtractionAdapter({
      samplePayload: testPayload || defaultPayload,
      sourceLabel: 'Correlation Payload',
      title: 'Correlation Payload → Variables',
    }),
    [testPayload, defaultPayload],
  );

  const handleSendTestWebhook = useCallback(async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const payloadStr = testPayload || defaultPayload;
      const body = JSON.parse(payloadStr);
      const corrPath = data.correlationJsonPath || '$.correlationId';
      const corrValue = getByPath(body, corrPath);
      const response = await fetch('/api/correlations/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlationId: corrValue ?? data.correlationIdExpression,
          webhookData: body,
        }),
      });
      const result = await response.json();
      setTestResult({
        ok: result.resumed === true,
        message: result.resumed ? `Resumed execution ${result.executionId ?? ''}` : 'No matching paused workflow found',
      });
    } catch (err) {
      setTestResult({ ok: false, message: toErrorMessage(err) });
    } finally {
      setTestSending(false);
    }
  }, [testPayload, defaultPayload, data.correlationJsonPath, data.correlationIdExpression]);
  return (
    <div className="wf-config-body">
      {/* ── Label ── */}
      <div className="wf-config-field">
        <label>Label</label>
        <input
          value={data.label}
          onChange={(e) => onChange({ ...data, label: e.target.value })}
        />
      </div>

      {/* ── Correlation ID Expression ── */}
      <div className="wf-config-field">
        <label>Correlation ID Expression</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          onInsert={(snippet) => onChange({ ...data, correlationIdExpression: data.correlationIdExpression + snippet })}
        >
          <input
            value={data.correlationIdExpression}
            onChange={(e) => onChange({ ...data, correlationIdExpression: e.target.value })}
            placeholder="e.g. {{paymentId}}"
          />
        </InsertVarField>
        <span className="wf-config-hint">
          Expression that resolves to a unique correlation ID for matching incoming webhooks.
        </span>
      </div>

      {/* ── Webhook Path ── */}
      <div className="wf-config-field">
        <label>Webhook Path</label>
        <input
          value={data.webhookPath}
          onChange={(e) => onChange({ ...data, webhookPath: e.target.value })}
          placeholder="/webhooks/callback"
        />
        <span className="wf-config-hint">
          The webhook endpoint path that will receive callbacks.
        </span>
      </div>

      {/* ── Correlation Source ── */}
      <div className="wf-config-field">
        <label>Correlation Source</label>
        <select
          value={data.correlationSource}
          onChange={(e) => onChange({ ...data, correlationSource: e.target.value as CorrelationWaitNodeData['correlationSource'] })}
        >
          {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="wf-config-hint">
          Where to extract the correlation ID from the incoming webhook.
        </span>
      </div>

      {/* ── Source-specific fields ── */}
      {data.correlationSource === 'body' && (
        <div className="wf-config-field">
          <label>Correlation JSONPath</label>
          <input
            value={data.correlationJsonPath ?? ''}
            onChange={(e) => onChange({ ...data, correlationJsonPath: e.target.value })}
            placeholder="$.correlationId"
          />
          <span className="wf-config-hint">
            JSONPath expression to extract the correlation ID from the webhook body.
          </span>
        </div>
      )}

      {data.correlationSource === 'header' && (
        <div className="wf-config-field">
          <label>Header Name</label>
          <input
            value={data.correlationHeader ?? ''}
            onChange={(e) => onChange({ ...data, correlationHeader: e.target.value })}
            placeholder="X-Correlation-Id"
          />
        </div>
      )}

      {data.correlationSource === 'query' && (
        <div className="wf-config-field">
          <label>Query Parameter</label>
          <input
            value={data.correlationQueryParam ?? ''}
            onChange={(e) => onChange({ ...data, correlationQueryParam: e.target.value })}
            placeholder="correlationId"
          />
        </div>
      )}

      {/* ── Extract Variables ── */}
      <div className="wf-config-field">
        <label>Extract Variables</label>
        <span className="wf-config-hint">
          Variables to extract from the webhook payload into the workflow context.
        </span>
        <div className="wf-extract-vars-list">
          {(data.extractVariables ?? []).map((ev, i) => (
            <div key={i} className="wf-extract-var-row">
              <input
                className="wf-extract-var-name"
                value={ev.name}
                onChange={(e) => {
                  const vars = [...(data.extractVariables ?? [])];
                  vars[i] = { ...vars[i], name: e.target.value };
                  onChange({ ...data, extractVariables: vars });
                }}
                placeholder="Variable name"
              />
              <input
                className="wf-extract-var-path"
                value={ev.jsonPath}
                onChange={(e) => {
                  const vars = [...(data.extractVariables ?? [])];
                  vars[i] = { ...vars[i], jsonPath: e.target.value };
                  onChange({ ...data, extractVariables: vars });
                }}
                placeholder="$.path.to.value"
              />
              <button
                className="wf-extract-var-remove"
                onClick={() => {
                  const vars = (data.extractVariables ?? []).filter((_, idx) => idx !== i);
                  onChange({ ...data, extractVariables: vars });
                }}
                title="Remove variable"
                aria-label="Remove variable"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="wf-extract-var-actions">
          <button
            className="wf-extract-var-add"
            onClick={() => {
              const vars = [...(data.extractVariables ?? []), { name: '', jsonPath: '' }];
              onChange({ ...data, extractVariables: vars });
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Variable
          </button>
          <button
            className="wf-extract-var-mapper-btn"
            onClick={() => setShowMapper(true)}
            title="Open Data Mapper to drag-and-drop fields from the payload sample"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              <path d="M10 7h4l-4 10h4" />
            </svg>
            Data Mapper
          </button>
        </div>
      </div>

      {/* ── Timeout ── */}
      <div className="wf-config-field">
        <label>Timeout (ms)</label>
        <input
          type="number"
          min={0}
          max={3600000}
          value={data.timeoutMs}
          onChange={(e) => onChange({ ...data, timeoutMs: parseInt(e.target.value) || 0 })}
        />
        <span className="wf-config-hint">
          Maximum time to wait for a webhook callback. 0 = no timeout.
        </span>
      </div>

      {/* ── Webhook Filter ── */}
      <div className="wf-config-field">
        <label>Webhook Filter (optional)</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          onInsert={(snippet) => onChange({ ...data, webhookFilter: (data.webhookFilter ?? '') + snippet })}
        >
          <input
            value={data.webhookFilter ?? ''}
            onChange={(e) => onChange({ ...data, webhookFilter: e.target.value })}
            placeholder='e.g. {{webhook.type}} == payment'
          />
        </InsertVarField>
        <span className="wf-config-hint">
          Optional expression to filter matching webhooks.
        </span>
      </div>

      {/* ── Notes ── */}
      <div className="wf-config-field">
        <label>Notes</label>
        <textarea
          className="wf-config-textarea"
          rows={2}
          value={data.notes ?? ''}
          onChange={(e) => onChange({ ...data, notes: e.target.value })}
          placeholder="Optional notes about this correlation step"
        />
      </div>

      {/* ── Test Webhook ── */}
      <div className="wf-test-webhook-section" data-testid="test-webhook-section">
        <div className="wf-test-webhook-header">
          <span className="wf-test-webhook-icon">🧪</span>
          <span className="wf-test-webhook-title">Test Webhook</span>
        </div>
        <p className="wf-test-webhook-desc">
          Send a test webhook payload to resume a paused workflow with this configuration.
          <strong> Requires an active workflow paused at this node.</strong>
        </p>

        {/* Show currently paused correlations */}
        <div className="wf-paused-correlations" data-testid="paused-correlations">
          <div className="wf-paused-correlations-header">
            <span>Currently Paused Workflows</span>
            <button
              className="wf-paused-refresh-btn"
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
          {pausedCorrelations.length === 0 ? (
            <div className="wf-paused-empty">
              {loadingPaused ? 'Loading...' : 'No workflows currently paused. Run a workflow first.'}
            </div>
          ) : (
            <div className="wf-paused-list">
              {pausedCorrelations.map((pc) => (
                <button
                  key={pc.correlationId}
                  className="wf-paused-item"
                  onClick={() => {
                    try {
                      const payloadObj = JSON.parse(testPayload || defaultPayload);
                      setByPath(payloadObj, data.correlationJsonPath || '$.correlationId', pc.correlationId);
                      setTestPayload(JSON.stringify(payloadObj, null, 2));
                      setTestResult(null);
                    } catch {
                      setTestResult({ ok: false, message: 'Invalid JSON in test payload. Fix the payload first.' });
                    }
                  }}
                  title={`Click to use this correlation ID in the payload`}
                >
                  <span className="wf-paused-item-id">{pc.correlationId}</span>
                  <span className="wf-paused-item-path">{pc.webhookPath}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          className="wf-test-webhook-payload"
          value={testPayload || defaultPayload}
          onChange={(e) => setTestPayload(e.target.value)}
          data-testid="test-webhook-payload"
          rows={4}
        />
        <div className="wf-test-webhook-actions">
          <button
            className="wf-test-webhook-btn"
            onClick={handleSendTestWebhook}
            disabled={testSending}
            data-testid="test-webhook-send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
            {testSending ? 'Sending...' : 'Send Test Webhook'}
          </button>
          {testResult && (
            <span
              className={`wf-test-webhook-result ${testResult.ok ? 'wf-test-webhook-ok' : 'wf-test-webhook-err'}`}
              data-testid="test-webhook-result"
            >
              {testResult.message}
            </span>
          )}
        </div>
      </div>

      <AvailableVariables hints={variableHints} />

      {showMapper && (
        <DataMapperModal
          adapter={mapperAdapter}
          initialData={data.extractVariables ?? EMPTY_EXTRACT_VARS}
          onSave={(result: WebhookExtractionOutput) => {
            onChange({ ...data, extractVariables: result });
            setShowMapper(false);
          }}
          onCancel={() => setShowMapper(false)}
          contextScope={data.label}
        />
      )}
    </div>
  );
}
