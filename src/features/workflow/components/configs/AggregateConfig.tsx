import { v4 as uuid } from 'uuid';
import type { AggregateNodeData, AggregateStrategy } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';

const STRATEGY_OPTIONS: { value: AggregateStrategy; label: string; desc: string }[] = [
  { value: 'concat', label: 'Concat', desc: 'Join all values into a JSON array' },
  { value: 'first', label: 'First', desc: 'Keep only the first value' },
  { value: 'last', label: 'Last', desc: 'Keep only the last value' },
  { value: 'count', label: 'Count', desc: 'Count of collected values' },
  { value: 'sum', label: 'Sum', desc: 'Sum of numeric values' },
  { value: 'custom', label: 'Custom', desc: 'Custom JSONPath expression' },
];

export default function AggregateConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: AggregateNodeData;
  onChange: (d: AggregateNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const mappings = data.mappings ?? [];
  const { update: updateMapping, remove: removeMapping, move: moveMapping } = useListCrud(
    mappings,
    (items) => onChange({ ...data, mappings: items }),
  );

  const addMapping = () => {
    const id = uuid().slice(0, 8);
    onChange({ ...data, mappings: [...mappings, { id, sourceExpression: '', targetVariable: '', strategy: 'concat' }] });
  };

  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field">
        <label>Aggregation Mappings</label>
        <div className="wf-aggregate-mappings-list">
          {mappings.map((m, i) => (
            <div key={m.id} className="wf-aggregate-mapping-row">
              <div className="wf-aggregate-mapping-fields">
                <InsertVarField
                  onRequestVariableInsert={onRequestVariableInsert}
                  onInsert={(snippet) => updateMapping(i, { sourceExpression: m.sourceExpression + snippet })}
                >
                  <ExpressionInput
                    className="wf-aggregate-mapping-source"
                    value={m.sourceExpression}
                    onChange={(val) => updateMapping(i, { sourceExpression: val })}
                    placeholder="Source {{variable}}"
                    variableHints={variableHints}
                  />
                </InsertVarField>
                <span className="wf-aggregate-mapping-arrow">→</span>
                <input
                  className="wf-aggregate-mapping-target"
                  value={m.targetVariable}
                  onChange={(e) => updateMapping(i, { targetVariable: e.target.value })}
                  placeholder="Target variable"
                />
              </div>
              <div className="wf-aggregate-mapping-strategy-row">
                <select
                  className="wf-aggregate-mapping-strategy"
                  value={m.strategy}
                  onChange={(e) => updateMapping(i, { strategy: e.target.value as AggregateStrategy })}
                >
                  {STRATEGY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} title={o.desc}>{o.label}</option>
                  ))}
                </select>
                {m.strategy === 'custom' && (
                  <input
                    className="wf-aggregate-mapping-custom"
                    value={m.customExpression ?? ''}
                    onChange={(e) => updateMapping(i, { customExpression: e.target.value })}
                    placeholder="Custom expression"
                  />
                )}
                <button
                  type="button"
                  className="wf-aggregate-mapping-move"
                  disabled={i === 0}
                  onClick={() => moveMapping(i, -1)}
                  title="Move up"
                >↑</button>
                <button
                  type="button"
                  className="wf-aggregate-mapping-move"
                  disabled={i === mappings.length - 1}
                  onClick={() => moveMapping(i, 1)}
                  title="Move down"
                >↓</button>
                <button
                  type="button"
                  className="wf-aggregate-mapping-remove"
                  onClick={() => removeMapping(i)}
                  title="Remove"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="wf-aggregate-add-mapping" onClick={addMapping}>+ Add Mapping</button>
      </div>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
