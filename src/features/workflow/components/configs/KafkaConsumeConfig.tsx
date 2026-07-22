import { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { KafkaConsumeLoadTestBehavior, KafkaConsumeNodeData, KafkaConsumeStartPosition, KafkaNodeMetadataBinding } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import KafkaSchemaConfigSection from './KafkaSchemaConfigSection';
import { createHeaderFilter, createJsonPathFilter } from './kafkaConfigFactories';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

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
    <div className="wf-config-body">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <div className="wf-config-field--row">
        <label>Cluster ID</label>
        <input value={data.clusterId} onChange={(e) => update({ clusterId: e.target.value })} placeholder="cluster-a" />
      </div>

      <div className="wf-config-field--row">
        <label>Topic</label>
        <input value={data.topic} onChange={(e) => update({ topic: e.target.value })} placeholder="orders.events" />
      </div>

      <div className="wf-config-field--row">
        <label>Key Regex</label>
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
      </div>

      <div className="wf-kafka-section">
        <div className="wf-kafka-section-title">
          Header Filters
          <button type="button" className="wf-section-add-btn" onClick={() => update({ headerFilters: [...headerFilters, createHeaderFilter()] })}>+ Add</button>
        </div>
        {headerFilters.length > 0 && (
          <div className="wf-config-kv-col-headers">
            <span className="wf-kv-col-toggle">On</span>
            <span className="wf-kv-col-fill">Name</span>
            <span className="wf-kv-col-fill">Value</span>
            <span className="wf-kv-col-del" />
          </div>
        )}
        <div className="wf-config-kv-list">
          {headerFilters.map((row, index) => (
            <div key={row.id} className="wf-config-kv-row">
              <div className="wf-kv-toggle">
                <input type="checkbox" checked={row.enabled} onChange={(e) => headerCrud.update(index, { enabled: e.target.checked })} />
              </div>
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
              <div className="wf-kv-del">
                <button type="button" className="btn btn-sm btn-danger" onClick={() => headerCrud.remove(index)}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="wf-kafka-section">
        <div className="wf-kafka-section-title">
          JSONPath Filters
          <button type="button" className="wf-section-add-btn" onClick={() => update({ jsonPathFilters: [...jsonPathFilters, createJsonPathFilter()] })}>+ Add</button>
        </div>
        {jsonPathFilters.length > 0 && (
          <div className="wf-config-kv-col-headers">
            <span className="wf-kv-col-toggle">On</span>
            <span className="wf-kv-col-fill">Path</span>
            <span className="wf-kv-col-fill">Expected</span>
            <span className="wf-kv-col-del" />
          </div>
        )}
        <div className="wf-config-kv-list">
          {jsonPathFilters.map((row, index) => (
            <div key={row.id} className="wf-config-kv-row">
              <div className="wf-kv-toggle">
                <input type="checkbox" checked={row.enabled} onChange={(e) => jsonPathCrud.update(index, { enabled: e.target.checked })} />
              </div>
              <input value={row.jsonPath} placeholder="$.payload.id" onChange={(e) => jsonPathCrud.update(index, { jsonPath: e.target.value })} />
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
                <button type="button" className="btn btn-sm btn-danger" onClick={() => jsonPathCrud.remove(index)}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="wf-config-field-pair">
        <div className="wf-config-field--row">
          <label>Timeout (ms)</label>
          <input
            type="number"
            value={data.timeoutMs ?? ''}
            onChange={(e) => update({ timeoutMs: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="30000"
          />
        </div>
        <div className="wf-config-field--row">
          <label>Max Messages</label>
          <input
            type="number"
            value={data.maxMessages ?? ''}
            onChange={(e) => update({ maxMessages: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="1"
          />
        </div>
      </div>

      <div className="wf-config-field-pair">
        <div className="wf-config-field--row">
          <label>Start Position</label>
          <CustomSelect
            value={data.startPosition ?? 'latest'}
            onChange={(v) => update({ startPosition: v as KafkaConsumeStartPosition })}
            options={START_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
        </div>
        <div className="wf-config-field--row">
          <label>Load Test</label>
          <CustomSelect
            value={loadTestBehavior.mode}
            onChange={(v) => applyLoadTestBehavior({ mode: v as KafkaConsumeLoadTestBehavior['mode'] })}
            options={LOAD_TEST_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
        </div>
      </div>

      {loadTestBehavior.mode !== 'wait-for-real' && (
        <div className="wf-config-field">
          <label>Mock Payload</label>
          <textarea
            className="wf-config-textarea"
            rows={6}
            value={mockPayloadText}
            onChange={(e) => handleMockPayloadChange(e.target.value)}
            aria-label="Mock Payload"
            placeholder={`{\n  "status": "ok"\n}`}
          />
        </div>
      )}

      {loadTestBehavior.mode === 'synthetic-inject' && (
        <div className="wf-config-field-pair">
          <div className="wf-config-field--row">
            <label>Synth Delay (ms)</label>
            <input
              type="number"
              value={loadTestBehavior.syntheticDelayMs ?? ''}
              onChange={(e) => applyLoadTestBehavior({ syntheticDelayMs: e.target.value === '' ? undefined : Number(e.target.value) })}
              aria-label="Synthetic Delay (ms)"
              placeholder="1000"
            />
          </div>
          <div className="wf-config-field--row">
            <label>Synth Jitter (ms)</label>
            <input
              type="number"
              value={loadTestBehavior.syntheticJitterMs ?? ''}
              onChange={(e) => applyLoadTestBehavior({ syntheticJitterMs: e.target.value === '' ? undefined : Number(e.target.value) })}
              aria-label="Synthetic Jitter (ms)"
              placeholder="100"
            />
          </div>
        </div>
      )}

      <div className="wf-kafka-section" data-testid="output-bindings-section">
        <div className="wf-kafka-section-title">
          Output Bindings
          <button type="button" className="wf-section-add-btn" data-testid="node-binding-add-btn" onClick={() => update({ outputBindings: [...outputBindings, createBinding()] })}>+ Add</button>
        </div>
        {outputBindings.length > 0 && (
          <div className="wf-config-kv-col-headers">
            <span className="wf-kv-col-toggle">On</span>
            <span className="wf-kv-col-fill">Source</span>
            <span className="wf-kv-col-fill">Target Variable</span>
            <span className="wf-kv-col-del" />
          </div>
        )}
        <div className="wf-config-kv-list">
          {outputBindings.map((row, index) => (
            <div key={row.id} className="wf-config-kv-row">
              <div className="wf-kv-toggle">
                <input type="checkbox" checked={row.enabled} onChange={(e) => bindingCrud.update(index, { enabled: e.target.checked })} />
              </div>
              <CustomSelect
                value={row.source}
                onChange={(v) => bindingCrud.update(index, { source: v as KafkaNodeMetadataBinding['source'] })}
                options={OUTPUT_SOURCE_OPTIONS.map((source) => ({ value: source, label: source }))}
              />
              <input
                value={row.targetVariable}
                onChange={(e) => bindingCrud.update(index, { targetVariable: e.target.value })}
                placeholder="targetVariable"
              />
              <div className="wf-kv-del">
                <button type="button" className="btn btn-sm btn-danger" onClick={() => bindingCrud.remove(index)}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <KafkaSchemaConfigSection
        value={data.schemaConfig}
        onChange={(schemaConfig) => update({ schemaConfig })}
        topic={data.topic ?? ''}
      />

      <AvailableVariables hints={variableHints} />
    </div>
  );
}