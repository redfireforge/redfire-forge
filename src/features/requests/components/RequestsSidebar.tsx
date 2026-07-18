import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { RequestCollection, RequestFolder, CatalogRequestMeta } from '../../../shared/types';
import { countGroupRequests, findFolderDeep, findSiblingFolders, countFolderReqs } from '../utils/requestTree';
import { toggleSetItem } from '../../../shared/utils/setToggle';
import SidebarContextMenu from './SidebarContextMenu';
import { useToast } from '../../../shared/hooks/useToast';
import { useRequestsSidebarSearch } from '../hooks/useRequestsSidebarSearch';
import { useRequestsSidebarDnD } from '../hooks/useRequestsSidebarDnD';
import {
  handleExportAll as exportAllToFile,
  handleExportCollection as exportCollectionToFile,
  handleExportFolder as exportFolderToFile,
  handleExportGroup as exportGroupToFile,
  handleImportToCollection as importToCollectionFromFile,
  handleImportToFolder as importToFolderFromFile,
} from '../utils/requestsSidebarImportExport';

interface Props {
  collections: RequestCollection[];
  selectedCollectionId?: string;
  selectedRequestId?: string;
  onSelectCollection: (colId: string) => void;
  onSelectRequest: (colId: string, reqId: string) => void;
  onNewCollection: (mode?: 'direct' | 'multi-env', groupId?: string) => void;
  onEditCollection: (col: RequestCollection) => void;
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
  onMoveRequest: (colId: string, reqId: string, targetFolderId: string | null, beforeReqId?: string) => void;
  onMoveRequestToCollection: (srcColId: string, reqId: string, destColId: string, destFolderId: string | null) => void;
  onMoveFolderToCollection: (srcColId: string, folderId: string, destColId: string, destParentFolderId: string | null) => void;
  onMergeCollectionInto: (srcColId: string, destColId: string) => void;
  countAllRequests: (col: RequestCollection) => number;
  onImportCollection: (col: RequestCollection) => void;
  onImportFolder: (colId: string, folder: RequestFolder, parentFolderId?: string) => void;
  onAddGroup: (name: string, parentGroupId?: string) => string;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveToGroup: (colId: string, targetGroupId: string | undefined) => void;
  onDuplicateGroup: (groupId: string) => void;
  onSendCollectionToHarness?: (colId: string) => void;
  onSendFolderToHarness?: (colId: string, folderId: string) => void;
  harnessRequestIds?: Set<string>;
}

import { METHOD_COLORS } from '../../../shared/constants/httpMethodColors';

function hasAuth(col: RequestCollection): boolean {
  return !!col.auth && col.auth.type !== 'none' && col.auth.type !== 'inherit';
}

function authLabel(col: RequestCollection): string {
  if (!col.auth) return '';
  switch (col.auth.type) {
    case 'bearer': return 'Bearer'; case 'basic': return 'Basic';
    case 'apikey': return 'API Key'; case 'oauth2': return 'OAuth2'; default: return '';
  }
}


export type CtxMenuData = {
  x: number; y: number;
  type: 'collection' | 'folder' | 'request' | 'group';
  colId: string; folderId?: string; reqId?: string;
};
type CtxMenu = CtxMenuData | null;

function modeIcon(mode: RequestCollection['mode']): string {
  if (mode === 'group') return '\uD83D\uDDC2\uFE0F';
  if (mode === 'multi-env') return '\uD83C\uDF10';
  return '\uD83D\uDCE1';
}

function modeBadge(mode: RequestCollection['mode']): string {
  if (mode === 'group') return 'GRP';
  if (mode === 'multi-env') return 'ENV';
  return 'URL';
}

