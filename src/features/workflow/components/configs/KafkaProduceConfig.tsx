import { useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import type { KafkaAckMode, KafkaNodeHeaderRow, KafkaNodeMetadataBinding, KafkaProduceNodeData } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import KafkaSchemaConfigSection from './KafkaSchemaConfigSection';

const ACK_OPTIONS: { value: KafkaAckMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'leader', label: 'Leader' },
  { value: 'none', label: 'None' },
];

const OUTPUT_SOURCE_OPTIONS: KafkaNodeMetadataBinding['source'][] = ['topic', 'partition', 'offset', 'timestamp', 'key'];

function createHeader(): KafkaNodeHeaderRow {
  return { id: uuid().slice(0, 8), key: '', value: '', enabled: true };
}

function createBinding(): KafkaNodeMetadataBinding {
  return { id: uuid().slice(0, 8), source: 'topic', targetVariable: '', enabled: true };
}

export default function KafkaProduceConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: KafkaProduceNodeData;
  onChange: (d: KafkaProduceNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const headers = data.headers ?? [];
  const outputBindings = data.outputBindings ?? [];
  const update = (patch: Partial<KafkaProduceNodeData>) => onChange({ ...data, ...patch });

  const headerCrud = useListCrud(headers, (items) => update({ headers: items }));
  const bindingCrud = useListCrud(outputBindings, (items) => update({ outputBindings: items }));

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
        <label>Key Template</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          shortRef
          onInsert={(snippet) => update({ keyTemplate: `${data.keyTemplate ?? ''}${snippet}` })}
        >
          <ExpressionInput
            value={data.keyTemplate ?? ''}
            onChange={(value) => update({ keyTemplate: value })}
            placeholder="e.g. {{orderId}}"
            variableHints={hintSet}
          />
        </InsertVarField>
      </div>

      <div className="wf-config-field-pair">
        <div className="wf-config-field--row">
          <label>Partition</label>
          <input
            type="number"
            value={data.partition ?? ''}
            onChange={(e) => update({ partition: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="Auto"
          />
        </div>
        <div className="wf-config-field--row">
          <label>Ack Mode</label>
          <select value={data.ackMode ?? 'all'} onChange={(e) => update({ ackMode: e.target.value as KafkaAckMode })}>
            {ACK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      <div className="wf-kafka-section">
        <div className="wf-kafka-section-title">
          Headers
          <button type="button" className="wf-section-add-btn" onClick={() => update({ headers: [...headers, createHeader()] })}>+ Add</button>
        </div>
        {headers.length > 0 && (
          <div className="wf-config-kv-col-headers">
            <span className="wf-kv-col-toggle">On</span>
            <span className="wf-kv-col-fill">Name</span>
            <span className="wf-kv-col-fill">Value</span>
            <span className="wf-kv-col-del" />
          </div>
        )}
        <div className="wf-config-kv-list">
          {headers.map((row, index) => (
            <div key={row.id} className="wf-config-kv-row">
              <div className="wf-kv-toggle">
                <input type="checkbox" checked={row.enabled} onChange={(e) => headerCrud.update(index, { enabled: e.target.checked })} />
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
                    placeholder="Value"
                    onChange={(value) => headerCrud.update(index, { value })}
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

      <div className="wf-config-field">
        <label>Body Template</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          shortRef
          onInsert={(snippet) => update({ bodyTemplate: `${data.bodyTemplate ?? ''}${snippet}` })}
        >
          <textarea
            className="wf-config-textarea"
            rows={5}
            value={data.bodyTemplate ?? ''}
            onChange={(e) => update({ bodyTemplate: e.target.value })}
            placeholder="JSON or plain text template with {{variables}}"
          />
        </InsertVarField>
      </div>

      <div className="wf-config-field--row">
        <label>Timeout (ms)</label>
        <input
          type="number"
          value={data.timeoutMs ?? ''}
          onChange={(e) => update({ timeoutMs: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="10000"
        />
      </div>

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
              <select value={row.source} onChange={(e) => bindingCrud.update(index, { source: e.target.value as KafkaNodeMetadataBinding['source'] })}>
                {OUTPUT_SOURCE_OPTIONS.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
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