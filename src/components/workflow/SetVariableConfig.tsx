import { v4 as uuid } from 'uuid';
import type { SetVariableNodeData, SetVariableAssignment } from '../../types/workflow';
import { useListCrud } from '../../hooks/useListCrud';

export default function SetVariableConfig({
  data,
  onChange,
}: {
  data: SetVariableNodeData;
  onChange: (d: SetVariableNodeData) => void;
}) {
  const assignments = data.assignments ?? [];
  const { update: updateAssignment, remove: removeAssignment, move: moveAssignment } = useListCrud(
    assignments,
    (items) => onChange({ ...data, assignments: items }),
  );

  const addAssignment = () => {
    const id = uuid().slice(0, 8);
    onChange({ ...data, assignments: [...assignments, { id, name: '', expression: '' }] });
  };

  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field">
        <label>Assignments</label>
        <div className="wf-setvar-assignments-list">
          {assignments.map((a, i) => (
            <div key={a.id} className="wf-setvar-assignment-row">
              <input
                className="wf-setvar-assignment-name"
                value={a.name}
                onChange={(e) => updateAssignment(i, { name: e.target.value })}
                placeholder="Variable name"
              />
              <span className="wf-setvar-assignment-eq">=</span>
              <input
                className="wf-setvar-assignment-expr"
                value={a.expression}
                onChange={(e) => updateAssignment(i, { expression: e.target.value })}
                placeholder="Value / {{expression}}"
              />
              <button
                type="button"
                className="wf-setvar-assignment-move"
                disabled={i === 0}
                onClick={() => moveAssignment(i, -1)}
                title="Move up"
              >↑</button>
              <button
                type="button"
                className="wf-setvar-assignment-move"
                disabled={i === assignments.length - 1}
                onClick={() => moveAssignment(i, 1)}
                title="Move down"
              >↓</button>
              <button
                type="button"
                className="wf-setvar-assignment-remove"
                onClick={() => removeAssignment(i)}
                title="Remove"
              >✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="wf-setvar-add-assignment" onClick={addAssignment}>+ Add Assignment</button>
      </div>
    </div>
  );
}
