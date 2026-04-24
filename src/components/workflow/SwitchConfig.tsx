import { v4 as uuidv4 } from 'uuid';
import type { SwitchNodeData, SwitchCase } from '../../types/workflow';

export default function SwitchConfig({ data, onChange }: { data: SwitchNodeData; onChange: (d: SwitchNodeData) => void }) {
  const addCase = () => {
    const newCase: SwitchCase = { id: uuidv4().slice(0, 8), value: '', label: '' };
    onChange({ ...data, cases: [...(data.cases ?? []), newCase] });
  };

  const updateCase = (id: string, patch: Partial<SwitchCase>) => {
    onChange({
      ...data,
      cases: (data.cases ?? []).map(c => c.id === id ? { ...c, ...patch } : c),
    });
  };

  const removeCase = (id: string) => {
    onChange({ ...data, cases: (data.cases ?? []).filter(c => c.id !== id) });
  };

  const moveCase = (index: number, direction: -1 | 1) => {
    const cases = [...(data.cases ?? [])];
    const target = index + direction;
    if (target < 0 || target >= cases.length) return;
    [cases[index], cases[target]] = [cases[target], cases[index]];
    onChange({ ...data, cases });
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
          {(data.cases ?? []).map((c, i) => (
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
                disabled={i === (data.cases ?? []).length - 1}
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
