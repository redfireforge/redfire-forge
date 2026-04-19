import type { Workflow } from '../../types/workflow';

interface Props {
  workflows: Workflow[];
  selected: Workflow | null;
  isRunning: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onSave: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onQuickTest: () => void;
}

export default function WorkflowToolbar({
  workflows, selected, isRunning,
  onNew, onSelect, onSave, onRename, onDelete, onDuplicate, onQuickTest,
}: Props) {
  return (
    <div className="wf-toolbar">
      <div className="wf-toolbar-left">
        <button className="btn btn-sm btn-primary" onClick={onNew} disabled={isRunning}>+ New</button>

        {workflows.length > 0 && (
          <select
            className="wf-toolbar-select"
            value={selected?.id ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            disabled={isRunning}
          >
            <option value="" disabled>Open workflow…</option>
            {workflows.map(wf => (
              <option key={wf.id} value={wf.id}>{wf.name}</option>
            ))}
          </select>
        )}

        {selected && (
          <>
            <button className="btn btn-sm" onClick={onSave} disabled={isRunning} title="Save">Save</button>
            <button className="btn btn-sm" onClick={onRename} disabled={isRunning} title="Rename">Rename</button>
            <button className="btn btn-sm" onClick={onDuplicate} disabled={isRunning} title="Duplicate">Duplicate</button>
            <button className="btn btn-sm btn-danger" onClick={onDelete} disabled={isRunning} title="Delete">Delete</button>
          </>
        )}
      </div>

      <div className="wf-toolbar-right">
        {selected && (
          <button
            className={`btn btn-sm ${isRunning ? 'btn-danger' : 'btn-primary'}`}
            onClick={onQuickTest}
          >
            {isRunning ? '■ Stop' : '▶ Quick Test'}
          </button>
        )}
      </div>
    </div>
  );
}
