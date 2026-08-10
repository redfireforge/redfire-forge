import { useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import type { KafkaAckMode, KafkaNodeHeaderRow, KafkaNodeMetadataBinding, KafkaProduceNodeData } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import KafkaSchemaConfigSection from './KafkaSchemaConfigSection';
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

const ACK_OPTIONS: { value: KafkaAckMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'leader', label: 'Leader' },
  { value: 'none', label: 'None' },
];

const OUTPUT_SOURCE_OPTIONS: KafkaNodeMetadataBinding['source'][] = [
  'topic',
  'partition',
  'offset',
  'timestamp',
  'key',
];

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
    <div className="wf-config-body wf-kafka-produce-config" data-testid="kafka-produce-config">
      <KafkaCard
        title="Connection"
        hint="Cluster and topic for this produce step. Topic supports {{variable}} placeholders."
      >
        <div className="wf-kafka-form wf-kafka-form--connection">
          <KafkaFormRow label="Label" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Kafka Produce"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Cluster ID" hint="Configured cluster ID" compact>
            <input
              className="wf-kafka-form-input"
              data-testid="kafka-produce-cluster-input"
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
              data-testid="kafka-produce-topic-input"
              value={data.topic}
              onChange={(e) => update({ topic: e.target.value })}
              placeholder="orders.events"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Message"
        hint="Key, headers, and body published to the topic."
      >
        <div className="wf-kafka-form">
          <KafkaFormRow label="Key template" hint="Optional — used for partition assignment.">
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
          </KafkaFormRow>
        </div>

        <div className="wf-kafka-subsection">
          <div className="wf-kafka-subsection-toolbar">
            <span className="wf-kafka-subsection-label">Headers</span>
            <KafkaAddButton
              onClick={() => update({ headers: [...headers, createHeader()] })}
            />
          </div>
          {headers.length === 0 ? (
            <KafkaEmptyState text="No headers yet. Add envelope metadata when the consumer needs it." />
          ) : (
            <div className="wf-kafka-kv-panel">
              <div className="wf-config-kv-col-headers">
                <span className="wf-kv-col-toggle">On</span>
                <span className="wf-kv-col-fill">Name</span>
                <span className="wf-kv-col-fill">Value</span>
                <span className="wf-kv-col-del" />
              </div>
              <div className="wf-config-kv-list">
                {headers.map((row, index) => (
                  <div key={row.id} className="wf-config-kv-row">
                    <div className="wf-kv-toggle">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => headerCrud.update(index, { enabled: e.target.checked })}
                        aria-label={`Enable header ${row.key || index + 1}`}
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
                          placeholder="Value"
                          onChange={(value) => headerCrud.update(index, { value })}
                          variableHints={hintSet}
                        />
                      </InsertVarField>
                    </div>
                    <div className="wf-kv-del">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => headerCrud.remove(index)}
                        aria-label={`Remove header ${row.key || index + 1}`}
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

        <div className="wf-kafka-subsection wf-kafka-subsection--body-template">
          <div className="wf-kafka-subsection-toolbar">
            <span className="wf-kafka-subsection-label">Body template</span>
            <span className="wf-kafka-subsection-meta">Supports <code>{'{{variables}}'}</code></span>
          </div>
          <InsertVarField
            onRequestVariableInsert={onRequestVariableInsert}
            shortRef
            onInsert={(snippet) => update({ bodyTemplate: `${data.bodyTemplate ?? ''}${snippet}` })}
          >
            <textarea
              data-testid="kafka-produce-body-textarea"
              className="wf-config-textarea wf-kafka-form-textarea"
              rows={5}
              value={data.bodyTemplate ?? ''}
              onChange={(e) => update({ bodyTemplate: e.target.value })}
              placeholder={`{\n  "demo": "workflow",\n  "runId": "{{runId}}"\n}`}
            />
          </InsertVarField>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Delivery"
        hint="Partition targeting, broker acknowledgements, and produce timeout."
      >
        <div className="wf-kafka-form wf-kafka-form--delivery">
          <KafkaFormRow label="Partition" hint="Auto if empty" compact>
            <input
              className="wf-kafka-form-input"
              type="number"
              value={data.partition ?? ''}
              onChange={(e) => update({ partition: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="Auto"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Ack mode" hint="All · Leader · None" compact>
            <CustomSelect
              value={data.ackMode ?? 'all'}
              onChange={(v) => update({ ackMode: v as KafkaAckMode })}
              options={ACK_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            />
          </KafkaFormRow>

          <KafkaFormRow label="Timeout (ms)" hint="Broker ack wait" compact>
            <input
              className="wf-kafka-form-input"
              type="number"
              value={data.timeoutMs ?? ''}
              onChange={(e) => update({ timeoutMs: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="10000"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Output bindings"
        hint="Map produce metadata into workflow variables for downstream nodes."
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
                      aria-label={`Remove binding ${row.targetVariable || index + 1}`}
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
