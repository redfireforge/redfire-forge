import { useState, useMemo, useCallback, useEffect } from 'react';
import type { CorrelationWaitNodeData } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import AvailableVariables from '../expression/AvailableVariables';
import { DataMapperModal, createWebhookExtractionAdapter } from '../../../../shared/components/data-mapper';
import type { WebhookExtractionOutput } from '../../../../shared/components/data-mapper';
import { getByPath, setByPath } from '../../../../shared/utils/jsonPath';
import { toErrorMessage } from '../../../../shared/utils/helpers';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';

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
  const [testPayload, setTestPayload] = useState<string>('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pausedCorrelations, setPausedCorrelations] = useState<PausedCorrelation[]>([]);
  const [loadingPaused, setLoadingPaused] = useState(false);
  const [showMapper, setShowMapper] = useState(false);

  const fetchPausedCorrelations = useCallback(async () => {
    setLoadingPaused(true);
    try {
      const host = window.location.hostname || 'localhost';
      const res = await fetch(`http://${host}:3001/api/correlations`);
      if (res.ok) {
        const json = await res.json();
        setPausedCorrelations(json.correlations ?? []);
      }
    } catch {
      // Server may not be running
    } finally {
      setLoadingPaused(false);
    }
  }, []);

  useEffect(() => {
    fetchPausedCorrelations();
    const interval = setInterval(fetchPausedCorrelations, 3000);
    return () => clearInterval(interval);
  }, [fetchPausedCorrelations]);

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

  const defaultPayload = useMemo(
    () => JSON.stringify(buildDefaultPayload(), null, 2),
    [buildDefaultPayload],
  );

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

  const extractVariables = data.extractVariables ?? [];

  const addExtractVar = () => {
    onChange({ ...data, extractVariables: [...extractVariables, { name: '', jsonPath: '' }] });
  };

  const updateExtractVar = (index: number, field: 'name' | 'jsonPath', value: string) => {
    const vars = [...extractVariables];
    vars[index] = { ...vars[index], [field]: value };
    onChange({ ...data, extractVariables: vars });
  };

  const removeExtractVar = (index: number) => {
    onChange({
      ...data,
      extractVariables: extractVariables.filter((_, idx) => idx !== index),
    });
  };

  const sourceHint = data.correlationSource === 'body'
    ? 'From request body'
    : data.correlationSource === 'header'
      ? 'From HTTP header'
      : 'From query string';

  return (
    <div className="wf-config-body wf-correlation-wait-config" data-testid="correlation-wait-config">
      <KafkaCard
        title="Matching"
        hint="How this step finds and resumes on an incoming webhook."
      >
        <div className="wf-kafka-form wf-kafka-form--correlation">
          <KafkaFormRow label="Label" hint="Canvas node title" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
              aria-label="Correlation Wait label"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Correlation ID" hint="Unique ID expression" compact>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) => onChange({
                ...data,
                correlationIdExpression: data.correlationIdExpression + snippet,
              })}
            >
              <input
                className="wf-kafka-form-input"
                value={data.correlationIdExpression}
                onChange={(e) => onChange({ ...data, correlationIdExpression: e.target.value })}
                placeholder="e.g. {{paymentId}}"
                aria-label="Correlation ID Expression"
              />
            </InsertVarField>
          </KafkaFormRow>

          <KafkaFormRow label="Webhook Path" hint="Callback endpoint path" compact>
            <input
              className="wf-kafka-form-input wf-kafka-form-input--mono"
              value={data.webhookPath}
              onChange={(e) => onChange({ ...data, webhookPath: e.target.value })}
              placeholder="/webhooks/callback"
              aria-label="Webhook Path"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Source" hint={sourceHint} compact>
            <CustomSelect
              value={data.correlationSource}
              onChange={(v) => onChange({
                ...data,
                correlationSource: v as CorrelationWaitNodeData['correlationSource'],
              })}
              options={SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </KafkaFormRow>

          {data.correlationSource === 'body' && (
            <KafkaFormRow label="Correlation JSONPath" hint="Path in webhook body" compact>
              <input
                className="wf-kafka-form-input wf-kafka-form-input--mono"
                value={data.correlationJsonPath ?? ''}
                onChange={(e) => onChange({ ...data, correlationJsonPath: e.target.value })}
                placeholder="$.correlationId"
                aria-label="Correlation JSONPath"
              />
            </KafkaFormRow>
          )}

          {data.correlationSource === 'header' && (
            <KafkaFormRow label="Header Name" hint="Incoming header key" compact>
              <input
                className="wf-kafka-form-input"
                value={data.correlationHeader ?? ''}
                onChange={(e) => onChange({ ...data, correlationHeader: e.target.value })}
                placeholder="X-Correlation-Id"
                aria-label="Header Name"
              />
            </KafkaFormRow>
          )}

          {data.correlationSource === 'query' && (
            <KafkaFormRow label="Query Parameter" hint="Query string key" compact>
              <input
                className="wf-kafka-form-input"
                value={data.correlationQueryParam ?? ''}
                onChange={(e) => onChange({ ...data, correlationQueryParam: e.target.value })}
                placeholder="correlationId"
                aria-label="Query Parameter"
              />
            </KafkaFormRow>
          )}

          <KafkaFormRow label="Timeout" hint="0 = no timeout" compact>
            <div className="wf-corr-timeout-ctrl">
              <input
                className="wf-kafka-form-input"
                type="number"
                min={0}
                max={3600000}
                value={data.timeoutMs}
                onChange={(e) => onChange({ ...data, timeoutMs: parseInt(e.target.value, 10) || 0 })}
                aria-label="Timeout (ms)"
              />
              <span className="unit">ms</span>
            </div>
          </KafkaFormRow>

          <KafkaFormRow label="Webhook Filter (optional)" hint="Extra match expression" compact>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) => onChange({
                ...data,
                webhookFilter: (data.webhookFilter ?? '') + snippet,
              })}
            >
              <input
                className="wf-kafka-form-input"
                value={data.webhookFilter ?? ''}
                onChange={(e) => onChange({ ...data, webhookFilter: e.target.value })}
                placeholder='e.g. {{webhook.type}} == payment'
                aria-label="Webhook Filter"
              />
            </InsertVarField>
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Extract Variables"
        hint="Pull fields from the webhook payload into workflow variables."
        action={(
          <div className="wf-webhook-extract-actions">
            <button
              type="button"
              className="wf-webhook-mapper-btn"
              onClick={() => setShowMapper(true)}
              title="Open Data Mapper to drag-and-drop fields from the payload sample"
            >
              Data Mapper
            </button>
            <KafkaAddButton label="Add Variable" onClick={addExtractVar} />
          </div>
        )}
      >
        {extractVariables.length === 0 ? (
          <KafkaEmptyState
            title="No extractions"
            text="Map payload fields to workflow variables, or open Data Mapper to pick paths visually."
          />
        ) : (
          <div className="wf-kafka-extract-panel">
            <div className="wf-kafka-extract-header" aria-hidden="true">
              <span className="wf-kafka-extract-col-name">Variable name</span>
              <span className="wf-kafka-extract-col-path">JSONPath</span>
              <span className="wf-kafka-extract-col-del" />
            </div>
            <div className="wf-kafka-extract-list">
              {extractVariables.map((ev, i) => (
                <div key={i} className="wf-kafka-extract-row">
                  <div className="wf-kafka-extract-col-name">
                    <input
                      className="wf-kafka-form-input"
                      value={ev.name}
                      onChange={(e) => updateExtractVar(i, 'name', e.target.value)}
                      placeholder="Variable name"
                    />
                  </div>
                  <div className="wf-kafka-extract-col-path">
                    <input
                      className="wf-kafka-form-input wf-kafka-form-input--mono"
                      value={ev.jsonPath}
                      onChange={(e) => updateExtractVar(i, 'jsonPath', e.target.value)}
                      placeholder="$.path.to.value"
                    />
                  </div>
                  <div className="wf-kafka-extract-col-del">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeExtractVar(i)}
                      title="Remove variable"
                      aria-label="Remove variable"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </KafkaCard>

      <KafkaCard title="Notes" hint="Optional description for teammates.">
        <div className="wf-kafka-card-pad">
          <textarea
            className="wf-config-textarea wf-kafka-form-textarea"
            rows={2}
            value={data.notes ?? ''}
            onChange={(e) => onChange({ ...data, notes: e.target.value })}
            placeholder="Optional notes about this correlation step"
            aria-label="Notes"
          />
        </div>
      </KafkaCard>

      <KafkaCard
        title="Test Webhook"
        hint="Send a sample payload to resume a workflow paused at this node."
        hintBelow
        testId="test-webhook-section"
      >
        <div className="wf-corr-test">
          <div className="wf-paused-correlations" data-testid="paused-correlations">
            <div className="wf-paused-correlations-header">
              <span>Currently paused workflows</span>
              <button
                type="button"
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
                {loadingPaused ? 'Loading…' : 'No workflows currently paused. Run a workflow first.'}
              </div>
            ) : (
              <div className="wf-paused-list">
                {pausedCorrelations.map((pc) => (
                  <button
                    key={pc.correlationId}
                    type="button"
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
                    title="Click to use this correlation ID in the payload"
                  >
                    <span className="wf-paused-item-id">{pc.correlationId}</span>
                    <span className="wf-paused-item-path">{pc.webhookPath}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="wf-grpc-code-field">
            <div className="wf-grpc-code-toolbar">
              <span className="wf-grpc-code-toolbar-label">Test payload</span>
              <span className="wf-grpc-code-toolbar-hint">JSON — must include the correlation ID</span>
            </div>
            <textarea
              className="wf-config-textarea wf-grpc-code-editor"
              value={testPayload || defaultPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              data-testid="test-webhook-payload"
              rows={4}
              spellCheck={false}
            />
          </div>

          <div className="wf-test-webhook-actions">
            <button
              type="button"
              className="wf-test-webhook-btn"
              onClick={handleSendTestWebhook}
              disabled={testSending}
              data-testid="test-webhook-send"
            >
              {testSending ? 'Sending…' : 'Send Test Webhook'}
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
      </KafkaCard>

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
