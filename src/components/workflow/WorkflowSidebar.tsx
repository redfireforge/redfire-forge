import type { Workflow } from '../../types/workflow';

interface Props {
  workflows: Workflow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onLoadSample: () => void;
}

export default function WorkflowSidebar({
  workflows, selectedId, onSelect, onNew, onDelete, onDuplicate, onLoadSample,
}: Props) {
  return (
    <div className="wf-sidebar">
      <div className="wf-sidebar-header">
        <span className="wf-sidebar-title">Workflows</span>
        <button className="btn btn-sm btn-primary" onClick={onNew} title="New workflow">+ New</button>
      </div>

      <div className="wf-sidebar-list">
        {workflows.map(wf => (
          <div
            key={wf.id}
            className={`wf-sidebar-item ${wf.id === selectedId ? 'active' : ''}`}
            onClick={() => onSelect(wf.id)}
          >
            <div className="wf-sidebar-item-top">
              <span className="wf-sidebar-item-name">{wf.name}</span>
              <span className="wf-sidebar-item-badge">{wf.nodes.length}</span>
            </div>
            <div className="wf-sidebar-item-actions">
              <button
                className="wf-sidebar-act-btn"
                onClick={(e) => { e.stopPropagation(); onDuplicate(wf.id); }}
                title="Duplicate"
              >⧉</button>
              <button
                className="wf-sidebar-act-btn wf-sidebar-act-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${wf.name}"?`)) onDelete(wf.id);
                }}
                title="Delete"
              >×</button>
            </div>
          </div>
        ))}
      </div>

      {workflows.length === 0 && (
        <div className="wf-sidebar-empty">
          <p>No workflows yet.</p>
          <p>Create one or load the sample.</p>
        </div>
      )}

      <div className="wf-sidebar-footer">
        <button className="btn btn-sm" onClick={onLoadSample} style={{ width: '100%' }}>
          Load Sample Workflow
        </button>
      </div>
    </div>
  );
}
