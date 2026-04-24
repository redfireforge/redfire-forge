import { useState } from 'react';
import type { RequestCollection, RequestFolder, RequestItem } from '../../types';
import type { CatalogEntry, CatalogFolder } from '../../types/catalog';
import type { WorkflowNodeType } from '../../types/workflow';

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#ef4444',
};

function countRequests(col: RequestCollection): number {
  let n = col.requests.length;
  const walk = (folders?: RequestFolder[]) => { if (!folders) return; for (const f of folders) { n += f.requests.length; walk(f.folders); } };
  walk(col.folders);
  return n;
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['triggers', 'actions', 'logic', 'flow', 'parallel']));

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
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
            {/* Triggers */}
            <button className="wf-palette-category-header" onClick={() => toggle('triggers')}>
              <span className="wf-palette-caret">{expanded.has('triggers') ? '▾' : '▸'}</span>
              <span className="wf-palette-category-title">Triggers</span>
              <span className="wf-palette-count">3</span>
            </button>
            {expanded.has('triggers') && (
              <>
                <button className="wf-palette-block wf-palette-block-start" onClick={() => onAddNode('start')}>
                  <span className="wf-pb-icon">▶</span>
                  <div>
                    <div className="wf-pb-title">Manual Start</div>
                    <div className="wf-pb-desc">Workflow entry point</div>
                  </div>
                </button>
                <button className="wf-palette-block wf-palette-block-webhook" onClick={() => onAddNode('webhook')}>
                  <span className="wf-pb-icon">🪝</span>
                  <div>
                    <div className="wf-pb-title">Webhook Trigger</div>
                    <div className="wf-pb-desc">Incoming HTTP request</div>
                  </div>
                </button>
                <button className="wf-palette-block wf-palette-block-schedule" onClick={() => onAddNode('schedule')}>
                  <span className="wf-pb-icon">⏰</span>
                  <div>
                    <div className="wf-pb-title">Schedule Trigger</div>
                    <div className="wf-pb-desc">Cron-based execution</div>
                  </div>
                </button>
              </>
            )}

            {/* Actions */}
            <button className="wf-palette-category-header" onClick={() => toggle('actions')}>
              <span className="wf-palette-caret">{expanded.has('actions') ? '▾' : '▸'}</span>
              <span className="wf-palette-category-title">Actions</span>
              <span className="wf-palette-count">2</span>
            </button>
            {expanded.has('actions') && (
              <>
                <button className="wf-palette-block wf-palette-block-http" onClick={() => onAddNode('http')}>
                  <span className="wf-pb-icon">↗</span>
                  <div>
                    <div className="wf-pb-title">HTTP Request</div>
                    <div className="wf-pb-desc">API call with extraction</div>
                  </div>
                </button>
                <button className="wf-palette-block wf-palette-block-delay" onClick={() => onAddNode('delay')}>
                  <span className="wf-pb-icon">⏱</span>
                  <div>
                    <div className="wf-pb-title">Delay</div>
                    <div className="wf-pb-desc">Pause between steps</div>
                  </div>
                </button>
              </>
            )}

            {/* Logic — branching & looping */}
            <button className="wf-palette-category-header" onClick={() => toggle('logic')}>
              <span className="wf-palette-caret">{expanded.has('logic') ? '▾' : '▸'}</span>
              <span className="wf-palette-category-title">Logic</span>
              <span className="wf-palette-count">3</span>
            </button>
            {expanded.has('logic') && (
              <>
                <button className="wf-palette-block wf-palette-block-condition" onClick={() => onAddNode('condition')}>
                  <span className="wf-pb-icon">◆</span>
                  <div>
                    <div className="wf-pb-title">Condition</div>
                    <div className="wf-pb-desc">If/Else branching</div>
                  </div>
                </button>
                <button className="wf-palette-block wf-palette-block-switch" onClick={() => onAddNode('switch')}>
                  <span className="wf-pb-icon">⇅</span>
                  <div>
                    <div className="wf-pb-title">Switch</div>
                    <div className="wf-pb-desc">Multi-way branching</div>
                  </div>
                </button>
                <button className="wf-palette-block wf-palette-block-loop" onClick={() => onAddNode('loop')}>
                  <span className="wf-pb-icon">🔄</span>
                  <div>
                    <div className="wf-pb-title">Loop</div>
                    <div className="wf-pb-desc">Repeat / For-Each / While</div>
                  </div>
                </button>
              </>
            )}

            {/* Data — variables & aggregation */}
            <button className="wf-palette-category-header" onClick={() => toggle('data')}>
              <span className="wf-palette-caret">{expanded.has('data') ? '▾' : '▸'}</span>
              <span className="wf-palette-category-title">Data</span>
              <span className="wf-palette-count">2</span>
            </button>
            {expanded.has('data') && (
              <>
                <button className="wf-palette-block wf-palette-block-setVariable" onClick={() => onAddNode('setVariable')}>
                  <span className="wf-pb-icon">📝</span>
                  <div>
                    <div className="wf-pb-title">Set Variable</div>
                    <div className="wf-pb-desc">Assign or transform variables</div>
                  </div>
                </button>
                <button className="wf-palette-block wf-palette-block-aggregate" onClick={() => onAddNode('aggregate')}>
                  <span className="wf-pb-icon">Σ</span>
                  <div>
                    <div className="wf-pb-title">Aggregate</div>
                    <div className="wf-pb-desc">Combine parallel results</div>
                  </div>
                </button>
              </>
            )}

            {/* Flow — parallelism & termination */}
            <button className="wf-palette-category-header" onClick={() => toggle('flow')}>
              <span className="wf-palette-caret">{expanded.has('flow') ? '▾' : '▸'}</span>
              <span className="wf-palette-category-title">Flow</span>
              <span className="wf-palette-count">3</span>
            </button>
            {expanded.has('flow') && (
              <>
                <button className="wf-palette-block wf-palette-block-fork" onClick={() => onAddNode('fork')}>
                  <span className="wf-pb-icon">⑃</span>
                  <div>
                    <div className="wf-pb-title">Parallel Fork</div>
                    <div className="wf-pb-desc">Concurrent branches</div>
                  </div>
                </button>
                <button className="wf-palette-block wf-palette-block-join" onClick={() => onAddNode('join')}>
                  <span className="wf-pb-icon">⑂</span>
                  <div>
                    <div className="wf-pb-title">Join</div>
                    <div className="wf-pb-desc">Wait for all branches</div>
                  </div>
                </button>
                <button className="wf-palette-block wf-palette-block-end" onClick={() => onAddNode('end')}>
                  <span className="wf-pb-icon">⏹</span>
                  <div>
                    <div className="wf-pb-title">End</div>
                    <div className="wf-pb-desc">Workflow termination</div>
                  </div>
                </button>
              </>
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
