import { useState, useCallback, useRef, useEffect } from 'react';
import type { WorkbenchCollection, WorkbenchFolder } from '../../types';
import { saveJsonFile, openJsonFile } from '../../utils/fileSaver';
import { isTauri } from '../../utils/platform';
import { v4 as uuidv4 } from 'uuid';
import SidebarContextMenu from './SidebarContextMenu';

interface Props {
  collections: WorkbenchCollection[];
  selectedCollectionId?: string;
  selectedRequestId?: string;
  onSelectCollection: (colId: string) => void;
  onSelectRequest: (colId: string, reqId: string) => void;
  onNewCollection: () => void;
  onEditCollection: (col: WorkbenchCollection) => void;
  onDeleteCollection: (colId: string) => void;
  onDuplicateCollection: (colId: string) => void;
  onNewRequest: (colId: string, folderId?: string) => void;
  onDeleteRequest: (colId: string, reqId: string) => void;
  onDuplicateRequest: (colId: string, reqId: string) => void;
  onAddFolder: (colId: string, name: string, parentFolderId?: string) => void;
  onAddSubCollection: (colId: string, name: string, parentFolderId?: string) => void;
  onEditSubCollection: (colId: string, folderId: string) => void;
  onRenameFolder: (colId: string, folderId: string, name: string) => void;
  onDeleteFolder: (colId: string, folderId: string) => void;
  onDuplicateFolder: (colId: string, folderId: string) => void;
  onMoveFolder: (colId: string, folderId: string, direction: 'up' | 'down') => void;
  onMoveFolderTo: (colId: string, folderId: string, targetParentFolderId: string | null) => void;
  onMoveRequest: (colId: string, reqId: string, targetFolderId: string | null) => void;
  onMoveRequestToCollection: (srcColId: string, reqId: string, destColId: string, destFolderId: string | null) => void;
  onMoveFolderToCollection: (srcColId: string, folderId: string, destColId: string, destParentFolderId: string | null) => void;
  onMergeCollectionInto: (srcColId: string, destColId: string) => void;
  onManageEnvs: () => void;
  countAllRequests: (col: WorkbenchCollection) => number;
  onImportCollection: (col: WorkbenchCollection) => void;
  onImportFolder: (colId: string, folder: WorkbenchFolder, parentFolderId?: string) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e', POST: '#f59e0b', PUT: '#3b82f6', PATCH: '#8b5cf6', DELETE: '#ef4444',
};

function hasAuth(col: WorkbenchCollection): boolean {
  return !!col.auth && col.auth.type !== 'none' && col.auth.type !== 'inherit';
}

function authLabel(col: WorkbenchCollection): string {
  if (!col.auth) return '';
  switch (col.auth.type) {
    case 'bearer': return 'Bearer'; case 'basic': return 'Basic';
    case 'apikey': return 'API Key'; case 'oauth2': return 'OAuth2'; default: return '';
  }
}

function findFolderInTree(folders: WorkbenchFolder[], folderId: string): WorkbenchFolder | null {
  for (const f of folders) {
    if (f.id === folderId) return f;
    const deep = findFolderInTree(f.folders ?? [], folderId);
    if (deep) return deep;
  }
  return null;
}

function findSiblingFolders(folders: WorkbenchFolder[], folderId: string): WorkbenchFolder[] | null {
  for (let i = 0; i < folders.length; i++) {
    if (folders[i].id === folderId) return folders;
    const deep = findSiblingFolders(folders[i].folders ?? [], folderId);
    if (deep) return deep;
  }
  return null;
}

function countFolderReqs(folder: WorkbenchFolder): number {
  return folder.requests.length + (folder.folders ?? []).reduce((s, f) => s + countFolderReqs(f), 0);
}

type CtxMenuData = {
  x: number; y: number;
  type: 'collection' | 'folder' | 'request';
  colId: string; folderId?: string; reqId?: string;
};
type CtxMenu = CtxMenuData | null;

type DragItem = { kind: 'request'; reqId: string; colId: string } | { kind: 'folder'; folderId: string; colId: string } | { kind: 'collection'; colId: string } | null;

