import { useState, useCallback, useRef } from 'react';
import type { CatalogEntry } from '../../types/catalog';
import { countEndpoints } from '../../utils/openApiParser';

interface Props {
  entries: CatalogEntry[];
  selectedEntryId?: string;
  onSelectEntry: (entryId: string | undefined) => void;
  onImport: () => void;
  onDeleteEntry: (entryId: string) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e', POST: '#f59e0b', PUT: '#3b82f6', PATCH: '#8b5cf6', DELETE: '#ef4444',
};

export default function CatalogSidebar({ entries, selectedEntryId, onSelectEntry, onImport, onDeleteEntry }: Props) {
  const [filter, setFilter] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entryId: string } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const filtered = filter.trim()
    ? entries.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
    : entries;

  const handleContextMenu = useCallback((e: React.MouseEvent, entryId: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, entryId });
  }, []);

  const closeCtx = useCallback(() => setCtxMenu(null), []);

  return (
    <div className="cat-sidebar" onClick={closeCtx}>
      <div className="cat-sidebar-header">
        <input
          className="cat-sidebar-filter"
          type="text"
          placeholder="Filter APIs..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <button className="cat-sidebar-import-btn" onClick={onImport}>
          + Import Spec
        </button>
      </div>

      <div className="cat-sidebar-list">
        {filtered.length === 0 && entries.length === 0 && (
          <div className="cat-sidebar-empty">
            No APIs imported yet.
            <br />Click "Import Spec" to get started.
          </div>
        )}
        {filtered.length === 0 && entries.length > 0 && (
          <div className="cat-sidebar-empty">No APIs match "{filter}"</div>
        )}
        {filtered.map(entry => {
          const epCount = countEndpoints(entry);
          const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);
          const isSelected = entry.id === selectedEntryId;
          return (
            <div
              key={entry.id}
              className={`cat-sidebar-entry ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectEntry(entry.id)}
              onContextMenu={e => handleContextMenu(e, entry.id)}
            >
              <div className="cat-entry-name">{entry.name}</div>
              <div className="cat-entry-meta">
                {currentVersion && <span className="cat-entry-version">v{currentVersion.version}</span>}
                <span className="cat-entry-count">{epCount} endpoint{epCount !== 1 ? 's' : ''}</span>
                {entry.servers.length > 0 && (
                  <MethodDots entry={entry} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {ctxMenu && (
        <div
          ref={ctxRef}
          className="cat-ctx-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {(() => {
            const entry = entries.find(e => e.id === ctxMenu.entryId);
            if (!entry) return null;
            const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);
            return (
              <>
                {currentVersion && (
                  <div className="cat-ctx-item disabled">
                    v{currentVersion.version} (current)
                  </div>
                )}
                <div className="cat-ctx-sep" />
                <div className="cat-ctx-item danger" onClick={() => { onDeleteEntry(ctxMenu.entryId); closeCtx(); }}>
                  Delete
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function MethodDots({ entry }: { entry: CatalogEntry }) {
  const methods = new Set<string>();
  const collect = (eps: CatalogEntry['endpoints']) => eps.forEach(e => methods.add(e.method));
  collect(entry.endpoints);
  entry.folders.forEach(f => collect(f.endpoints));

  return (
    <span className="cat-entry-methods">
      {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter(m => methods.has(m)).map(m => (
        <span key={m} className="cat-method-dot" style={{ background: METHOD_COLORS[m] }} title={m} />
      ))}
    </span>
  );
}
