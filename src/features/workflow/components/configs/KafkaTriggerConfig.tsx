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
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';
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
    <div className="wf-config-body wf-kafka-trigger-config" data-testid="kafka-trigger-config">
      <KafkaCard
        title="Connection"
        hint="Cluster, topic, and consumer group for this trigger subscription."
      >
        <div className="wf-kafka-form wf-kafka-form--connection">
          <KafkaFormRow label="Label" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Kafka Trigger"
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
            hint={<>e.g. <code>orders.created</code></>}
            compact
          >
            <input
              className="wf-kafka-form-input wf-kafka-form-input--mono"
              value={data.topic}
              onChange={(e) => update({ topic: e.target.value })}
              placeholder="orders.created"
            />
          </KafkaFormRow>

          <KafkaFormRow
            label="Group ID"
            hint="Leave empty to use the default deterministic group ID."
            compact
          >
            <input
              className="wf-kafka-form-input"
              value={data.consumerGroupId ?? ''}
              onChange={(e) => update({ consumerGroupId: e.target.value || undefined })}
              placeholder="Auto-derived from workflow + node ID"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Subscription"
        hint="Offset policy, concurrency, and optional key pre-filter."
      >
        <div className="wf-kafka-form wf-kafka-form--consume">
          <KafkaFormRow label="Offset policy" hint="Latest · Earliest" compact>
            <CustomSelect
              value={data.startPosition ?? 'latest'}
              onChange={(v) => update({ startPosition: v as KafkaTriggerOffsetPolicy })}
              options={OFFSET_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
          </KafkaFormRow>

          <KafkaFormRow label="Max concurrent" hint="Pause consumer at limit" compact>
            <input
              className="wf-kafka-form-input"
              type="number"
              value={data.maxConcurrentRuns ?? ''}
              onChange={(e) => update({ maxConcurrentRuns: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="10"
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
                placeholder="Optional regex filter on message key"
                variableHints={hintSet}
              />
            </InsertVarField>
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Filters"
        hint="Match headers and JSON body fields before starting a workflow run."
      >
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
                      placeholder="$.payload.type"
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
        title="Extract Variables"
        hint="Extract fields from the trigger message body into workflow variables via JSONPath."
        action={(
          <KafkaAddButton
            onClick={() => update({ extractVariables: [...extractVariables, createExtractVariable()] })}
          />
        )}
      >
        {extractVariables.length === 0 ? (
          <KafkaEmptyState
            title="No extractions"
            text="Extract fields from the trigger message body into workflow variables via JSONPath."
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
        hint="Sample message so Quick Test uses real values instead of empty variables."
      >
        <div className="wf-kafka-subsection wf-kafka-subsection--body-template">
          <div className="wf-kafka-subsection-toolbar">
            <span className="wf-kafka-subsection-label">Message body (JSON)</span>
          </div>
          <textarea
            className="wf-config-textarea wf-kafka-form-textarea"
            rows={5}
            value={data.samplePayload ?? ''}
            onChange={(e) => update({ samplePayload: e.target.value || undefined })}
            placeholder={`{\n  "orderId": "order-123",\n  "customerId": "cust-456",\n  "amount": 99.99\n}`}
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
            placeholder='{"X-Source": "test", "X-Region": "us-east"}'
          />
        </div>
      </KafkaCard>

      <KafkaCard title="Notes" hint="Optional description for teammates.">
        <div className="wf-kafka-card-pad">
          <textarea
            className="wf-config-textarea wf-kafka-form-textarea"
            rows={3}
            value={data.notes ?? ''}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Optional description for this trigger"
          />
        </div>
      </KafkaCard>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
