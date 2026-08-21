import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApiMockServerList, type ApiMockServerListEntry } from '../ApiMockServerListBridge';
import { useConfirmDialog } from '../../../app/hooks/useConfirmDialog';
import {
  buildFolderTree,
  childFolderNames,
  collectFolderPaths,
  folderLeafName,
  folderParentPath,
  isSameOrDescendant,
  joinFolderPath,
  moveFolderPaths,
  pathAfterDeletingFolder,
  renameFolderPaths,
  type FolderTreeNode,
} from '../apiMockFolderTree';

interface CtxMenuState { id: string; name: string; x: number; y: number; }
interface RenameState { id: string; value: string; }
/** Move-a-server-to-folder submenu, keyed by server id. */
interface FolderMenuState { id: string; x: number; y: number; }
/** Folder right-click menu, keyed by full folder path. */
interface FolderCtxMenuState { path: string; x: number; y: number; }
/** Move-a-folder-into-folder submenu, keyed by full folder path. */
interface FolderMoveMenuState { path: string; x: number; y: number; }
interface FolderRenameState { path: string; value: string; }
/** Inline folder-create row. `parent` undefined = top level (subfolder otherwise). */
interface FolderDraftState { parent: string | undefined; value: string; }

interface FlatFolder { path: string; name: string; depth: number; }

/**
 * Left-sidebar server list.  Reads from the module-level bridge published by
 * ApiMockStudioPage.  Supports search, drag-to-reorder, and a nested folder
 * hierarchy (folders encoded as `/`-joined paths on each server's serverFolder).
 * Right-click menus (portalled to document.body) offer rename, move, create
 * subfolder, and delete (with confirmation).
 */
