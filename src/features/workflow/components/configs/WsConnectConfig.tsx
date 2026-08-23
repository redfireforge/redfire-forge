import { useMemo } from 'react';
import type { WsConnectNodeData, WsConnectOutputBinding } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '@shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import { createWsHeaderRow } from './wsConfigFactories';
import { WsKeyValueSection, WsOutputBindingsSection } from './WsConfigShared';
import { KafkaCard, KafkaFormRow } from './KafkaConfigUi';

const OUTPUT_FIELD_OPTIONS: WsConnectOutputBinding['field'][] = ['protocol', 'extensions', 'latencyMs'];

export default function WsConnectConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: WsConnectNodeData;
  onChange: (d: WsConnectNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const headers = data.headers ?? [];
  const queryParams = data.queryParams ?? [];
  const outputBindings = data.outputBindings ?? [];
  const update = (patch: Partial<WsConnectNodeData>) => onChange({ ...data, ...patch });

  const headerCrud = useListCrud(headers, (items) => update({ headers: items }));
  const paramCrud = useListCrud(queryParams, (items) => update({ queryParams: items }));
  const bindingCrud = useListCrud(outputBindings, (items) => update({ outputBindings: items }));

  const hintSet = useMemo(() => variableHints, [variableHints]);

  return (
    <div className="wf-config-body wf-ws-connect-config" data-testid="ws-connect-config">
      <KafkaCard
        title="Connection"
        hint="WebSocket endpoint, connection identity, and handshake options."
      >
        <div className="wf-kafka-form wf-kafka-form--connection">
          <KafkaFormRow label="Label" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="WS Connect"
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

          <KafkaFormRow label="Connection ID" hint="Referenced by Send / Receive nodes" compact>
            <input
              className="wf-kafka-form-input"
              value={data.connectionId}
              onChange={(e) => update({ connectionId: e.target.value })}
              placeholder="ws1"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Subprotocols" hint="Comma-separated" compact>
            <input
              className="wf-kafka-form-input"
              value={(data.subprotocols ?? []).join(', ')}
              onChange={(e) => update({ subprotocols: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="graphql-ws, mqtt"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Timeout (ms)" hint="Handshake wait" compact>
            <input
              className="wf-kafka-form-input"
              type="number"
              value={data.timeoutMs}
              onChange={(e) => update({ timeoutMs: Number(e.target.value) || 10000 })}
              placeholder="10000"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <WsKeyValueSection
        title="Headers"
        hint="Handshake headers sent with the WebSocket upgrade."
        emptyText="No headers yet. Add Authorization or custom handshake headers when needed."
        rows={headers}
        keyPlaceholder="Header name"
        addLabel="+ Add Header"
        crud={headerCrud}
        onAdd={() => update({ headers: [...headers, createWsHeaderRow()] })}
        onRequestVariableInsert={onRequestVariableInsert}
        variableHints={hintSet}
      />

      <WsKeyValueSection
        title="Query Parameters"
        hint="Appended to the URL before the handshake."
        emptyText="No query parameters. Add token or room IDs as URL params when needed."
        rows={queryParams}
        keyPlaceholder="Param name"
        addLabel="+ Add Parameter"
        crud={paramCrud}
        onAdd={() => update({ queryParams: [...queryParams, createWsHeaderRow()] })}
        onRequestVariableInsert={onRequestVariableInsert}
        variableHints={hintSet}
      />

      <WsOutputBindingsSection
        outputBindings={outputBindings}
        fieldOptions={OUTPUT_FIELD_OPTIONS}
        bindingCrud={bindingCrud}
        onAdd={() => update({ outputBindings: [...outputBindings, { field: 'protocol' as const, variableName: '', enabled: true }] })}
        hint="Map negotiated protocol, extensions, or connect latency into workflow variables."
      />

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
