import { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { KafkaConsumeLoadTestBehavior, KafkaConsumeNodeData, KafkaConsumeStartPosition, KafkaNodeMetadataBinding } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '@shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import KafkaSchemaConfigSection from './KafkaSchemaConfigSection';
import { createHeaderFilter, createJsonPathFilter } from './kafkaConfigFactories';
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';
import { CustomSelect } from '@shared/components/CustomSelect';

const START_OPTIONS: { value: KafkaConsumeStartPosition; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'earliest', label: 'Earliest' },
  { value: 'committed', label: 'Committed' },
];

const OUTPUT_SOURCE_OPTIONS: KafkaNodeMetadataBinding['source'][] = ['topic', 'partition', 'offset', 'timestamp', 'key'];

const LOAD_TEST_OPTIONS: { value: KafkaConsumeLoadTestBehavior['mode']; label: string }[] = [
  { value: 'wait-for-real', label: 'Wait for real' },
  { value: 'auto-resume', label: 'Auto resume' },
  { value: 'synthetic-inject', label: 'Synthetic inject' },
];

function createBinding(): KafkaNodeMetadataBinding {
  return { id: uuid().slice(0, 8), source: 'topic', targetVariable: '', enabled: true };
}

function stringifyMockPayload(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(value ?? {}, null, 2);
}

