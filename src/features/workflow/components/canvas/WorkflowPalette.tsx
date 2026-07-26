import { useState, useMemo, useRef, useCallback } from 'react';
import type { RequestCollection, RequestFolder, RequestItem } from '../../../../shared/types';
import type { CatalogEntry, CatalogFolder } from '../../../catalog/types/catalog';
import type { WorkflowNodeType } from '../../types/workflow';
import type { WorkflowPreviewEntry } from '../../../../shared/utils/workflowPreviewStorage';
import { isPublicationStale } from '../../../catalog/utils/publicationDrift';
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
  subGroup?: string;
}

const SUB_GROUP_META: Record<string, { label: string; color: string }> = {
  http:      { label: 'HTTP',      color: 'var(--proto-http)' },
  kafka:     { label: 'Kafka',     color: 'var(--proto-kafka)' },
  websocket: { label: 'WebSocket', color: 'var(--proto-ws)' },
  graphql:   { label: 'GraphQL',   color: 'var(--proto-gql)' },
  grpc:      { label: 'gRPC',      color: 'var(--proto-grpc)' },
};
const SUB_GROUP_ORDER = ['http', 'kafka', 'websocket', 'graphql', 'grpc'];

const ALL_BLOCKS: BlockDef[] = [
  { type: 'start', title: 'Manual Start', desc: 'Workflow entry point', category: 'triggers' },
  { type: 'webhook', title: 'Webhook Trigger', desc: 'Incoming HTTP request', category: 'triggers' },
  { type: 'schedule', title: 'Schedule Trigger', desc: 'Cron-based execution', category: 'triggers' },
  { type: 'http', title: 'HTTP Request', desc: 'API call with extraction', category: 'actions', subGroup: 'http' },
  { type: 'delay', title: 'Delay', desc: 'Pause between steps', category: 'actions', subGroup: 'http' },
  { type: 'correlationWait', title: 'Correlation Wait', desc: 'Pause and wait for webhook callback', category: 'actions', subGroup: 'http' },
  { type: 'kafkaProduce', title: 'Kafka Produce', desc: 'Publish a message to Kafka', category: 'actions', subGroup: 'kafka' },
  { type: 'kafkaConsume', title: 'Kafka Consume', desc: 'Read messages from Kafka', category: 'actions', subGroup: 'kafka' },
  { type: 'kafkaTrigger', title: 'Kafka Trigger', desc: 'Start workflow from a Kafka message', category: 'triggers' },
  { type: 'kafkaWait', title: 'Kafka Wait', desc: 'Pause workflow until a correlated Kafka message arrives', category: 'actions', subGroup: 'kafka' },
  { type: 'wsConnect', title: 'WS Connect', desc: 'Open a WebSocket connection', category: 'actions', subGroup: 'websocket' },
  { type: 'wsSend', title: 'WS Send', desc: 'Send a message on a WebSocket connection', category: 'actions', subGroup: 'websocket' },
  { type: 'wsReceive', title: 'WS Receive', desc: 'Wait for a matching WebSocket message', category: 'actions', subGroup: 'websocket' },
  { type: 'wsTrigger', title: 'WS Trigger', desc: 'Start workflow from a WebSocket message', category: 'triggers' },
  { type: 'graphqlQuery', title: 'GraphQL Query', desc: 'Execute a GraphQL query', category: 'actions', subGroup: 'graphql' },
  { type: 'graphqlMutation', title: 'GraphQL Mutation', desc: 'Execute a GraphQL mutation', category: 'actions', subGroup: 'graphql' },
  { type: 'graphqlSubscription', title: 'GraphQL Subscription', desc: 'Subscribe to a GraphQL event stream', category: 'actions', subGroup: 'graphql' },
  { type: 'graphqlIntrospect', title: 'GraphQL Introspect', desc: 'Introspect a GraphQL schema', category: 'actions', subGroup: 'graphql' },
  { type: 'graphqlAssert', title: 'GraphQL Assert', desc: 'Assert GraphQL response values', category: 'logic' },
  { type: 'grpcUnary', title: 'gRPC Unary', desc: 'Execute a unary gRPC call', category: 'actions', subGroup: 'grpc' },
  { type: 'grpcServerStream', title: 'gRPC Server Stream', desc: 'Execute and collect a server stream', category: 'actions', subGroup: 'grpc' },
  { type: 'grpcAssert', title: 'gRPC Assert', desc: 'Assert an upstream gRPC step result', category: 'logic' },
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
  { type: 'fork', title: 'Parallel Fork', desc: 'Concurrent branches', category: 'flow' },
  { type: 'join', title: 'Join', desc: 'Wait for all branches', category: 'flow' },
  { type: 'end', title: 'End', desc: 'Workflow termination', category: 'flow' },
];

