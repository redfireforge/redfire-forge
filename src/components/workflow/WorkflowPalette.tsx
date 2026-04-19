import { useState } from 'react';
import type { RequestCollection } from '../../types';
import type { CatalogEntry } from '../../types/catalog';
import type { WorkflowNodeType } from '../../types/workflow';

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#ef4444',
};

interface Props {
  collections: RequestCollection[];
  catalogEntries: CatalogEntry[];
  onAddNode: (type: WorkflowNodeType) => void;
  onAddFromRequest: (collectionId: string, requestId: string) => void;
  onAddFromCatalog: (entryId: string, endpointId: string) => void;
}

export default function WorkflowPalette({ collections, catalogEntries, onAddNode, onAddFromRequest, onAddFromCatalog }: Props) {
  const [section, setSection] = useState<'blocks' | 'requests' | 'catalog'>('blocks');
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const toggleCol = (id: string) => setExpandedCols(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleCat = (id: string) => setExpandedCats(prev => {
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
            <button className="wf-palette-block wf-palette-block-http" onClick={() => onAddNode('http')}>
              <span className="wf-pb-icon">↗</span>
              <div>
                <div className="wf-pb-title">HTTP Request</div>
                <div className="wf-pb-desc">API call with extraction</div>
              </div>
            </button>
            <button className="wf-palette-block wf-palette-block-condition" onClick={() => onAddNode('condition')}>
              <span className="wf-pb-icon">◆</span>
              <div>
                <div className="wf-pb-title">Condition</div>
                <div className="wf-pb-desc">If/Else branching</div>
              </div>
            </button>
            <button className="wf-palette-block wf-palette-block-delay" onClick={() => onAddNode('delay')}>
              <span className="wf-pb-icon">⏱</span>
              <div>
                <div className="wf-pb-title">Delay</div>
                <div className="wf-pb-desc">Pause between steps</div>
              </div>
            </button>
          </div>
        )}

        {section === 'requests' && (
          <div className="wf-palette-tree">
            {collections.length === 0 && <p className="wf-palette-empty">No request collections</p>}
            {collections.map(col => (
              <div key={col.id} className="wf-palette-group">
                <button className="wf-palette-group-header" onClick={() => toggleCol(col.id)}>
                  <span className="wf-palette-caret">{expandedCols.has(col.id) ? '▾' : '▸'}</span>
                  {col.name}
                  <span className="wf-palette-count">{col.requests.length}</span>
                </button>
                {expandedCols.has(col.id) && col.requests.map(req => (
                  <button
                    key={req.id}
                    className="wf-palette-item"
                    onClick={() => onAddFromRequest(col.id, req.id)}
                    title={`${req.method} ${req.url}`}
                  >
                    <span className="wf-method-mini" style={{ color: METHOD_COLORS[req.method] ?? '#6b7280' }}>
                      {req.method}
                    </span>
                    <span className="wf-palette-item-name">{req.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {section === 'catalog' && (
          <div className="wf-palette-tree">
            {catalogEntries.length === 0 && <p className="wf-palette-empty">No catalog entries</p>}
            {catalogEntries.map(entry => (
              <div key={entry.id} className="wf-palette-group">
                <button className="wf-palette-group-header" onClick={() => toggleCat(entry.id)}>
                  <span className="wf-palette-caret">{expandedCats.has(entry.id) ? '▾' : '▸'}</span>
                  {entry.name}
                  <span className="wf-palette-count">{entry.endpoints.length}</span>
                </button>
                {expandedCats.has(entry.id) && entry.endpoints.map(ep => (
                  <button
                    key={ep.id}
                    className="wf-palette-item"
                    onClick={() => onAddFromCatalog(entry.id, ep.id)}
                    title={`${ep.method.toUpperCase()} ${ep.path}`}
                  >
                    <span className="wf-method-mini" style={{ color: METHOD_COLORS[ep.method.toUpperCase()] ?? '#6b7280' }}>
                      {ep.method.toUpperCase()}
                    </span>
                    <span className="wf-palette-item-name">{ep.summary || ep.path}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