export default function KafkaConsumeConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: KafkaConsumeNodeData;
  onChange: (d: KafkaConsumeNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const headerFilters = data.headerFilters ?? [];
  const jsonPathFilters = data.jsonPathFilters ?? [];
  const outputBindings = data.outputBindings ?? [];
  const loadTestBehavior = data.loadTestBehavior ?? { mode: 'wait-for-real' as const };
  const [mockPayloadText, setMockPayloadText] = useState(() => stringifyMockPayload(loadTestBehavior.mockPayload));
  const update = (patch: Partial<KafkaConsumeNodeData>) => onChange({ ...data, ...patch });

  useEffect(() => {
    setMockPayloadText(stringifyMockPayload(data.loadTestBehavior?.mockPayload));
  }, [data.loadTestBehavior?.mockPayload]);

  const headerCrud = useListCrud(headerFilters, (items) => update({ headerFilters: items }));
  const jsonPathCrud = useListCrud(jsonPathFilters, (items) => update({ jsonPathFilters: items }));
  const bindingCrud = useListCrud(outputBindings, (items) => update({ outputBindings: items }));

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

  return (
    <div className="wf-config-body wf-kafka-consume-config" data-testid="kafka-consume-config">
      <KafkaCard
        title="Connection"
        hint="Cluster and topic for this consume step. Topic supports {{variable}} placeholders."
      >
        <div className="wf-kafka-form wf-kafka-form--connection">
          <KafkaFormRow label="Label" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Kafka Consume"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Cluster ID" hint="Configured cluster ID" compact>
            <input
              className="wf-kafka-form-input"
              data-testid="kafka-consume-cluster-input"
              value={data.clusterId}
              onChange={(e) => update({ clusterId: e.target.value })}
              placeholder="cluster-a"
            />
          </KafkaFormRow>

          <KafkaFormRow
            label="Topic"
            hint={<>e.g. <code>{'{{topic}}'}</code></>}
            compact
          >
            <input
              className="wf-kafka-form-input wf-kafka-form-input--mono"
              data-testid="kafka-consume-topic-input"
              value={data.topic}
              onChange={(e) => update({ topic: e.target.value })}
              placeholder="orders.events"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Filters"
        hint="Match messages by key, headers, and JSON body fields before the step resolves."
      >
        <div className="wf-kafka-form">
          <KafkaFormRow label="Key regex" hint="Optional — filter on message key.">
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) => update({ keyRegex: `${data.keyRegex ?? ''}${snippet}` })}
            >
              <ExpressionInput
                value={data.keyRegex ?? ''}
                onChange={(value) => update({ keyRegex: value })}
                placeholder="Optional regex filter"
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
            <KafkaEmptyState text="No header filters. Add one when messages must match envelope headers." />
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

        <div className="wf-kafka-subsection">
          <div className="wf-kafka-subsection-toolbar">
            <span className="wf-kafka-subsection-label">JSONPath filters</span>
            <KafkaAddButton
              onClick={() => update({ jsonPathFilters: [...jsonPathFilters, createJsonPathFilter()] })}
            />
          </div>
          {jsonPathFilters.length === 0 ? (
            <KafkaEmptyState text="No JSONPath filters. Match payload fields with $.path expressions." />
          ) : (
            <div className="wf-kafka-kv-panel">
              <div className="wf-config-kv-col-headers">
                <span className="wf-kv-col-toggle">On</span>
                <span className="wf-kv-col-fill">Path</span>
                <span className="wf-kv-col-fill">Expected</span>
                <span className="wf-kv-col-del" />
              </div>
              <div className="wf-config-kv-list">
                {jsonPathFilters.map((row, index) => (
                  <div key={row.id} className="wf-config-kv-row">
                    <div className="wf-kv-toggle">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => jsonPathCrud.update(index, { enabled: e.target.checked })}
                        aria-label={`Enable JSONPath filter ${row.jsonPath || index + 1}`}
                      />
                    </div>
                    <input
                      value={row.jsonPath}
                      placeholder="$.payload.id"
                      onChange={(e) => jsonPathCrud.update(index, { jsonPath: e.target.value })}
                    />
                    <div className="wf-config-kv-val-wrap">
                      <InsertVarField
                        onRequestVariableInsert={onRequestVariableInsert}
                        shortRef
                        onInsert={(snippet) => jsonPathCrud.update(index, { expectedValue: `${row.expectedValue ?? ''}${snippet}` })}
                        initialSearch={row.jsonPath}
                      >
                        <ExpressionInput
                          value={row.expectedValue ?? ''}
                          onChange={(value) => jsonPathCrud.update(index, { expectedValue: value })}
                          placeholder="Expected value"
                          variableHints={hintSet}
                        />
                      </InsertVarField>
                    </div>
                    <div className="wf-kv-del">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => jsonPathCrud.remove(index)}
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
        title="Consumption"
        hint="How long to wait, how many messages to take, and where to start reading."
      >
        <div className="wf-kafka-form wf-kafka-form--consume">
          <KafkaFormRow label="Timeout (ms)" hint="Wait for a matching message" compact>
            <input
              className="wf-kafka-form-input"
              type="number"
              value={data.timeoutMs ?? ''}
              onChange={(e) => update({ timeoutMs: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="30000"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Max messages" hint="Stop after this many matches" compact>
            <input
              className="wf-kafka-form-input"
              type="number"
              value={data.maxMessages ?? ''}
              onChange={(e) => update({ maxMessages: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="1"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Start position" hint="Latest · Earliest · Committed" compact>
            <CustomSelect
              value={data.startPosition ?? 'latest'}
              onChange={(v) => update({ startPosition: v as KafkaConsumeStartPosition })}
              options={START_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            />
          </KafkaFormRow>

          <KafkaFormRow label="Load test" hint="Behavior under load / dry runs" compact>
            <CustomSelect
              value={loadTestBehavior.mode}
              onChange={(v) => applyLoadTestBehavior({ mode: v as KafkaConsumeLoadTestBehavior['mode'] })}
              options={LOAD_TEST_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
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
              rows={6}
              value={mockPayloadText}
              onChange={(e) => handleMockPayloadChange(e.target.value)}
              aria-label="Mock Payload"
              placeholder={`{\n  "status": "ok"\n}`}
            />
          </div>
        )}

        {loadTestBehavior.mode === 'synthetic-inject' && (
          <div className="wf-kafka-form wf-kafka-form--consume">
            <KafkaFormRow label="Synth delay (ms)" hint="Base delay before inject" compact>
              <input
                className="wf-kafka-form-input"
                type="number"
                value={loadTestBehavior.syntheticDelayMs ?? ''}
                onChange={(e) => applyLoadTestBehavior({ syntheticDelayMs: e.target.value === '' ? undefined : Number(e.target.value) })}
                aria-label="Synthetic Delay (ms)"
                placeholder="1000"
              />
            </KafkaFormRow>
            <KafkaFormRow label="Synth jitter (ms)" hint="Random extra delay" compact>
              <input
                className="wf-kafka-form-input"
                type="number"
                value={loadTestBehavior.syntheticJitterMs ?? ''}
                onChange={(e) => applyLoadTestBehavior({ syntheticJitterMs: e.target.value === '' ? undefined : Number(e.target.value) })}
                aria-label="Synthetic Jitter (ms)"
                placeholder="100"
              />
            </KafkaFormRow>
          </div>
        )}
      </KafkaCard>

      <KafkaCard
        title="Output bindings"
        hint="Map consumed message metadata into workflow variables for downstream nodes."
        hintBelow
        testId="output-bindings-section"
        action={(
          <KafkaAddButton
            testId="node-binding-add-btn"
            onClick={() => update({ outputBindings: [...outputBindings, createBinding()] })}
          />
        )}
      >
        {outputBindings.length === 0 ? (
          <KafkaEmptyState
            title="No output bindings"
            text="Bind partition, offset, timestamp, topic, or key to a variable name."
            actionLabel="+ Add binding"
            onAction={() => update({ outputBindings: [...outputBindings, createBinding()] })}
          />
        ) : (
          <div className="wf-kafka-bindings-panel">
            <div className="wf-kafka-bindings-header" aria-hidden="true">
              <span className="wf-kafka-bindings-col-on">On</span>
              <span className="wf-kafka-bindings-col-source">Source</span>
              <span className="wf-kafka-bindings-col-target">Target variable</span>
              <span className="wf-kafka-bindings-col-del" />
            </div>
            <div className="wf-kafka-bindings-list">
              {outputBindings.map((row, index) => (
                <div key={row.id} className="wf-kafka-bindings-row">
                  <div className="wf-kafka-bindings-col-on">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => bindingCrud.update(index, { enabled: e.target.checked })}
                      aria-label={`Enable binding ${row.targetVariable || index + 1}`}
                    />
                  </div>
                  <div className="wf-kafka-bindings-col-source">
                    <CustomSelect
                      value={row.source}
                      onChange={(v) => bindingCrud.update(index, { source: v as KafkaNodeMetadataBinding['source'] })}
                      options={OUTPUT_SOURCE_OPTIONS.map((source) => ({ value: source, label: source }))}
                    />
                  </div>
                  <div className="wf-kafka-bindings-col-target">
                    <input
                      value={row.targetVariable}
                      onChange={(e) => bindingCrud.update(index, { targetVariable: e.target.value })}
                      placeholder="targetVariable"
                    />
                  </div>
                  <div className="wf-kafka-bindings-col-del">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => bindingCrud.remove(index)}
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

      <KafkaSchemaConfigSection
        value={data.schemaConfig}
        onChange={(schemaConfig) => update({ schemaConfig })}
        topic={data.topic ?? ''}
      />

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
