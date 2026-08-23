import { useMemo } from 'react';
import type { WsReceiveNodeData, WsReceiveOutputBinding, WsMatchCriteria } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '@shared/hooks/useListCrud';
import AvailableVariables from '../expression/AvailableVariables';
import { WsConnectionIdField, WsMatchCriteriaSection, WsExtractionRulesSection, WsOutputBindingsSection } from './WsConfigShared';
import { KafkaCard, KafkaFormRow } from './KafkaConfigUi';

const OUTPUT_FIELD_OPTIONS: WsReceiveOutputBinding['field'][] = ['messageBody', 'messageType', 'matchedAt', 'latencyMs'];

export default function WsReceiveConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
  availableConnectionIds = [],
}: {
  data: WsReceiveNodeData;
  onChange: (d: WsReceiveNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
  availableConnectionIds?: string[];
}) {
  const mc = data.matchCriteria ?? {};
  const extractionRules = data.extractionRules ?? [];
  const outputBindings = data.outputBindings ?? [];
  const update = (patch: Partial<WsReceiveNodeData>) => onChange({ ...data, ...patch });
  const updateMatch = (patch: Partial<WsMatchCriteria>) => update({ matchCriteria: { ...mc, ...patch } });

  const bindingCrud = useListCrud(outputBindings, (items) => update({ outputBindings: items }));

  const hintSet = useMemo(() => variableHints, [variableHints]);

  return (
    <div className="wf-config-body wf-ws-receive-config" data-testid="ws-receive-config">
      <KafkaCard
        title="Receive"
        hint="Wait on an open connection for the next matching inbound message."
      >
        <div className="wf-kafka-form wf-kafka-form--connection">
          <KafkaFormRow label="Label" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="WS Receive"
            />
          </KafkaFormRow>

          <WsConnectionIdField
            connectionId={data.connectionId}
            onChange={(value) => update({ connectionId: value })}
            availableConnectionIds={availableConnectionIds}
          />

          <KafkaFormRow label="Timeout (ms)" hint="Fail if no match in time" compact>
            <input
              className="wf-kafka-form-input"
              type="number"
              value={data.timeoutMs}
              onChange={(e) => update({ timeoutMs: Number(e.target.value) || 30000 })}
              placeholder="30000"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <WsMatchCriteriaSection
        matchCriteria={mc}
        updateMatch={updateMatch}
        onRequestVariableInsert={onRequestVariableInsert}
        variableHints={hintSet}
        hintText="Only messages matching ALL specified criteria will be accepted."
      />

      <WsExtractionRulesSection
        extractionRules={extractionRules}
        onChange={(rules) => update({ extractionRules: rules })}
        title="Extraction Rules"
        hint="Extract fields from the received message into workflow variables via JSONPath."
        addLabel="+ Add Extraction"
      />

      <WsOutputBindingsSection
        outputBindings={outputBindings}
        fieldOptions={OUTPUT_FIELD_OPTIONS}
        bindingCrud={bindingCrud}
        onAdd={() => update({ outputBindings: [...outputBindings, { field: 'messageBody' as const, variableName: '', enabled: true }] })}
        hint="Map message body, type, matched-at, or latency into workflow variables."
      />

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
