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
        <input value={data.topic} onChange={(e) => update({ topic: e.target.value })} placeholder="orders.events" />
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
            placeholder="Optional regex filter"
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
        <div className="wf-kafka-section-title">JSONPath Filters</div>
        <div className="wf-config-kv-list">
          {jsonPathFilters.map((row, index) => (
            <div key={row.id} className="wf-config-kv-row">
              <label className="wf-config-checkbox-label" style={{ minWidth: 72 }}>
                <input type="checkbox" checked={row.enabled} onChange={(e) => jsonPathCrud.update(index, { enabled: e.target.checked })} />
                Enabled
              </label>
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
              <button type="button" className="btn btn-sm btn-danger" onClick={() => jsonPathCrud.remove(index)}>×</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm" onClick={() => update({ jsonPathFilters: [...jsonPathFilters, createJsonPathFilter()] })}>+ Add JSONPath Filter</button>
      </div>

      <div className="wf-config-field">
        <label>Timeout (ms)</label>
        <input
          type="number"
          value={data.timeoutMs ?? ''}
          onChange={(e) => update({ timeoutMs: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="30000"
        />
      </div>

      <div className="wf-config-field">
        <label>Max Messages</label>
        <input
          type="number"
          value={data.maxMessages ?? ''}
          onChange={(e) => update({ maxMessages: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="1"
        />
      </div>

      <div className="wf-config-field">
        <label>Start Position</label>
        <select value={data.startPosition ?? 'latest'} onChange={(e) => update({ startPosition: e.target.value as KafkaConsumeStartPosition })}>
          {START_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div className="wf-config-field">
        <label>Load Test Behavior</label>
        <select value={loadTestBehavior.mode} onChange={(e) => applyLoadTestBehavior({ mode: e.target.value as KafkaConsumeLoadTestBehavior['mode'] })}>
          {LOAD_TEST_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
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
        <>
          <div className="wf-config-field">
            <label>Synthetic Delay (ms)</label>
            <input
              type="number"
              value={loadTestBehavior.syntheticDelayMs ?? ''}
              onChange={(e) => applyLoadTestBehavior({ syntheticDelayMs: e.target.value === '' ? undefined : Number(e.target.value) })}
              aria-label="Synthetic Delay (ms)"
              placeholder="1000"
            />
          </div>
          <div className="wf-config-field">
            <label>Synthetic Jitter (ms)</label>
            <input
              type="number"
              value={loadTestBehavior.syntheticJitterMs ?? ''}
              onChange={(e) => applyLoadTestBehavior({ syntheticJitterMs: e.target.value === '' ? undefined : Number(e.target.value) })}
              aria-label="Synthetic Jitter (ms)"
              placeholder="100"
            />
          </div>
        </>
      )}

      <div className="wf-kafka-section">
        <div className="wf-kafka-section-title">Output Bindings</div>
        <div className="wf-config-kv-list">
          {outputBindings.map((row, index) => (
            <div key={row.id} className="wf-config-kv-row">
              <label className="wf-config-checkbox-label" style={{ minWidth: 72 }}>
                <input type="checkbox" checked={row.enabled} onChange={(e) => bindingCrud.update(index, { enabled: e.target.checked })} />
                Enabled
              </label>
              <select value={row.source} onChange={(e) => bindingCrud.update(index, { source: e.target.value as KafkaNodeMetadataBinding['source'] })}>
                {OUTPUT_SOURCE_OPTIONS.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
              <input
                value={row.targetVariable}
                onChange={(e) => bindingCrud.update(index, { targetVariable: e.target.value })}
                placeholder="targetVariable"
              />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => bindingCrud.remove(index)}>×</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm" onClick={() => update({ outputBindings: [...outputBindings, createBinding()] })}>+ Add Binding</button>
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