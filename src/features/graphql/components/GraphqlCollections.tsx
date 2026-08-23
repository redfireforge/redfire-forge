/**
 * GraphqlCollections — Phase 3A (task 3A-4)
 *
 * Folder tree with:
 *  - Expand/collapse, inline rename (double-click), right-click context menu
 *  - Items: run/duplicate/delete, schema-validation ⚠ badge
 *  - Fork collection
 *  - Global search bar
 *  - "Save current operation" shortcut (via prop)
 *  - Export / import (3A-5) triggered from toolbar
 *  - "Run All" → emits onRunAll(collectionId)
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useModalDrag } from '@shared/hooks/useModalDrag';
import { buildCollectionImportPreview } from '../utils/collectionImportPreview';
import { GraphqlImportPreviewPanel } from './GraphqlImportPreviewPanel';
import type {
  GraphqlCollectionFolder,
  GraphqlCollectionItem,
  GraphqlOperation,
  GraphqlScriptConfig,
  RfResponseContext,
} from '@shared/types/graphql';
import type { CollectionTree, UseGraphqlCollectionsResult } from '../hooks/useGraphqlCollections';
import type { CollectionExportData } from '@shared/utils/idbGraphqlCollections';
import { GraphqlScriptEditorModal, type ScriptEditorSavePayload } from './GraphqlScriptEditorModal';
import type { ContextMenuState } from './graphqlCollectionsTypes';
import { ChevronIcon, PlusIcon, ExportIcon, ImportIcon } from './GraphqlCollectionsIcons';
import { CollectionItemRow } from './GraphqlCollectionItemRow';
import { CollectionContextMenu } from './GraphqlCollectionContextMenu';
import { CollectionVarsEditor } from './GraphqlCollectionVarsEditor';

export type { SaveToCollectionModalProps } from './GraphqlSaveToCollectionModal';
export { SaveToCollectionModal } from './GraphqlSaveToCollectionModal';

export interface GraphqlCollectionsProps {
  collections: UseGraphqlCollectionsResult;
  loading: boolean;
  onRunItem: (item: GraphqlCollectionItem) => void;
  onRunAll: (collectionId: string, folderId?: string) => void;
  onLoadItem: (item: GraphqlCollectionItem) => void;
  currentOperation?: GraphqlOperation;
  invalidItemIds?: Set<string>;
  onSaveComplete?: () => void;
  lastRfResponse?: RfResponseContext;
  envSnapshot?: Record<string, string>;
}

export function GraphqlCollections({
  collections,
  loading,
  onRunItem,
  onRunAll,
  onLoadItem,
  currentOperation,
  invalidItemIds = new Set(),
  onSaveComplete,
  lastRfResponse,
  envSnapshot,
}: GraphqlCollectionsProps) {
  const [searchQuery, setSearchQuery]   = useState('');
  const [showBrokenOnly, setShowBrokenOnly] = useState(false);
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set());
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editingName, setEditingName]   = useState('');
  const [contextMenu, setContextMenu]   = useState<ContextMenuState | null>(null);
  const [saveName, setSaveName]         = useState('');
  const [saveTarget, setSaveTarget]     = useState<{ collectionId: string; folderId?: string } | null>(null);
  const [saveVarsError, setSaveVarsError] = useState<string | null>(null);
  const [importPending, setImportPending] = useState<{ data: CollectionExportData; fileName: string } | null>(null);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importError, setImportError]     = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { onDragStart, isDragged, overlayStyle, modalStyle } = useModalDrag(!!importPending);
  const importPreview = useMemo(
    () => (importPending ? buildCollectionImportPreview(importPending.data) : null),
    [importPending],
  );

  const [varsOpenId, setVarsOpenId] = useState<string | null>(null);

  const [scriptModal, setScriptModal] = useState<{
    open: boolean;
    context: 'item' | 'collection';
    name: string;
    itemId?: string;
    collectionId?: string;
    scripts?: GraphqlScriptConfig;
    collectionPreScript?: string;
    collectionPostScript?: string;
    testResponse?: RfResponseContext;
  }>({ open: false, context: 'item', name: '' });

  const openItemScriptEditor = useCallback((item: GraphqlCollectionItem) => {
    setContextMenu(null);
    setScriptModal({ open: true, context: 'item', name: item.name, itemId: item.id, scripts: item.scripts, testResponse: lastRfResponse });
  }, [lastRfResponse]);

  const openCollectionScriptEditor = useCallback((colId: string, colName: string) => {
    const tree = collections.trees.find((t) => t.collection.id === colId);
    if (!tree) return;
    setContextMenu(null);
    setScriptModal({ open: true, context: 'collection', name: colName, collectionId: colId, collectionPreScript: tree.collection.preRequestScript, collectionPostScript: tree.collection.postResponseScript, testResponse: lastRfResponse });
  }, [collections.trees, lastRfResponse]);

  const handleScriptSave = useCallback(async (payload: ScriptEditorSavePayload) => {
    if (payload.context === 'item' && scriptModal.itemId) {
      const tree = collections.trees.find((t) => t.items.some((i) => i.id === scriptModal.itemId));
      const item = tree?.items.find((i) => i.id === scriptModal.itemId);
      if (item) await collections.updateItem({ ...item, scripts: payload.scripts, updatedAt: Date.now() });
    } else if (payload.context === 'collection' && scriptModal.collectionId) {
      await collections.updateCollectionScript(scriptModal.collectionId, 'preRequestScript', payload.collectionPreScript ?? '');
      await collections.updateCollectionScript(scriptModal.collectionId, 'postResponseScript', payload.collectionPostScript ?? '');
    }
    setScriptModal((prev) => ({ ...prev, open: false }));
  }, [collections, scriptModal.itemId, scriptModal.collectionId]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const beginRename = useCallback((id: string, currentName: string) => {
    setEditingId(id); setEditingName(currentName); setContextMenu(null);
  }, []);

  const commitRename = useCallback((type: 'collection' | 'folder' | 'item', id: string) => {
    if (!editingName.trim()) { setEditingId(null); return; }
    if (type === 'collection') collections.renameCollection(id, editingName.trim()).catch(() => {});
    else if (type === 'folder') collections.renameFolder(id, editingName.trim()).catch(() => {});
    else {
      const item = collections.trees.flatMap((t) => t.items).find((i) => i.id === id);
      if (item) collections.updateItem({ ...item, name: editingName.trim(), updatedAt: Date.now() }).catch(() => {});
    }
    setEditingId(null);
  }, [collections, editingName]);

  const handleContextMenu = useCallback((e: React.MouseEvent, menu: ContextMenuState) => {
    e.preventDefault(); setContextMenu(menu);
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleExport = useCallback(async () => {
    const data = await collections.exportCollections();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `redfire-graphql-collections-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [collections]);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setImportError('File is larger than 10 MB.'); return; }
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as Record<string, unknown>;
      if (!raw || typeof raw !== 'object') throw new Error('Invalid format: expected a JSON object');
      if (!Array.isArray(raw.collections)) throw new Error('Invalid format: "collections" array is missing');
      const version = (raw._exportMeta as Record<string, unknown> | undefined)?.version;
      if (version && version !== '1.0' && version !== '1.1') console.warn(`[Import] Unknown collection export version: ${String(version)}`);
      setImportPending({ data: raw as unknown as CollectionExportData, fileName: file.name });
      setImportPreviewOpen(false);
      setImportError(null);
    } catch (err) {
      setImportError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }, []);

  const handleImportConfirm = useCallback(async (mode: 'replace' | 'merge') => {
    if (!importPending) return;
    setImportPending(null);
    try {
      if (mode === 'merge') {
        const existingIds = new Set(collections.trees.map((t) => t.collection.id));
        const resolutions = new Map(importPending.data.collections.filter((g) => existingIds.has(g.collection.id)).map((g) => [g.collection.id, 'keep-both' as const]));
        await collections.importCollections(importPending.data, 'merge', resolutions);
      } else {
        await collections.importCollections(importPending.data, 'replace');
      }
    } catch (err) {
      setImportError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [collections, importPending]);

  const handleSaveCurrentOperation = useCallback(async () => {
    if (!currentOperation || !saveTarget || !saveName.trim()) return;
    const vars = currentOperation.variables ?? '';
    if (vars.trim() && vars.trim() !== '{}') {
      try { JSON.parse(vars); setSaveVarsError(null); } catch { setSaveVarsError('Variables must be valid JSON'); return; }
    }
    setSaveVarsError(null);
    await collections.addItem(saveTarget.collectionId, saveTarget.folderId, saveName.trim(), currentOperation);
    setSaveTarget(null); setSaveName(''); onSaveComplete?.();
  }, [collections, currentOperation, saveTarget, saveName, onSaveComplete]);

  if (loading) {
    return <div className="gql-collections-panel gql-collections-panel--loading" aria-label="Loading collections"><div className="gql-history-spinner" aria-hidden="true" /></div>;
  }

  const searchFiltered = searchQuery.trim()
    ? collections.trees.filter((t) => t.collection.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.items.some((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase())) || t.folders.some((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())))
    : collections.trees;

  const brokenCount = invalidItemIds.size;
  const filtered = showBrokenOnly && brokenCount > 0
    ? searchFiltered.filter((t) => t.items.some((i) => invalidItemIds.has(i.id))).map((t) => ({ ...t, items: t.items.filter((i) => invalidItemIds.has(i.id)) }))
    : searchFiltered;

  return (
    <div className="gql-collections-panel" data-testid="gql-collections-panel">
      <div className="gql-collections-header">
        <span className="gql-collections-title">Collections</span>
        <div className="gql-collections-header-actions">
          <button type="button" className="gql-collections-toolbar-btn" title="New collection" onClick={() => collections.addCollection('New Collection').catch(() => {})} aria-label="New collection" data-testid="gql-collections-new"><PlusIcon /></button>
          <button type="button" className="gql-collections-toolbar-btn" title="Export collections" onClick={handleExport} aria-label="Export" data-testid="gql-collections-export"><ExportIcon /></button>
          <button type="button" className="gql-collections-toolbar-btn" title="Import collections" onClick={() => importInputRef.current?.click()} aria-label="Import" data-testid="gql-collections-import"><ImportIcon /></button>
          <input ref={importInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} data-testid="gql-collections-import-input" />
        </div>
      </div>

      <div className="gql-collections-search">
        <input type="search" className="gql-history-search-input" placeholder="Search collections…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search collections" data-testid="gql-collections-search" />
        {brokenCount > 0 && (
          <button type="button" className={`gql-collections-broken-filter${showBrokenOnly ? ' gql-collections-broken-filter--active' : ''}`} title={showBrokenOnly ? 'Show all operations' : `Show only broken operations (${brokenCount})`} onClick={() => setShowBrokenOnly((v) => !v)} aria-pressed={showBrokenOnly} data-testid="gql-collections-broken-filter">⚠ {brokenCount}</button>
        )}
      </div>

      {currentOperation && saveTarget && (
        <div className="gql-collections-save-banner">
          <div className="gql-collections-save-row">
            <input type="text" className="gql-collections-save-input" placeholder="Operation name…" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCurrentOperation(); }} autoFocus />
            <button type="button" className="gql-collections-save-confirm" onClick={handleSaveCurrentOperation}>Save</button>
            <button type="button" className="gql-collections-save-cancel" onClick={() => { setSaveTarget(null); setSaveVarsError(null); }}>✕</button>
          </div>
          {saveVarsError && <div className="gql-collections-save-error" role="alert" data-testid="gql-collections-save-vars-error">{saveVarsError}</div>}
        </div>
      )}

      <div className="gql-collections-tree" role="tree" aria-label="Collections tree" data-testid="gql-collections-tree">
        {collections.trees.length === 0 && <div className="gql-history-empty">No collections yet. Click + to create one.</div>}
        {collections.trees.length > 0 && filtered.length === 0 && <div className="gql-history-empty">{showBrokenOnly ? 'No broken operations found.' : 'No collections match your search.'}</div>}
        {filtered.map((tree) => (
          <CollectionNode
            key={tree.collection.id}
            tree={tree}
            expandedIds={expandedIds}
            editingId={editingId}
            editingName={editingName}
            onEditingNameChange={setEditingName}
            onToggleExpand={toggleExpand}
            onBeginRename={beginRename}
            onCommitRename={commitRename}
            onContextMenu={handleContextMenu}
            onRunItem={onRunItem}
            onRunAll={onRunAll}
            onLoadItem={onLoadItem}
            onSaveCurrentOperation={currentOperation ? (colId, folderId) => { setSaveTarget({ collectionId: colId, folderId }); setSaveName(currentOperation.name ?? ''); } : undefined}
            invalidItemIds={invalidItemIds}
            onDeleteItem={(id) => collections.deleteItem(id).catch(() => {})}
            onAddFolder={(colId, parentId) => collections.addFolder(colId, 'New Folder', parentId).catch(() => {})}
            onEditItemScripts={openItemScriptEditor}
            onEditCollectionScripts={openCollectionScriptEditor}
            isVarsOpen={varsOpenId === tree.collection.id}
            onToggleVars={(colId) => setVarsOpenId((prev) => prev === colId ? null : colId)}
            onSaveVars={(colId, vars) => collections.updateCollectionVariables(colId, vars).catch(() => {})}
          />
        ))}
      </div>

      {contextMenu && (
        <CollectionContextMenu
          menu={contextMenu}
          onClose={closeContextMenu}
          onRename={(type, id, name) => beginRename(`${type}:${id}`, name)}
          onDelete={(type, id) => {
            if (type === 'collection') collections.deleteCollection(id).catch(() => {});
            else if (type === 'folder') collections.deleteFolder(id).catch(() => {});
            else collections.deleteItem(id).catch(() => {});
            closeContextMenu();
          }}
          onFork={(id) => { const name = prompt('Name for the forked collection?'); if (name) collections.forkCollection(id, name).catch(() => {}); closeContextMenu(); }}
          onDuplicate={(id) => {
            const item = collections.trees.flatMap((t) => t.items).find((i) => i.id === id);
            if (item) {
              collections.addItem(item.collectionId, item.folderId, `${item.name} (copy)`, item.operation)
                .then((newItem) => collections.updateItem({ ...newItem, scripts: item.scripts, tags: item.tags, isPinned: false, description: item.description, connectionId: item.connectionId }))
                .catch(() => {});
            }
            closeContextMenu();
          }}
          onEditItemScripts={(id) => { const item = collections.trees.flatMap((t) => t.items).find((i) => i.id === id); if (item) openItemScriptEditor(item); }}
          onEditCollectionScripts={(id, name) => openCollectionScriptEditor(id, name)}
          itemIsPinned={contextMenu?.type === 'item' ? (collections.trees.flatMap((t) => t.items).find((i) => i.id === contextMenu.id)?.isPinned ?? false) : undefined}
          onTogglePin={(id, pinned) => { collections.setPinned(id, pinned).catch(() => {}); }}
        />
      )}

      <GraphqlScriptEditorModal
        open={scriptModal.open}
        name={scriptModal.name}
        context={scriptModal.context}
        scripts={scriptModal.scripts}
        collectionPreScript={scriptModal.collectionPreScript}
        collectionPostScript={scriptModal.collectionPostScript}
        resetKey={scriptModal.itemId ?? scriptModal.collectionId}
        testResponse={scriptModal.testResponse}
        envSnapshot={envSnapshot}
        collectionVarsSnapshot={(() => {
          const colId = scriptModal.collectionId ?? (scriptModal.itemId ? collections.trees.find((t) => t.items.some((i) => i.id === scriptModal.itemId))?.collection.id : undefined);
          return colId ? (collections.trees.find((t) => t.collection.id === colId)?.collection.variables ?? {}) : {};
        })()}
        onSave={(payload) => { handleScriptSave(payload).catch(() => {}); }}
        onClose={() => setScriptModal((prev) => ({ ...prev, open: false }))}
      />

      {importPending && (
        <div
          className={`gql-import-mode-overlay${isDragged ? ' gql-import-mode-overlay--dragged' : ''}`}
          style={overlayStyle}
          data-testid="gql-import-mode-dialog"
        >
          <div
            className={`gql-import-mode-panel${isDragged ? ' gql-import-mode-panel--dragged' : ''}${importPreviewOpen ? ' gql-import-mode-panel--preview-open' : ''}`}
            style={modalStyle}
            role="dialog"
            aria-modal="true"
            aria-label={`Import collections from ${importPending.fileName}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="gql-import-mode-header gql-import-mode-header--draggable"
              onMouseDown={onDragStart}
              data-testid="gql-import-mode-header"
            >
              <span className="gql-import-mode-drag-grip" aria-hidden="true" title="Drag to move">
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2" cy="2" r="1.2" /><circle cx="8" cy="2" r="1.2" />
                  <circle cx="2" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" />
                  <circle cx="2" cy="14" r="1.2" /><circle cx="8" cy="14" r="1.2" />
                </svg>
              </span>
              <h3 className="gql-import-mode-title">Import Collections</h3>
            </div>
            <div className="gql-import-mode-body">
              <div className="gql-import-mode-file" data-testid="gql-import-mode-file">
                <span className="gql-import-mode-file-label">File</span>
                <button
                  type="button"
                  className="gql-import-mode-file-name-btn"
                  title={importPending.fileName}
                  aria-expanded={importPreviewOpen}
                  aria-controls="gql-import-mode-preview-panel"
                  data-testid="gql-import-mode-file-preview"
                  onClick={() => setImportPreviewOpen((open) => !open)}
                >
                  {importPending.fileName}
                </button>
                <button
                  type="button"
                  className="gql-import-mode-preview-toggle"
                  aria-expanded={importPreviewOpen}
                  aria-controls="gql-import-mode-preview-panel"
                  data-testid="gql-import-mode-preview-toggle"
                  onClick={() => setImportPreviewOpen((open) => !open)}
                >
                  {importPreviewOpen ? 'Hide preview' : 'Preview'}
                </button>
              </div>
              {importPreviewOpen && importPreview && (
                <div id="gql-import-mode-preview-panel">
                  <GraphqlImportPreviewPanel preview={importPreview} />
                </div>
              )}
              <p className="gql-import-mode-summary" data-testid="gql-import-mode-summary">
                {importPending.data.collections.length} collection{importPending.data.collections.length === 1 ? '' : 's'}
                {' · '}
                {importPending.data.collections.reduce((n, g) => n + g.items.length, 0)} operation
                {importPending.data.collections.reduce((n, g) => n + g.items.length, 0) === 1 ? '' : 's'}
              </p>
              <p className="gql-import-mode-desc">How would you like to handle conflicts with existing collections?</p>
              <div className="gql-import-mode-actions">
                <button type="button" className="gql-import-mode-btn" onClick={() => { handleImportConfirm('merge').catch(() => {}); }} data-testid="gql-import-mode-merge">
                  <strong>Merge</strong><span className="gql-import-mode-hint">Keep existing, skip or rename conflicts</span>
                </button>
                <button type="button" className="gql-import-mode-btn gql-import-mode-btn--replace" onClick={() => { handleImportConfirm('replace').catch(() => {}); }} data-testid="gql-import-mode-replace">
                  <strong>Replace</strong><span className="gql-import-mode-hint">Overwrite all existing collections (destructive)</span>
                </button>
              </div>
            </div>
            <footer className="gql-import-mode-footer">
              <button
                type="button"
                className="gql-script-btn gql-script-btn--secondary"
                onClick={() => { setImportPending(null); setImportPreviewOpen(false); }}
                data-testid="gql-import-mode-cancel"
              >
                Cancel
              </button>
            </footer>
          </div>
        </div>
      )}
      {importError && (
        <div className="gql-import-error" role="alert" data-testid="gql-import-error">
          <span>{importError}</span>
          <button type="button" className="gql-import-error-dismiss" aria-label="Dismiss" onClick={() => setImportError(null)}>×</button>
        </div>
      )}
    </div>
  );
}

// ─── Collection node ──────────────────────────────────────────────────────────

interface CollectionNodeProps {
  tree: CollectionTree;
  expandedIds: Set<string>;
  editingId: string | null;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onToggleExpand: (id: string) => void;
  onBeginRename: (key: string, name: string) => void;
  onCommitRename: (type: 'collection' | 'folder' | 'item', id: string) => void;
  onContextMenu: (e: React.MouseEvent, menu: ContextMenuState) => void;
  onRunItem: (item: GraphqlCollectionItem) => void;
  onRunAll: (colId: string, folderId?: string) => void;
  onLoadItem: (item: GraphqlCollectionItem) => void;
  onSaveCurrentOperation?: (colId: string, folderId?: string) => void;
  invalidItemIds: Set<string>;
  onDeleteItem: (id: string) => void;
  onAddFolder: (colId: string, parentId?: string) => void;
  onEditItemScripts: (item: GraphqlCollectionItem) => void;
  onEditCollectionScripts: (colId: string, colName: string) => void;
  isVarsOpen: boolean;
  onToggleVars: (colId: string) => void;
  onSaveVars: (colId: string, vars: Record<string, string>) => void;
}

function CollectionNode({
  tree, expandedIds, editingId, editingName, onEditingNameChange,
  onToggleExpand, onBeginRename, onCommitRename, onContextMenu,
  onRunItem, onRunAll, onLoadItem, onSaveCurrentOperation, invalidItemIds,
  onDeleteItem,
  onAddFolder, onEditItemScripts, onEditCollectionScripts, isVarsOpen, onToggleVars, onSaveVars,
}: CollectionNodeProps) {
  const { collection, folders, items } = tree;
  const isExpanded = expandedIds.has(collection.id);
  const isEditingCollection = editingId === `collection:${collection.id}`;
  const rootItems = items.filter((i) => !i.folderId).sort((a, b) => { if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1; return a.sortOrder - b.sortOrder; });

  return (
    <div className="gql-col-node" role="treeitem" aria-expanded={isExpanded} data-testid="gql-col-node">
      <div className="gql-col-node-header" onClick={() => onToggleExpand(collection.id)} onContextMenu={(e) => onContextMenu(e, { type: 'collection', id: collection.id, name: collection.name, x: e.clientX, y: e.clientY })}>
        <ChevronIcon expanded={isExpanded} />
        {isEditingCollection ? (
          <input autoFocus className="gql-col-inline-rename" value={editingName} onChange={(e) => onEditingNameChange(e.target.value)} onBlur={() => onCommitRename('collection', collection.id)} onKeyDown={(e) => { if (e.key === 'Enter') onCommitRename('collection', collection.id); if (e.key === 'Escape') onBeginRename('', ''); }} onClick={(e) => e.stopPropagation()} data-testid="gql-col-rename-input" />
        ) : (
          <span className="gql-col-name" onDoubleClick={(e) => { e.stopPropagation(); onBeginRename(`collection:${collection.id}`, collection.name); }}>{collection.name}</span>
        )}
        <span className="gql-col-item-count">{items.length}</span>
        <button type="button" className="gql-col-run-all-btn" title="Run All" onClick={(e) => { e.stopPropagation(); onRunAll(collection.id); }} aria-label={`Run all items in ${collection.name}`} data-testid="gql-col-run-all">▶</button>
        <button type="button" className={`gql-col-script-btn${(collection.preRequestScript || collection.postResponseScript) ? ' gql-col-script-btn--active' : ''}`} title="Edit collection-level scripts" onClick={(e) => { e.stopPropagation(); onEditCollectionScripts(collection.id, collection.name); }} aria-label={`Edit scripts for ${collection.name}`} data-testid="gql-col-scripts-btn">{'{…}'}</button>
        <button type="button" className={`gql-col-vars-btn${isVarsOpen ? ' gql-col-vars-btn--active' : ''}${Object.keys(collection.variables).length > 0 ? ' gql-col-vars-btn--has-vars' : ''}`} title="Collection variables" onClick={(e) => { e.stopPropagation(); onToggleVars(collection.id); }} aria-label={`Edit variables for ${collection.name}`} aria-expanded={isVarsOpen} data-testid="gql-col-vars-btn">$</button>
        {onSaveCurrentOperation && (
          <button type="button" className="gql-col-save-btn" title="Save current operation here" onClick={(e) => { e.stopPropagation(); onSaveCurrentOperation(collection.id, undefined); }} aria-label="Save current operation to this collection" data-testid="gql-col-save-current">+</button>
        )}
      </div>

      {isVarsOpen && <CollectionVarsEditor collection={collection} onSave={(vars) => onSaveVars(collection.id, vars)} />}

      {isExpanded && (
        <div className="gql-col-children">
          {rootItems.map((item) => (
            <CollectionItemRow key={item.id} item={item} depth={1} isInvalid={invalidItemIds.has(item.id)} onRun={() => onRunItem(item)} onLoad={() => onLoadItem(item)} onDelete={() => onDeleteItem(item.id)} onEditScripts={() => onEditItemScripts(item)} onContextMenu={(e) => onContextMenu(e, { type: 'item', id: item.id, name: item.name, x: e.clientX, y: e.clientY })} editingId={editingId} editingName={editingName} onEditingNameChange={onEditingNameChange} onCommitRename={onCommitRename} />
          ))}
          {folders.filter((f) => !f.parentId).sort((a, b) => a.sortOrder - b.sortOrder).map((folder) => (
            <FolderNode key={folder.id} folder={folder} allFolders={folders} items={items} expandedIds={expandedIds} editingId={editingId} editingName={editingName} onEditingNameChange={onEditingNameChange} onToggleExpand={onToggleExpand} onBeginRename={onBeginRename} onCommitRename={onCommitRename} onContextMenu={onContextMenu} onRunItem={onRunItem} onRunAll={(folderId) => onRunAll(collection.id, folderId)} onLoadItem={onLoadItem} invalidItemIds={invalidItemIds} onDeleteItem={onDeleteItem} onEditItemScripts={onEditItemScripts} depth={1} />
          ))}
          <button type="button" className="gql-col-add-folder-btn" onClick={() => onAddFolder(collection.id)} data-testid="gql-col-add-folder">+ New Folder</button>
        </div>
      )}
    </div>
  );
}

// ─── Folder node ──────────────────────────────────────────────────────────────

interface FolderNodeProps {
  folder: GraphqlCollectionFolder;
  allFolders: GraphqlCollectionFolder[];
  items: GraphqlCollectionItem[];
  expandedIds: Set<string>;
  editingId: string | null;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onToggleExpand: (id: string) => void;
  onBeginRename: (key: string, name: string) => void;
  onCommitRename: (type: 'collection' | 'folder' | 'item', id: string) => void;
  onContextMenu: (e: React.MouseEvent, menu: ContextMenuState) => void;
  onRunItem: (item: GraphqlCollectionItem) => void;
  onRunAll: (folderId: string) => void;
  onLoadItem: (item: GraphqlCollectionItem) => void;
  invalidItemIds: Set<string>;
  onDeleteItem: (id: string) => void;
  onEditItemScripts: (item: GraphqlCollectionItem) => void;
  depth: number;
}

function FolderNode({
  folder, allFolders, items, expandedIds, editingId, editingName,
  onEditingNameChange, onToggleExpand, onBeginRename, onCommitRename,
  onContextMenu, onRunItem, onRunAll, onLoadItem, invalidItemIds,
  onDeleteItem, onEditItemScripts, depth,
}: FolderNodeProps) {
  const isExpanded = expandedIds.has(folder.id);
  const isEditingFolder = editingId === `folder:${folder.id}`;
  const folderItems = items.filter((i) => i.folderId === folder.id).sort((a, b) => { if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1; return a.sortOrder - b.sortOrder; });
  const subFolders = allFolders.filter((f) => f.parentId === folder.id).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="gql-folder-node" style={{ '--gql-depth': depth } as React.CSSProperties} role="treeitem" aria-expanded={isExpanded}>
      <div className="gql-folder-node-header" onClick={() => onToggleExpand(folder.id)} onContextMenu={(e) => onContextMenu(e, { type: 'folder', id: folder.id, name: folder.name, x: e.clientX, y: e.clientY })}>
        <ChevronIcon expanded={isExpanded} />
        {isEditingFolder ? (
          <input autoFocus className="gql-col-inline-rename" value={editingName} onChange={(e) => onEditingNameChange(e.target.value)} onBlur={() => onCommitRename('folder', folder.id)} onKeyDown={(e) => { if (e.key === 'Enter') onCommitRename('folder', folder.id); }} onClick={(e) => e.stopPropagation()} />
        ) : (
          <span className="gql-folder-name" onDoubleClick={(e) => { e.stopPropagation(); onBeginRename(`folder:${folder.id}`, folder.name); }}>{folder.name}</span>
        )}
        <button type="button" className="gql-col-run-all-btn" title="Run All in folder" onClick={(e) => { e.stopPropagation(); onRunAll(folder.id); }} aria-label={`Run all items in ${folder.name}`}>▶</button>
      </div>
      {isExpanded && (
        <div className="gql-folder-children">
          {folderItems.map((item) => (
            <CollectionItemRow key={item.id} item={item} depth={depth + 1} isInvalid={invalidItemIds.has(item.id)} onRun={() => onRunItem(item)} onLoad={() => onLoadItem(item)} onDelete={() => onDeleteItem(item.id)} onEditScripts={() => onEditItemScripts(item)} onContextMenu={(e) => onContextMenu(e, { type: 'item', id: item.id, name: item.name, x: e.clientX, y: e.clientY })} editingId={editingId} editingName={editingName} onEditingNameChange={onEditingNameChange} onCommitRename={onCommitRename} />
          ))}
          {subFolders.map((sub) => (
            <FolderNode key={sub.id} folder={sub} allFolders={allFolders} items={items} expandedIds={expandedIds} editingId={editingId} editingName={editingName} onEditingNameChange={onEditingNameChange} onToggleExpand={onToggleExpand} onBeginRename={onBeginRename} onCommitRename={onCommitRename} onContextMenu={onContextMenu} onRunItem={onRunItem} onRunAll={onRunAll} onLoadItem={onLoadItem} invalidItemIds={invalidItemIds} onDeleteItem={onDeleteItem} onEditItemScripts={onEditItemScripts} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
