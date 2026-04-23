import { useEffect, useState, useRef } from 'react';
import type { Workflow } from '../../types/workflow';
import { sampleWorkflowCatalog, type SampleWorkflowEntry } from '../../data/sampleWorkflows';

interface Props {
  workflows: Workflow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onLoadSample: (entry: SampleWorkflowEntry) => void;
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
  const [showSamples, setShowSamples] = useState(false);
  const samplesRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!showSamples) return;
    const close = (e: MouseEvent) => {
      if (samplesRef.current && !samplesRef.current.contains(e.target as Node)) setShowSamples(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSamples(false); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [showSamples]);

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

      <div className="wf-sidebar-footer" ref={samplesRef}>
        <button className="btn btn-sm" onClick={() => setShowSamples(v => !v)} style={{ width: '100%' }}>
          📚 Browse Samples
        </button>
        {showSamples && (
          <div className="wf-sample-dropdown">
            {sampleWorkflowCatalog.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className="wf-sample-dropdown-item"
                  onClick={() => {
                    onLoadSample(entry);
                    setShowSamples(false);
                  }}
                >
                  <span className="wf-sample-name">{entry.name}</span>
                  <span className="wf-sample-desc">{entry.description}</span>
                </button>
            ))}
          </div>
        )}
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
