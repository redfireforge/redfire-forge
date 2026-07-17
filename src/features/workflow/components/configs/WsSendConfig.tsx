import type { WsSendNodeData, WsSendOutputBinding } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import AvailableVariables from '../expression/AvailableVariables';
import { WsConnectionIdField, WsOutputBindingsSection } from './WsConfigShared';

const MSG_TYPE_OPTIONS: { value: 'text' | 'binary'; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'binary', label: 'Binary' },
];

const OUTPUT_FIELD_OPTIONS: WsSendOutputBinding['field'][] = ['responseBody', 'responseType', 'latencyMs'];

export default function WsSendConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
  availableConnectionIds = [],
}: {
  data: WsSendNodeData;
  onChange: (d: WsSendNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
  availableConnectionIds?: string[];
}) {
  const outputBindings = data.outputBindings ?? [];
  const update = (patch: Partial<WsSendNodeData>) => onChange({ ...data, ...patch });

  const bindingCrud = useListCrud(outputBindings, (items) => update({ outputBindings: items }));

  return (
    <div className="wf-config-body" data-testid="ws-send-config">
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
        <label>Message Type</label>
        <select value={data.messageType} onChange={(e) => update({ messageType: e.target.value as 'text' | 'binary' })}>
          {MSG_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      <div className="wf-config-field">
        <label>Message</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          shortRef
          onInsert={(snippet) => update({ message: `${data.message}${snippet}` })}
        >
          <textarea
            className="wf-config-textarea"
            rows={6}
            value={data.message}
            onChange={(e) => update({ message: e.target.value })}
            placeholder={'{"action": "subscribe", "channel": "{{channel}}"}'}
          />
        </InsertVarField>
        <span className="wf-config-hint">Supports <code>{'{{variable}}'}</code> templates.</span>
      </div>

      <div className="wf-ws-section">
        <div className="wf-ws-section-title">Wait for Response</div>
        <div className="wf-config-field">
          <label className="wf-config-checkbox-label">
            <input
              type="checkbox"
              checked={data.waitForResponse}
              onChange={(e) => update({ waitForResponse: e.target.checked })}
            />
            Wait for next message after send
          </label>
        </div>
        {data.waitForResponse && (
          <div className="wf-config-field--row">
            <label>Response Timeout (ms)</label>
            <input
              type="number"
              value={data.responseTimeoutMs}
              onChange={(e) => update({ responseTimeoutMs: Number(e.target.value) || 5000 })}
              placeholder="5000"
            />
          </div>
        )}
      </div>

      {data.waitForResponse && (
        <WsOutputBindingsSection
          outputBindings={outputBindings}
          fieldOptions={OUTPUT_FIELD_OPTIONS}
          bindingCrud={bindingCrud}
          onAdd={() => update({ outputBindings: [...outputBindings, { field: 'responseBody' as const, variableName: '', enabled: true }] })}
        />
      )}

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
