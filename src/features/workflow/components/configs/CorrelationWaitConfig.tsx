import { useState, useMemo, useCallback } from 'react';
import type { CorrelationWaitNodeData } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import AvailableVariables from '../expression/AvailableVariables';

const SOURCE_OPTIONS: { value: CorrelationWaitNodeData['correlationSource']; label: string }[] = [
  { value: 'body', label: 'Request Body (JSONPath)' },
  { value: 'header', label: 'HTTP Header' },
  { value: 'query', label: 'Query Parameter' },
];

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

  const defaultPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    // Add correlation ID field based on source config
    if (data.correlationSource === 'body' && data.correlationJsonPath) {
      const path = data.correlationJsonPath.replace(/^\$\.?/, '');
      const keys = path.split('.');
      let current = payload;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = current[keys[i]] || {};
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = data.correlationIdExpression || '<correlationId>';
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
        current[keys[keys.length - 1]] = `<${ev.name}>`;
      }
    }
    return JSON.stringify(payload, null, 2);
  }, [data.correlationSource, data.correlationJsonPath, data.correlationIdExpression, data.extractVariables]);

  const handleSendTestWebhook = useCallback(async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const payloadStr = testPayload || defaultPayload;
      const body = JSON.parse(payloadStr);
      const response = await fetch('/api/correlations/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlationId: body[data.correlationJsonPath?.replace(/^\$\.?/, '') ?? 'correlationId'] ?? data.correlationIdExpression,
          webhookData: body,
        }),
      });
      const result = await response.json();
      setTestResult({
        ok: result.resumed === true,
        message: result.resumed ? `Resumed execution ${result.executionId ?? ''}` : 'No matching paused workflow found',
      });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
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
        {(data.extractVariables ?? []).map((ev, i) => (
          <div key={i} className="wf-config-row">
            <input
              className="wf-config-input-half"
              value={ev.name}
              onChange={(e) => {
                const vars = [...(data.extractVariables ?? [])];
                vars[i] = { ...vars[i], name: e.target.value };
                onChange({ ...data, extractVariables: vars });
              }}
              placeholder="Variable name"
            />
            <input
              className="wf-config-input-half"
              value={ev.jsonPath}
              onChange={(e) => {
                const vars = [...(data.extractVariables ?? [])];
                vars[i] = { ...vars[i], jsonPath: e.target.value };
                onChange({ ...data, extractVariables: vars });
              }}
              placeholder="$.path.to.value"
            />
            <button
              className="wf-config-btn-remove"
              onClick={() => {
                const vars = (data.extractVariables ?? []).filter((_, idx) => idx !== i);
                onChange({ ...data, extractVariables: vars });
              }}
              title="Remove variable"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="wf-config-btn-add"
          onClick={() => {
            const vars = [...(data.extractVariables ?? []), { name: '', jsonPath: '' }];
            onChange({ ...data, extractVariables: vars });
          }}
        >
          + Add Variable
        </button>
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
        <div className="wf-test-webhook-title">Test Webhook</div>
        <span className="wf-config-hint">
          Send a test webhook payload to resume a paused workflow with this configuration.
        </span>
        <textarea
          className="wf-test-webhook-payload"
          value={testPayload || defaultPayload}
          onChange={(e) => setTestPayload(e.target.value)}
          data-testid="test-webhook-payload"
          rows={4}
        />
        <div className="wf-test-webhook-actions">
          <button
            className="wf-config-btn-add"
            onClick={handleSendTestWebhook}
            disabled={testSending}
            data-testid="test-webhook-send"
          >
            {testSending ? 'Sending...' : '🧪 Send Test Webhook'}
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
    </div>
  );
}
