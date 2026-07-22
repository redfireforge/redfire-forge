import { useMemo } from 'react';
import type {
  KafkaTriggerNodeData,
  KafkaTriggerOffsetPolicy,
} from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import { createHeaderFilter, createJsonPathFilter, createExtractVariable } from './kafkaConfigFactories';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

const OFFSET_OPTIONS: { value: KafkaTriggerOffsetPolicy; label: string }[] = [
  { value: 'latest', label: 'Latest (no replay)' },
  { value: 'earliest', label: 'Earliest (replay all)' },
];

export default function KafkaTriggerConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: KafkaTriggerNodeData;
  onChange: (d: KafkaTriggerNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const headerFilters = data.headerFilters ?? [];
  const jsonPathFilters = data.jsonPathFilters ?? [];
  const extractVariables = data.extractVariables ?? [];
  const update = (patch: Partial<KafkaTriggerNodeData>) => onChange({ ...data, ...patch });

  const headerCrud = useListCrud(headerFilters, (items) => update({ headerFilters: items }));
  const jsonPathCrud = useListCrud(jsonPathFilters, (items) => update({ jsonPathFilters: items }));

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
    <div className="wf-config-body" data-testid="kafka-trigger-config">
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
        <input value={data.topic} onChange={(e) => update({ topic: e.target.value })} placeholder="orders.created" />
      </div>

      <div className="wf-config-field--row">
        <label>Group ID</label>
        <input
          value={data.consumerGroupId ?? ''}
          onChange={(e) => update({ consumerGroupId: e.target.value || undefined })}
          placeholder="Auto-derived from workflow + node ID"
        />
      </div>
      <span className="wf-config-row-hint">Leave empty to use the default deterministic group ID.</span>

      <div className="wf-config-field-pair">
        <div className="wf-config-field--row">
          <label>Offset Policy</label>
          <CustomSelect
            value={data.startPosition ?? 'latest'}
            onChange={(v) => update({ startPosition: v as KafkaTriggerOffsetPolicy })}
            options={OFFSET_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        </div>
        <div className="wf-config-field--row">
          <label>Max Concurrent</label>
          <input
            type="number"
            value={data.maxConcurrentRuns ?? ''}
            onChange={(e) => update({ maxConcurrentRuns: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="10"
          />
        </div>
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
            placeholder="Optional regex filter on message key"
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
              <input value={row.jsonPath} placeholder="$.payload.type" onChange={(e) => jsonPathCrud.update(index, { jsonPath: e.target.value })} />
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

      <div className="wf-kafka-section">
        <div className="wf-kafka-section-title">
          Extract Variables
          <button type="button" className="wf-section-add-btn" onClick={() => update({ extractVariables: [...extractVariables, createExtractVariable()] })}>+ Add</button>
        </div>
        <span className="wf-config-hint">Extract fields from the trigger message body into workflow variables via JSONPath.</span>
        {extractVariables.length > 0 && (
          <div className="wf-config-kv-col-headers" style={{ marginTop: 6 }}>
            <span className="wf-kv-col-fill">Variable Name</span>
            <span className="wf-kv-col-fill">JSONPath</span>
            <span className="wf-kv-col-del" />
          </div>
        )}
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
              <div className="wf-kv-del">
                <button type="button" className="btn btn-sm btn-danger" onClick={() => handleExtractRemove(index)}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="wf-kafka-section">
        <div className="wf-kafka-section-title">Test Payload (Quick Test)</div>
        <span className="wf-config-hint">
          Provide a sample Kafka message body so Quick Test uses real values instead of dry-running with empty variables.
        </span>
        <div className="wf-config-field">
          <label>Message Body (JSON)</label>
          <textarea
            className="wf-config-textarea"
            rows={5}
            value={data.samplePayload ?? ''}
            onChange={(e) => update({ samplePayload: e.target.value || undefined })}
            placeholder={`{\n  "orderId": "order-123",\n  "customerId": "cust-456",\n  "amount": 99.99\n}`}
          />
        </div>
        <div className="wf-config-field--row">
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
            placeholder='{"X-Source": "test", "X-Region": "us-east"}'
          />
        </div>
      </div>

      <div className="wf-config-field">
        <label>Notes</label>
        <textarea
          className="wf-config-textarea"
          rows={3}
          value={data.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Optional description for this trigger"
        />
      </div>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