const CATEGORIES: { id: string; label: string; icon: string; color: string }[] = [
  { id: 'triggers', label: 'Triggers', icon: '⚡', color: 'var(--cat-triggers)' },
  { id: 'actions',  label: 'Actions',  icon: '⛭',  color: 'var(--cat-actions)' },
  { id: 'logic',    label: 'Logic',    icon: '⎇',  color: 'var(--cat-logic)' },
  { id: 'data',     label: 'Data',     icon: '▤',  color: 'var(--cat-data)' },
  { id: 'flow',     label: 'Flow',     icon: '⑂',  color: 'var(--cat-flow)' },
];

function highlightMatch(text: string, query: string): React.ReactNode {
  return highlightSearchMatch(text, query, 'wf-palette-match');
}

function PaletteBlock({ block, searchQuery, onAddNode, onDragStart, onDragEnd }: {
  block: BlockDef;
  searchQuery: string;
  onAddNode: (type: WorkflowNodeType) => void;
  onDragStart: (e: React.DragEvent, block: BlockDef) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`wf-palette-block wf-palette-block-${block.type}`}
      onClick={() => onAddNode(block.type)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAddNode(block.type); } }}
      draggable
      onDragStart={(e) => onDragStart(e, block)}
      onDragEnd={onDragEnd}
    >
      <NodeIcon type={block.type} />
      <div>
        <div className="wf-pb-title">{highlightMatch(block.title, searchQuery.trim())}</div>
        <div className="wf-pb-desc">{highlightMatch(block.desc, searchQuery.trim())}</div>
      </div>
    </div>
  );
}

interface Props {
  collections: RequestCollection[];
  catalogEntries: CatalogEntry[];
  previewEndpoints?: WorkflowPreviewEntry[];
  onAddNode: (type: WorkflowNodeType) => void;
  onAddFromRequest: (collectionId: string, requestId: string) => void;
  onAddFromCatalog: (entryId: string, endpointId: string) => void;
}

