import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { Workflow, WorkflowFolder } from '../../types/workflow';
import {
  buildFolderTree,
  getUnfiledWorkflows,
  getWorkflowsInFolderRecursive,
  getFolderPath,
} from '../../utils/workflowFolderTree';
import type { FolderTreeNode } from '../../utils/workflowFolderTree';
import { useWorkflowMultiSelect } from '../../hooks/useWorkflowMultiSelect';
import { useWorkflowSidebarDnD } from '../../hooks/useWorkflowSidebarDnD';
import { highlightSearchMatch } from '../../../../shared/utils/consoleLogUtils';

interface Props {
  workflows: Workflow[];
  selectedId: string | null;
  folders: WorkflowFolder[];
  foldersLoaded: boolean;
  onSelect: (id: string) => void;
  onNew: (name: string) => void;
  onBrowseTemplates: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport?: (id: string) => void;
  onExportFolder?: (folderId: string) => void;
  onImport?: () => void;
  onToggleFolderCollapse?: (folderId: string) => void;
  onSetFolderCollapsed?: (folderId: string, collapsed: boolean) => void;
  onCreateFolder?: (name: string, parentId?: string) => void;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => Set<string>;
  onMoveWorkflowToFolder?: (workflowId: string, folderId: string | null, order: number) => void;
  onMoveWorkflowsToFolder?: (workflowIds: string[], folderId: string | null, startOrder: number) => void;
  onMoveFolder?: (folderId: string, newParentId: string | null, newOrder: number) => void;
  onRunAllInFolder?: (workflows: Workflow[]) => void;
}

interface WorkflowCtxMenuState {
  workflowId: string;
  workflowName: string;
  workflowFolderId?: string;
  x: number;
  y: number;
}

interface FolderCtxMenuState {
  folderId: string;
  folderName: string;
  x: number;
  y: number;
}

