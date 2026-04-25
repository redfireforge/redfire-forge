import { useState, useMemo, useRef, useCallback } from 'react';
import type { RequestCollection, RequestFolder, RequestItem } from '../../types';
import type { CatalogEntry, CatalogFolder } from '../../types/catalog';
import type { WorkflowNodeType } from '../../types/workflow';
import { NodeIcon } from './nodes/NodeIcon';

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#ef4444',
};

function countRequests(col: RequestCollection): number {
  let n = col.requests.length;
  const walk = (folders?: RequestFolder[]) => { if (!folders) return; for (const f of folders) { n += f.requests.length; walk(f.folders); } };
  walk(col.folders);
  return n;
}

interface BlockDef {
  type: WorkflowNodeType;
  title: string;
  desc: string;
  category: string;
}

const ALL_BLOCKS: BlockDef[] = [
  { type: 'start', title: 'Manual Start', desc: 'Workflow entry point', category: 'triggers' },
  { type: 'webhook', title: 'Webhook Trigger', desc: 'Incoming HTTP request', category: 'triggers' },
  { type: 'schedule', title: 'Schedule Trigger', desc: 'Cron-based execution', category: 'triggers' },
  { type: 'http', title: 'HTTP Request', desc: 'API call with extraction', category: 'actions' },
  { type: 'delay', title: 'Delay', desc: 'Pause between steps', category: 'actions' },
  { type: 'condition', title: 'Condition', desc: 'If/Else branching', category: 'logic' },
  { type: 'switch', title: 'Switch', desc: 'Multi-way branching', category: 'logic' },
  { type: 'loop', title: 'Loop', desc: 'Repeat / For-Each / While', category: 'logic' },
  { type: 'setVariable', title: 'Set Variable', desc: 'Assign or transform variables', category: 'data' },
  { type: 'aggregate', title: 'Aggregate', desc: 'Combine parallel results', category: 'data' },
  { type: 'errorHandler', title: 'Error Handler', desc: 'Retry and catch errors', category: 'flow' },
  { type: 'logDebug', title: 'Log/Debug', desc: 'Log messages and variable snapshots', category: 'data' },
  { type: 'waitForCondition', title: 'Wait for Condition', desc: 'Poll until condition met', category: 'logic' },
  { type: 'fork', title: 'Parallel Fork', desc: 'Concurrent branches', category: 'flow' },
  { type: 'join', title: 'Join', desc: 'Wait for all branches', category: 'flow' },
  { type: 'end', title: 'End', desc: 'Workflow termination', category: 'flow' },
];

const CATEGORIES = [
  { id: 'triggers', label: 'Triggers' },
  { id: 'actions', label: 'Actions' },
  { id: 'logic', label: 'Logic' },
  { id: 'data', label: 'Data' },
  { id: 'flow', label: 'Flow' },
];

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark className="wf-palette-match">{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}

interface Props {
  collections: RequestCollection[];
  catalogEntries: CatalogEntry[];
  onAddNode: (type: WorkflowNodeType) => void;
  onAddFromRequest: (collectionId: string, requestId: string) => void;
  onAddFromCatalog: (entryId: string, endpointId: string) => void;
}

