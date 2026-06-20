import { useState, useMemo, useRef, useCallback } from 'react';
import type { RequestCollection, RequestFolder, RequestItem } from '../../../../shared/types';
import type { CatalogEntry, CatalogFolder } from '../../../catalog/types/catalog';
import type { WorkflowNodeType } from '../../types/workflow';
import { NodeIcon } from '../nodes/NodeIcon';
import { highlightSearchMatch } from '../../../../shared/utils/consoleLogUtils';

import { WORKFLOW_METHOD_COLORS as METHOD_COLORS } from '../../../../shared/constants/httpMethodColors';

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
  { type: 'kafkaProduce', title: 'Kafka Produce', desc: 'Publish a message to Kafka', category: 'actions' },
  { type: 'kafkaConsume', title: 'Kafka Consume', desc: 'Read messages from Kafka', category: 'actions' },
  { type: 'kafkaTrigger', title: 'Kafka Trigger', desc: 'Start workflow from a Kafka message', category: 'triggers' },
  { type: 'kafkaWait', title: 'Kafka Wait', desc: 'Pause workflow until a correlated Kafka message arrives', category: 'actions' },
  { type: 'wsConnect', title: 'WS Connect', desc: 'Open a WebSocket connection', category: 'actions' },
  { type: 'wsSend', title: 'WS Send', desc: 'Send a message on a WebSocket connection', category: 'actions' },
  { type: 'wsReceive', title: 'WS Receive', desc: 'Wait for a matching WebSocket message', category: 'actions' },
  { type: 'wsTrigger', title: 'WS Trigger', desc: 'Start workflow from a WebSocket message', category: 'triggers' },
  { type: 'graphqlQuery', title: 'GraphQL Query', desc: 'Execute a GraphQL query', category: 'actions' },
  { type: 'graphqlMutation', title: 'GraphQL Mutation', desc: 'Execute a GraphQL mutation', category: 'actions' },
  { type: 'graphqlSubscription', title: 'GraphQL Subscription', desc: 'Subscribe to a GraphQL event stream', category: 'actions' },
  { type: 'graphqlIntrospect', title: 'GraphQL Introspect', desc: 'Introspect a GraphQL schema', category: 'actions' },
  { type: 'graphqlAssert', title: 'GraphQL Assert', desc: 'Assert GraphQL response values', category: 'logic' },
  { type: 'delay', title: 'Delay', desc: 'Pause between steps', category: 'actions' },
  { type: 'condition', title: 'Condition', desc: 'If/Else branching', category: 'logic' },
  { type: 'switch', title: 'Switch', desc: 'Multi-way branching', category: 'logic' },
  { type: 'loop', title: 'Loop', desc: 'Repeat / For-Each / While', category: 'logic' },
  { type: 'setVariable', title: 'Set Variable', desc: 'Assign or transform variables', category: 'data' },
  { type: 'aggregate', title: 'Aggregate', desc: 'Combine parallel results', category: 'data' },
  { type: 'errorHandler', title: 'Error Handler', desc: 'Retry and catch errors', category: 'flow' },
  { type: 'subWorkflow', title: 'Sub-Workflow', desc: 'Execute another workflow', category: 'flow' },
  { type: 'logDebug', title: 'Log/Debug', desc: 'Log messages and variable snapshots', category: 'data' },
  { type: 'script', title: 'Script', desc: 'Custom JavaScript data transformation', category: 'data' },
  { type: 'waitForCondition', title: 'Wait for Condition', desc: 'Poll until condition met', category: 'logic' },
  { type: 'correlationWait', title: 'Correlation Wait', desc: 'Pause and wait for webhook callback', category: 'actions' },
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
  return highlightSearchMatch(text, query, 'wf-palette-match');
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

  const q = searchQuery.trim().toLowerCase();

  const filteredBlocks = useMemo(() => {
    if (!q) return ALL_BLOCKS;
    return ALL_BLOCKS.filter(b => b.title.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q));
  }, [q]);

  const filteredCollections = useMemo(() => {
    if (!q) return collections;
    return collections.map(col => {
      const matchRequests = (reqs: RequestItem[]) => reqs.filter(r => r.name.toLowerCase().includes(q) || r.method.toLowerCase().includes(q) || r.url?.toLowerCase().includes(q));
      const matchFolders = (folders?: RequestFolder[]): RequestFolder[] | undefined => {
        if (!folders) return undefined;
        return folders.map(f => ({
          ...f,
          requests: matchRequests(f.requests),
          folders: matchFolders(f.folders),
        })).filter(f => f.requests.length > 0 || (f.folders?.some(sf => sf.requests.length > 0 || (sf.folders?.length ?? 0) > 0) ?? false));
      };
      return { ...col, requests: matchRequests(col.requests), folders: matchFolders(col.folders) ?? [] };
    }).filter(col => col.requests.length > 0 || col.folders.length > 0);
  }, [q, collections]);

  const filteredCatalog = useMemo(() => {
    const filterExposed = (ep: CatalogEntry['endpoints'][number]) => !!ep.exposedToWorkflow;
    const filterFolder = (folder: CatalogFolder): CatalogFolder => ({
      ...folder,
      endpoints: folder.endpoints.filter(filterExposed),
      folders: folder.folders.map(filterFolder).filter(f => f.endpoints.length > 0 || f.folders.length > 0),
    });
    const exposed = catalogEntries.map(entry => ({
      ...entry,
      endpoints: entry.endpoints.filter(filterExposed),
      folders: entry.folders.map(filterFolder).filter(f => f.endpoints.length > 0 || f.folders.length > 0),
    })).filter(entry => entry.endpoints.length > 0 || entry.folders.length > 0);

    if (!q) return exposed;
    const folderHasMatch = (folder: CatalogFolder): boolean =>
      folder.endpoints.some(ep => matchesSearch(ep, q)) || folder.folders.some(folderHasMatch);
    return exposed.filter(entry =>
      entry.endpoints.some(ep => matchesSearch(ep, q)) || entry.folders.some(folderHasMatch),
    );
  }, [q, catalogEntries]);

  const handleBlockDragStart = useCallback((e: React.DragEvent, block: BlockDef) => {
    e.dataTransfer.setData('application/reactflow-type', block.type);
    e.dataTransfer.setData('text/x-reactflow-type', block.type);
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
  }, []);

  const handleBlockDragEnd = useCallback(() => {
    if (dragGhostRef.current) {
      document.body.removeChild(dragGhostRef.current);
      dragGhostRef.current = null;
    }
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

      <div className="wf-palette-search-wrap">
        <svg className="wf-palette-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          className="wf-palette-search"
          type="text"
          placeholder={section === 'blocks' ? 'Search blocks…' : section === 'requests' ? 'Search requests…' : 'Search catalog…'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button type="button" className="wf-palette-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">&times;</button>
        )}
      </div>
      <div className="wf-palette-content">
        {section === 'blocks' && (
          <div className="wf-palette-blocks">
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
                    <div
                      key={block.type}
                      role="button"
                      tabIndex={0}
                      className={`wf-palette-block wf-palette-block-${block.type}`}
                      onClick={() => onAddNode(block.type)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAddNode(block.type); } }}
                      draggable
                      onDragStart={(e) => handleBlockDragStart(e, block)}
                      onDragEnd={handleBlockDragEnd}
                    >
                      <NodeIcon type={block.type} />
                      <div>
                        <div className="wf-pb-title">{highlightMatch(block.title, searchQuery.trim())}</div>
                        <div className="wf-pb-desc">{highlightMatch(block.desc, searchQuery.trim())}</div>
                      </div>
                    </div>
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
            {filteredCollections.length === 0 && <p className="wf-palette-empty">{q ? `No requests matching "${searchQuery.trim()}"` : 'No request collections'}</p>}
            {filteredCollections.map(col => (
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
            {filteredCatalog.length === 0 && <p className="wf-palette-empty">{q ? `No exposed endpoints matching "${searchQuery.trim()}"` : 'No endpoints exposed to Workflow. Use the "Expose to Workflow" checkbox on the Catalog page.'}</p>}
            {filteredCatalog.map(entry => {
              const totalEpCount = countCatalogEndpoints(entry);
              return (
                <div key={entry.id} className="wf-palette-group">
                  <button className="wf-palette-group-header" onClick={() => toggle(entry.id)}>
                    <span className="wf-palette-caret">{expanded.has(entry.id) ? '▾' : '▸'}</span>
                    {entry.name}
                    <span className="wf-palette-count">{totalEpCount}</span>
                  </button>
                  {expanded.has(entry.id) && (
                    <div className="wf-palette-children">
                      <CatalogFolderTree
                        folders={entry.folders}
                        rootEndpoints={entry.endpoints}
                        entryId={entry.id}
                        expanded={expanded}
                        onToggle={toggle}
                        onAdd={onAddFromCatalog}
                        searchQuery={searchQuery.trim()}
                      />
                    </div>
                  )}
                </div>
              );
            })}
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

// ── Catalog helpers ────────────────────────────────────

function countCatalogEndpoints(entry: CatalogEntry): number {
  let n = entry.endpoints.length;
  const walk = (folders: CatalogFolder[]) => {
    for (const f of folders) { n += f.endpoints.length; walk(f.folders); }
  };
  walk(entry.folders);
  return n;
}

function countFolderEndpoints(folder: CatalogFolder): number {
  let n = folder.endpoints.length;
  const walk = (folders: CatalogFolder[]) => {
    for (const f of folders) { n += f.endpoints.length; walk(f.folders); }
  };
  walk(folder.folders);
  return n;
}

function matchesSearch(ep: CatalogEntry['endpoints'][number], q: string): boolean {
  if (!q) return true;
  return (ep.summary || '').toLowerCase().includes(q) || ep.path.toLowerCase().includes(q) || ep.method.toLowerCase().includes(q);
}

// ── Catalog folder tree ────────────────────────────────

function CatalogFolderTree({ folders, rootEndpoints, entryId, expanded, onToggle, onAdd, depth = 1, searchQuery = '' }: {
  folders: CatalogFolder[];
  rootEndpoints: CatalogEntry['endpoints'];
  entryId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAdd: (entryId: string, endpointId: string) => void;
  depth?: number;
  searchQuery?: string;
}) {
  const q = searchQuery.toLowerCase();
  return (
    <>
      {folders.map(folder => {
        const epCount = countFolderEndpoints(folder);
        if (epCount === 0 && q) return null;
        const isOpen = !!q || expanded.has(folder.id);
        const filteredEps = q ? folder.endpoints.filter(ep => matchesSearch(ep, q)) : folder.endpoints;
        return (
          <div key={folder.id} className="wf-palette-folder">
            <button className="wf-palette-folder-header" style={{ paddingLeft: depth * 12 + 8 }} onClick={() => onToggle(folder.id)}>
              <span className="wf-palette-caret">{isOpen ? '▾' : '▸'}</span>
              <span className="wf-palette-folder-icon">▤</span>
              <span className="wf-palette-folder-name">{folder.name}</span>
              {epCount > 0 && <span className="wf-palette-count">{epCount}</span>}
            </button>
            {isOpen && (
              <>
                {filteredEps.map(ep => (
                  <button key={ep.id} className="wf-palette-item" style={{ paddingLeft: depth * 12 + 24 }} onClick={() => onAdd(entryId, ep.id)} title={`${ep.method.toUpperCase()} ${ep.path}`}>
                    <span className="wf-method-mini" style={{ color: METHOD_COLORS[ep.method.toUpperCase()] ?? '#6b7280' }}>{ep.method.toUpperCase()}</span>
                    <span className="wf-palette-item-name">{ep.summary || ep.path}</span>
                  </button>
                ))}
                {folder.folders.length > 0 && (
                  <CatalogFolderTree
                    folders={folder.folders}
                    rootEndpoints={[]}
                    entryId={entryId}
                    expanded={expanded}
                    onToggle={onToggle}
                    onAdd={onAdd}
                    depth={depth + 1}
                    searchQuery={searchQuery}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
      {rootEndpoints
        .filter(ep => matchesSearch(ep, q))
        .map(ep => (
          <button key={ep.id} className="wf-palette-item" style={{ paddingLeft: depth * 12 + 16 }} onClick={() => onAdd(entryId, ep.id)} title={`${ep.method.toUpperCase()} ${ep.path}`}>
            <span className="wf-method-mini" style={{ color: METHOD_COLORS[ep.method.toUpperCase()] ?? '#6b7280' }}>{ep.method.toUpperCase()}</span>
            <span className="wf-palette-item-name">{ep.summary || ep.path}</span>
          </button>
        ))}
    </>
  );
}
