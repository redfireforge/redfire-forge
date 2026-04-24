import { v4 as uuidv4 } from 'uuid';
import type { SwitchNodeData, SwitchCase } from '../../types/workflow';
import { useListCrud } from '../../hooks/useListCrud';

export default function SwitchConfig({ data, onChange }: { data: SwitchNodeData; onChange: (d: SwitchNodeData) => void }) {
  const cases = data.cases ?? [];
  const { update: updateCaseByIdx, remove: removeCaseByIdx, move: moveCase } = useListCrud(
    cases,
    (items) => onChange({ ...data, cases: items }),
  );

  const addCase = () => {
    const newCase: SwitchCase = { id: uuidv4().slice(0, 8), value: '', label: '' };
    onChange({ ...data, cases: [...cases, newCase] });
  };

  const updateCase = (id: string, patch: Partial<SwitchCase>) => {
    const idx = cases.findIndex(c => c.id === id);
    if (idx >= 0) updateCaseByIdx(idx, patch);
  };

  const removeCase = (id: string) => {
    const idx = cases.findIndex(c => c.id === id);
    if (idx >= 0) removeCaseByIdx(idx);
  };

  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field">
        <label>Expression</label>
        <input
          value={data.expression}
          onChange={(e) => onChange({ ...data, expression: e.target.value })}
          placeholder="e.g. {{status}} or {{category}}"
        />
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
                onChange={(e) => updateCase(c.id, { value: e.target.value })}
                placeholder="Match value"
              />
              <input
                className="wf-switch-case-label"
                value={c.label ?? ''}
                onChange={(e) => updateCase(c.id, { label: e.target.value })}
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
                onClick={() => removeCase(c.id)}
                title="Remove case"
              >✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="wf-switch-add-case" onClick={addCase}>+ Add Case</button>
        <span className="wf-config-hint">If no case matches, the Default path is taken</span>
      </div>
    </div>
  );
}