export default function WorkflowSidebar({
  workflows, selectedId, folders, foldersLoaded, onSelect, onNew, onBrowseTemplates,
  onRename, onDelete, onDuplicate, onExport, onExportFolder, onImport, onToggleFolderCollapse,
  onSetFolderCollapsed, onCreateFolder, onRenameFolder, onDeleteFolder,
  onMoveWorkflowToFolder, onMoveWorkflowsToFolder, onMoveFolder, onRunAllInFolder,
}: Props) {
  const [wfCtxMenu, setWfCtxMenu] = useState<WorkflowCtxMenuState | null>(null);
  const [folderCtxMenu, setFolderCtxMenu] = useState<FolderCtxMenuState | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [renameState, setRenameState] = useState<{ id: string; name: string; type: 'workflow' | 'folder' } | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState<{ parentId?: string } | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const folderCreateInputRef = useRef<HTMLInputElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');

  // ── Multi-select ────────────────────────────
  const {
    multiSelected, setMultiSelected, handleWorkflowClick,
    isMultiDrag, effectiveSelection,
  } = useWorkflowMultiSelect({ workflows, selectedId, folders, foldersLoaded, onSelect });

  // ── Drag-and-drop ────────────────────────────
  const {
    dragSource, dropTarget, setDropTarget,
    handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd,
    getDropClass,
  } = useWorkflowSidebarDnD({
    folders, workflows, multiSelected, setMultiSelected, listRef,
    onSetFolderCollapsed, onMoveWorkflowToFolder, onMoveWorkflowsToFolder, onMoveFolder,
  });

  const hasFolders = foldersLoaded && folders.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  const sortCompare = useCallback((a: string, b: string) => {
    if (sortOrder === 'none') return 0;
    const cmp = a.localeCompare(b, undefined, { sensitivity: 'base' });
    return sortOrder === 'desc' ? -cmp : cmp;
  }, [sortOrder]);

  const sortTreeNodes = useMemo(() => {
    const recurse = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
      if (sortOrder === 'none') return nodes;
      return nodes
        .map((node) => ({
          ...node,
          children: recurse(node.children),
          workflows: [...node.workflows].sort((a, b) => sortCompare(a.name, b.name)),
        }))
        .sort((a, b) => sortCompare(a.folder.name, b.folder.name));
    };
    return recurse;
  }, [sortOrder, sortCompare]);

  const rawFolderTree = hasFolders ? buildFolderTree(folders, workflows) : [];
  const rawUnfiled = hasFolders ? getUnfiledWorkflows(folders, workflows) : workflows;
  const folderTree = sortOrder !== 'none' ? sortTreeNodes(rawFolderTree) : rawFolderTree;
  const unfiled = sortOrder !== 'none'
    ? [...rawUnfiled].sort((a, b) => sortCompare(a.name, b.name))
    : rawUnfiled;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase().trim();
    return workflows
      .filter((wf) => wf.name.toLowerCase().includes(q))
      .map((wf) => ({
        workflow: wf,
        breadcrumb: wf.folderId ? getFolderPath(wf.folderId, folders) : 'Workflows',
      }));
  }, [isSearching, searchQuery, workflows, folders]);

  const activeCtxMenu = wfCtxMenu || folderCtxMenu;

  const clearAllMenus = useCallback(() => {
    setWfCtxMenu(null);
    setFolderCtxMenu(null);
    setShowMoveMenu(false);
  }, []);

  const getRecursiveCount = useCallback(
    (folderId: string) => getWorkflowsInFolderRecursive(folderId, folders, workflows).length,
    [folders, workflows],
  );

  // ── Search highlight helper ─────────────────────────

  const highlightMatch = (text: string, query: string) => {
    return highlightSearchMatch(text, query, 'wf-search-highlight');
  };

  const renderSearchResults = () => (
    <div className="wf-search-results">
      {searchResults.length === 0 ? (
        <div className="wf-sidebar-empty">
          <p>No workflows match "{searchQuery}"</p>
        </div>
      ) : (
        searchResults.map(({ workflow: wf, breadcrumb }) => (
          <div
            key={wf.id}
            className={`wf-sidebar-item wf-search-result-item ${wf.id === selectedId ? 'active' : ''}`}
            onClick={() => onSelect(wf.id)}
          >
            <div className="wf-search-result-content">
              <span className="wf-search-result-breadcrumb">{breadcrumb}</span>
              <div className="wf-sidebar-item-top">
                <span className="wf-sidebar-item-name">{highlightMatch(wf.name, searchQuery.trim())}</span>
                <span className="wf-sidebar-item-badge">{wf.nodes.length}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ── Workflow item ──────────────────────────────────

  const renderWorkflowItem = (wf: Workflow) => {
    const isDragging = dragSource?.type === 'workflow' && (dragSource.id === wf.id || (isMultiDrag && multiSelected.has(wf.id)));
    const isSelected = effectiveSelection.has(wf.id);
    const isActive = wf.id === selectedId;
    const isCtxActive = wfCtxMenu?.workflowId === wf.id;
    return (
      <div
        key={wf.id}
        className={`wf-sidebar-item ${isActive ? 'active' : ''} ${isCtxActive ? 'wf-ctx-active' : ''} ${isSelected && multiSelected.size > 0 ? 'wf-multi-selected' : ''} ${isDragging ? 'wf-dragging' : ''} ${getDropClass('workflow', wf.id)}`}
        onClick={(e) => { setSelectedFolderId(null); handleWorkflowClick(e, wf.id); }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelectedFolderId(null);
          if (!multiSelected.has(wf.id)) {
            setMultiSelected(new Set());
            onSelect(wf.id);
          }
          setFolderCtxMenu(null);
          setShowMoveMenu(false);
          setWfCtxMenu({ workflowId: wf.id, workflowName: wf.name, workflowFolderId: wf.folderId, x: e.clientX, y: e.clientY });
        }}
        draggable
        onDragStart={(e) => handleDragStart(e, 'workflow', wf.id)}
        onDragOver={(e) => handleDragOver(e, 'workflow', wf.id)}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        <div className="wf-sidebar-item-top">
          {multiSelected.size > 0 && (
            <span className={`wf-multi-check ${isSelected ? 'checked' : ''}`} />
          )}
          <span className="wf-sidebar-item-name">{wf.name}</span>
          <span className="wf-sidebar-item-badge">{wf.nodes.length}</span>
        </div>
        {isDragging && isMultiDrag && dragSource?.id === wf.id && (
          <span className="wf-drag-count">{multiSelected.size}</span>
        )}
      </div>
    );
  };

  // ── Folder node (recursive) ────────────────────────

  const renderFolderNode = (node: FolderTreeNode, depth: number) => {
    const isExpanded = !node.folder.collapsed;
    const count = getRecursiveCount(node.folder.id);
    const isRenaming = renameState?.type === 'folder' && renameState.id === node.folder.id;
    const isDragging = dragSource?.type === 'folder' && dragSource.id === node.folder.id;
    return (
      <div key={node.folder.id} className={`wf-folder-group ${isDragging ? 'wf-dragging' : ''}`} style={{ paddingLeft: depth > 0 ? 8 : 0 }}>
        <div
          className={`wf-folder-header ${selectedFolderId === node.folder.id ? 'active' : ''} ${folderCtxMenu?.folderId === node.folder.id ? 'wf-ctx-active' : ''} ${getDropClass('folder', node.folder.id)}`}
          onClick={() => { setSelectedFolderId(node.folder.id); onToggleFolderCollapse?.(node.folder.id); }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedFolderId(node.folder.id);
            setWfCtxMenu(null);
            setShowMoveMenu(false);
            setFolderCtxMenu({ folderId: node.folder.id, folderName: node.folder.name, x: e.clientX, y: e.clientY });
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setRenameState({ id: node.folder.id, name: node.folder.name, type: 'folder' });
          }}
          draggable
          onDragStart={(e) => handleDragStart(e, 'folder', node.folder.id)}
          onDragOver={(e) => handleDragOver(e, 'folder', node.folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        >
          <span className="wf-folder-arrow">{isExpanded ? '▾' : '▸'}</span>
          <span className="wf-folder-icon">📁</span>
          {isRenaming ? (
            <input
              className="wf-folder-inline-rename"
              autoFocus
              defaultValue={renameState.name}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) { onRenameFolder?.(renameState.id, val); }
                  setRenameState(null);
                } else if (e.key === 'Escape') {
                  setRenameState(null);
                }
              }}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val && val !== renameState.name) { onRenameFolder?.(renameState.id, val); }
                setRenameState(null);
              }}
            />
          ) : (
            <span className="wf-folder-name">{node.folder.name}</span>
          )}
          <span className="wf-folder-count">({count})</span>
        </div>
        {isExpanded && (
          <div className="wf-folder-children">
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
            {node.workflows.map(renderWorkflowItem)}
          </div>
        )}
      </div>
    );
  };

  // ── Close menus on escape / resize ─────────────────

  useEffect(() => {
    if (!activeCtxMenu) return;
    const close = () => clearAllMenus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
    };
  }, [activeCtxMenu, clearAllMenus]);

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

  // ── Render ─────────────────────────────────────────

  return (
    <div className="wf-sidebar">
      <div className="wf-sidebar-header">
        <span className="wf-sidebar-title">Workflows</span>
        <div className="wf-new-dropdown-wrap" ref={newMenuRef}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowNewMenu(v => !v)}
            title="New workflow"
            data-testid="wf-sidebar-new-btn"
          >
            + New
          </button>
          {showNewMenu && (
            <div className="wf-new-dropdown">
              <button
                className="wf-new-dropdown-item"
                data-testid="wf-new-blank-item"
                onClick={() => { setShowCreateDialog(true); setShowNewMenu(false); }}
              >
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
              {onImport && (
                <button className="wf-new-dropdown-item" onClick={() => { onImport(); setShowNewMenu(false); }}>
                  <span className="wf-new-dropdown-icon">📥</span>
                  <div>
                    <div className="wf-new-dropdown-label">Import Workflow</div>
                    <div className="wf-new-dropdown-hint">Import from JSON file</div>
                  </div>
                </button>
              )}
              {onCreateFolder && (
                <>
                  <div className="wf-new-dropdown-divider" />
                  <button className="wf-new-dropdown-item" onClick={() => { setShowCreateFolderDialog({}); setShowNewMenu(false); }}>
                    <span className="wf-new-dropdown-icon">📁</span>
                    <div>
                      <div className="wf-new-dropdown-label">New Folder</div>
                      <div className="wf-new-dropdown-hint">Organize your workflows</div>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {workflows.length > 0 && (
        <div className="wf-sidebar-search">
          <input
            type="text"
            className="wf-sidebar-search-input"
            placeholder="Search workflows…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="wf-sidebar-search"
          />
          {searchQuery && (
            <button
              className="wf-sidebar-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >×</button>
          )}
          <button
            className={`wf-sidebar-sort-btn ${sortOrder !== 'none' ? 'active' : ''}`}
            onClick={() => setSortOrder((prev) => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none')}
            title={sortOrder === 'none' ? 'Sort A–Z' : sortOrder === 'asc' ? 'Sort Z–A' : 'Clear sort'}
            data-testid="wf-sidebar-sort"
          >
            {sortOrder === 'none' && '↕'}
            {sortOrder === 'asc' && '↑'}
            {sortOrder === 'desc' && '↓'}
          </button>
        </div>
      )}

      <div className="wf-sidebar-list" ref={listRef}>
        {isSearching ? renderSearchResults() : (
          hasFolders ? (
            <>
              {folderTree.map((node) => renderFolderNode(node, 0))}
              {unfiled.length > 0 && (
                <div
                  key="unfiled"
                  className={`wf-folder-unfiled ${dropTarget?.type === 'unfiled' ? 'wf-drop-inside' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragSource) {
                      e.dataTransfer.dropEffect = 'move';
                      setDropTarget({ type: 'unfiled', id: 'unfiled', zone: 'inside' });
                    }
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {unfiled.map(renderWorkflowItem)}
                </div>
              )}
              {unfiled.length === 0 && dragSource && (
                <div
                  key="unfiled-drop"
                  className={`wf-folder-unfiled wf-folder-unfiled-drop ${dropTarget?.type === 'unfiled' ? 'wf-drop-inside' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    setDropTarget({ type: 'unfiled', id: 'unfiled', zone: 'inside' });
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="wf-folder-unfiled-header">Drop here</div>
                </div>
              )}
            </>
          ) : (
            unfiled.map(renderWorkflowItem)
          )
        )}
      </div>

      {workflows.length === 0 && (
        <div className="wf-sidebar-empty">
          <p>No workflows yet.</p>
          <p>Click <strong>+ New</strong> to create one or browse templates.</p>
        </div>
      )}

      {/* ── Workflow context menu ─────────────────────── */}
      {wfCtxMenu && (() => {
        const ctxIds = multiSelected.size > 1 && multiSelected.has(wfCtxMenu.workflowId)
          ? [...multiSelected] : [wfCtxMenu.workflowId];
        const isBulk = ctxIds.length > 1;
        const bulkLabel = `${ctxIds.length} workflows`;

        const anyInFolder = isBulk
          ? ctxIds.some(id => workflows.find(w => w.id === id)?.folderId)
          : !!wfCtxMenu.workflowFolderId;

        const moveCtxWorkflows = (folderId: string | null) => {
          const targetFolder = folderId ?? undefined;
          const endOrder = workflows.filter((w) => (w.folderId ?? undefined) === targetFolder).length;
          if (isBulk && onMoveWorkflowsToFolder) {
            onMoveWorkflowsToFolder(ctxIds, folderId, endOrder);
          } else {
            onMoveWorkflowToFolder?.(wfCtxMenu.workflowId, folderId, endOrder);
          }
          setMultiSelected(new Set());
          clearAllMenus();
        };

        return (
          <>
            <div className="wf-sidebar-ctx-backdrop" onClick={clearAllMenus} role="presentation" />
            <div
              className="wf-sidebar-ctx-menu"
              style={{ left: wfCtxMenu.x, top: wfCtxMenu.y }}
              role="menu"
              onClick={(e) => e.stopPropagation()}
            >
              {isBulk && (
                <div className="wf-sidebar-ctx-header">{bulkLabel} selected</div>
              )}
              {!isBulk && (
                <>
                  <button type="button" className="wf-sidebar-ctx-item" role="menuitem"
                    onClick={() => { setRenameState({ id: wfCtxMenu.workflowId, name: wfCtxMenu.workflowName, type: 'workflow' }); clearAllMenus(); }}>
                    Rename Workflow
                  </button>
                  <button type="button" className="wf-sidebar-ctx-item" role="menuitem"
                    onClick={() => { onDuplicate(wfCtxMenu.workflowId); clearAllMenus(); }}>
                    Duplicate Workflow
                  </button>
                  {onExport && (
                    <button type="button" className="wf-sidebar-ctx-item" role="menuitem"
                      onClick={() => { onExport(wfCtxMenu.workflowId); clearAllMenus(); }}>
                      Export Workflow
                    </button>
                  )}
                </>
              )}
              {(onMoveWorkflowToFolder || onMoveWorkflowsToFolder) && foldersLoaded && (
                <>
                  <div className="wf-sidebar-ctx-divider" />
                  <div className="wf-sidebar-ctx-submenu-wrap">
                    <button type="button" className="wf-sidebar-ctx-item" role="menuitem"
                      onClick={() => setShowMoveMenu((v) => !v)}>
                      {isBulk ? `Move ${bulkLabel} to Folder ▸` : 'Move to Folder ▸'}
                    </button>
                    {showMoveMenu && (
                      <div className="wf-sidebar-ctx-submenu" role="menu">
                        {folders.filter((f) => !f.parentId).map((f) => (
                          <button key={f.id} type="button" className="wf-sidebar-ctx-item" role="menuitem"
                            onClick={() => moveCtxWorkflows(f.id)}>
                            📁 {f.name}
                          </button>
                        ))}
                        {anyInFolder && (
                          <button type="button" className="wf-sidebar-ctx-item wf-sidebar-ctx-item-muted" role="menuitem"
                            onClick={() => moveCtxWorkflows(null)}>
                            ↩ Move out of Folder
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
              <div className="wf-sidebar-ctx-divider" />
              <button type="button" className="wf-sidebar-ctx-item wf-sidebar-ctx-item-danger" role="menuitem"
                onClick={() => {
                  if (isBulk) {
                    setConfirmDelete({
                      message: `Delete ${ctxIds.length} selected workflows?`,
                      onConfirm: () => { ctxIds.forEach((id) => onDelete(id)); setMultiSelected(new Set()); },
                    });
                  } else {
                    setConfirmDelete({ message: `Delete "${wfCtxMenu.workflowName}"?`, onConfirm: () => onDelete(wfCtxMenu.workflowId) });
                  }
                  clearAllMenus();
                }}>
                {isBulk ? `Delete ${bulkLabel}` : 'Delete Workflow'}
              </button>
            </div>
          </>
        );
      })()}

      {/* ── Folder context menu ──────────────────────── */}
      {folderCtxMenu && (
        <>
          <div className="wf-sidebar-ctx-backdrop" onClick={clearAllMenus} role="presentation" />
          <div
            className="wf-sidebar-ctx-menu"
            style={{ left: folderCtxMenu.x, top: folderCtxMenu.y }}
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            {onRenameFolder && (
              <button type="button" className="wf-sidebar-ctx-item" role="menuitem"
                onClick={() => { setRenameState({ id: folderCtxMenu.folderId, name: folderCtxMenu.folderName, type: 'folder' }); clearAllMenus(); }}>
                Rename Folder
              </button>
            )}
            {onCreateFolder && (
              <button type="button" className="wf-sidebar-ctx-item" role="menuitem"
                onClick={() => { setShowCreateFolderDialog({ parentId: folderCtxMenu.folderId }); clearAllMenus(); }}>
                New Sub-Folder
              </button>
            )}
            {onExportFolder && getRecursiveCount(folderCtxMenu.folderId) > 0 && (
              <>
                <div className="wf-sidebar-ctx-divider" />
                <button type="button" className="wf-sidebar-ctx-item" role="menuitem"
                  onClick={() => { onExportFolder(folderCtxMenu.folderId); clearAllMenus(); }}>
                  Export Folder ({getRecursiveCount(folderCtxMenu.folderId)})
                </button>
              </>
            )}
            {onImport && (
              <button type="button" className="wf-sidebar-ctx-item" role="menuitem"
                onClick={() => { onImport(); clearAllMenus(); }}>
                Import Workflow
              </button>
            )}
            {onRunAllInFolder && (
              <>
                <div className="wf-sidebar-ctx-divider" />
                <button type="button" className="wf-sidebar-ctx-item" role="menuitem"
                  onClick={() => {
                    const wfs = getWorkflowsInFolderRecursive(folderCtxMenu.folderId, folders, workflows);
                    onRunAllInFolder(wfs);
                    clearAllMenus();
                  }}>
                  Run All in Folder ({getRecursiveCount(folderCtxMenu.folderId)})
                </button>
              </>
            )}
            {onDeleteFolder && (
              <>
                <div className="wf-sidebar-ctx-divider" />
                <button type="button" className="wf-sidebar-ctx-item wf-sidebar-ctx-item-danger" role="menuitem"
                  onClick={() => {
                    const count = getRecursiveCount(folderCtxMenu.folderId);
                    const msg = count > 0
                      ? `Delete folder "${folderCtxMenu.folderName}" and move its ${count} workflow(s) out of the folder?`
                      : `Delete empty folder "${folderCtxMenu.folderName}"?`;
                    setConfirmDelete({
                      message: msg,
                      onConfirm: () => {
                        const removedIds = onDeleteFolder(folderCtxMenu.folderId);
                        if (onMoveWorkflowToFolder) {
                          const unfiledCount = workflows.filter((w) => !w.folderId).length;
                          workflows
                            .filter((w) => w.folderId && removedIds.has(w.folderId))
                            .forEach((w, i) => onMoveWorkflowToFolder(w.id, null, unfiledCount + i));
                        }
                      },
                    });
                    clearAllMenus();
                  }}>
                  Delete Folder
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Rename dialog (workflow or folder) ────────── */}
      {renameState && renameState.type === 'workflow' && (
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
                } else if (e.key === 'Escape') { setRenameState(null); }
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

      {/* ── Delete confirmation ───────────────────────── */}
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

      {/* ── Create workflow dialog ────────────────────── */}
      {showCreateDialog && (
        <div className="req-confirm-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="req-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>New workflow</p>
            <input
              ref={createInputRef}
              className="req-confirm-input"
              data-testid="wf-create-input"
              autoFocus
              placeholder="Workflow name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = createInputRef.current?.value.trim();
                  if (val) { onNew(val); setShowCreateDialog(false); }
                } else if (e.key === 'Escape') { setShowCreateDialog(false); }
              }}
            />
            <div className="req-confirm-actions">
              <button className="req-confirm-cancel" onClick={() => setShowCreateDialog(false)}>Cancel</button>
              <button
                className="req-confirm-ok req-confirm-ok-primary"
                data-testid="wf-create-ok"
                onClick={() => {
                  const val = createInputRef.current?.value.trim();
                  if (val) { onNew(val); setShowCreateDialog(false); }
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create folder dialog ──────────────────────── */}
      {showCreateFolderDialog && (
        <div className="req-confirm-overlay" onClick={() => setShowCreateFolderDialog(null)}>
          <div className="req-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{showCreateFolderDialog.parentId ? 'New sub-folder' : 'New folder'}</p>
            <input
              ref={folderCreateInputRef}
              className="req-confirm-input"
              autoFocus
              placeholder="Folder name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = folderCreateInputRef.current?.value.trim();
                  if (val) { onCreateFolder?.(val, showCreateFolderDialog.parentId); setShowCreateFolderDialog(null); }
                } else if (e.key === 'Escape') { setShowCreateFolderDialog(null); }
              }}
            />
            <div className="req-confirm-actions">
              <button className="req-confirm-cancel" onClick={() => setShowCreateFolderDialog(null)}>Cancel</button>
              <button className="req-confirm-ok req-confirm-ok-primary" onClick={() => {
                const val = folderCreateInputRef.current?.value.trim();
                if (val) { onCreateFolder?.(val, showCreateFolderDialog.parentId); setShowCreateFolderDialog(null); }
              }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
