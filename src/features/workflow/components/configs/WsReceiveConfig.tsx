import { useMemo } from 'react';
import type { WsReceiveNodeData, WsReceiveOutputBinding, WsMatchCriteria } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import AvailableVariables from '../expression/AvailableVariables';
import { WsConnectionIdField, WsMatchCriteriaSection, WsExtractionRulesSection, WsOutputBindingsSection } from './WsConfigShared';

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
    <div className="wf-config-body" data-testid="ws-receive-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <WsConnectionIdField
        connectionId={data.connectionId}
        onChange={(value) => update({ connectionId: value })}
        availableConnectionIds={availableConnectionIds}
      />

      <div className="wf-config-field--row">
        <label>Timeout (ms)</label>
        <input
          type="number"
          value={data.timeoutMs}
          onChange={(e) => update({ timeoutMs: Number(e.target.value) || 30000 })}
          placeholder="30000"
        />
      </div>

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
      />

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