export default function WorkflowPalette({ collections, catalogEntries, previewEndpoints, onAddNode, onAddFromRequest, onAddFromCatalog }: Props) {
  const [section, setSection] = useState<'blocks' | 'requests' | 'catalog'>('blocks');
  const [activeCategory, setActiveCategory] = useState('triggers');
  const [activeProtocol, setActiveProtocol] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set([
    'triggers', 'actions', 'logic', 'data', 'flow', 'parallel',
    '__pub_section', '__preview_section',
    ...SUB_GROUP_ORDER.map(sg => `__sg_${sg}`),
  ]));
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
    const filterPublished = (ep: CatalogEntry['endpoints'][number]) => !!(ep.workflowPublication || ep.workflowExposure === 'published');
    const filterFolder = (folder: CatalogFolder): CatalogFolder => ({
      ...folder,
      endpoints: folder.endpoints.filter(filterPublished),
      folders: folder.folders.map(filterFolder).filter(f => f.endpoints.length > 0 || f.folders.length > 0),
    });
    const published = catalogEntries.map(entry => ({
      ...entry,
      endpoints: entry.endpoints.filter(filterPublished),
      folders: entry.folders.map(filterFolder).filter(f => f.endpoints.length > 0 || f.folders.length > 0),
    })).filter(entry => entry.endpoints.length > 0 || entry.folders.length > 0);

    if (!q) return published;
    const folderHasMatch = (folder: CatalogFolder): boolean =>
      folder.endpoints.some(ep => matchesSearch(ep, q)) || folder.folders.some(folderHasMatch);
    return published.filter(entry =>
      entry.endpoints.some(ep => matchesSearch(ep, q)) || entry.folders.some(folderHasMatch),
    );
  }, [q, catalogEntries]);

  const filteredPreviews = useMemo(() => {
    if (!previewEndpoints?.length) return [];
    if (!q) return previewEndpoints;
    return previewEndpoints.filter(p =>
      p.summary.toLowerCase().includes(q) || p.path.toLowerCase().includes(q) ||
      p.method.toLowerCase().includes(q) || p.entryName.toLowerCase().includes(q),
    );
  }, [q, previewEndpoints]);

  const handleBlockDragStart = useCallback((e: React.DragEvent, block: BlockDef) => {
    e.dataTransfer.setData('application/reactflow-type', block.type);
    e.dataTransfer.setData('text/x-reactflow-type', block.type);
    e.dataTransfer.effectAllowed = 'move';
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

  const handleRailClick = (catId: string) => {
    setActiveCategory(catId);
    setActiveProtocol('all');
    setSearchQuery('');
  };

  const categoryBlocks = useMemo(() => {
    return ALL_BLOCKS.filter(b => b.category === activeCategory);
  }, [activeCategory]);

  const availableProtocols = useMemo(() => {
    return SUB_GROUP_ORDER.filter(sg => categoryBlocks.some(b => b.subGroup === sg));
  }, [categoryBlocks]);

  const hasProtocolChips = availableProtocols.length > 0;

  const visibleBlocks = useMemo(() => {
    if (hasProtocolChips && activeProtocol !== 'all') {
      return categoryBlocks.filter(b => b.subGroup === activeProtocol);
    }
    return categoryBlocks;
  }, [categoryBlocks, activeProtocol, hasProtocolChips]);

  const activeCatMeta = CATEGORIES.find(c => c.id === activeCategory);

  const renderBlocksPanel = () => {
    const isSearching = !!q;

    if (isSearching) {
      const grouped = CATEGORIES.map(cat => ({
        cat,
        blocks: filteredBlocks.filter(b => b.category === cat.id),
      })).filter(g => g.blocks.length > 0);

      return (
        <div className="wf-palette-rail-panel">
          <div className="wf-palette-rail-title">
            <span className="wf-palette-rail-dot" style={{ background: 'var(--primary)' }} />
            All blocks
            <span className="wf-palette-count">{filteredBlocks.length}</span>
          </div>
          <div className="wf-palette-rail-scroll">
            <div className="wf-palette-blocks">
              {grouped.map(({ cat, blocks }) => (
                <div key={cat.id}>
                  <div className="wf-palette-proto-header">
                    <span className="wf-palette-proto-dot" style={{ background: cat.color }} />
                    {cat.label}
                  </div>
                  {blocks.map(block => (
                    <PaletteBlock key={block.type} block={block} searchQuery={searchQuery} onAddNode={onAddNode} onDragStart={handleBlockDragStart} onDragEnd={handleBlockDragEnd} />
                  ))}
                </div>
              ))}
              {filteredBlocks.length === 0 && (
                <div className="wf-palette-no-results">No blocks matching &ldquo;{searchQuery.trim()}&rdquo;</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="wf-palette-rail-panel">
        <div className="wf-palette-rail-title">
          <span className="wf-palette-rail-dot" style={{ background: activeCatMeta?.color }} />
          {activeCatMeta?.label}
          <span className="wf-palette-count">{hasProtocolChips && activeProtocol !== 'all' ? visibleBlocks.length : categoryBlocks.length}</span>
        </div>
        {hasProtocolChips && (
          <div className="wf-palette-chips">
            <button
              type="button"
              className={`wf-palette-chip${activeProtocol === 'all' ? ' active' : ''}`}
              onClick={() => setActiveProtocol('all')}
            >All</button>
            {availableProtocols.map(sgId => {
              const meta = SUB_GROUP_META[sgId];
              return (
                <button
                  key={sgId}
                  type="button"
                  className={`wf-palette-chip${activeProtocol === sgId ? ' active' : ''}`}
                  onClick={() => setActiveProtocol(sgId)}
                  data-testid={`wf-palette-chip-${sgId}`}
                >
                  <span className="wf-palette-chip-dot" style={{ background: meta.color }} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}
        <div className="wf-palette-rail-scroll">
          <div className="wf-palette-blocks">
            {hasProtocolChips && activeProtocol === 'all' ? (
              SUB_GROUP_ORDER.filter(sg => visibleBlocks.some(b => b.subGroup === sg)).map(sgId => {
                const meta = SUB_GROUP_META[sgId];
                const sgBlocks = visibleBlocks.filter(b => b.subGroup === sgId);
                return (
                  <div key={sgId}>
                    <div className="wf-palette-proto-header">
                      <span className="wf-palette-proto-dot" style={{ background: meta.color }} />
                      {meta.label}
                    </div>
                    {sgBlocks.map(block => (
                      <PaletteBlock key={block.type} block={block} searchQuery={searchQuery} onAddNode={onAddNode} onDragStart={handleBlockDragStart} onDragEnd={handleBlockDragEnd} />
                    ))}
                  </div>
                );
              })
            ) : (
              visibleBlocks.map(block => (
                <PaletteBlock key={block.type} block={block} searchQuery={searchQuery} onAddNode={onAddNode} onDragStart={handleBlockDragStart} onDragEnd={handleBlockDragEnd} />
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="wf-palette">
      <div className="wf-palette-tabs">
        <button data-testid="wf-palette-tab-blocks" className={`wf-palette-tab ${section === 'blocks' ? 'active' : ''}`} onClick={() => setSection('blocks')}>Blocks</button>
        <button data-testid="wf-palette-tab-requests" className={`wf-palette-tab ${section === 'requests' ? 'active' : ''}`} onClick={() => setSection('requests')}>Requests</button>
        <button data-testid="wf-palette-tab-catalog" className={`wf-palette-tab ${section === 'catalog' ? 'active' : ''}`} onClick={() => setSection('catalog')}>Catalog</button>
      </div>

      <div className="wf-palette-search-wrap">
        <svg className="wf-palette-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          className="wf-palette-search"
          type="text"
          placeholder={section === 'blocks' ? 'Search all blocks…' : section === 'requests' ? 'Search requests…' : 'Search catalog…'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button type="button" className="wf-palette-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">&times;</button>
        )}
      </div>

      {section === 'blocks' && (
        <div className="wf-palette-rail-wrap">
          <div className="wf-palette-rail" data-testid="wf-palette-rail">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`wf-palette-rail-btn${!q && activeCategory === cat.id ? ' active' : ''}`}
                data-testid={`wf-palette-rail-${cat.id}`}
                data-rail={cat.id}
                title={cat.label}
                style={q ? { opacity: 0.45 } : undefined}
                onClick={() => handleRailClick(cat.id)}
              >
                <span className="wf-palette-rail-icon" style={{ color: cat.color }}>{cat.icon}</span>
                <span className="wf-palette-rail-label">{cat.label.slice(0, 4)}</span>
              </button>
            ))}
          </div>
          {renderBlocksPanel()}
        </div>
      )}

      {section !== 'blocks' && (
        <div className="wf-palette-content">

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
            {filteredCatalog.length === 0 && filteredPreviews.length === 0 && (
              <p className="wf-palette-empty">{q ? `No exposed endpoints matching "${searchQuery.trim()}"` : 'No endpoints exposed to Workflow. Use the exposure dropdown on the Catalog page to Preview or Publish endpoints.'}</p>
            )}

            {(filteredCatalog.length > 0 || filteredPreviews.length > 0) && (
              <>
                {/* ── Published section ── */}
                <button
                  type="button"
                  className="wf-palette-section-header"
                  onClick={() => toggle('__pub_section')}
                  data-testid="wf-palette-pub-section"
                >
                  <span className="wf-palette-caret">{(q || expanded.has('__pub_section')) ? '▾' : '▸'}</span>
                  <span className="wf-palette-section-icon">📌</span>
                  <span className="wf-palette-section-label">Published</span>
                  <span className="wf-palette-count">{filteredCatalog.reduce((n, e) => n + countCatalogEndpoints(e), 0)}</span>
                </button>
                {(q || expanded.has('__pub_section')) && (
                  <div className="wf-palette-section-body">
                    {filteredCatalog.length === 0 && (
                      <p className="wf-palette-section-empty" data-testid="wf-palette-pub-empty">No published endpoints</p>
                    )}
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
                                currentVersionId={entry.currentVersionId}
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

                {/* ── Preview section ── */}
                <button
                  type="button"
                  className="wf-palette-section-header wf-palette-section-header--preview"
                  onClick={() => toggle('__preview_section')}
                  data-testid="wf-palette-preview-section"
                >
                  <span className="wf-palette-caret">{(q || expanded.has('__preview_section')) ? '▾' : '▸'}</span>
                  <span className="wf-palette-section-icon">◇</span>
                  <span className="wf-palette-section-label">Preview (yours)</span>
                  <span className="wf-palette-count">{filteredPreviews.length}</span>
                </button>
                {(q || expanded.has('__preview_section')) && (
                  <div className="wf-palette-section-body">
                    {filteredPreviews.length === 0 && (
                      <p className="wf-palette-section-empty" data-testid="wf-palette-preview-empty">No preview endpoints</p>
                    )}
                    {filteredPreviews.map(p => (
                      <button
                        key={`${p.entryId}::${p.endpointId}`}
                        className="wf-palette-item wf-palette-item--preview"
                        onClick={() => onAddFromCatalog(p.entryId, p.endpointId)}
                        title={`${p.method.toUpperCase()} ${p.path} (${p.entryName})`}
                      >
                        <span className="wf-method-mini" style={{ color: METHOD_COLORS[p.method.toUpperCase()] ?? '#6b7280' }}>{p.method.toUpperCase()}</span>
                        <span className="wf-palette-item-name">{p.summary || p.path}</span>
                        <span className="wf-palette-badge wf-palette-badge--preview" title="Preview">◇</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        </div>
      )}

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

function CatalogFolderTree({ folders, rootEndpoints, entryId, currentVersionId, expanded, onToggle, onAdd, depth = 1, searchQuery = '' }: {
  folders: CatalogFolder[];
  rootEndpoints: CatalogEntry['endpoints'];
  entryId: string;
  currentVersionId: string;
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
                      {isPublicationStale(ep, currentVersionId) && <span className="wf-palette-badge wf-palette-badge--stale" title="Spec updated since publication" data-testid="wf-palette-stale-badge">⚠</span>}
                      <span className="wf-palette-badge wf-palette-badge--published" title="Published">📌</span>
                    </button>
                ))}
                {folder.folders.length > 0 && (
                  <CatalogFolderTree
                    folders={folder.folders}
                    rootEndpoints={[]}
                    entryId={entryId}
                    currentVersionId={currentVersionId}
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
              {isPublicationStale(ep, currentVersionId) && <span className="wf-palette-badge wf-palette-badge--stale" title="Spec updated since publication" data-testid="wf-palette-stale-badge">⚠</span>}
              <span className="wf-palette-badge wf-palette-badge--published" title="Published">📌</span>
            </button>
        ))}
    </>
  );
}