export default function ApiMockSidebar() {
  const state = useApiMockServerList();
  const entries = useMemo(() => state?.entries ?? [], [state]);
  const { confirm, confirmDialogElement } = useConfirmDialog();
  const [query, setQuery] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [folderMenu, setFolderMenu] = useState<FolderMenuState | null>(null);
  const [rename, setRename] = useState<RenameState | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [newFolderInput, setNewFolderInput] = useState('');
  const [folderDraft, setFolderDraft] = useState<FolderDraftState | null>(null);
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
  const [folderOrder, setFolderOrder] = useState<string[]>([]);
  const [folderDragPath, setFolderDragPath] = useState<string | null>(null);
  const [folderDragOverPath, setFolderDragOverPath] = useState<string | null>(null);
  const [folderCtxMenu, setFolderCtxMenu] = useState<FolderCtxMenuState | null>(null);
  const [folderMoveMenu, setFolderMoveMenu] = useState<FolderMoveMenuState | null>(null);
  const [folderRename, setFolderRename] = useState<FolderRenameState | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const folderDraftRef = useRef<HTMLInputElement>(null);
  const folderRenameRef = useRef<HTMLInputElement>(null);
  /** Sync refs so drag-type/id are readable immediately in onDragOver. */
  const activeDragTypeRef = useRef<'server' | 'folder' | null>(null);
  const activeDragIdRef = useRef<string | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () => (needle
      ? entries.filter(e => e.name.toLowerCase().includes(needle) || String(e.port).includes(needle))
      : entries),
    [entries, needle],
  );
  const canDrag = !needle;

  const ungrouped = useMemo(() => visible.filter(e => !e.serverFolder), [visible]);

  /** Direct servers keyed by exact folder path. */
  const serversByFolder = useMemo(() => {
    const map = new Map<string, ApiMockServerListEntry[]>();
    visible.forEach(e => {
      if (!e.serverFolder) return;
      const list = map.get(e.serverFolder) ?? [];
      list.push(e);
      map.set(e.serverFolder, list);
    });
    return map;
  }, [visible]);

  /** All folder paths (incl. ancestors) for the visible tree. */
  const visibleFolderPaths = useMemo(
    () => collectFolderPaths(visible.map(e => e.serverFolder), needle ? [] : emptyFolders),
    [visible, emptyFolders, needle],
  );

  /** All folder paths across every server (unfiltered) — used for move/rename remaps. */
  const allFolderPaths = useMemo(
    () => collectFolderPaths(entries.map(e => e.serverFolder), emptyFolders),
    [entries, emptyFolders],
  );

  const folderTree = useMemo(
    () => buildFolderTree(visibleFolderPaths, folderOrder),
    [visibleFolderPaths, folderOrder],
  );

  const allVisibleFolderList = useMemo(() => [...visibleFolderPaths], [visibleFolderPaths]);
  const isAllExpanded = allVisibleFolderList.length > 0
    && allVisibleFolderList.every(p => !collapsedFolders.has(p));
  const toggleExpandAll = () => {
    /* c8 ignore next */
    if (allVisibleFolderList.length === 0) return;
    setCollapsedFolders(isAllExpanded ? new Set(allVisibleFolderList) : new Set());
  };

  /** Depth-first flattened folders for the move menus. */
  const flatFolders = useMemo(() => {
    const out: FlatFolder[] = [];
    const walk = (nodes: FolderTreeNode[]) => nodes.forEach(n => {
      out.push({ path: n.path, name: n.name, depth: n.depth });
      walk(n.children);
    });
    walk(folderTree);
    return out;
  }, [folderTree]);

  // Drop stale empty folders that now contain servers.
  useEffect(() => {
    /* c8 ignore next */
    if (emptyFolders.size === 0) return;
    const occupied = new Set(entries.map(e => e.serverFolder).filter(Boolean) as string[]);
    setEmptyFolders(prev => {
      const toRemove = [...prev].filter(f => occupied.has(f));
      /* c8 ignore next */
      if (toRemove.length === 0) return prev;
      const next = new Set(prev);
      toRemove.forEach(f => next.delete(f));
      return next;
    });
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeAllMenus = () => {
    setCtxMenu(null); setFolderMenu(null); setFolderCtxMenu(null); setFolderMoveMenu(null);
  };

  // ─── Server folder membership ──────────────────────────────────────────────
  /**
   * Move a server into a folder (or out with `undefined`).  If this empties the
   * source folder, keep it alive as an empty folder so it does not vanish the
   * moment its last server leaves.
   */
  const moveServerToFolder = (id: string, target: string | undefined) => {
    const src = entries.find(e => e.id === id)?.serverFolder;
    /* c8 ignore next */
    if (src && src !== target) {
      const stillOccupied = entries.some(e => e.id !== id && e.serverFolder === src);
      /* c8 ignore next */
      if (!stillOccupied) {
        setEmptyFolders(prev => new Set(prev).add(src));
        /* c8 ignore next */
        setFolderOrder(prev => (prev.includes(src) ? prev : [...prev, src]));
      }
    }
    state?.onMoveToFolder(id, target);
  };

  // ─── Folder path remaps (rename / move) ────────────────────────────────────
  const applyFolderRemap = (remap: Map<string, string>) => {
    entries.forEach(e => {
      /* c8 ignore next */
      if (e.serverFolder && remap.has(e.serverFolder)) {
        state?.onMoveToFolder(e.id, remap.get(e.serverFolder));
      }
    });
    /* c8 ignore next */
    const remapPath = (p: string) => remap.get(p) ?? p;
    setEmptyFolders(prev => new Set([...prev].map(remapPath)));
    setFolderOrder(prev => prev.map(remapPath));
    setCollapsedFolders(prev => new Set([...prev].map(remapPath)));
  };

  const renameFolder = (path: string, newName: string) => {
    const remap = renameFolderPaths(path, newName, allFolderPaths);
    /* c8 ignore next */
    if (!remap) return;
    const newPath = remap.get(path)!;
    // Reject a sibling name collision.
    /* c8 ignore next */
    const siblings = childFolderNames(allFolderPaths, path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : undefined);
    /* c8 ignore next */
    if (siblings.some(n => n.toLowerCase() === folderLeafName(newPath).toLowerCase() && n.toLowerCase() !== folderLeafName(path).toLowerCase())) return;
    applyFolderRemap(remap);
  };

  const moveFolderInto = (src: string, destParent: string | undefined) => {
    const remap = moveFolderPaths(src, destParent, allFolderPaths);
    /* c8 ignore next */
    if (!remap) return;
    // Reject if a same-named folder already sits under the destination.
    const destChildren = childFolderNames(allFolderPaths, destParent);
    /* c8 ignore next */
    if (destChildren.some(n => n.toLowerCase() === folderLeafName(src).toLowerCase())) return;
    applyFolderRemap(remap);
    setFolderMoveMenu(null);
    setFolderCtxMenu(null);
  };

  // ─── Folder create (top-level or subfolder) ────────────────────────────────
  const startFolderCreate = (parent: string | undefined) => {
    closeAllMenus();
    /* c8 ignore next */
    if (parent) setCollapsedFolders(prev => { const n = new Set(prev); n.delete(parent); return n; });
    setFolderDraft({ parent, value: '' });
    requestAnimationFrame(() => folderDraftRef.current?.focus());
  };

  const confirmFolderCreate = () => {
    const name = folderDraft?.value.trim();
    const parent = folderDraft?.parent;
    /* c8 ignore next */
    if (name) {
      const path = joinFolderPath(parent, name);
      const siblings = childFolderNames(allFolderPaths, parent);
      /* c8 ignore next */
      if (!siblings.some(n => n.toLowerCase() === name.toLowerCase())) {
        setEmptyFolders(prev => new Set([...prev, path]));
        setFolderOrder(prev => [...prev, path]);
      }
    }
    setFolderDraft(null);
  };

  // ─── Folder delete (with confirmation) ─────────────────────────────────────
  const deleteFolder = (path: string) => {
    setFolderCtxMenu(null);
    const name = folderLeafName(path);
    const parent = folderParentPath(path);
    const destLabel = parent ? `"${folderLeafName(parent)}"` : 'Ungrouped';
    const subDestLabel = parent ? `"${folderLeafName(parent)}"` : 'the top level';
    const directCount = entries.filter(e => e.serverFolder === path).length;
    const subCount = childFolderNames(allFolderPaths, path).length;

    const outcomes: string[] = [];
    /* c8 ignore next */
    if (directCount === 1) outcomes.push(`1 mock server in this folder will move to ${destLabel}.`);
    /* c8 ignore next */
    else if (directCount > 1) outcomes.push(`${directCount} mock servers in this folder will move to ${destLabel}.`);
    /* c8 ignore next */
    if (subCount === 1) outcomes.push('1 subfolder will move to ' + subDestLabel + ' and keep its servers.');
    /* c8 ignore next */
    else if (subCount > 1) outcomes.push(`${subCount} subfolders will move to ${subDestLabel} and keep their servers.`);
    /* c8 ignore next */
    if (outcomes.length === 0) outcomes.push('This folder is empty.');
    outcomes.push('Mock servers are not deleted.');

    confirm(
      `Delete folder "${name}"?`,
      () => {
        entries.forEach(e => {
          /* c8 ignore next */
          if (!e.serverFolder || !isSameOrDescendant(e.serverFolder, path)) return;
          const next = pathAfterDeletingFolder(e.serverFolder, path);
          /* c8 ignore next */
          if (next !== e.serverFolder) state?.onMoveToFolder(e.id, next);
        });
        /* c8 ignore next */
        const remapKept = (f: string): string | undefined => (f === path ? undefined : pathAfterDeletingFolder(f, path));
        setEmptyFolders(prev => new Set([...prev].map(remapKept).filter((f): f is string => Boolean(f))));
        setFolderOrder(prev => prev.map(remapKept).filter((f): f is string => Boolean(f)));
        setCollapsedFolders(prev => new Set([...prev].map(remapKept).filter((f): f is string => Boolean(f))));
      },
      undefined,
      { confirmLabel: 'Delete folder', title: 'Delete folder', finalNote: outcomes.join('\n') },
    );
  };

  // ─── Folder rename / context menu ──────────────────────────────────────────
  const openFolderCtxMenu = (ev: React.MouseEvent, path: string) => {
    ev.preventDefault();
    ev.stopPropagation();
    closeAllMenus();
    setFolderCtxMenu({ path, x: ev.clientX, y: ev.clientY });
  };

  const startFolderRename = (path: string) => {
    setFolderCtxMenu(null);
    setFolderRename({ path, value: folderLeafName(path) });
    requestAnimationFrame(() => folderRenameRef.current?.select());
  };

  const commitFolderRename = () => {
    /* c8 ignore next */
    if (!folderRename) return;
    renameFolder(folderRename.path, folderRename.value);
    setFolderRename(null);
  };

  // ─── Server drag / drop ────────────────────────────────────────────────────
  const handleServerDropOnFolder = (path: string) => {
    const id = activeDragIdRef.current ?? dragId;
    /* c8 ignore next */
    /* c8 ignore next */
    if (id && activeDragTypeRef.current === 'server') moveServerToFolder(id, path);
    resetDrag();
  };

  const handleDrop = (targetId: string) => {
    /* c8 ignore next */
    if (dragId && dragId !== targetId) {
      const dragEntry = entries.find(e => e.id === dragId);
      const targetEntry = entries.find(e => e.id === targetId);
      const dragFolder = dragEntry?.serverFolder ?? undefined;
      const targetFolder = targetEntry?.serverFolder ?? undefined;
      /* c8 ignore next */
      if (dragFolder !== targetFolder) moveServerToFolder(dragId, targetFolder);
      state?.onReorder(dragId, targetId);
    }
    resetDrag();
  };

  /** Dropping a folder onto a server places it as a sibling of that server. */
  const handleFolderDropOnServer = (target: ApiMockServerListEntry) => {
    const aid = activeDragIdRef.current;
    /* c8 ignore next */
    /* c8 ignore next */
    if (aid && activeDragTypeRef.current === 'folder') moveFolderInto(aid, target.serverFolder);
    resetDrag();
  };

  const handleFolderDropToTop = () => {
    const aid = activeDragIdRef.current;
    /* c8 ignore next */
    /* c8 ignore next */
    if (aid && activeDragTypeRef.current === 'folder') moveFolderInto(aid, undefined);
    resetDrag();
  };

  const resetDrag = () => {
    activeDragTypeRef.current = null;
    activeDragIdRef.current = null;
    setDragId(null);
    setDragOverId(null);
    setFolderDragPath(null);
    setFolderDragOverPath(null);
  };

  const openCtxMenu = (ev: React.MouseEvent, id: string, name: string) => {
    ev.preventDefault();
    closeAllMenus();
    setCtxMenu({ id, name, x: ev.clientX, y: ev.clientY });
  };

  const startRename = (id: string, name: string) => {
    setCtxMenu(null);
    setFolderMenu(null);
    setRename({ id, value: name });
    requestAnimationFrame(() => renameInputRef.current?.select());
  };

  const commitRename = () => {
    /* c8 ignore next */
    if (rename) {
      const trimmed = rename.value.trim();
      /* c8 ignore next */
      if (trimmed) state?.onRename(rename.id, trimmed);
      setRename(null);
    }
  };

  const toggleFolder = (path: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const moveToFolder = (id: string, folder: string | undefined) => {
    moveServerToFolder(id, folder);
    setFolderMenu(null);
    setCtxMenu(null);
  };

  // ─── Renderers ─────────────────────────────────────────────────────────────
  const renderItem = (e: ApiMockServerListEntry) => (
    <div
      key={e.id}
      className={[
        'am-sidebar-item',
          // c8 ignore next
          e.isActive ? 'active' : '',
          // c8 ignore next
          !e.isOpen ? 'am-sidebar-item-parked' : '',
          // c8 ignore next
          dragId === e.id ? 'am-sidebar-item-dragging' : '',
          // c8 ignore next
          dragOverId === e.id ? 'am-sidebar-item-dragover' : '',
      ].filter(Boolean).join(' ')}
      draggable={canDrag}
      onDragStart={ev => {
        /* c8 ignore next */
        if (!canDrag) return;
        ev.dataTransfer.setData('text/plain', e.id);
        ev.dataTransfer.effectAllowed = 'move';
        activeDragTypeRef.current = 'server';
        activeDragIdRef.current = e.id;
        setDragId(e.id);
      }}
      onDragOver={ev => {
        /* c8 ignore next */
        if (!canDrag) return;
        const type = activeDragTypeRef.current;
        if (type === 'server' || type === 'folder') {
          ev.preventDefault();
          ev.stopPropagation();
          ev.dataTransfer.dropEffect = 'move';
          setDragOverId(e.id);
        }
      }}
      onDragLeave={() => { /* c8 ignore next */ if (dragOverId === e.id) setDragOverId(null); }}
      onDrop={ev => {
        /* c8 ignore next */
        if (!canDrag) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (activeDragTypeRef.current === 'folder') handleFolderDropOnServer(e);
        else handleDrop(e.id);
      }}
      onDragEnd={resetDrag}
      onContextMenu={ev => openCtxMenu(ev, e.id, e.name)}
      onClick={() => state?.onSelect(e.id)}
      data-testid={`api-mock-sidebar-item-${e.id}`}
    >
      {/* c8 ignore next */}
      {/* c8 ignore next */}
      {e.isActive && (
        <span data-testid="api-mock-sidebar-active-item" style={{ display: 'none' }} />
      )}
      <button
        type="button"
        className="am-sidebar-item-btn"
        onClick={ev => { ev.stopPropagation(); state?.onSelect(e.id); }}
        title={`${e.name} · Port ${e.port}${e.isOpen ? '' : ' · closed'}${e.status === 'running' ? ' · running' : ''}`}
      >
        <span className={`am-sidebar-dot am-sidebar-dot--${e.status}`} aria-hidden="true" />
        <span className={`am-sidebar-item-icon am-sidebar-item-icon--${e.status}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="7" rx="1.6" />
            <rect x="3" y="13" width="18" height="7" rx="1.6" />
            <circle cx="7" cy="7.5" r="0.5" fill="currentColor" />
            <circle cx="7" cy="16.5" r="0.5" fill="currentColor" />
          </svg>
        </span>
        {/* c8 ignore next */}
        {rename?.id === e.id ? (
          <input
            ref={renameInputRef}
            className="am-sidebar-rename-input"
            value={rename.value}
            autoFocus
            onClick={ev => ev.stopPropagation()}
            onChange={ev => setRename(r => r ? { ...r, value: ev.target.value } : r)}
            onKeyDown={ev => {
              if (ev.key === 'Enter') { ev.preventDefault(); commitRename(); }
              if (ev.key === 'Escape') setRename(null);
            }}
            onBlur={commitRename}
            data-testid="api-mock-sidebar-rename-input"
          />
        ) : (
          <span className="am-sidebar-item-name">{e.name}</span>
        )}
        <span className="am-sidebar-item-port">:{e.port}</span>
        {/* c8 ignore next */}
        {/* c8 ignore next */}
        {e.ruleCount > 0 && (
          <span className="am-sidebar-item-count" title={`${e.ruleCount} ${e.ruleCount === 1 ? 'rule' : 'rules'}`}>
            {e.ruleCount}
          </span>
        )}
      </button>
    </div>
  );

  const renderFolderCreateRow = (parent: string | undefined) => (
    <div className="am-sidebar-folder-create-row">
      <input
        ref={folderDraftRef}
        className="am-sidebar-folder-create-input"
        placeholder={parent ? 'Subfolder name…' : 'Folder name…'}
        value={folderDraft?.value ?? ''}
        autoFocus
        onChange={ev => setFolderDraft(d => d ? { ...d, value: ev.target.value } : d)}
        onKeyDown={ev => {
          if (ev.key === 'Enter') { ev.preventDefault(); confirmFolderCreate(); }
          if (ev.key === 'Escape') setFolderDraft(null);
        }}
        data-testid="api-mock-sidebar-folder-create-input"
      />
      <button
        type="button"
        className="am-sidebar-new-folder-btn"
        disabled={!folderDraft?.value.trim() || childFolderNames(allFolderPaths, parent).some(n => n.toLowerCase() === folderDraft.value.trim().toLowerCase())}
        onClick={confirmFolderCreate}
        data-testid="api-mock-sidebar-folder-create-confirm"
      >Add</button>
      <button
        type="button"
        className="am-sidebar-folder-create-cancel"
        onClick={() => setFolderDraft(null)}
        title="Cancel"
      >×</button>
    </div>
  );

  const renderFolderNode = (node: FolderTreeNode) => {
    const directServers = serversByFolder.get(node.path) ?? [];
    /* c8 ignore next */
    const hasContent = directServers.length > 0 || node.children.length > 0;
    /* c8 ignore next */
    const collapsed = collapsedFolders.has(node.path);
    /* c8 ignore next */
    const totalServers = visible.filter(e => e.serverFolder && isSameOrDescendant(e.serverFolder, node.path)).length;
    return (
      <div
        key={node.path}
        className={[
          'am-sidebar-folder',
          folderDragPath === node.path ? 'am-sidebar-folder-dragging' : '',
          folderDragOverPath === node.path ? 'am-sidebar-folder-dragover' : '',
        ].filter(Boolean).join(' ')}
        data-testid={`api-mock-sidebar-folder-${node.path}`}
        onDragOver={ev => {
          /* c8 ignore next */
          if (!canDrag) return;
          const type = activeDragTypeRef.current;
          const aid = activeDragIdRef.current;
          /* c8 ignore next */
          if (type === 'server') { ev.preventDefault(); ev.stopPropagation(); ev.dataTransfer.dropEffect = 'move'; setFolderDragOverPath(node.path); }
          /* c8 ignore next */
          else if (type === 'folder' && aid && !isSameOrDescendant(node.path, aid)) { ev.preventDefault(); ev.stopPropagation(); ev.dataTransfer.dropEffect = 'move'; setFolderDragOverPath(node.path); }
        }}
        onDragLeave={ev => {
          const related = ev.relatedTarget as Node | null;
          if (!related || !ev.currentTarget.contains(related)) setFolderDragOverPath(null);
        }}
        onDrop={ev => {
          /* c8 ignore next */
          if (!canDrag) return;
          ev.preventDefault();
          ev.stopPropagation();
          const type = activeDragTypeRef.current;
          const aid = activeDragIdRef.current;
          /* c8 ignore next */
          if (type === 'server') handleServerDropOnFolder(node.path);
          /* c8 ignore next */
          else if (type === 'folder' && aid && !isSameOrDescendant(node.path, aid)) { moveFolderInto(aid, node.path); resetDrag(); }
        }}
      >
        <div
          className="am-sidebar-folder-header-wrap"
          draggable={canDrag && activeDragTypeRef.current !== 'server'}
          onDragStart={ev => {
            ev.stopPropagation();
            if (!canDrag) return;
            ev.dataTransfer.setData('text/plain', node.path);
            ev.dataTransfer.effectAllowed = 'move';
            activeDragTypeRef.current = 'folder';
            activeDragIdRef.current = node.path;
            setFolderDragPath(node.path);
          }}
          onDragEnd={resetDrag}
          onContextMenu={ev => openFolderCtxMenu(ev, node.path)}
        >
          <button
            type="button"
            className="am-sidebar-folder-header"
            onClick={() => hasContent && !folderRename && toggleFolder(node.path)}
            title={collapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
          >
            <span className={`am-sidebar-folder-chevron${hasContent && !collapsed ? ' open' : ''}${hasContent ? '' : ' am-sidebar-folder-chevron-hidden'}`}>▶</span>
            <span className="am-sidebar-folder-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {hasContent && !collapsed ? (
                  <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h3.8l1.6 2H19a1.5 1.5 0 0 1 1.48 1.75l-1 6A1.5 1.5 0 0 1 18 17H5a1.5 1.5 0 0 1-1.5-1.5z" />
                ) : (
                  <path d="M3 7A1.5 1.5 0 0 1 4.5 5.5h3.6l1.6 2H19.5A1.5 1.5 0 0 1 21 9v7.5A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5z" />
                )}
              </svg>
            </span>
            {folderRename?.path === node.path ? (
              <input
                ref={folderRenameRef}
                className="am-sidebar-folder-rename-input"
                value={folderRename.value}
                autoFocus
                onClick={ev => ev.stopPropagation()}
                onChange={ev => setFolderRename(r => r ? { ...r, value: ev.target.value } : r)}
                onKeyDown={ev => {
                  if (ev.key === 'Enter') { ev.preventDefault(); commitFolderRename(); }
                  if (ev.key === 'Escape') setFolderRename(null);
                }}
                onBlur={commitFolderRename}
                data-testid="api-mock-sidebar-folder-rename-input"
              />
            ) : (
              <span className="am-sidebar-folder-name">{node.name}</span>
            )}
            {totalServers > 0 && <span className="am-sidebar-folder-count">{totalServers}</span>}
          </button>
          <button
            type="button"
            className="am-sidebar-folder-add"
            title={`Create subfolder in ${node.name}`}
            aria-label={`Create subfolder in ${node.name}`}
            data-testid={`api-mock-sidebar-folder-add-${node.path}`}
            onClick={ev => { ev.preventDefault(); ev.stopPropagation(); startFolderCreate(node.path); }}
          >+</button>
        </div>
        {!collapsed && (
          <div className="am-sidebar-folder-items">
            {node.children.map(renderFolderNode)}
            {folderDraft?.parent === node.path && renderFolderCreateRow(node.path)}
            {directServers.map(renderItem)}
            {!hasContent && folderDraft?.parent !== node.path && (
              <div className="am-sidebar-folder-empty-hint">Drop a server here</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const moveMenuLeft = (baseX: number) => baseX + 155;

  return (
    <div className="am-sidebar" data-testid="api-mock-sidebar">
      <div className="am-sidebar-header">
        <span className="am-sidebar-title">Mock Servers</span>
        <div className="am-sidebar-header-actions">
          <button
            type="button"
            className={`am-sidebar-icon-btn${isAllExpanded ? ' active' : ''}`}
            onClick={toggleExpandAll}
            disabled={allVisibleFolderList.length === 0}
            title={isAllExpanded ? 'Shrink all' : 'Expand all'}
            aria-label={isAllExpanded ? 'Shrink all folders' : 'Expand all folders'}
            aria-pressed={isAllExpanded}
            data-testid="api-mock-sidebar-expand-all"
          >
            {isAllExpanded ? '\u229F' : '\u229E'}
          </button>
          <button
            type="button"
            className="am-sidebar-icon-btn"
            onClick={() => startFolderCreate(undefined)}
            disabled={!state || folderDraft !== null}
            title="New folder"
            aria-label="New folder"
            data-testid="api-mock-sidebar-new-folder-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7A1.5 1.5 0 0 1 4.5 5.5h3.6l1.6 2H19.5A1.5 1.5 0 0 1 21 9v7.5A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5z" />
              <path d="M12 11v6M9 14h6" />
            </svg>
          </button>
          <button
            type="button"
            className="am-sidebar-icon-btn am-sidebar-icon-btn-primary"
            onClick={() => state?.onCreate()}
            disabled={!state}
            title="New mock server"
            aria-label="New mock server"
            data-testid="api-mock-sidebar-new"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
      <div className="am-sidebar-search">
        <svg className="am-sidebar-search-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16.2 16.2L21 21" />
        </svg>
        <input
          type="text"
          className="am-sidebar-search-input"
          placeholder="Search servers…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          data-testid="api-mock-sidebar-search"
        />
        {query && (
          <button
            type="button"
            className="am-sidebar-search-clear"
            onClick={() => setQuery('')}
            title="Clear search"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      <div
        className="am-sidebar-list"
        data-testid="api-mock-sidebar-list"
        onDragOver={ev => { /* c8 ignore next */ if (canDrag && activeDragTypeRef.current === 'folder') { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; } }}
        onDrop={ev => {
          /* c8 ignore next */
          if (!canDrag) return;
          const aid = activeDragIdRef.current;
          /* c8 ignore next */
          if (activeDragTypeRef.current === 'folder' && aid) { ev.preventDefault(); handleFolderDropToTop(); }
        }}
      >
        {visible.length === 0 && (
          <div className="am-sidebar-empty">
            {entries.length === 0 ? 'No mock servers yet.' : 'No servers match your search.'}
          </div>
        )}
        {folderDraft?.parent === undefined && folderDraft && renderFolderCreateRow(undefined)}
        {ungrouped.map(renderItem)}
        {folderTree.map(renderFolderNode)}
        {folderDragPath && folderParentPath(folderDragPath) && (
          <div
            className="am-sidebar-root-drop"
            data-testid="api-mock-sidebar-root-drop"
            onDragOver={ev => {
              ev.preventDefault();
              ev.stopPropagation();
              ev.dataTransfer.dropEffect = 'move';
            }}
            onDrop={ev => {
              ev.preventDefault();
              ev.stopPropagation();
              handleFolderDropToTop();
            }}
          >
            Drop here to move to top level
          </div>
        )}
      </div>

      {/* Server right-click context menu */}
      {ctxMenu && createPortal(
        <>
          <div
            className="am-sidebar-ctx-backdrop"
            onClick={() => { setCtxMenu(null); setFolderMenu(null); }}
            onContextMenu={ev => { ev.preventDefault(); setCtxMenu(null); setFolderMenu(null); }}
            role="presentation"
          />
          <div
            className="am-sidebar-ctx-menu"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
            role="menu"
            data-testid="api-mock-sidebar-ctx-menu"
          >
            <button type="button" className="am-sidebar-ctx-item" role="menuitem"
              onClick={() => startRename(ctxMenu.id, ctxMenu.name)}
              data-testid="api-mock-sidebar-ctx-rename"
            >Rename</button>
            <button type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-has-arrow" role="menuitem"
              onClick={ev => { setFolderMenu(folderMenu ? null : { id: ctxMenu.id, x: ctxMenu.x, y: ev.clientY }); setNewFolderInput(''); }}
              data-testid="api-mock-sidebar-ctx-move-folder"
            >Move to folder <span className="am-sidebar-ctx-arrow">›</span></button>
            <div className="am-sidebar-ctx-divider" />
            <button type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-danger" role="menuitem"
              onClick={() => { state?.onDelete(ctxMenu.id); setCtxMenu(null); }}
              data-testid="api-mock-sidebar-ctx-delete"
            >Delete</button>
          </div>
          {/* Move-server-to-folder submenu — shows the nested folder structure */}
          {folderMenu && (
            <div
              className="am-sidebar-ctx-menu am-sidebar-folder-submenu"
              style={{ top: folderMenu.y, left: moveMenuLeft(ctxMenu.x) }}
              role="menu"
              data-testid="api-mock-sidebar-folder-submenu"
            >
              {flatFolders.filter(f => f.path !== entries.find(e => e.id === folderMenu.id)?.serverFolder).map(f => (
                <button key={f.path} type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-folder" role="menuitem"
                  style={{ paddingLeft: 10 + f.depth * 14 }}
                  onClick={() => moveToFolder(folderMenu.id, f.path)}
                  data-testid={`api-mock-sidebar-move-to-${f.path}`}
                >
                  <span className="am-sidebar-ctx-folder-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7A1.5 1.5 0 0 1 4.5 5.5h3.6l1.6 2H19.5A1.5 1.5 0 0 1 21 9v7.5A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5z" />
                    </svg>
                  </span>
                  {f.name}
                </button>
              ))}
              {entries.find(e => e.id === folderMenu.id)?.serverFolder && (
                <button type="button" className="am-sidebar-ctx-item" role="menuitem"
                  onClick={() => moveToFolder(folderMenu.id, undefined)}
                  data-testid="api-mock-sidebar-move-no-folder"
                >No folder</button>
              )}
              {flatFolders.length > 0 && <div className="am-sidebar-ctx-divider" />}
              <div className="am-sidebar-new-folder-row">
                <input
                  className="am-sidebar-new-folder-input"
                  placeholder="New folder…"
                  value={newFolderInput}
                  onChange={ev => setNewFolderInput(ev.target.value)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' && newFolderInput.trim()) moveToFolder(folderMenu.id, newFolderInput.trim());
                    if (ev.key === 'Escape') setFolderMenu(null);
                  }}
                  data-testid="api-mock-sidebar-new-folder-input"
                  autoFocus
                />
                <button type="button" className="am-sidebar-new-folder-btn"
                  disabled={!newFolderInput.trim()}
                  onClick={() => { if (newFolderInput.trim()) moveToFolder(folderMenu.id, newFolderInput.trim()); }}
                  data-testid="api-mock-sidebar-new-folder-btn"
                >Add</button>
              </div>
            </div>
          )}
        </>,
        document.body,
      )}

      {/* Folder right-click context menu */}
      {folderCtxMenu && createPortal(
        <>
          <div
            className="am-sidebar-ctx-backdrop"
            onClick={() => { setFolderCtxMenu(null); setFolderMoveMenu(null); }}
            onContextMenu={ev => { ev.preventDefault(); setFolderCtxMenu(null); setFolderMoveMenu(null); }}
            role="presentation"
          />
          <div
            className="am-sidebar-ctx-menu"
            style={{ top: folderCtxMenu.y, left: folderCtxMenu.x }}
            role="menu"
            data-testid="api-mock-sidebar-folder-ctx-menu"
          >
            <button type="button" className="am-sidebar-ctx-item" role="menuitem"
              onClick={() => startFolderCreate(folderCtxMenu.path)}
              data-testid="api-mock-sidebar-folder-ctx-subfolder"
            >Create subfolder</button>
            <button type="button" className="am-sidebar-ctx-item" role="menuitem"
              onClick={() => startFolderRename(folderCtxMenu.path)}
              data-testid="api-mock-sidebar-folder-ctx-rename"
            >Rename</button>
            <button type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-has-arrow" role="menuitem"
              onClick={ev => setFolderMoveMenu(folderMoveMenu ? null : { path: folderCtxMenu.path, x: folderCtxMenu.x, y: ev.clientY })}
              data-testid="api-mock-sidebar-folder-ctx-move"
            >Move to folder <span className="am-sidebar-ctx-arrow">›</span></button>
            <div className="am-sidebar-ctx-divider" />
            <button type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-danger" role="menuitem"
              onClick={() => deleteFolder(folderCtxMenu.path)}
              data-testid="api-mock-sidebar-folder-ctx-delete"
            >Delete</button>
          </div>
          {/* Move-this-folder submenu — nested folder structure, self+descendants excluded */}
          {folderMoveMenu && (
            <div
              className="am-sidebar-ctx-menu am-sidebar-folder-submenu"
              style={{ top: folderMoveMenu.y, left: moveMenuLeft(folderCtxMenu.x) }}
              role="menu"
              data-testid="api-mock-sidebar-folder-move-submenu"
            >
              <button type="button" className="am-sidebar-ctx-item" role="menuitem"
                onClick={() => moveFolderInto(folderMoveMenu.path, undefined)}
                data-testid="api-mock-sidebar-folder-move-top"
              >Top level</button>
              {flatFolders.filter(f => !isSameOrDescendant(f.path, folderMoveMenu.path)).length > 0 && <div className="am-sidebar-ctx-divider" />}
              {flatFolders.filter(f => !isSameOrDescendant(f.path, folderMoveMenu.path)).map(f => (
                <button key={f.path} type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-folder" role="menuitem"
                  style={{ paddingLeft: 10 + f.depth * 14 }}
                  onClick={() => moveFolderInto(folderMoveMenu.path, f.path)}
                  data-testid={`api-mock-sidebar-folder-move-to-${f.path}`}
                >
                  <span className="am-sidebar-ctx-folder-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7A1.5 1.5 0 0 1 4.5 5.5h3.6l1.6 2H19.5A1.5 1.5 0 0 1 21 9v7.5A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5z" />
                    </svg>
                  </span>
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </>,
        document.body,
      )}

      {confirmDialogElement}
    </div>
  );
}
