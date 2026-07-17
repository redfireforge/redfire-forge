import { useMemo } from 'react';
import type { WsTriggerNodeData, WsMatchCriteria } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import { WsMatchCriteriaSection, WsExtractionRulesSection } from './WsConfigShared';

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
    <div className="wf-config-body" data-testid="ws-trigger-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <div className="wf-config-field--row">
        <label>URL</label>
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
      </div>

      <div className="wf-config-field--row">
        <label>Connection ID</label>
        <input
          value={data.connectionId}
          onChange={(e) => update({ connectionId: e.target.value })}
          placeholder="ws1"
        />
      </div>

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

      <div className="wf-ws-section">
        <div className="wf-ws-section-title">Test Payload (Quick Test)</div>
        <span className="wf-config-hint">
          Provide a sample WebSocket message body so Quick Test uses real values instead of dry-running with empty variables.
        </span>
        <div className="wf-config-field">
          <label>Sample Payload</label>
          <textarea
            className="wf-config-textarea"
            rows={5}
            value={data.samplePayload ?? ''}
            onChange={(e) => update({ samplePayload: e.target.value || undefined })}
            placeholder={'{\n  "event": "order.created",\n  "orderId": "order-123",\n  "amount": 99.99\n}'}
          />
        </div>
      </div>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