export default function RequestsSidebar({
  collections, selectedCollectionId, selectedRequestId,
  onSelectCollection, onSelectRequest, onNewCollection,
  onEditCollection, onDeleteCollection, onDuplicateCollection, onNewRequest, onDeleteRequest,
  onDuplicateRequest, onAddFolder, onAddSubCollection, onEditSubCollection, onRenameFolder, onDeleteFolder, onDuplicateFolder, onMoveFolder,
  onMoveFolderTo, onMoveRequest, onMoveRequestToCollection, onMoveFolderToCollection, onMergeCollectionInto, countAllRequests,
  onImportCollection, onImportFolder,
  onAddGroup, onRenameGroup, onDeleteGroup, onMoveToGroup, onDuplicateGroup,
  onSendCollectionToHarness,
  onSendFolderToHarness,
  harnessRequestIds,
}: Props) {
  const toast = useToast();
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set(collections.map(c => c.id)));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<CtxMenu>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showFolderMoveMenu, setShowFolderMoveMenu] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<{ colId: string; folderId: string } | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [newFolderTarget, setNewFolderTarget] = useState<{ colId: string; parentFolderId?: string; isSubCollection?: boolean } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [renameGroupVal, setRenameGroupVal] = useState('');
  const renameGroupRef = useRef<HTMLInputElement>(null);
  const [newGroupTarget, setNewGroupTarget] = useState<string | undefined>(undefined);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const nonGroupCollections = useMemo(() => collections.filter(c => c.mode !== 'group'), [collections]);

  const allColIds = useMemo(() => collections.map(c => c.id), [collections]);
  const allFolderIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (folders: RequestFolder[]) => {
      for (const f of folders) { ids.push(f.id); walk(f.folders ?? []); }
    };
    collections.forEach(c => walk(c.folders ?? []));
    return ids;
  }, [collections]);
  const isAllExpanded = useMemo(() =>
    allColIds.length > 0 &&
    allColIds.every(id => expandedCols.has(id)) &&
    allFolderIds.every(id => expandedFolders.has(id)),
    [allColIds, allFolderIds, expandedCols, expandedFolders]);
  const toggleExpandAll = useCallback(() => {
    if (isAllExpanded) {
      setExpandedCols(new Set());
      setExpandedFolders(new Set());
    } else {
      setExpandedCols(new Set(allColIds));
      setExpandedFolders(new Set(allFolderIds));
    }
  }, [isAllExpanded, allColIds, allFolderIds]);

  const {
    search,
    setSearch,
    searchLower,
    matchesSearch,
    folderMatchesSearch,
    requestMatchesSearch,
    groupMatchesSearch,
    filteredCollections,
  } = useRequestsSidebarSearch(collections);

  const {
    dragItem,
    dragItemRef,
    dropTarget,
    setDropTarget,
    dropInsert,
    setDropInsert,
    autoExpandTimerRef,
    handleCollectionDragStart,
    handleReqDragStart,
    handleFolderDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleGroupDrop,
    handleFolderDrop,
    handleDragEnd,
    handleReqDragOver,
    handleReqDrop,
    handleRootDrop,
  } = useRequestsSidebarDnD({
    collections,
    onMoveRequest,
    onMoveRequestToCollection,
    onMoveFolderTo,
    onMoveFolderToCollection,
    onMergeCollectionInto,
    onMoveToGroup,
  });

  const dismissCtx = useCallback(() => {
    setContextMenu(null); setShowMoveMenu(false); setShowFolderMoveMenu(false);
  }, []);

  // Shared onDragLeave for collection/group containers with auto-expand timer cleanup.
  const handleContainerDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
      if (autoExpandTimerRef.current) { clearTimeout(autoExpandTimerRef.current); autoExpandTimerRef.current = null; }
    }
  }, [setDropTarget, autoExpandTimerRef]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => dismissCtx();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu, dismissCtx]);

  useEffect(() => {
    if (!showAddMenu) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showAddMenu]);

  const toggleCol = (colId: string) => {
    toggleSetItem(setExpandedCols, colId);
  };
  const toggleFolder = (folderId: string) => {
    toggleSetItem(setExpandedFolders, folderId);
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
        ? findFolderDeep(col?.folders ?? [], newFolderTarget.parentFolderId)?.folders ?? []
        : col?.folders ?? [];
      const nameExists = siblings.some(f => f.name.toLowerCase() === newFolderName.trim().toLowerCase());
      if (nameExists) {
        toast.show('warning', 'Name already exists', `A folder or sub-collection with the name "${newFolderName.trim()}" already exists at this level.`);
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
        toast.show('warning', 'Name already exists', `A folder or sub-collection with the name "${renameVal.trim()}" already exists at this level.`);
        return;
      }
      onRenameFolder(renamingFolder.colId, renamingFolder.folderId, renameVal.trim());
    }
    setRenamingFolder(null);
  };

  const startRenameGroup = (groupId: string, currentName: string) => {
    setRenamingGroup(groupId); setRenameGroupVal(currentName); setContextMenu(null);
    setTimeout(() => renameGroupRef.current?.focus(), 50);
  };
  const commitRenameGroup = () => {
    if (renamingGroup && renameGroupVal.trim()) {
      onRenameGroup(renamingGroup, renameGroupVal.trim());
    }
    setRenamingGroup(null);
  };

  const startAddGroup = (parentGroupId?: string) => {
    setNewGroupTarget(parentGroupId); setNewGroupName(''); setShowNewGroupInput(true); setContextMenu(null);
    if (parentGroupId) setExpandedCols((prev) => new Set(prev).add(parentGroupId));
  };
  const commitAddGroup = () => {
    if (newGroupName.trim()) {
      const id = onAddGroup(newGroupName.trim(), newGroupTarget);
      setExpandedCols((prev) => new Set(prev).add(id));
    }
    setShowNewGroupInput(false); setNewGroupName(''); setNewGroupTarget(undefined);
  };

  // ─── Export / Import ──────────────────────────────────

  const handleExportAll = async () => {
    await exportAllToFile(collections);
  };

  const handleExportCollection = async (colId: string) => {
    await exportCollectionToFile(collections, colId);
    setContextMenu(null);
  };

  const handleExportFolder = async (colId: string, folderId: string) => {
    await exportFolderToFile(collections, colId, folderId);
    setContextMenu(null);
  };

  const handleExportGroup = async (groupId: string) => {
    await exportGroupToFile(collections, groupId);
    setContextMenu(null);
  };

  const handleImportToCollection = async (colId?: string, targetGroupId?: string) => {
    setContextMenu(null);
    await importToCollectionFromFile({
      collections,
      toast,
      colId,
      targetGroupId,
      onImportCollection,
      onImportFolder,
      onAddGroup,
    });
  };

  const handleImportToFolder = async (colId: string, parentFolderId: string) => {
    setContextMenu(null);
    await importToFolderFromFile({
      collections,
      toast,
      colId,
      parentFolderId,
      onImportFolder,
    });
  };

  // ─── Render helpers ──────────────────────────────────

  const renderRequest = (colId: string, reqId: string, method: string, name: string, url: string, inFolderId?: string, siblingRequests?: { id: string }[], meta?: CatalogRequestMeta) => {
    const isDragging = dragItem?.kind === 'request' && dragItem.reqId === reqId;
    const showBefore = dropInsert?.beforeReqId === reqId;
    const showAfter = dropInsert?.beforeReqId === reqId + ':after';
    const inHarness = harnessRequestIds?.has(reqId);
    return (
      <div key={reqId} className="req-req-drop-wrapper">
        {showBefore && <div className="req-drop-indicator" />}
        <div
          className={`req-req-item ${selectedRequestId === reqId ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${meta?.deprecated ? 'deprecated' : ''}`}
          onClick={() => onSelectRequest(colId, reqId)}
          onContextMenu={(e) => handleContext(e, 'request', colId, inFolderId, reqId)}
          onDragOver={(e) => handleReqDragOver(e, colId, reqId, inFolderId)}
          onDragLeave={() => setDropInsert(null)}
          onDrop={(e) => handleReqDrop(e, colId, inFolderId, siblingRequests ?? [])}
          data-testid="req-req-item" data-req-name={name || url || 'Untitled'}
          draggable onDragStart={(e) => handleReqDragStart(e, colId, reqId)} onDragEnd={handleDragEnd}>
          <span className="req-req-method" style={{ color: METHOD_COLORS[method] || '#94a3b8' }}>{method}</span>
          <span className={`req-req-name ${meta?.deprecated ? 'deprecated' : ''}`} title={name || url}>{name || url || 'Untitled'}</span>
          {meta && <span className="req-req-catalog-badge" title={meta.sourceSpec ? `From: ${meta.sourceSpec}` : 'From API Catalog'}>&#128203;</span>}
          {meta?.deprecated && <span className="req-req-deprecated-badge" title="Deprecated">&#9888;&#65039;</span>}
          {inHarness && <span className="req-req-harness-badge" data-testid="req-in-harness-badge" title="Promoted to Harness">IN HARNESS</span>}
        </div>
        {showAfter && <div className="req-drop-indicator" />}
      </div>
    );
  };

  const renderFolder = (col: RequestCollection, folder: RequestFolder, depth: number) => {
    if (searchLower && !folderMatchesSearch(folder)) return null;
    const isExpanded = expandedFolders.has(folder.id) || !!searchLower;
    const isRenaming = renamingFolder?.folderId === folder.id;
    const isDropTgt = dropTarget === folder.id;
    const isDraggingThis = dragItem?.kind === 'folder' && dragItem.folderId === folder.id;
    const subFolders = folder.folders ?? [];
    const isNewFolderHere = newFolderTarget?.parentFolderId === folder.id;
    const filteredRequests = searchLower ? folder.requests.filter(requestMatchesSearch) : folder.requests;

    return (
      <div key={folder.id}
        className={`req-folder-group ${isDropTgt ? 'drop-target' : ''} ${isDraggingThis ? 'dragging' : ''}`}
        style={{ paddingLeft: depth > 0 ? 8 : 0 }}
        onDragOver={(e) => handleDragOver(e, folder.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleFolderDrop(e, col.id, folder.id)}>
        <div className="req-folder-header"
          onClick={() => toggleFolder(folder.id)}
          onContextMenu={(e) => handleContext(e, 'folder', col.id, folder.id)}
          draggable onDragStart={(e) => handleFolderDragStart(e, col.id, folder.id)} onDragEnd={handleDragEnd}>
          <span className="req-folder-arrow">{isExpanded ? '▾' : '▸'}</span>
          <span className="req-folder-icon">{folder.isSubCollection ? '📦' : '📁'}</span>
          {isRenaming ? (
            <input ref={renameRef} className="req-inline-input" value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)} onBlur={commitRenameFolder}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRenameFolder(); if (e.key === 'Escape') setRenamingFolder(null); }}
              onClick={(e) => e.stopPropagation()} autoFocus />
          ) : (
            <span className="req-folder-name" title={folder.name}>{folder.name}</span>
          )}
          <span className="req-folder-count">{countFolderReqs(folder)}</span>
        </div>
        {isExpanded && (
          <div className="req-folder-requests">
            {filteredRequests.map((req) => renderRequest(col.id, req.id, req.method, req.name, req.url, folder.id, folder.requests, req.catalogMeta))}
            {subFolders.map((sf) => renderFolder(col, sf, depth + 1))}
            {isNewFolderHere && (
              <div className="req-new-folder-row">
                <span className="req-folder-icon">{newFolderTarget?.isSubCollection ? '📦' : '📁'}</span>
                <input className="req-inline-input" data-testid="req-folder-name-input" value={newFolderName} placeholder={newFolderTarget?.isSubCollection ? 'Sub-collection name' : 'Folder name'}
                  onChange={(e) => setNewFolderName(e.target.value)} onBlur={commitAddFolder}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitAddFolder(); if (e.key === 'Escape') setNewFolderTarget(null); }} autoFocus />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCollection = (col: RequestCollection, depth: number) => {
    if (searchLower && !matchesSearch(col, col.folders, col.requests)) return null;
    const isExpCol = expandedCols.has(col.id) || !!searchLower;
    const isRootDropTarget = dropTarget === `root-${col.id}` || dropTarget === `col-header-${col.id}`;
    const filteredRootReqs = searchLower ? col.requests.filter(requestMatchesSearch) : col.requests;
    return (
      <div key={col.id} className={`req-col-group ${dropTarget === `col-header-${col.id}` ? 'col-drop-target' : ''}`}
        style={{ paddingLeft: depth > 0 ? 12 : 0 }}
        onDragOver={(e) => {
          const di = dragItemRef.current;
          if (!di) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (di.colId === col.id) return;
          setDropTarget(`col-header-${col.id}`);
          if (!expandedCols.has(col.id) && !autoExpandTimerRef.current) {
            autoExpandTimerRef.current = setTimeout(() => {
              setExpandedCols(prev => new Set(prev).add(col.id));
              autoExpandTimerRef.current = null;
            }, 500);
          }
        }}
        onDragLeave={handleContainerDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          const di = dragItemRef.current;
          if (!di || di.colId === col.id) return;
          if (autoExpandTimerRef.current) { clearTimeout(autoExpandTimerRef.current); autoExpandTimerRef.current = null; }
          handleDrop(e, col.id, null);
        }}>
        <div className={`req-col-header ${selectedCollectionId === col.id && !selectedRequestId ? 'selected' : ''} ${dropTarget === `col-header-${col.id}` ? 'drop-target' : ''} ${dragItem?.kind === 'collection' && dragItem.colId === col.id ? 'dragging' : ''}`}
          onClick={() => { toggleCol(col.id); onSelectCollection(col.id); }}
          onContextMenu={(e) => handleContext(e, 'collection', col.id)}
          data-testid="req-col-item" data-col-name={col.name}
          draggable onDragStart={(e) => handleCollectionDragStart(e, col.id)} onDragEnd={handleDragEnd}>
          <span className="req-col-arrow">{isExpCol ? '▾' : '▸'}</span>
          <span className="req-col-icon">{modeIcon(col.mode)}</span>
          <span className="req-col-name" title={col.name}>{col.name}</span>
          <span className={`req-col-mode-badge ${col.mode}`}>{modeBadge(col.mode)}</span>
          {hasAuth(col) && <span className="req-col-auth-badge" title={`Auth: ${authLabel(col)}`}>&#128274;</span>}
          <span className="req-col-count">{countAllRequests(col)}</span>
          <button className="req-col-edit-btn" title="Edit collection settings"
            onClick={(e) => { e.stopPropagation(); onEditCollection(col); }}>&#9998;</button>
        </div>

        {isExpCol && (
          <div className="req-req-list"
            onDragOver={(e) => { if (dragItemRef.current) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
            onDrop={(e) => { e.preventDefault(); handleDrop(e, col.id, null); }}>
            <div className={`req-root-drop ${isRootDropTarget ? 'drop-target' : ''}`}
              onDragOver={(e) => handleDragOver(e, `root-${col.id}`)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id, null)}>
              {filteredRootReqs.map((req) => renderRequest(col.id, req.id, req.method, req.name, req.url, undefined, col.requests, req.catalogMeta))}
            </div>
            {(col.folders ?? []).map((folder) => renderFolder(col, folder, 0))}
            {newFolderTarget?.colId === col.id && !newFolderTarget.parentFolderId && (
              <div className="req-new-folder-row">
                <span className="req-folder-icon">{newFolderTarget?.isSubCollection ? '📦' : '📁'}</span>
                <input className="req-inline-input" data-testid="req-folder-name-input" value={newFolderName} placeholder={newFolderTarget?.isSubCollection ? 'Sub-collection name' : 'Folder name'}
                  onChange={(e) => setNewFolderName(e.target.value)} onBlur={commitAddFolder}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitAddFolder(); if (e.key === 'Escape') setNewFolderTarget(null); }} autoFocus />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (group: RequestCollection, depth: number) => {
    if (searchLower && !groupMatchesSearch(group)) return null;
    const isExpanded = expandedCols.has(group.id) || !!searchLower;
    const isDropTgt = dropTarget === `group-${group.id}`;
    const isDraggingThis = dragItem?.kind === 'collection' && dragItem.colId === group.id;
    const isRenaming = renamingGroup === group.id;
    const groupReqCount = countGroupRequests(group.id, collections);
    const isNewGroupHere = showNewGroupInput && newGroupTarget === group.id;

    const children = collections.filter(c => c.groupId === group.id);

    return (
      <div key={group.id}
        className={`req-group-wrapper ${isDropTgt ? 'drop-target' : ''} ${isDraggingThis ? 'dragging' : ''}`}
        style={{ paddingLeft: depth > 0 ? 12 : 0 }}
        onDragOver={(e) => {
          const di = dragItemRef.current;
          if (!di || di.kind !== 'collection') return;
          if (di.colId === group.id) return;
          e.preventDefault(); e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          setDropTarget(`group-${group.id}`);
          if (!expandedCols.has(group.id) && !autoExpandTimerRef.current) {
            autoExpandTimerRef.current = setTimeout(() => {
              setExpandedCols(prev => new Set(prev).add(group.id));
              autoExpandTimerRef.current = null;
            }, 500);
          }
        }}
        onDragLeave={handleContainerDragLeave}
        onDrop={(e) => handleGroupDrop(e, group.id)}>

        <div className={`req-group-header ${isDraggingThis ? 'dragging' : ''} ${isDropTgt ? 'drop-target' : ''}`}
          onClick={() => toggleCol(group.id)}
          onContextMenu={(e) => handleContext(e, 'group', group.id)}
          draggable onDragStart={(e) => handleCollectionDragStart(e, group.id)} onDragEnd={handleDragEnd}>
          <span className="req-col-arrow">{isExpanded ? '▾' : '▸'}</span>
          <span className="req-col-icon">{modeIcon('group')}</span>
          {isRenaming ? (
            <input ref={renameGroupRef} className="req-inline-input" value={renameGroupVal}
              onChange={(e) => setRenameGroupVal(e.target.value)} onBlur={commitRenameGroup}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRenameGroup(); if (e.key === 'Escape') setRenamingGroup(null); }}
              onClick={(e) => e.stopPropagation()} autoFocus />
          ) : (
            <span className="req-col-name" title={group.name}>{group.name}</span>
          )}
          <span className="req-col-mode-badge group">GRP</span>
          <span className="req-col-count">{groupReqCount}</span>
        </div>

        {isExpanded && (
          <div className="req-group-children">
            {children.map(child =>
              child.mode === 'group'
                ? renderGroup(child, depth + 1)
                : renderCollection(child, depth + 1)
            )}
            {isNewGroupHere && (
              <div className="req-new-folder-row" style={{ paddingLeft: 12 }}>
                <span className="req-folder-icon">{modeIcon('group')}</span>
                <input className="req-inline-input" value={newGroupName} placeholder="Group name"
                  onChange={(e) => setNewGroupName(e.target.value)} onBlur={commitAddGroup}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitAddGroup(); if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName(''); } }} autoFocus />
              </div>
            )}
            {children.length === 0 && !isNewGroupHere && (
              <div className="req-group-empty" style={{ paddingLeft: (depth + 1) * 12 + 8 }}>Empty group</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="req-sidebar" data-testid="req-sidebar">
      <div className="req-sidebar-header">
        <span className="req-sidebar-title">COLLECTIONS</span>
        <div className="req-sidebar-actions">
          <button
            className={`req-icon-btn ${isAllExpanded ? 'active' : ''}`}
            onClick={toggleExpandAll}
            title={isAllExpanded ? 'Shrink All' : 'Expand All'}
            aria-label={isAllExpanded ? 'Shrink all collections' : 'Expand all collections'}
            aria-pressed={isAllExpanded}
            data-testid="req-sidebar-expand-all"
          >{isAllExpanded ? '\u229F' : '\u229E'}</button>
          <button className="req-icon-btn" onClick={handleExportAll} title="Export All" data-testid="req-sidebar-export-all">&#8613;</button>
          <button className="req-icon-btn" onClick={() => handleImportToCollection()} title="Import" data-testid="req-sidebar-import">&#8615;</button>
          <div className="req-add-menu-wrapper" ref={addMenuRef}>
            <button className="req-icon-btn" onClick={() => setShowAddMenu(!showAddMenu)} title="Add new..." data-testid="req-sidebar-add-btn">+</button>
            {showAddMenu && (
              <div className="req-add-dropdown" data-testid="req-add-dropdown">
                <button data-testid="req-add-group" onClick={() => { startAddGroup(); setShowAddMenu(false); }}>
                  {modeIcon('group')} Group
                </button>
                <button data-testid="req-add-url-collection" onClick={() => { onNewCollection('direct'); setShowAddMenu(false); }}>
                  {modeIcon('direct')} URL Collection
                </button>
                <button data-testid="req-add-env-collection" onClick={() => { onNewCollection('multi-env'); setShowAddMenu(false); }}>
                  {modeIcon('multi-env')} ENV Collection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="req-sidebar-search">
        <input
          type="text"
          className="req-sidebar-search-input"
          placeholder="Search collections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search collections and requests"
          data-testid="req-sidebar-search"
        />
        {search && (
          <button
            className="req-sidebar-search-clear"
            onClick={() => setSearch('')}
            title="Clear search"
          >&times;</button>
        )}
      </div>

      <div className="req-sidebar-list"
        onClick={() => { setContextMenu(null); setShowMoveMenu(false); setShowFolderMoveMenu(false); }}
        onDragOver={(e) => {
          const di = dragItemRef.current;
          if (!di || di.kind !== 'collection') return;
          const col = collections.find(c => c.id === di.colId);
          if (col?.groupId) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDropTarget('sidebar-root');
          }
        }}
        onDrop={handleRootDrop}>
        {collections.length === 0 && (
          <div className="req-sidebar-empty">No collections yet. <button className="btn-link-sm" onClick={() => onNewCollection()}>Create one</button></div>
        )}

        {filteredCollections.map(col =>
          col.mode === 'group'
            ? renderGroup(col, 0)
            : renderCollection(col, 0)
        )}

        {showNewGroupInput && newGroupTarget === undefined && (
          <div className="req-new-folder-row">
            <span className="req-folder-icon">{modeIcon('group')}</span>
            <input className="req-inline-input" value={newGroupName} placeholder="Group name"
              onChange={(e) => setNewGroupName(e.target.value)} onBlur={commitAddGroup}
              onKeyDown={(e) => { if (e.key === 'Enter') commitAddGroup(); if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName(''); } }} autoFocus />
          </div>
        )}
      </div>

      {contextMenu && (
        <SidebarContextMenu
          contextMenu={contextMenu}
          collections={collections}
          nonGroupCollections={nonGroupCollections}
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
          onNewCollection={onNewCollection}
          startAddGroup={startAddGroup}
          startRenameGroup={startRenameGroup}
          onDeleteGroup={onDeleteGroup}
          onDuplicateGroup={onDuplicateGroup}
          onMoveToGroup={onMoveToGroup}
          handleExportGroup={handleExportGroup}
          onSendCollectionToHarness={onSendCollectionToHarness}
          onSendFolderToHarness={onSendFolderToHarness}
        />
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

    </div>
  );
}