function regenIds(folder: WorkbenchFolder): WorkbenchFolder {
  return {
    ...folder, id: uuidv4(),
    requests: folder.requests.map(r => ({ ...r, id: uuidv4() })),
    folders: (folder.folders ?? []).map(regenIds),
  };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildExportPayload(type: string, data: unknown) {
  return { type, version: '1.0', exportedAt: new Date().toISOString(), data };
}

async function pickImportFile(): Promise<string | null> {
  if (isTauri()) {
    const result = await openJsonFile();
    return result?.content ?? null;
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => { alert('Failed to read file.'); resolve(null); };
      reader.readAsText(file);
    };
    input.click();
  });
}

export default function WorkbenchSidebar({
  collections, selectedCollectionId, selectedRequestId,
  onSelectCollection, onSelectRequest, onNewCollection,
  onEditCollection, onDeleteCollection, onDuplicateCollection, onNewRequest, onDeleteRequest,
  onDuplicateRequest, onAddFolder, onAddSubCollection, onEditSubCollection, onRenameFolder, onDeleteFolder, onDuplicateFolder, onMoveFolder,
  onMoveFolderTo, onMoveRequest, onMoveRequestToCollection, onMoveFolderToCollection, onMergeCollectionInto, onManageEnvs, countAllRequests,
  onImportCollection, onImportFolder,
}: Props) {
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set(collections.map(c => c.id)));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<CtxMenu>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showFolderMoveMenu, setShowFolderMoveMenu] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<{ colId: string; folderId: string } | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [newFolderTarget, setNewFolderTarget] = useState<{ colId: string; parentFolderId?: string; isSubCollection?: boolean } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragItem, _setDragItem] = useState<DragItem>(null);
  const dragItemRef = useRef<DragItem>(null);
  const setDragItem = useCallback((v: DragItem) => { dragItemRef.current = v; _setDragItem(v); }, []);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const autoExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const dismissCtx = useCallback(() => {
    setContextMenu(null); setShowMoveMenu(false); setShowFolderMoveMenu(false);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => dismissCtx();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu, dismissCtx]);

  const toggleCol = (colId: string) => {
    setExpandedCols((prev) => { const n = new Set(prev); if (n.has(colId)) n.delete(colId); else n.add(colId); return n; });
  };
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => { const n = new Set(prev); if (n.has(folderId)) n.delete(folderId); else n.add(folderId); return n; });
  };

  const handleContext = (e: React.MouseEvent, type: CtxMenuData['type'], colId: string, folderId?: string, reqId?: string) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, colId, folderId, reqId });
    setShowMoveMenu(false); setShowFolderMoveMenu(false);
  };

  const startAddFolder = (colId: string, parentFolderId?: string, isSubCollection?: boolean) => {
    setNewFolderTarget({ colId, parentFolderId, isSubCollection }); setNewFolderName(''); setContextMenu(null);
    setExpandedCols((prev) => new Set(prev).add(colId));
    if (parentFolderId) setExpandedFolders((prev) => new Set(prev).add(parentFolderId));
  };
  const commitAddFolder = () => {
    if (newFolderTarget && newFolderName.trim()) {
      const col = collections.find(c => c.id === newFolderTarget.colId);
      const siblings = newFolderTarget.parentFolderId
        ? findFolderInTree(col?.folders ?? [], newFolderTarget.parentFolderId)?.folders ?? []
        : col?.folders ?? [];
      const nameExists = siblings.some(f => f.name.toLowerCase() === newFolderName.trim().toLowerCase());
      if (nameExists) {
        alert(`A folder or sub-collection with the name "${newFolderName.trim()}" already exists at this level.`);
        return;
      }
      if (newFolderTarget.isSubCollection) {
        onAddSubCollection(newFolderTarget.colId, newFolderName.trim(), newFolderTarget.parentFolderId);
      } else {
        onAddFolder(newFolderTarget.colId, newFolderName.trim(), newFolderTarget.parentFolderId);
      }
    }
    setNewFolderTarget(null); setNewFolderName('');
  };
  const startRenameFolder = (colId: string, folderId: string, currentName: string) => {
    setRenamingFolder({ colId, folderId }); setRenameVal(currentName); setContextMenu(null);
    setTimeout(() => renameRef.current?.focus(), 50);
  };
  const commitRenameFolder = () => {
    if (renamingFolder && renameVal.trim()) {
      const col = collections.find(c => c.id === renamingFolder.colId);
      const siblings = findSiblingFolders(col?.folders ?? [], renamingFolder.folderId) ?? [];
      const nameExists = siblings.some(f => f.id !== renamingFolder.folderId && f.name.toLowerCase() === renameVal.trim().toLowerCase());
      if (nameExists) {
        alert(`A folder or sub-collection with the name "${renameVal.trim()}" already exists at this level.`);
        return;
      }
      onRenameFolder(renamingFolder.colId, renamingFolder.folderId, renameVal.trim());
    }
    setRenamingFolder(null);
  };

  // ─── Export / Import ──────────────────────────────────

  const handleExportAll = async () => {
    if (collections.length === 0) return;
    const payload = buildExportPayload('workbench-all', { collections });
    await saveJsonFile(payload, `workbench-all-collections.json`);
  };

  const handleExportCollection = async (colId: string) => {
    const col = collections.find(c => c.id === colId);
    if (!col) return;
    await saveJsonFile(buildExportPayload('workbench-collection', col), `collection-${slugify(col.name)}.json`);
    setContextMenu(null);
  };

  const handleExportFolder = async (colId: string, folderId: string) => {
    const col = collections.find(c => c.id === colId);
    const folder = col ? findFolderInTree(col.folders ?? [], folderId) : null;
    if (!folder) return;
    await saveJsonFile(buildExportPayload('workbench-folder', folder), `folder-${slugify(folder.name)}.json`);
    setContextMenu(null);
  };

  const handleImportToCollection = async (colId?: string) => {
    setContextMenu(null);
    const content = await pickImportFile();
    if (!content) return;
    try {
      const json = JSON.parse(content);
      if (json.type === 'workbench-collection' && json.data) {
        const incoming = json.data as WorkbenchCollection;
        if (!incoming.name || !incoming.requests) {
          alert('Invalid collection format: missing required fields.'); return;
        }
        const nameExists = collections.some(c => c.name.toLowerCase() === incoming.name.toLowerCase());
        const imported: WorkbenchCollection = {
          ...incoming,
          id: uuidv4(),
          name: nameExists ? `${incoming.name} (imported)` : incoming.name,
          requests: incoming.requests.map(r => ({ ...r, id: uuidv4() })),
          folders: (incoming.folders ?? []).map(regenIds),
        };
        onImportCollection(imported);
      } else if (json.type === 'workbench-folder' && json.data && colId) {
        const incoming = json.data as WorkbenchFolder;
        if (!incoming.name || !incoming.requests) {
          alert('Invalid folder format: missing required fields.'); return;
        }
        const col = collections.find(c => c.id === colId);
        const siblings = col?.folders ?? [];
        const nameExists = siblings.some(f => f.name.toLowerCase() === incoming.name.toLowerCase());
        const imported = regenIds({
          ...incoming,
          name: nameExists ? `${incoming.name} (imported)` : incoming.name,
        });
        onImportFolder(colId, imported);
      } else if (json.type === 'workbench-all' && json.data?.collections) {
        const incoming = json.data.collections as WorkbenchCollection[];
        let importedCount = 0;
        for (const inc of incoming) {
          if (!inc.name || !inc.requests) continue;
          const nameExists = collections.some(c => c.name.toLowerCase() === inc.name.toLowerCase());
          const imported: WorkbenchCollection = {
            ...inc,
            id: uuidv4(),
            name: nameExists ? `${inc.name} (imported)` : inc.name,
            requests: inc.requests.map(r => ({ ...r, id: uuidv4() })),
            folders: (inc.folders ?? []).map(regenIds),
          };
          onImportCollection(imported);
          importedCount++;
        }
        if (importedCount === 0) alert('No valid collections found in the file.');
      } else {
        alert('Unrecognized file format. Expected a workbench collection, folder, or all-collections export.');
      }
    } catch {
      alert('Invalid JSON file. Please select a valid export file.');
    }
  };

  const handleImportToFolder = async (colId: string, parentFolderId: string) => {
    setContextMenu(null);
    const content = await pickImportFile();
    if (!content) return;
    try {
      const json = JSON.parse(content);
      if (json.type === 'workbench-folder' && json.data) {
        const incoming = json.data as WorkbenchFolder;
        if (!incoming.name || !incoming.requests) {
          alert('Invalid folder format: missing required fields.'); return;
        }
        const parent = findFolderInTree(collections.find(c => c.id === colId)?.folders ?? [], parentFolderId);
        const siblings = parent?.folders ?? [];
        const nameExists = siblings.some(f => f.name.toLowerCase() === incoming.name.toLowerCase());
        const imported = regenIds({
          ...incoming,
          name: nameExists ? `${incoming.name} (imported)` : incoming.name,
        });
        onImportFolder(colId, imported, parentFolderId);
      } else {
        alert('Expected a folder/sub-collection export file.');
      }
    } catch {
      alert('Invalid JSON file. Please select a valid export file.');
    }
  };

  // ─── Drag and Drop ──────────────────────────────────

  const handleCollectionDragStart = useCallback((e: React.DragEvent, colId: string) => {
    setDragItem({ kind: 'collection', colId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  }, [setDragItem]);

  const handleReqDragStart = useCallback((e: React.DragEvent, colId: string, reqId: string) => {
    setDragItem({ kind: 'request', reqId, colId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', reqId);
  }, [setDragItem]);

  const handleFolderDragStart = useCallback((e: React.DragEvent, colId: string, folderId: string) => {
    setDragItem({ kind: 'folder', folderId, colId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', folderId);
  }, [setDragItem]);

  const handleDragOver = useCallback((e: React.DragEvent, _targetId: string) => {
    if (!dragItemRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(_targetId);
  }, []);

  const handleDragLeave = useCallback(() => setDropTarget(null), []);

  const handleDrop = useCallback((e: React.DragEvent, colId: string, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const di = dragItemRef.current;
    if (!di) return;
    if (di.kind === 'collection') {
      if (di.colId !== colId) {
        onMergeCollectionInto(di.colId, colId);
      }
    } else if (di.kind === 'request') {
      if (di.colId === colId) {
        onMoveRequest(colId, di.reqId, targetFolderId);
      } else {
        onMoveRequestToCollection(di.colId, di.reqId, colId, targetFolderId);
      }
    } else if (di.kind === 'folder') {
      if (di.colId === colId && targetFolderId === null) {
        onMoveFolderTo(colId, di.folderId, null);
      } else if (di.colId !== colId) {
        onMoveFolderToCollection(di.colId, di.folderId, colId, targetFolderId);
      }
    }
    setDragItem(null); setDropTarget(null);
  }, [onMoveRequest, onMoveRequestToCollection, onMoveFolderTo, onMoveFolderToCollection, onMergeCollectionInto, setDragItem]);

  const handleFolderDrop = useCallback((e: React.DragEvent, colId: string, targetFolderId: string) => {
    e.preventDefault(); e.stopPropagation();
    const di = dragItemRef.current;
    if (!di) return;
    if (di.kind === 'request') {
      if (di.colId === colId) {
        onMoveRequest(colId, di.reqId, targetFolderId);
      } else {
        onMoveRequestToCollection(di.colId, di.reqId, colId, targetFolderId);
      }
    } else if (di.kind === 'folder' && di.folderId !== targetFolderId) {
      if (di.colId === colId) {
        onMoveFolderTo(colId, di.folderId, targetFolderId);
      } else {
        onMoveFolderToCollection(di.colId, di.folderId, colId, targetFolderId);
      }
    }
    setDragItem(null); setDropTarget(null);
  }, [onMoveRequest, onMoveRequestToCollection, onMoveFolderTo, onMoveFolderToCollection, setDragItem]);

  const handleDragEnd = useCallback(() => {
    setDragItem(null); setDropTarget(null);
    if (autoExpandTimer.current) { clearTimeout(autoExpandTimer.current); autoExpandTimer.current = null; }
  }, [setDragItem]);

  const renderRequest = (colId: string, reqId: string, method: string, name: string, url: string, inFolderId?: string) => (
    <div key={reqId}
      className={`wb-req-item ${selectedRequestId === reqId ? 'selected' : ''} ${dragItem?.kind === 'request' && (dragItem as any).reqId === reqId ? 'dragging' : ''}`}
      onClick={() => onSelectRequest(colId, reqId)}
      onContextMenu={(e) => handleContext(e, 'request', colId, inFolderId, reqId)}
      draggable onDragStart={(e) => handleReqDragStart(e, colId, reqId)} onDragEnd={handleDragEnd}>
      <span className="wb-req-method" style={{ color: METHOD_COLORS[method] || '#94a3b8' }}>{method}</span>
      <span className="wb-req-name" title={name || url}>{name || url || 'Untitled'}</span>
    </div>
  );

  const renderFolder = (col: WorkbenchCollection, folder: WorkbenchFolder, depth: number) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isRenaming = renamingFolder?.folderId === folder.id;
    const isDropTgt = dropTarget === folder.id;
    const isDraggingThis = dragItem?.kind === 'folder' && (dragItem as any).folderId === folder.id;
    const subFolders = folder.folders ?? [];
    const isNewFolderHere = newFolderTarget?.parentFolderId === folder.id;

    return (
      <div key={folder.id}
        className={`wb-folder-group ${isDropTgt ? 'drop-target' : ''} ${isDraggingThis ? 'dragging' : ''}`}
        style={{ paddingLeft: depth > 0 ? 8 : 0 }}
        onDragOver={(e) => handleDragOver(e, folder.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleFolderDrop(e, col.id, folder.id)}>
        <div className="wb-folder-header"
          onClick={() => toggleFolder(folder.id)}
          onContextMenu={(e) => handleContext(e, 'folder', col.id, folder.id)}
          draggable onDragStart={(e) => handleFolderDragStart(e, col.id, folder.id)} onDragEnd={handleDragEnd}>
          <span className="wb-folder-arrow">{isExpanded ? '▾' : '▸'}</span>
          <span className="wb-folder-icon">{folder.isSubCollection ? '📦' : '📁'}</span>
          {isRenaming ? (
            <input ref={renameRef} className="wb-inline-input" value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)} onBlur={commitRenameFolder}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRenameFolder(); if (e.key === 'Escape') setRenamingFolder(null); }}
              onClick={(e) => e.stopPropagation()} autoFocus />
          ) : (
            <span className="wb-folder-name" title={folder.name}>{folder.name}</span>
          )}
          <span className="wb-folder-count">{countFolderReqs(folder)}</span>
        </div>
        {isExpanded && (
          <div className="wb-folder-requests">
            {folder.requests.map((req) => renderRequest(col.id, req.id, req.method, req.name, req.url, folder.id))}
            {subFolders.map((sf) => renderFolder(col, sf, depth + 1))}
            {isNewFolderHere && (
              <div className="wb-new-folder-row">
                <span className="wb-folder-icon">{newFolderTarget?.isSubCollection ? '📦' : '📁'}</span>
                <input className="wb-inline-input" value={newFolderName} placeholder={newFolderTarget?.isSubCollection ? 'Sub-collection name' : 'Folder name'}
                  onChange={(e) => setNewFolderName(e.target.value)} onBlur={commitAddFolder}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitAddFolder(); if (e.key === 'Escape') setNewFolderTarget(null); }} autoFocus />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="wb-sidebar">
      <div className="wb-sidebar-header">
        <span className="wb-sidebar-title">COLLECTIONS</span>
        <div className="wb-sidebar-actions">
          <button className="wb-icon-btn" onClick={onManageEnvs} title="Manage Environments">&#9881;</button>
          <button className="wb-icon-btn" onClick={handleExportAll} title="Export All Collections">&#8613;</button>
          <button className="wb-icon-btn" onClick={() => handleImportToCollection()} title="Import Collection">&#8615;</button>
          <button className="wb-icon-btn" onClick={onNewCollection} title="New Collection">+</button>
        </div>
      </div>

      <div className="wb-sidebar-list" onClick={() => { setContextMenu(null); setShowMoveMenu(false); setShowFolderMoveMenu(false); }}>
        {collections.length === 0 && (
          <div className="wb-sidebar-empty">No collections yet. <button className="btn-link-sm" onClick={onNewCollection}>Create one</button></div>
        )}

        {collections.map((col) => {
          const isRootDropTarget = dropTarget === `root-${col.id}` || dropTarget === `col-header-${col.id}`;
          return (
            <div key={col.id} className={`wb-col-group ${dropTarget === `col-header-${col.id}` ? 'col-drop-target' : ''}`}
              onDragOver={(e) => {
                const di = dragItemRef.current;
                if (!di) return;
                if (di.colId === col.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTarget(`col-header-${col.id}`);
                if (!expandedCols.has(col.id) && !autoExpandTimer.current) {
                  autoExpandTimer.current = setTimeout(() => {
                    setExpandedCols(prev => new Set(prev).add(col.id));
                    autoExpandTimer.current = null;
                  }, 500);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDropTarget(null);
                  if (autoExpandTimer.current) { clearTimeout(autoExpandTimer.current); autoExpandTimer.current = null; }
                }
              }}
              onDrop={(e) => {
                const di = dragItemRef.current;
                if (!di || di.colId === col.id) return;
                if (autoExpandTimer.current) { clearTimeout(autoExpandTimer.current); autoExpandTimer.current = null; }
                handleDrop(e, col.id, null);
              }}>
              <div className={`wb-col-header ${selectedCollectionId === col.id && !selectedRequestId ? 'selected' : ''} ${dropTarget === `col-header-${col.id}` ? 'drop-target' : ''} ${dragItem?.kind === 'collection' && dragItem.colId === col.id ? 'dragging' : ''}`}
                onClick={() => { toggleCol(col.id); onSelectCollection(col.id); }}
                onContextMenu={(e) => handleContext(e, 'collection', col.id)}
                draggable onDragStart={(e) => handleCollectionDragStart(e, col.id)} onDragEnd={handleDragEnd}>
                <span className="wb-col-arrow">{expandedCols.has(col.id) ? '▾' : '▸'}</span>
                <span className="wb-col-name" title={col.name}>{col.name}</span>
                <span className={`wb-col-mode-badge ${col.mode}`}>{col.mode === 'multi-env' ? 'ENV' : 'URL'}</span>
                {hasAuth(col) && <span className="wb-col-auth-badge" title={`Auth: ${authLabel(col)}`}>&#128274;</span>}
                <span className="wb-col-count">{countAllRequests(col)}</span>
                <button className="wb-col-edit-btn" title="Edit collection settings"
                  onClick={(e) => { e.stopPropagation(); onEditCollection(col); }}>&#9998;</button>
              </div>

              {expandedCols.has(col.id) && (
                <div className="wb-req-list">
                  <div className={`wb-root-drop ${isRootDropTarget ? 'drop-target' : ''}`}
                    onDragOver={(e) => handleDragOver(e, `root-${col.id}`)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.id, null)}>
                    {col.requests.map((req) => renderRequest(col.id, req.id, req.method, req.name, req.url))}
                  </div>
                  {(col.folders ?? []).map((folder) => renderFolder(col, folder, 0))}
                  {newFolderTarget?.colId === col.id && !newFolderTarget.parentFolderId && (
                    <div className="wb-new-folder-row">
                      <span className="wb-folder-icon">{newFolderTarget?.isSubCollection ? '📦' : '📁'}</span>
                      <input className="wb-inline-input" value={newFolderName} placeholder={newFolderTarget?.isSubCollection ? 'Sub-collection name' : 'Folder name'}
                        onChange={(e) => setNewFolderName(e.target.value)} onBlur={commitAddFolder}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitAddFolder(); if (e.key === 'Escape') setNewFolderTarget(null); }} autoFocus />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <SidebarContextMenu
          contextMenu={contextMenu}
          collections={collections}
          showMoveMenu={showMoveMenu}
          showFolderMoveMenu={showFolderMoveMenu}
          setShowMoveMenu={setShowMoveMenu}
          setShowFolderMoveMenu={setShowFolderMoveMenu}
          dismiss={dismissCtx}
          onNewRequest={onNewRequest}
          onEditCollection={onEditCollection}
          onDuplicateCollection={onDuplicateCollection}
          onDeleteCollection={onDeleteCollection}
          onEditSubCollection={onEditSubCollection}
          onDuplicateFolder={onDuplicateFolder}
          onDuplicateRequest={onDuplicateRequest}
          onDeleteFolder={onDeleteFolder}
          onDeleteRequest={onDeleteRequest}
          onMoveFolder={onMoveFolder}
          onMoveFolderTo={onMoveFolderTo}
          onMoveRequest={onMoveRequest}
          onMoveRequestToCollection={onMoveRequestToCollection}
          onMoveFolderToCollection={onMoveFolderToCollection}
          onMergeCollectionInto={onMergeCollectionInto}
          countAllRequests={countAllRequests}
          startAddFolder={startAddFolder}
          startRenameFolder={startRenameFolder}
          handleExportCollection={handleExportCollection}
          handleExportFolder={handleExportFolder}
          handleImportToCollection={handleImportToCollection}
          handleImportToFolder={handleImportToFolder}
          setConfirmDelete={setConfirmDelete}
        />
      )}

      {confirmDelete && (
        <div className="wb-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="wb-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{confirmDelete.message}</p>
            <div className="wb-confirm-actions">
              <button className="wb-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="wb-confirm-ok" onClick={() => { confirmDelete.onConfirm(); setConfirmDelete(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
