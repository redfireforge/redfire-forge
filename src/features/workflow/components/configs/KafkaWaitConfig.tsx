import { useEffect, useMemo, useState } from 'react';
import type {
  KafkaConsumeLoadTestBehavior,
  KafkaWaitCorrelationSource,
  KafkaWaitNodeData,
} from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import { createHeaderFilter, createExtractVariable } from './kafkaConfigFactories';

const CORRELATION_SOURCE_OPTIONS: { value: KafkaWaitCorrelationSource; label: string }[] = [
  { value: 'body', label: 'Body (JSONPath)' },
  { value: 'header', label: 'Header' },
  { value: 'key', label: 'Message Key' },
];

const LOAD_TEST_OPTIONS: { value: KafkaConsumeLoadTestBehavior['mode']; label: string }[] = [
  { value: 'wait-for-real', label: 'Wait for real' },
  { value: 'auto-resume', label: 'Auto resume' },
  { value: 'synthetic-inject', label: 'Synthetic inject' },
];

function stringifyMockPayload(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(value ?? {}, null, 2);
}

export default function KafkaWaitConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: KafkaWaitNodeData;
  onChange: (d: KafkaWaitNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const headerFilters = data.headerFilters ?? [];
  const extractVariables = data.extractVariables ?? [];
  const loadTestBehavior = data.loadTestBehavior ?? { mode: 'wait-for-real' as const };
  const [mockPayloadText, setMockPayloadText] = useState(() => stringifyMockPayload(loadTestBehavior.mockPayload));
  const update = (patch: Partial<KafkaWaitNodeData>) => onChange({ ...data, ...patch });

  useEffect(() => {
    setMockPayloadText(stringifyMockPayload(data.loadTestBehavior?.mockPayload));
  }, [data.loadTestBehavior?.mockPayload]);

  const headerCrud = useListCrud(headerFilters, (items) => update({ headerFilters: items }));

  const applyLoadTestBehavior = (patch: Partial<KafkaConsumeLoadTestBehavior>) => {
    update({ loadTestBehavior: { ...loadTestBehavior, ...patch } });
  };

  const handleMockPayloadChange = (value: string) => {
    setMockPayloadText(value);
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        applyLoadTestBehavior({ mockPayload: parsed as Record<string, unknown> });
      }
    } catch {
      // Keep the typed text locally until it becomes valid JSON.
    }
  };

  const hintSet = useMemo(() => variableHints, [variableHints]);

  const handleExtractChange = (index: number, field: 'name' | 'jsonPath', value: string) => {
    const next = [...extractVariables];
    next[index] = { ...next[index], [field]: value };
    update({ extractVariables: next });
  };

  const handleExtractRemove = (index: number) => {
    update({ extractVariables: extractVariables.filter((_, i) => i !== index) });
  };

  return (
    <div className="wf-config-body" data-testid="kafka-wait-config">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <div className="wf-config-field">
        <label>Cluster ID</label>
        <input value={data.clusterId} onChange={(e) => update({ clusterId: e.target.value })} placeholder="cluster-a" />
      </div>

      <div className="wf-config-field">
        <label>Topic</label>
        <input value={data.topic} onChange={(e) => update({ topic: e.target.value })} placeholder="payments.authorized" />
      </div>

      <div className="wf-kafka-section">
        <div className="wf-kafka-section-title">Correlation Matching</div>

        <div className="wf-config-field">
          <label>Correlation ID Expression</label>
          <InsertVarField
            onRequestVariableInsert={onRequestVariableInsert}
            shortRef
            onInsert={(snippet) => update({ correlationIdExpression: `${data.correlationIdExpression ?? ''}${snippet}` })}
          >
            <ExpressionInput
              value={data.correlationIdExpression ?? ''}
              onChange={(value) => update({ correlationIdExpression: value })}
              placeholder="e.g. {{orderId}}"
              variableHints={hintSet}
            />
          </InsertVarField>
          <span className="wf-config-hint">The value to match against incoming messages. Supports <code>{'{{variable}}'}</code> templates.</span>
        </div>

        <div className="wf-config-field">
          <label>Correlation Source</label>
          <select value={data.correlationSource ?? 'body'} onChange={(e) => update({ correlationSource: e.target.value as KafkaWaitCorrelationSource })}>
            {CORRELATION_SOURCE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>

        {(data.correlationSource ?? 'body') === 'body' && (
          <div className="wf-config-field">
            <label>Correlation JSONPath</label>
            <input
              value={data.correlationJsonPath ?? ''}
              onChange={(e) => update({ correlationJsonPath: e.target.value || undefined })}
              placeholder="$.orderId"
            />
            <span className="wf-config-hint">JSONPath within the message value to extract the correlation ID.</span>
          </div>
        )}

        {data.correlationSource === 'header' && (
          <div className="wf-config-field">
            <label>Correlation Header</label>
            <input
              value={data.correlationHeader ?? ''}
              onChange={(e) => update({ correlationHeader: e.target.value || undefined })}
              placeholder="X-Correlation-Id"
            />
            <span className="wf-config-hint">Header name containing the correlation ID.</span>
          </div>
        )}

        {data.correlationSource === 'key' && (
          <div className="wf-config-field">
            <span className="wf-config-hint">The message key is used directly as the correlation ID.</span>
          </div>
        )}
      </div>

      <div className="wf-config-field">
        <label>Timeout (ms)</label>
        <input
          type="number"
          value={data.timeoutMs ?? ''}
          onChange={(e) => update({ timeoutMs: e.target.value === '' ? 0 : Number(e.target.value) })}
          placeholder="30000"
        />
        <span className="wf-config-hint">0 = unlimited wait. Workflow fails if no match within timeout.</span>
      </div>

      <div className="wf-config-field">
        <label>Key Regex</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          shortRef
          onInsert={(snippet) => update({ keyRegex: `${data.keyRegex ?? ''}${snippet}` })}
        >
          <ExpressionInput
            value={data.keyRegex ?? ''}
            onChange={(value) => update({ keyRegex: value })}
            placeholder="Optional pre-filter on message key"
            variableHints={hintSet}
          />
        </InsertVarField>
      </div>

      <div className="wf-kafka-section">
        <div className="wf-kafka-section-title">Header Filters</div>
        <div className="wf-config-kv-list">
          {headerFilters.map((row, index) => (
            <div key={row.id} className="wf-config-kv-row">
              <label className="wf-config-checkbox-label" style={{ minWidth: 72 }}>
                <input type="checkbox" checked={row.enabled} onChange={(e) => headerCrud.update(index, { enabled: e.target.checked })} />
                Enabled
              </label>
              <input value={row.key} placeholder="Header name" onChange={(e) => headerCrud.update(index, { key: e.target.value })} />
              <div className="wf-config-kv-val-wrap">
                <InsertVarField
                  onRequestVariableInsert={onRequestVariableInsert}
                  shortRef
                  onInsert={(snippet) => headerCrud.update(index, { value: `${row.value}${snippet}` })}
                  initialSearch={row.key}
                >
                  <ExpressionInput
                    value={row.value}
                    onChange={(value) => headerCrud.update(index, { value })}
                    placeholder="Value"
                    variableHints={hintSet}
                  />
                </InsertVarField>
              </div>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => headerCrud.remove(index)}>×</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm" onClick={() => update({ headerFilters: [...headerFilters, createHeaderFilter()] })}>+ Add Header Filter</button>
      </div>

      <div className="wf-kafka-section">
        <div className="wf-kafka-section-title">Extract Variables</div>
        <span className="wf-config-hint">Extract fields from the correlated message body into workflow variables.</span>
        <div className="wf-config-kv-list">
          {extractVariables.map((ev, index) => (
            <div key={index} className="wf-config-kv-row">
              <input
                value={ev.name}
                placeholder="Variable name"
                onChange={(e) => handleExtractChange(index, 'name', e.target.value)}
              />
              <input
                value={ev.jsonPath}
                placeholder="$.field.path"
                onChange={(e) => handleExtractChange(index, 'jsonPath', e.target.value)}
              />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => handleExtractRemove(index)}>×</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm" onClick={() => update({ extractVariables: [...extractVariables, createExtractVariable()] })}>+ Add Variable</button>
      </div>

      <div className="wf-kafka-section">
        <div className="wf-kafka-section-title">Test Payload (Quick Test)</div>
        <span className="wf-config-hint">
          Provide a sample response message body so Quick Test can resolve this wait node without a real Kafka subscription.
        </span>
        <div className="wf-config-field">
          <label>Message Body (JSON)</label>
          <textarea
            className="wf-config-textarea"
            rows={5}
            value={data.samplePayload ?? ''}
            onChange={(e) => update({ samplePayload: e.target.value || undefined })}
            placeholder={`{\n  "orderId": "order-123",\n  "status": "approved",\n  "approvedAt": "2026-01-01T00:00:00Z"\n}`}
          />
        </div>
        <div className="wf-config-field">
          <label>Message Key</label>
          <input
            value={data.sampleKey ?? ''}
            onChange={(e) => update({ sampleKey: e.target.value || undefined })}
            placeholder="Optional key (e.g. order-123)"
          />
        </div>
        <div className="wf-config-field">
          <label>Message Headers (JSON)</label>
          <textarea
            className="wf-config-textarea"
            rows={2}
            value={data.sampleHeaders ?? ''}
            onChange={(e) => update({ sampleHeaders: e.target.value || undefined })}
            placeholder='{"X-Correlation-Id": "order-123"}'
          />
        </div>
      </div>

      <div className="wf-config-field">
        <label>Load Test Behavior</label>
        <select value={loadTestBehavior.mode} onChange={(e) => applyLoadTestBehavior({ mode: e.target.value as KafkaConsumeLoadTestBehavior['mode'] })}>
          {LOAD_TEST_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {loadTestBehavior.mode !== 'wait-for-real' && (
        <div className="wf-config-field">
          <label>Mock Payload</label>
          <textarea
            className="wf-config-textarea"
            rows={4}
            value={mockPayloadText}
            onChange={(e) => handleMockPayloadChange(e.target.value)}
            aria-label="Mock Payload"
            placeholder={`{\n  "status": "ok"\n}`}
          />
        </div>
      )}

      <div className="wf-config-field">
        <label>Notes</label>
        <textarea
          className="wf-config-textarea"
          rows={3}
          value={data.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Optional description for this wait node"
        />
      </div>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