export default function WorkflowPalette({ collections, catalogEntries, onAddNode, onAddFromRequest, onAddFromCatalog }: Props) {
  const [section, setSection] = useState<'blocks' | 'requests' | 'catalog'>('blocks');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['triggers', 'actions', 'logic', 'data', 'flow', 'parallel']));
  const [searchQuery, setSearchQuery] = useState('');
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  const filteredBlocks = useMemo(() => {
    if (!searchQuery.trim()) return ALL_BLOCKS;
    const q = searchQuery.trim().toLowerCase();
    return ALL_BLOCKS.filter(b => b.title.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q));
  }, [searchQuery]);

  const handleBlockDragStart = useCallback((e: React.DragEvent, block: BlockDef) => {
    e.dataTransfer.setData('application/reactflow-type', block.type);
    e.dataTransfer.effectAllowed = 'move';
    // Create styled drag ghost
    const ghost = document.createElement('div');
    ghost.className = 'wf-drag-ghost';
    ghost.innerHTML = `<span class="wf-drag-ghost-label">${block.title}</span>`;
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    e.dataTransfer.setDragImage(ghost, 40, 20);
    // Clean up after drag ends
    setTimeout(() => {
      if (dragGhostRef.current) {
        document.body.removeChild(dragGhostRef.current);
        dragGhostRef.current = null;
      }
    }, 0);
  }, []);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev); if (next.has(id)) { next.delete(id); } else { next.add(id); } return next;
  });

  return (
    <div className="wf-palette">
      <div className="wf-palette-tabs">
        <button className={`wf-palette-tab ${section === 'blocks' ? 'active' : ''}`} onClick={() => setSection('blocks')}>Blocks</button>
        <button className={`wf-palette-tab ${section === 'requests' ? 'active' : ''}`} onClick={() => setSection('requests')}>Requests</button>
        <button className={`wf-palette-tab ${section === 'catalog' ? 'active' : ''}`} onClick={() => setSection('catalog')}>Catalog</button>
      </div>

      <div className="wf-palette-content">
        {section === 'blocks' && (
          <div className="wf-palette-blocks">
            <div className="wf-palette-search-wrap">
              <svg className="wf-palette-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                className="wf-palette-search"
                type="text"
                placeholder="Search blocks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {CATEGORIES.map(cat => {
              const blocks = filteredBlocks.filter(b => b.category === cat.id);
              if (blocks.length === 0) return null;
              const isOpen = searchQuery.trim() || expanded.has(cat.id);
              return (
                <div key={cat.id}>
                  <button className="wf-palette-category-header" onClick={() => toggle(cat.id)}>
                    <span className="wf-palette-caret">{isOpen ? '▾' : '▸'}</span>
                    <span className="wf-palette-category-title">{cat.label}</span>
                    <span className="wf-palette-count">{blocks.length}</span>
                  </button>
                  {isOpen && blocks.map(block => (
                    <button
                      key={block.type}
                      className={`wf-palette-block wf-palette-block-${block.type}`}
                      onClick={() => onAddNode(block.type)}
                      draggable
                      onDragStart={(e) => handleBlockDragStart(e, block)}
                    >
                      <NodeIcon type={block.type} />
                      <div>
                        <div className="wf-pb-title">{highlightMatch(block.title, searchQuery.trim())}</div>
                        <div className="wf-pb-desc">{highlightMatch(block.desc, searchQuery.trim())}</div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
            {filteredBlocks.length === 0 && searchQuery.trim() && (
              <div className="wf-palette-no-results">No blocks matching &ldquo;{searchQuery.trim()}&rdquo;</div>
            )}
          </div>
        )}

        {section === 'requests' && (
          <div className="wf-palette-tree">
            {collections.length === 0 && <p className="wf-palette-empty">No request collections</p>}
            {collections.map(col => (
              <div key={col.id} className="wf-palette-group">
                <button className="wf-palette-group-header" onClick={() => toggle(col.id)}>
                  <span className="wf-palette-caret">{expanded.has(col.id) ? '▾' : '▸'}</span>
                  {col.name}
                  <span className="wf-palette-count">{countRequests(col)}</span>
                </button>
                {expanded.has(col.id) && (
                  <div className="wf-palette-children">
                    <RequestItemList requests={col.requests} collectionId={col.id} onAdd={onAddFromRequest} />
                    <FolderTree folders={col.folders} collectionId={col.id} depth={1} expanded={expanded} onToggle={toggle} onAdd={onAddFromRequest} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {section === 'catalog' && (
          <div className="wf-palette-tree">
            {catalogEntries.length === 0 && <p className="wf-palette-empty">No catalog entries</p>}
            {catalogEntries.map(entry => (
              <div key={entry.id} className="wf-palette-group">
                <button className="wf-palette-group-header" onClick={() => toggle(entry.id)}>
                  <span className="wf-palette-caret">{expanded.has(entry.id) ? '▾' : '▸'}</span>
                  {entry.name}
                  <span className="wf-palette-count">{entry.endpoints.length}</span>
                </button>
                {expanded.has(entry.id) && (
                  <div className="wf-palette-children">
                    <CatalogFolderTree
                      folders={entry.folders}
                      endpoints={entry.endpoints}
                      entryId={entry.id}
                      expanded={expanded}
                      onToggle={toggle}
                      onAdd={onAddFromCatalog}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}


      </div>

      <div className="wf-palette-hint" role="note">
        <span className="wf-palette-hint-title">Connections</span>
        <p>
          Click an edge to select it, then press <kbd className="wf-kbd">Delete</kbd> or{' '}
          <kbd className="wf-kbd">Backspace</kbd> to remove. Drag an edge endpoint to reconnect it to another handle.
        </p>
      </div>
    </div>
  );
}

// ── Recursive folder tree for REQUESTS ─────────────────

function FolderTree({ folders, collectionId, depth, expanded, onToggle, onAdd }: {
  folders?: RequestFolder[];
  collectionId: string;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAdd: (collectionId: string, requestId: string) => void;
}) {
  if (!folders || folders.length === 0) return null;
  return (
    <>
      {folders.map(folder => {
        const reqCount = folder.requests.length;
        const hasChildren = reqCount > 0 || (folder.folders?.length ?? 0) > 0;
        return (
          <div key={folder.id} className="wf-palette-folder">
            <button
              className="wf-palette-folder-header"
              style={{ paddingLeft: depth * 12 + 8 }}
              onClick={() => onToggle(folder.id)}
            >
              <span className="wf-palette-caret">{expanded.has(folder.id) ? '▾' : '▸'}</span>
              <span className="wf-palette-folder-icon">{folder.isSubCollection ? '◫' : '▤'}</span>
              <span className="wf-palette-folder-name">{folder.name}</span>
              {hasChildren && <span className="wf-palette-count">{reqCount}</span>}
            </button>
            {expanded.has(folder.id) && (
              <>
                <RequestItemList requests={folder.requests} collectionId={collectionId} onAdd={onAdd} depth={depth + 1} />
                <FolderTree folders={folder.folders} collectionId={collectionId} depth={depth + 1} expanded={expanded} onToggle={onToggle} onAdd={onAdd} />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

function RequestItemList({ requests, collectionId, onAdd, depth = 1 }: {
  requests: RequestItem[];
  collectionId: string;
  onAdd: (collectionId: string, requestId: string) => void;
  depth?: number;
}) {
  if (requests.length === 0) return null;
  return (
    <>
      {requests.map(req => (
        <button
          key={req.id}
          className="wf-palette-item"
          style={{ paddingLeft: depth * 12 + 16 }}
          onClick={() => onAdd(collectionId, req.id)}
          title={`${req.method} ${req.url}`}
        >
          <span className="wf-method-mini" style={{ color: METHOD_COLORS[req.method] ?? '#6b7280' }}>
            {req.method}
          </span>
          <span className="wf-palette-item-name">{req.name}</span>
        </button>
      ))}
    </>
  );
}

// ── Catalog folder tree ────────────────────────────────

function CatalogFolderTree({ folders, endpoints, entryId, expanded, onToggle, onAdd }: {
  folders: CatalogFolder[];
  endpoints: CatalogEntry['endpoints'];
  entryId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAdd: (entryId: string, endpointId: string) => void;
}) {
  if (folders.length === 0) {
    return (
      <>
        {endpoints.map(ep => (
          <button key={ep.id} className="wf-palette-item" onClick={() => onAdd(entryId, ep.id)} title={`${ep.method.toUpperCase()} ${ep.path}`}>
            <span className="wf-method-mini" style={{ color: METHOD_COLORS[ep.method.toUpperCase()] ?? '#6b7280' }}>{ep.method.toUpperCase()}</span>
            <span className="wf-palette-item-name">{ep.summary || ep.path}</span>
          </button>
        ))}
      </>
    );
  }

  const folderEndpoints = new Map<string, typeof endpoints>();
  const rootEndpoints: typeof endpoints = [];
  for (const ep of endpoints) {
    const folderId = (ep as unknown as Record<string, string>).folderId;
    if (folderId) {
      const list = folderEndpoints.get(folderId) ?? [];
      list.push(ep);
      folderEndpoints.set(folderId, list);
    } else {
      rootEndpoints.push(ep);
    }
  }

  return (
    <>
      {folders.map(folder => {
        const folderEps = folderEndpoints.get(folder.id) ?? [];
        return (
          <div key={folder.id} className="wf-palette-folder">
            <button className="wf-palette-folder-header" style={{ paddingLeft: 20 }} onClick={() => onToggle(folder.id)}>
              <span className="wf-palette-caret">{expanded.has(folder.id) ? '▾' : '▸'}</span>
              <span className="wf-palette-folder-icon">▤</span>
              <span className="wf-palette-folder-name">{folder.name}</span>
              {folderEps.length > 0 && <span className="wf-palette-count">{folderEps.length}</span>}
            </button>
            {expanded.has(folder.id) && folderEps.map(ep => (
              <button key={ep.id} className="wf-palette-item" style={{ paddingLeft: 32 }} onClick={() => onAdd(entryId, ep.id)} title={`${ep.method.toUpperCase()} ${ep.path}`}>
                <span className="wf-method-mini" style={{ color: METHOD_COLORS[ep.method.toUpperCase()] ?? '#6b7280' }}>{ep.method.toUpperCase()}</span>
                <span className="wf-palette-item-name">{ep.summary || ep.path}</span>
              </button>
            ))}
          </div>
        );
      })}
      {rootEndpoints.map(ep => (
        <button key={ep.id} className="wf-palette-item" onClick={() => onAdd(entryId, ep.id)} title={`${ep.method.toUpperCase()} ${ep.path}`}>
          <span className="wf-method-mini" style={{ color: METHOD_COLORS[ep.method.toUpperCase()] ?? '#6b7280' }}>{ep.method.toUpperCase()}</span>
          <span className="wf-palette-item-name">{ep.summary || ep.path}</span>
        </button>
      ))}
    </>
  );
}
