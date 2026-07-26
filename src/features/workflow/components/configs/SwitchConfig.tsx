import { v4 as uuidv4 } from 'uuid';
import type { SwitchNodeData, SwitchCase } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import ConfigSectionGroup from './ConfigSectionGroup';

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
    <div className="wf-config-body wf-switch-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field--row">
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
      </div>

      <ConfigSectionGroup title="Cases" count={cases.length}>
        <div className="wf-switch-cases-list">
          {cases.length === 0 && (
            <div className="wf-switch-empty">No cases defined — only the Default path will be used</div>
          )}
          {cases.map((c, i) => (
            <div key={c.id} className="wf-switch-case-row">
              <span className="wf-switch-case-idx">{i + 1}</span>
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
              <div className="wf-switch-case-actions">
                <button
                  type="button"
                  className="wf-switch-case-btn"
                  onClick={() => moveCase(i, -1)}
                  disabled={i === 0}
                  title="Move up"
                >▲</button>
                <button
                  type="button"
                  className="wf-switch-case-btn"
                  onClick={() => moveCase(i, 1)}
                  disabled={i === cases.length - 1}
                  title="Move down"
                >▼</button>
                <button
                  type="button"
                  className="wf-switch-case-btn wf-switch-case-btn--del"
                  onClick={() => removeCaseByIdx(i)}
                  title="Remove case"
                >×</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="wf-switch-add-case" onClick={addCase}>+ Add Case</button>
      </ConfigSectionGroup>

      <div className="wf-config-section-info">
        <div className="wf-config-info-title">How it works</div>
        <p className="wf-config-hint">
          The <strong>Expression</strong> is evaluated at runtime and compared against each case value
          in order. The first match routes to that case&apos;s output handle.
          If no case matches, the <strong>Default</strong> path is taken.
        </p>
      </div>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
