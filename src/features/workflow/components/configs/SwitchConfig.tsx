import { v4 as uuidv4 } from 'uuid';
import type { SwitchNodeData, SwitchCase } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';

export default function SwitchConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: SwitchNodeData;
  onChange: (d: SwitchNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const cases = data.cases ?? [];
  const { update: updateCaseByIdx, remove: removeCaseByIdx, move: moveCase } = useListCrud(
    cases,
    (items) => onChange({ ...data, cases: items }),
  );

  const addCase = () => {
    const newCase: SwitchCase = { id: uuidv4().slice(0, 8), value: '', label: '' };
    onChange({ ...data, cases: [...cases, newCase] });
  };

  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field">
        <label>Expression</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          onInsert={(snippet) => onChange({ ...data, expression: data.expression + snippet })}
        >
          <ExpressionInput
            value={data.expression}
            onChange={(val) => onChange({ ...data, expression: val })}
            placeholder="e.g. {{status}} or {{category}}"
            variableHints={variableHints}
          />
        </InsertVarField>
        <span className="wf-config-hint">Variable or template expression to match against cases</span>
      </div>

      <div className="wf-config-field">
        <label>Cases</label>
        <div className="wf-switch-cases-list">
          {cases.map((c, i) => (
            <div key={c.id} className="wf-switch-case-row">
              <input
                className="wf-switch-case-value"
                value={c.value}
                onChange={(e) => updateCaseByIdx(i, { value: e.target.value })}
                placeholder="Match value"
              />
              <input
                className="wf-switch-case-label"
                value={c.label ?? ''}
                onChange={(e) => updateCaseByIdx(i, { label: e.target.value })}
                placeholder="Label (optional)"
              />
              <button
                type="button"
                className="wf-switch-case-move"
                onClick={() => moveCase(i, -1)}
                disabled={i === 0}
                title="Move up"
              >↑</button>
              <button
                type="button"
                className="wf-switch-case-move"
                onClick={() => moveCase(i, 1)}
                disabled={i === cases.length - 1}
                title="Move down"
              >↓</button>
              <button
                type="button"
                className="wf-switch-case-remove"
                onClick={() => removeCaseByIdx(i)}
                title="Remove case"
              >✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="wf-switch-add-case" onClick={addCase}>+ Add Case</button>
        <span className="wf-config-hint">If no case matches, the Default path is taken</span>
      </div>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
