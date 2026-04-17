import { useState } from 'react';
import type { WorkbenchCollection, WorkbenchRequest } from '../../types';

interface Props {
  collections: WorkbenchCollection[];
  selectedCollectionId?: string;
  selectedRequestId?: string;
  onSelectCollection: (colId: string) => void;
  onSelectRequest: (colId: string, reqId: string) => void;
  onNewCollection: () => void;
  onEditCollection: (col: WorkbenchCollection) => void;
  onDeleteCollection: (colId: string) => void;
  onNewRequest: (colId: string) => void;
  onDeleteRequest: (colId: string, reqId: string) => void;
  onManageEnvs: () => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#f59e0b',
  PUT: '#3b82f6',
  PATCH: '#8b5cf6',
  DELETE: '#ef4444',
};

export default function WorkbenchSidebar({
  collections, selectedCollectionId, selectedRequestId,
  onSelectCollection, onSelectRequest, onNewCollection,
  onEditCollection, onDeleteCollection, onNewRequest, onDeleteRequest,
  onManageEnvs,
}: Props) {
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set(collections.map(c => c.id)));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'collection' | 'request'; colId: string; reqId?: string } | null>(null);

  const toggleExpand = (colId: string) => {
    setExpandedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId); else next.add(colId);
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'collection' | 'request', colId: string, reqId?: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, colId, reqId });
  };

  return (
    <aside className="wb-sidebar">
      <div className="wb-sidebar-header">
        <span className="wb-sidebar-title">Collections</span>
        <div className="wb-sidebar-actions">
          <button className="wb-icon-btn" onClick={onManageEnvs} title="Manage Environments">&#9881;</button>
          <button className="wb-icon-btn" onClick={onNewCollection} title="New Collection">+</button>
        </div>
      </div>

      <div className="wb-sidebar-list" onClick={() => setContextMenu(null)}>
        {collections.length === 0 && (
          <div className="wb-sidebar-empty">
            No collections yet.
            <button className="btn-link-sm" onClick={onNewCollection}>Create one</button>
          </div>
        )}

        {collections.map((col) => (
          <div key={col.id} className="wb-col-group">
            <div
              className={`wb-col-header ${selectedCollectionId === col.id && !selectedRequestId ? 'selected' : ''}`}
              onClick={() => { toggleExpand(col.id); onSelectCollection(col.id); }}
              onContextMenu={(e) => handleContextMenu(e, 'collection', col.id)}
            >
              <span className="wb-col-arrow">{expandedCols.has(col.id) ? '▾' : '▸'}</span>
              <span className="wb-col-name" title={col.name}>{col.name}</span>
              <span className={`wb-col-mode-badge ${col.mode}`}>
                {col.mode === 'multi-env' ? 'ENV' : 'URL'}
              </span>
              <span className="wb-col-count">{col.requests.length}</span>
            </div>

            {expandedCols.has(col.id) && (
              <div className="wb-req-list">
                {col.requests.map((req) => (
                  <div
                    key={req.id}
                    className={`wb-req-item ${selectedRequestId === req.id ? 'selected' : ''}`}
                    onClick={() => onSelectRequest(col.id, req.id)}
                    onContextMenu={(e) => handleContextMenu(e, 'request', col.id, req.id)}
                  >
                    <span className="wb-req-method" style={{ color: METHOD_COLORS[req.method] || '#94a3b8' }}>
                      {req.method}
                    </span>
                    <span className="wb-req-name" title={req.name || req.url}>{req.name || req.url || 'Untitled'}</span>
                  </div>
                ))}
                <button
                  className="wb-add-req-btn"
                  onClick={(e) => { e.stopPropagation(); onNewRequest(col.id); }}
                >
                  + New Request
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {contextMenu && (
        <div
          className="wb-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          {contextMenu.type === 'collection' && (
            <>
              <button onClick={() => onNewRequest(contextMenu.colId)}>Add Request</button>
              <button onClick={() => { const col = collections.find(c => c.id === contextMenu.colId); if (col) onEditCollection(col); }}>
                Edit Collection
              </button>
              <button className="danger" onClick={() => onDeleteCollection(contextMenu.colId)}>
                Delete Collection
              </button>
            </>
          )}
          {contextMenu.type === 'request' && contextMenu.reqId && (
            <button className="danger" onClick={() => onDeleteRequest(contextMenu.colId, contextMenu.reqId!)}>
              Delete Request
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
