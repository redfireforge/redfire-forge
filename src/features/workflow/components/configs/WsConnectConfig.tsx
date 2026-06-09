import { useMemo } from 'react';
import type { WsConnectNodeData, WsConnectOutputBinding } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import { createWsHeaderRow } from './wsConfigFactories';
import { WsKeyValueSection, WsOutputBindingsSection } from './WsConfigShared';

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
    <div className="wf-config-body" data-testid="ws-connect-config">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <div className="wf-config-field">
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
        <span className="wf-config-hint">Supports <code>{'{{variable}}'}</code> templates.</span>
      </div>

      <div className="wf-config-field">
        <label>Connection ID</label>
        <input
          value={data.connectionId}
          onChange={(e) => update({ connectionId: e.target.value })}
          placeholder="ws1"
        />
        <span className="wf-config-hint">Referenced by downstream WS Send / WS Receive nodes.</span>
      </div>

      <div className="wf-config-field">
        <label>Subprotocols</label>
        <input
          value={(data.subprotocols ?? []).join(', ')}
          onChange={(e) => update({ subprotocols: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          placeholder="graphql-ws, mqtt"
        />
        <span className="wf-config-hint">Comma-separated list of WebSocket subprotocols.</span>
      </div>

      <div className="wf-config-field">
        <label>Timeout (ms)</label>
        <input
          type="number"
          value={data.timeoutMs}
          onChange={(e) => update({ timeoutMs: Number(e.target.value) || 10000 })}
          placeholder="10000"
        />
      </div>

      <WsKeyValueSection
        title="Headers"
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
      />

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
