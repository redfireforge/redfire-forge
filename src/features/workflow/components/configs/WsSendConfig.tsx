import type { WsSendNodeData, WsSendOutputBinding } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '@shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import AvailableVariables from '../expression/AvailableVariables';
import { WsConnectionIdField, WsOutputBindingsSection } from './WsConfigShared';
import { KafkaCard, KafkaFormRow } from './KafkaConfigUi';
import { CustomSelect } from '@shared/components/CustomSelect';

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
    <div className="wf-config-body wf-ws-send-config" data-testid="ws-send-config">
      <KafkaCard
        title="Send"
        hint="Choose a connection and the payload to write on the socket."
      >
        <div className="wf-kafka-form wf-kafka-form--connection">
          <KafkaFormRow label="Label" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="WS Send"
            />
          </KafkaFormRow>

          <WsConnectionIdField
            connectionId={data.connectionId}
            onChange={(value) => update({ connectionId: value })}
            availableConnectionIds={availableConnectionIds}
          />

          <KafkaFormRow label="Message type" hint="Text · Binary" compact>
            <CustomSelect
              value={data.messageType}
              onChange={(v) => update({ messageType: v as 'text' | 'binary' })}
              options={MSG_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
          </KafkaFormRow>
        </div>

        <div className="wf-kafka-subsection wf-kafka-subsection--body-template">
          <div className="wf-kafka-subsection-toolbar">
            <span className="wf-kafka-subsection-label">Message</span>
            <span className="wf-kafka-subsection-meta">
              Supports <code>{'{{variable}}'}</code> templates
            </span>
          </div>
          <InsertVarField
            onRequestVariableInsert={onRequestVariableInsert}
            shortRef
            onInsert={(snippet) => update({ message: `${data.message}${snippet}` })}
          >
            <textarea
              className="wf-config-textarea wf-kafka-form-textarea"
              rows={6}
              value={data.message}
              onChange={(e) => update({ message: e.target.value })}
              placeholder={'{"action": "subscribe", "channel": "{{channel}}"}'}
              aria-label="Message"
            />
          </InsertVarField>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Wait for Response"
        hint="Optionally pause until the next inbound message after send."
      >
        <header className="wf-ws-wait-toggle-bar">
          <label className="wf-ws-wait-toggle">
            <input
              type="checkbox"
              checked={data.waitForResponse}
              onChange={(e) => update({ waitForResponse: e.target.checked })}
              aria-label="Wait for next message after send"
            />
            <span className="wf-ws-wait-toggle-copy">
              <span className="wf-ws-wait-toggle-title">Wait for next message after send</span>
              <span className="wf-ws-wait-toggle-hint">
                Blocks this step until a message arrives or the timeout elapses
              </span>
            </span>
          </label>
        </header>

        {data.waitForResponse && (
          <div className="wf-kafka-form wf-kafka-form--consume">
            <KafkaFormRow label="Timeout (ms)" hint="Fail if no message in time" compact>
              <input
                className="wf-kafka-form-input"
                type="number"
                value={data.responseTimeoutMs}
                onChange={(e) => update({ responseTimeoutMs: Number(e.target.value) || 5000 })}
                placeholder="5000"
              />
            </KafkaFormRow>
          </div>
        )}
      </KafkaCard>

      {data.waitForResponse && (
        <WsOutputBindingsSection
          outputBindings={outputBindings}
          fieldOptions={OUTPUT_FIELD_OPTIONS}
          bindingCrud={bindingCrud}
          onAdd={() => update({ outputBindings: [...outputBindings, { field: 'responseBody' as const, variableName: '', enabled: true }] })}
          hint="Map the response body, type, or latency into workflow variables."
        />
      )}

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
