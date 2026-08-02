import { useMemo } from 'react';
import type { WsTriggerNodeData, WsMatchCriteria } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import { WsMatchCriteriaSection, WsExtractionRulesSection } from './WsConfigShared';
import { KafkaCard, KafkaFormRow } from './KafkaConfigUi';

export default function WsTriggerConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: WsTriggerNodeData;
  onChange: (d: WsTriggerNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const mc = data.matchCriteria ?? {};
  const extractionRules = data.extractionRules ?? [];
  const update = (patch: Partial<WsTriggerNodeData>) => onChange({ ...data, ...patch });
  const updateMatch = (patch: Partial<WsMatchCriteria>) => update({ matchCriteria: { ...mc, ...patch } });

  const hintSet = useMemo(() => variableHints, [variableHints]);

  return (
    <div className="wf-config-body wf-ws-trigger-config" data-testid="ws-trigger-config">
      <KafkaCard
        title="Connection"
        hint="Listen URL and connection identity for this trigger subscription."
      >
        <div className="wf-kafka-form wf-kafka-form--connection">
          <KafkaFormRow label="Label" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="WS Trigger"
            />
          </KafkaFormRow>

          <KafkaFormRow label="URL" hint={<>e.g. <code>wss://…</code></>}>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) => update({ url: `${data.url}${snippet}` })}
            >
              <ExpressionInput
                value={data.url}
                onChange={(value) => update({ url: value })}
                placeholder="wss://example.com/ws"
                variableHints={hintSet}
              />
            </InsertVarField>
          </KafkaFormRow>

          <KafkaFormRow label="Connection ID" hint="Stable ID for this trigger socket" compact>
            <input
              className="wf-kafka-form-input"
              value={data.connectionId}
              onChange={(e) => update({ connectionId: e.target.value })}
              placeholder="ws1"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <WsMatchCriteriaSection
        matchCriteria={mc}
        updateMatch={updateMatch}
        onRequestVariableInsert={onRequestVariableInsert}
        variableHints={hintSet}
        hintText="Only messages matching ALL specified criteria will trigger the workflow."
      />

      <WsExtractionRulesSection
        extractionRules={extractionRules}
        onChange={(rules) => update({ extractionRules: rules })}
        title="Extract Variables"
        hint="Extract fields from the trigger message body into workflow variables via JSONPath."
        addLabel="+ Add Variable"
      />

      <KafkaCard
        title="Quick Test"
        hint="Sample message so Quick Test uses real values instead of empty variables."
      >
        <div className="wf-kafka-subsection wf-kafka-subsection--body-template">
          <div className="wf-kafka-subsection-toolbar">
            <span className="wf-kafka-subsection-label">Sample payload</span>
            <span className="wf-kafka-subsection-meta">JSON or text body</span>
          </div>
          <textarea
            className="wf-config-textarea wf-kafka-form-textarea"
            rows={5}
            value={data.samplePayload ?? ''}
            onChange={(e) => update({ samplePayload: e.target.value || undefined })}
            placeholder={'{\n  "event": "order.created",\n  "orderId": "order-123",\n  "amount": 99.99\n}'}
            aria-label="Sample Payload"
          />
        </div>
      </KafkaCard>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
