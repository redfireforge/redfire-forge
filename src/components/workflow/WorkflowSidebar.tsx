import { useEffect, useState, useRef } from 'react';
import type { Workflow } from '../../types/workflow';

interface Props {
  workflows: Workflow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: (name: string) => void;
  onBrowseTemplates: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

interface WorkflowSidebarContextMenuState {
  workflowId: string;
  workflowName: string;
  x: number;
  y: number;
}

export default function WorkflowSidebar({
  workflows, selectedId, onSelect, onNew, onBrowseTemplates, onRename, onDelete, onDuplicate,
}: Props) {
  const [contextMenu, setContextMenu] = useState<WorkflowSidebarContextMenuState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [renameState, setRenameState] = useState<{ id: string; name: string } | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

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
    if (!showNewMenu) return;
    const close = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setShowNewMenu(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowNewMenu(false); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [showNewMenu]);

  return (
    <div className="wf-sidebar">
      <div className="wf-sidebar-header">
        <span className="wf-sidebar-title">Workflows</span>
        <div className="wf-new-dropdown-wrap" ref={newMenuRef}>
          <button className="btn btn-sm btn-primary" onClick={() => setShowNewMenu(v => !v)} title="New workflow">+ New</button>
          {showNewMenu && (
            <div className="wf-new-dropdown">
              <button className="wf-new-dropdown-item" onClick={() => { setShowCreateDialog(true); setShowNewMenu(false); }}>
                <span className="wf-new-dropdown-icon">📄</span>
                <div>
                  <div className="wf-new-dropdown-label">Blank Workflow</div>
                  <div className="wf-new-dropdown-hint">Start from scratch</div>
                </div>
              </button>
              <button className="wf-new-dropdown-item" onClick={() => { onBrowseTemplates(); setShowNewMenu(false); }}>
                <span className="wf-new-dropdown-icon">📚</span>
                <div>
                  <div className="wf-new-dropdown-label">From Template</div>
                  <div className="wf-new-dropdown-hint">Browse pre-built workflows</div>
                </div>
              </button>
            </div>
          )}
        </div>
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
          <p>Click <strong>+ New</strong> to create one or browse templates.</p>
        </div>
      )}

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
                setRenameState({ id: contextMenu.workflowId, name: contextMenu.workflowName });
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
                setConfirmDelete({
                  message: `Delete "${contextMenu.workflowName}"?`,
                  onConfirm: () => onDelete(contextMenu.workflowId),
                });
                setContextMenu(null);
              }}
            >
              Delete Workflow
            </button>
          </div>
        </>
      )}

      {renameState && (
        <div className="req-confirm-overlay" onClick={() => setRenameState(null)}>
          <div className="req-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Rename workflow</p>
            <input
              ref={renameInputRef}
              className="req-confirm-input"
              autoFocus
              defaultValue={renameState.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = renameInputRef.current?.value.trim();
                  if (val) { onRename(renameState.id, val); setRenameState(null); }
                } else if (e.key === 'Escape') {
                  setRenameState(null);
                }
              }}
            />
            <div className="req-confirm-actions">
              <button className="req-confirm-cancel" onClick={() => setRenameState(null)}>Cancel</button>
              <button className="req-confirm-ok req-confirm-ok-primary" onClick={() => {
                const val = renameInputRef.current?.value.trim();
                if (val) { onRename(renameState.id, val); setRenameState(null); }
              }}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="req-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="req-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{confirmDelete.message}</p>
            <div className="req-confirm-actions">
              <button className="req-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="req-confirm-ok" onClick={() => { confirmDelete.onConfirm(); setConfirmDelete(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showCreateDialog && (
        <div className="req-confirm-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="req-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>New workflow</p>
            <input
              ref={createInputRef}
              className="req-confirm-input"
              autoFocus
              placeholder="Workflow name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = createInputRef.current?.value.trim();
                  if (val) { onNew(val); setShowCreateDialog(false); }
                } else if (e.key === 'Escape') {
                  setShowCreateDialog(false);
                }
              }}
            />
            <div className="req-confirm-actions">
              <button className="req-confirm-cancel" onClick={() => setShowCreateDialog(false)}>Cancel</button>
              <button className="req-confirm-ok req-confirm-ok-primary" onClick={() => {
                const val = createInputRef.current?.value.trim();
                if (val) { onNew(val); setShowCreateDialog(false); }
              }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
