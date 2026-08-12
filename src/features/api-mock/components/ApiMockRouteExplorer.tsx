import { useMemo, useState } from 'react';
import type { ApiMockRouteFolderV1, ApiMockRouteV1 } from '../../../shared/api-mock/contracts';
import { getNextTabIndex } from '../../../shared/utils/tabListKeyboard';

interface Props {
  routes: ApiMockRouteV1[];
  folders?: ApiMockRouteFolderV1[];
  selectedRouteId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onAddFolder?: () => void;
  onToggleFolder?: (folderId: string) => void;
  /** Route ids flagged as having a conflict/overlap. */
  conflictRouteIds?: string[];
  onAnalyze?: () => void;
}

export function ApiMockRouteExplorer({
  routes,
  folders = [],
  selectedRouteId,
  onSelect,
  onCreate,
  onDelete: _onDelete,
  onToggle,
  onAddFolder,
  onToggleFolder,
  conflictRouteIds,
  onAnalyze,
}: Props) {
  const [query, setQuery] = useState('');
  const conflictSet = useMemo(() => new Set(conflictRouteIds ?? []), [conflictRouteIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter(r =>
      r.method.toLowerCase().includes(q) ||
      (r.path.value ?? '').toLowerCase().includes(q) ||
      (r.name ?? '').toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      (r.operationId ?? '').toLowerCase().includes(q),
    );
  }, [routes, query]);

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [folders],
  );

  const unfiled = useMemo(
    () => filtered.filter(r => !r.folderId || !folders.some(f => f.id === r.folderId)),
    [filtered, folders],
  );

  const enabledCount = routes.filter(r => r.enabled).length;
  const draftCount = routes.length - enabledCount;

  const onTreeKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]'));
    if (items.length === 0) return;
    const idx = items.findIndex(i => i === document.activeElement);
    if (idx < 0) return;
    const next = getNextTabIndex(e.key, idx, items.length);
    if (next == null || next === idx) return;
    e.preventDefault();
    items[next].focus();
  };

  const renderRoute = (route: ApiMockRouteV1, index: number) => {
    const conflict = conflictSet.has(route.id);
    const tabIndex = selectedRouteId
      ? (route.id === selectedRouteId ? 0 : -1)
      : (index === 0 ? 0 : -1);
    return (
      <button
        key={route.id}
        role="treeitem"
        aria-selected={route.id === selectedRouteId}
        tabIndex={tabIndex}
        className={`am-route-item${route.id === selectedRouteId ? ' active' : ''}${!route.enabled ? ' disabled' : ''}${conflict ? ' conflict' : ''}`}
        onClick={() => onSelect(route.id)}
        onDoubleClick={() => onToggle(route.id, !route.enabled)}
        title={conflict ? 'Potential overlap with another route' : route.name}
        data-testid={`api-mock-route-${route.id}`}
      >
        <span className={`am-method ${route.method.toLowerCase()}`}>{route.method}</span>
        <span className="am-route-path">{route.path.value || '/'}</span>
        <span className={`am-badge${conflict ? ' warning' : ''}`}>P{route.priority}</span>
      </button>
    );
  };

  let routeIndex = 0;

  return (
    <aside className="api-mock-route-panel" data-testid="api-mock-route-explorer">
      <div className="am-panel-head">
        <span className="am-panel-title">Rules</span>
        <span className="am-count-badge">{routes.length}</span>
        {conflictSet.size > 0 && (
          <span className="am-count-badge warning" title={`${conflictSet.size} conflicts`}>{conflictSet.size}</span>
        )}
        <span className="am-spacer" />
      </div>

      <div className="am-route-tools">
        <input
          className="am-search"
          type="search"
          placeholder="Search path, tag, operation…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search rules"
          data-testid="api-mock-route-search"
        />
        <button className="am-icon-btn" aria-label="Add rule" title="Add rule" onClick={onCreate} data-testid="api-mock-add-route">+</button>
        <button
          className="am-icon-btn"
          aria-label="Add folder"
          title="Add folder"
          onClick={onAddFolder}
          data-testid="api-mock-add-folder"
        >📁+</button>
      </div>

      <div className="am-route-tree" role="tree" aria-label="Rule list" onKeyDown={onTreeKeyDown}>
        {routes.length === 0 && (
          <div className="am-route-empty" data-testid="api-mock-routes-empty">
            No rules yet. Click + to create one.
          </div>
        )}
        {routes.length > 0 && filtered.length === 0 && (
          <div className="am-route-empty" data-testid="api-mock-routes-no-match">
            No rules match “{query}”.
          </div>
        )}
        {sortedFolders.map(folder => {
          const kids = filtered.filter(r => r.folderId === folder.id);
          if (query && kids.length === 0) return null;
          return (
            <div key={folder.id} className="am-tree-folder-block" data-testid={`api-mock-folder-${folder.id}`}>
              <button
                type="button"
                className="am-tree-folder"
                onClick={() => onToggleFolder?.(folder.id)}
                aria-expanded={folder.expanded}
              >
                <span aria-hidden="true">{folder.expanded ? '▾' : '▸'}</span>
                {folder.name}
                <span className="am-count-badge">{kids.length}</span>
              </button>
              {folder.expanded && kids.map(r => renderRoute(r, routeIndex++))}
            </div>
          );
        })}
        {unfiled.map(r => renderRoute(r, routeIndex++))}
      </div>

      {routes.length > 0 && (
        <div className="am-panel-foot">
          <span className="am-faint">{enabledCount} enabled · {draftCount} draft{draftCount === 1 ? '' : 's'}</span>
          <span className="am-spacer" />
          <button className="am-btn small ghost" onClick={onAnalyze} data-testid="api-mock-analyze">Analyze all</button>
        </div>
      )}
    </aside>
  );
}
