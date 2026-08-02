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
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

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

  const correlationSource = data.correlationSource ?? 'body';

  return (
    <div className="wf-config-body wf-kafka-wait-config" data-testid="kafka-wait-config">
      <KafkaCard
        title="Connection"
        hint="Cluster and topic to subscribe while waiting for a correlated message."
      >
        <div className="wf-kafka-form wf-kafka-form--connection">
          <KafkaFormRow label="Label" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Kafka Wait"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Cluster ID" hint="Configured cluster ID" compact>
            <input
              className="wf-kafka-form-input"
              value={data.clusterId}
              onChange={(e) => update({ clusterId: e.target.value })}
              placeholder="cluster-a"
            />
          </KafkaFormRow>

          <KafkaFormRow
            label="Topic"
            hint={<>e.g. <code>payments.confirmed</code></>}
            compact
          >
            <input
              className="wf-kafka-form-input wf-kafka-form-input--mono"
              value={data.topic}
              onChange={(e) => update({ topic: e.target.value })}
              placeholder="payments.authorized"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Correlation Matching"
        hint="Pause until an inbound message matches the expected correlation ID."
        testId="wait-correlation-section"
      >
        <div className="wf-kafka-form wf-kafka-form--wait-correlation">
          <KafkaFormRow label="ID expression" hint={<>e.g. <code>{'{{orderId}}'}</code></>}>
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
          </KafkaFormRow>

          <KafkaFormRow label="Source" hint="Where to read the correlation ID" compact>
            <CustomSelect
              value={correlationSource}
              onChange={(v) => update({ correlationSource: v as KafkaWaitCorrelationSource })}
              options={CORRELATION_SOURCE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
          </KafkaFormRow>

          {correlationSource === 'body' && (
            <KafkaFormRow label="JSONPath" hint="Path in message body" compact>
              <input
                className="wf-kafka-form-input wf-kafka-form-input--mono"
                value={data.correlationJsonPath ?? ''}
                onChange={(e) => update({ correlationJsonPath: e.target.value || undefined })}
                placeholder="$.orderId"
              />
            </KafkaFormRow>
          )}

          {correlationSource === 'header' && (
            <KafkaFormRow label="Header name" hint="Header carrying the ID" compact>
              <input
                className="wf-kafka-form-input"
                value={data.correlationHeader ?? ''}
                onChange={(e) => update({ correlationHeader: e.target.value || undefined })}
                placeholder="X-Correlation-Id"
              />
            </KafkaFormRow>
          )}

          {correlationSource === 'key' && (
            <div className="wf-kafka-form-note">
              The message key is used directly as the correlation ID.
            </div>
          )}
        </div>
      </KafkaCard>

      <KafkaCard
        title="Wait & filters"
        hint="Timeout, optional key pre-filter, and header match rules before correlation."
      >
        <div className="wf-kafka-form wf-kafka-form--consume">
          <KafkaFormRow
            label="Timeout (ms)"
            hint="0 = unlimited wait. Workflow fails if no match within timeout."
            compact
          >
            <input
              className="wf-kafka-form-input"
              type="number"
              value={data.timeoutMs ?? ''}
              onChange={(e) => update({ timeoutMs: e.target.value === '' ? 0 : Number(e.target.value) })}
              placeholder="30000"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Key regex" hint="Optional pre-filter on message key">
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
          </KafkaFormRow>
        </div>

        <div className="wf-kafka-subsection">
          <div className="wf-kafka-subsection-toolbar">
            <span className="wf-kafka-subsection-label">Header filters</span>
            <KafkaAddButton
              onClick={() => update({ headerFilters: [...headerFilters, createHeaderFilter()] })}
            />
          </div>
          {headerFilters.length === 0 ? (
            <KafkaEmptyState text="No header filters. Add one when messages must match envelope headers first." />
          ) : (
            <div className="wf-kafka-kv-panel">
              <div className="wf-config-kv-col-headers">
                <span className="wf-kv-col-toggle">On</span>
                <span className="wf-kv-col-fill">Name</span>
                <span className="wf-kv-col-fill">Value</span>
                <span className="wf-kv-col-del" />
              </div>
              <div className="wf-config-kv-list">
                {headerFilters.map((row, index) => (
                  <div key={row.id} className="wf-config-kv-row">
                    <div className="wf-kv-toggle">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => headerCrud.update(index, { enabled: e.target.checked })}
                        aria-label={`Enable header filter ${row.key || index + 1}`}
                      />
                    </div>
                    <input
                      value={row.key}
                      placeholder="Header name"
                      onChange={(e) => headerCrud.update(index, { key: e.target.value })}
                    />
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
                    <div className="wf-kv-del">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => headerCrud.remove(index)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </KafkaCard>

      <KafkaCard
        title="Extract Variables"
        hint="Pull fields from the correlated message body into workflow variables."
        action={(
          <KafkaAddButton
            onClick={() => update({ extractVariables: [...extractVariables, createExtractVariable()] })}
          />
        )}
      >
        {extractVariables.length === 0 ? (
          <KafkaEmptyState
            title="No extractions"
            text="Extract fields from the correlated message body into workflow variables."
            actionLabel="+ Add extraction"
            onAction={() => update({ extractVariables: [...extractVariables, createExtractVariable()] })}
          />
        ) : (
          <div className="wf-kafka-extract-panel">
            <div className="wf-kafka-extract-header" aria-hidden="true">
              <span className="wf-kafka-extract-col-name">Variable name</span>
              <span className="wf-kafka-extract-col-path">JSONPath</span>
              <span className="wf-kafka-extract-col-del" />
            </div>
            <div className="wf-kafka-extract-list">
              {extractVariables.map((ev, index) => (
                <div key={index} className="wf-kafka-extract-row">
                  <div className="wf-kafka-extract-col-name">
                    <input
                      value={ev.name}
                      placeholder="Variable name"
                      onChange={(e) => handleExtractChange(index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="wf-kafka-extract-col-path">
                    <input
                      value={ev.jsonPath}
                      placeholder="$.field.path"
                      onChange={(e) => handleExtractChange(index, 'jsonPath', e.target.value)}
                    />
                  </div>
                  <div className="wf-kafka-extract-col-del">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleExtractRemove(index)}
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

      <KafkaCard
        title="Quick Test"
        hint="Sample response so Quick Test can resolve this wait without a live Kafka subscription."
      >
        <div className="wf-kafka-subsection wf-kafka-subsection--body-template">
          <div className="wf-kafka-subsection-toolbar">
            <span className="wf-kafka-subsection-label">Message body (JSON)</span>
          </div>
          <textarea
            className="wf-config-textarea wf-kafka-form-textarea"
            data-testid="wait-sample-payload"
            rows={5}
            value={data.samplePayload ?? ''}
            onChange={(e) => update({ samplePayload: e.target.value || undefined })}
            placeholder={`{\n  "orderId": "order-123",\n  "status": "approved",\n  "approvedAt": "2026-01-01T00:00:00Z"\n}`}
          />
        </div>

        <div className="wf-kafka-form wf-kafka-form--connection">
          <KafkaFormRow label="Message key" hint="Optional sample key" compact>
            <input
              className="wf-kafka-form-input"
              value={data.sampleKey ?? ''}
              onChange={(e) => update({ sampleKey: e.target.value || undefined })}
              placeholder="Optional key (e.g. order-123)"
            />
          </KafkaFormRow>
        </div>

        <div className="wf-kafka-subsection wf-kafka-subsection--body-template">
          <div className="wf-kafka-subsection-toolbar">
            <span className="wf-kafka-subsection-label">Message headers (JSON)</span>
          </div>
          <textarea
            className="wf-config-textarea wf-kafka-form-textarea"
            rows={2}
            value={data.sampleHeaders ?? ''}
            onChange={(e) => update({ sampleHeaders: e.target.value || undefined })}
            placeholder='{"X-Correlation-Id": "order-123"}'
          />
        </div>
      </KafkaCard>

      <KafkaCard
        title="Load test"
        hint="How this wait behaves during load / performance runs."
      >
        <div className="wf-kafka-form wf-kafka-form--consume">
          <KafkaFormRow label="Mode" hint="Wait · Auto resume · Synthetic" compact>
            <CustomSelect
              data-testid="wait-load-mode"
              value={loadTestBehavior.mode}
              onChange={(v) => applyLoadTestBehavior({ mode: v as KafkaConsumeLoadTestBehavior['mode'] })}
              options={LOAD_TEST_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
          </KafkaFormRow>
        </div>

        {loadTestBehavior.mode !== 'wait-for-real' && (
          <div className="wf-kafka-subsection">
            <div className="wf-kafka-subsection-toolbar">
              <span className="wf-kafka-subsection-label">Mock payload</span>
              <span className="wf-kafka-subsection-meta">JSON object used when not waiting for real messages</span>
            </div>
            <textarea
              className="wf-config-textarea wf-kafka-form-textarea"
              rows={4}
              value={mockPayloadText}
              onChange={(e) => handleMockPayloadChange(e.target.value)}
              aria-label="Mock Payload"
              placeholder={`{\n  "status": "ok"\n}`}
            />
          </div>
        )}
      </KafkaCard>

      <KafkaCard title="Notes" hint="Optional description for teammates.">
        <div className="wf-kafka-card-pad">
          <textarea
            className="wf-config-textarea wf-kafka-form-textarea"
            rows={3}
            value={data.notes ?? ''}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Optional description for this wait node"
          />
        </div>
      </KafkaCard>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
