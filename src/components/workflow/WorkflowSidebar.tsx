import { useEffect, useState } from 'react';
import type { Workflow } from '../../types/workflow';

interface Props {
  workflows: Workflow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onLoadSample: () => void;
}

interface WorkflowSidebarContextMenuState {
  workflowId: string;
  workflowName: string;
  x: number;
  y: number;
}

export default function WorkflowSidebar({
  workflows, selectedId, onSelect, onNew, onRename, onDelete, onDuplicate, onLoadSample,
}: Props) {
  const [contextMenu, setContextMenu] = useState<WorkflowSidebarContextMenuState | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
    };
  }, [contextMenu]);

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
            onContextMenu={(e) => {
              e.preventDefault();
              onSelect(wf.id);
              setContextMenu({ workflowId: wf.id, workflowName: wf.name, x: e.clientX, y: e.clientY });
            }}
          >
            <div className="wf-sidebar-item-top">
              <span className="wf-sidebar-item-name">{wf.name}</span>
              <span className="wf-sidebar-item-badge">{wf.nodes.length}</span>
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

      {contextMenu && (
        <>
          <div className="wf-sidebar-ctx-backdrop" onClick={() => setContextMenu(null)} role="presentation" />
          <div
            className="wf-sidebar-ctx-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="wf-sidebar-ctx-item"
              role="menuitem"
              onClick={() => {
                onRename(contextMenu.workflowId);
                setContextMenu(null);
              }}
            >
              Rename Workflow
            </button>
            <button
              type="button"
              className="wf-sidebar-ctx-item"
              role="menuitem"
              onClick={() => {
                onDuplicate(contextMenu.workflowId);
                setContextMenu(null);
              }}
            >
              Duplicate Workflow
            </button>
            <button
              type="button"
              className="wf-sidebar-ctx-item wf-sidebar-ctx-item-danger"
              role="menuitem"
              onClick={() => {
                if (confirm(`Delete "${contextMenu.workflowName}"?`)) onDelete(contextMenu.workflowId);
                setContextMenu(null);
              }}
            >
              Delete Workflow
            </button>
          </div>
        </>
      )}
    </div>
  );
}
