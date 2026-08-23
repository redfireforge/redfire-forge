import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiMockRouteFolderV1, ApiMockRouteV1 } from '@shared/api-mock/contracts';
import { CustomSelect } from '@shared/components/CustomSelect';
import { httpMethodSelectOptions } from '@shared/constants/httpMethodColors';
import { getNextTabIndex } from '@shared/utils/tabListKeyboard';
import { PlusIcon, FolderPlusIcon, FilterIcon, XIcon, ChevronDownIcon, ChevronRightIcon, TrashIcon, CheckIcon } from './ApiMockIcons';
import { API_MOCK_CLI_SIMULATE_EXAMPLE, API_MOCK_CLI_VERIFY_EXAMPLE } from '../apiMockExportActions';

const METHOD_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All methods' },
  ...httpMethodSelectOptions(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'], { detail: false }),
];

const ROUTE_DND_MIME = 'application/x-api-mock-route';

interface Props {
  routes: ApiMockRouteV1[];
  folders?: ApiMockRouteFolderV1[];
  selectedRouteId?: string;
  onSelect: (id: string) => void;
  /** Create a rule; pass folderId to file it immediately. */
  onCreate: (folderId?: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onAddFolder?: () => void;
  onToggleFolder?: (folderId: string) => void;
  onRenameFolder?: (folderId: string, name: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  /** Move a rule into a folder, or `undefined` for Ungrouped. */
  onMoveRoute?: (routeId: string, folderId: string | undefined) => void;
  /** Route ids flagged as having a conflict/overlap. */
  conflictRouteIds?: string[];
  onAnalyze?: () => void;
  /** When true, show close control for the mobile/tablet drawer (mockup 08). */
  drawerOpen?: boolean;
  onCloseDrawer?: () => void;
  /** Listener is bound — empty list should explain unmatched 404. */
  running?: boolean;
}

export function ApiMockRouteExplorer({
  routes,
  folders = [],
  selectedRouteId,
  onSelect,
  onCreate,
  onDelete,
  onToggle,
  onAddFolder,
  onToggleFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveRoute,
  conflictRouteIds,
  onAnalyze,
  drawerOpen = false,
  onCloseDrawer,
  running = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | undefined>();
  const [showDisabled, setShowDisabled] = useState(true);
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [methodFilter, setMethodFilter] = useState<'ALL' | string>('ALL');
  const [dropTarget, setDropTarget] = useState<string | 'ungrouped' | null>(null);
  const [draggingRouteId, setDraggingRouteId] = useState<string | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const conflictSet = useMemo(() => new Set(conflictRouteIds ?? []), [conflictRouteIds]);
  const filtersActive = !showDisabled || conflictsOnly || methodFilter !== 'ALL';

  useEffect(() => {
    if (!filterOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (filterWrapRef.current?.contains(target)) return;
      // CustomSelect menus portal to document.body
      if (target.closest?.('.cs-menu')) return;
      setFilterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return routes.filter(r => {
      if (!showDisabled && !r.enabled) return false;
      if (conflictsOnly && !conflictSet.has(r.id)) return false;
      if (methodFilter !== 'ALL' && r.method !== methodFilter && r.method !== 'ANY') return false;
      if (!q) return true;
      return (
        r.method.toLowerCase().includes(q)
        || (r.path.value ?? '').toLowerCase().includes(q)
        || (r.name ?? '').toLowerCase().includes(q)
        || r.tags.some(t => t.toLowerCase().includes(q))
        || (r.operationId ?? '').toLowerCase().includes(q)
      );
    });
  }, [routes, query, showDisabled, conflictsOnly, methodFilter, conflictSet]);

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

  const acceptRouteDrop = (e: React.DragEvent, folderId: string | undefined) => {
    e.preventDefault();
    e.stopPropagation();
    const routeId = e.dataTransfer.getData(ROUTE_DND_MIME) || e.dataTransfer.getData('text/plain');
    setDropTarget(null);
    setDraggingRouteId(null);
    if (!routeId || !onMoveRoute) return;
    const route = routes.find(r => r.id === routeId);
    if (!route) return;
    const current = route.folderId && folders.some(f => f.id === route.folderId) ? route.folderId : undefined;
    if (current === folderId) return;
    onMoveRoute(routeId, folderId);
  };

  const renderRoute = (route: ApiMockRouteV1, index: number) => {
    const conflict = conflictSet.has(route.id);
    const tabIndex = selectedRouteId
      ? (route.id === selectedRouteId ? 0 : -1)
      : (index === 0 ? 0 : -1);
    const priorityClass = conflict ? ' warning' : route.priority >= 100 ? ' success' : '';
    return (
      <div className="am-tree-route-row" key={route.id}>
      <button
        role="treeitem"
        aria-selected={route.id === selectedRouteId}
        tabIndex={tabIndex}
        draggable={!!onMoveRoute}
        className={`am-route-item${route.enabled ? ' is-live' : ' disabled is-draft'}${route.id === selectedRouteId ? ' active' : ''}${conflict ? ' conflict' : ''}${draggingRouteId === route.id ? ' dragging' : ''}`}
        onClick={() => onSelect(route.id)}
        onDoubleClick={() => onToggle(route.id, !route.enabled)}
        onDragStart={e => {
          if (!onMoveRoute) return;
          e.dataTransfer.setData(ROUTE_DND_MIME, route.id);
          e.dataTransfer.setData('text/plain', route.id);
          e.dataTransfer.effectAllowed = 'move';
          setDraggingRouteId(route.id);
        }}
        onDragEnd={() => {
          setDraggingRouteId(null);
          setDropTarget(null);
        }}
        title={
          conflict
            ? 'Potential overlap with another route'
            : `${route.enabled ? 'Enabled' : 'Draft — not matching'}${onMoveRoute ? ' · drag into a folder' : ''}`
        }
        aria-label={`${route.method} ${route.path.value || '/'} — ${route.enabled ? 'enabled' : 'draft'}`}
        data-testid={`api-mock-route-${route.id}`}
        data-route-name={route.name}
        data-enabled={route.enabled ? 'true' : 'false'}
        data-copied={route.name.endsWith(' (copy)') ? 'true' : undefined}
      >
        <span className={`am-method ${route.method.toLowerCase()}`}>{route.method}</span>
        <span className="am-route-path">{route.path.value || '/'}</span>
        <span className="am-route-meta">
          <span className={`am-badge${priorityClass}`}>P{route.priority}</span>
        </span>
      </button>
        <button
          type="button"
          className={`am-route-state ${route.enabled ? 'is-live' : 'is-draft'}`}
          aria-pressed={route.enabled}
          aria-label={route.enabled ? `Disable ${route.method} ${route.path.value || '/'}` : `Enable ${route.method} ${route.path.value || '/'}`}
          title={route.enabled ? 'Disable this rule' : 'Enable this rule — drafts do not match incoming traffic'}
          data-testid={`api-mock-route-state-${route.id}`}
          data-enabled={route.enabled ? 'true' : 'false'}
          onClick={() => onToggle(route.id, !route.enabled)}
        >
          {route.enabled ? 'On' : 'Draft'}
        </button>
        <button
          type="button"
          className="am-icon-btn am-route-delete"
          aria-label={`Delete rule ${route.name}`}
          title="Delete rule"
          onClick={() => onDelete(route.id)}
          data-testid={`api-mock-route-delete-${route.id}`}
        ><TrashIcon size={13} /></button>
      </div>
    );
  };

  let routeIndex = 0;

  return (
    <aside className={`api-mock-route-panel${drawerOpen ? ' drawer-open' : ''}`} data-testid="api-mock-route-explorer">
      <div className="am-panel-head">
        <span className="am-panel-title">Rules</span>
        <span className="am-count-badge" data-testid="api-mock-rules-count">{routes.length}</span>
        {conflictSet.size > 0 && (
          <span
            className="am-count-badge warning"
            title={`${conflictSet.size} conflicts`}
            data-testid="api-mock-conflicts-count"
          >{conflictSet.size}</span>
        )}
        <span className="am-spacer" />
        <div className="am-filter-wrap" ref={filterWrapRef}>
          <button
            type="button"
            className={`am-icon-btn${filterOpen || filtersActive ? ' active' : ''}`}
            aria-label="Rule filters"
            title="Rule filters"
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            data-testid="api-mock-route-filter"
            onClick={() => setFilterOpen(o => !o)}
          ><FilterIcon /></button>
          {filterOpen && (
            <div className="am-filter-popover" role="dialog" aria-label="Rule filters" data-testid="api-mock-route-filter-panel">
              <div className="am-filter-popover-title">Rule filters</div>
              <button
                type="button"
                className={`am-check-row${showDisabled ? ' checked' : ''}`}
                role="checkbox"
                aria-checked={showDisabled}
                data-testid="api-mock-filter-show-disabled"
                onClick={() => setShowDisabled(v => !v)}
              >
                <span className="am-check-box" aria-hidden="true">
                  {showDisabled && <CheckIcon size={12} />}
                </span>
                <span className="am-check-label">Show disabled</span>
              </button>
              <button
                type="button"
                className={`am-check-row${conflictsOnly ? ' checked' : ''}`}
                role="checkbox"
                aria-checked={conflictsOnly}
                data-testid="api-mock-filter-conflicts-only"
                onClick={() => setConflictsOnly(v => !v)}
              >
                <span className="am-check-box" aria-hidden="true">
                  {conflictsOnly && <CheckIcon size={12} />}
                </span>
                <span className="am-check-label">Conflicts only</span>
              </button>
              <div className="am-filter-field">
                <span className="am-filter-field-label">Method</span>
                <CustomSelect
                  value={methodFilter}
                  onChange={setMethodFilter}
                  options={METHOD_FILTER_OPTIONS}
                  className="am-cs am-cs--filter-method"
                  size="sm"
                  menuMinWidth={160}
                  menuMatchTriggerWidth
                  aria-label="Filter by method"
                  data-testid="api-mock-filter-method"
                />
              </div>
            </div>
          )}
        </div>
        {onCloseDrawer && (
          <button
            type="button"
            className="am-icon-btn am-drawer-close"
            aria-label="Close drawer"
            title="Close"
            onClick={onCloseDrawer}
            data-testid="api-mock-close-routes"
          ><XIcon /></button>
        )}
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
        <button className="am-icon-btn" aria-label="Add rule" title="Add rule" onClick={() => onCreate()} data-testid="api-mock-add-route"><PlusIcon /></button>
        <button
          className="am-icon-btn"
          aria-label="Add folder"
          title="Add folder"
          onClick={onAddFolder}
          data-testid="api-mock-add-folder"
        ><FolderPlusIcon /></button>
      </div>

      <div className="am-route-tree" role="tree" aria-label="Rule list" onKeyDown={onTreeKeyDown}>
        {routes.length === 0 && (
          <div className="am-route-empty" data-testid="api-mock-routes-empty">
            {running
              ? 'No rules yet. The listener is running — unmatched requests return 404.'
              : 'No rules yet. Click + to create one. Start is allowed — unmatched requests return 404.'}
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
          const isDrop = dropTarget === folder.id;
          return (
            <div
              key={folder.id}
              className={`am-tree-folder-block${isDrop ? ' drop-target' : ''}`}
              data-testid={`api-mock-folder-${folder.id}`}
              data-folder-name={folder.name}
              onDragOver={e => {
                if (!onMoveRoute || !draggingRouteId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dropTarget !== folder.id) setDropTarget(folder.id);
              }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDropTarget(t => (t === folder.id ? null : t));
                }
              }}
              onDrop={e => acceptRouteDrop(e, folder.id)}
            >
              {renamingFolderId === folder.id ? (
                <input
                  className="am-input am-folder-rename"
                  autoFocus
                  defaultValue={folder.name}
                  aria-label="Folder name"
                  data-testid={`api-mock-folder-rename-input-${folder.id}`}
                  onBlur={e => { onRenameFolder?.(folder.id, e.target.value.trim() || folder.name); setRenamingFolderId(undefined); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setRenamingFolderId(undefined);
                    }
                  }}
                />
              ) : (
                <div className="am-tree-folder-row">
                  <button
                    type="button"
                    className="am-tree-folder"
                    onClick={() => onToggleFolder?.(folder.id)}
                    onDoubleClick={() => onRenameFolder && setRenamingFolderId(folder.id)}
                    aria-expanded={folder.expanded}
                    title={onRenameFolder ? 'Click to expand · double-click to rename' : folder.name}
                    data-testid={`api-mock-folder-toggle-${folder.id}`}
                  >
                    <span aria-hidden="true">{folder.expanded ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}</span>
                    <span className="am-folder-name">{folder.name}</span>
                    <span className="am-count-badge">{kids.length}</span>
                  </button>
                  <button
                    type="button"
                    className="am-icon-btn am-folder-add"
                    aria-label={`Add rule in ${folder.name}`}
                    title="Add rule in this folder"
                    onClick={() => onCreate(folder.id)}
                    data-testid={`api-mock-folder-add-route-${folder.id}`}
                  ><PlusIcon size={13} /></button>
                  {onDeleteFolder && (
                    <button
                      type="button"
                      className="am-icon-btn am-folder-delete"
                      aria-label={`Delete folder ${folder.name}`}
                      title="Delete folder (rules move to Ungrouped)"
                      onClick={() => onDeleteFolder(folder.id)}
                      data-testid={`api-mock-folder-delete-${folder.id}`}
                    ><TrashIcon size={13} /></button>
                  )}
                </div>
              )}
              {folder.expanded && kids.map(r => renderRoute(r, routeIndex++))}
              {folder.expanded && kids.length === 0 && (
                <div className="am-folder-empty" data-testid={`api-mock-folder-empty-${folder.id}`}>
                  <span>Drop a rule here, or</span>
                  <button
                    type="button"
                    className="am-link-btn"
                    onClick={() => onCreate(folder.id)}
                    data-testid={`api-mock-folder-empty-add-${folder.id}`}
                  >
                    add a rule
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {sortedFolders.length > 0 && (
          <div
            className={`am-ungrouped-zone${dropTarget === 'ungrouped' ? ' drop-target' : ''}`}
            data-testid="api-mock-ungrouped-zone"
            onDragOver={e => {
              if (!onMoveRoute || !draggingRouteId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dropTarget !== 'ungrouped') setDropTarget('ungrouped');
            }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropTarget(t => (t === 'ungrouped' ? null : t));
              }
            }}
            onDrop={e => acceptRouteDrop(e, undefined)}
          >
            <div className="am-tree-section-label" data-testid="api-mock-ungrouped-label">Ungrouped</div>
            {unfiled.length === 0 ? (
              <div className="am-folder-empty am-ungrouped-empty">Drop rules here to ungroup</div>
            ) : (
              unfiled.map(r => renderRoute(r, routeIndex++))
            )}
          </div>
        )}
        {sortedFolders.length === 0 && unfiled.map(r => renderRoute(r, routeIndex++))}
      </div>

      {routes.length > 0 && (
        <div className="am-panel-foot">
          <div
            className="am-route-tally"
            data-testid="api-mock-routes-footer"
            role="status"
            aria-label={`${enabledCount} enabled · ${draftCount} draft${draftCount === 1 ? '' : 's'}`}
          >
            <span
              className={`am-route-tally-chip${enabledCount > 0 ? ' is-live' : ' is-empty'}`}
              data-testid="api-mock-routes-enabled"
              title={`${enabledCount} rule${enabledCount === 1 ? '' : 's'} enabled for matching`}
            >
              <span className="am-route-tally-dot" aria-hidden="true" />
              <span className="am-route-tally-value">{enabledCount}</span>
              <span className="am-route-tally-label">Enabled</span>
            </span>
            <span
              className={`am-route-tally-chip${draftCount > 0 ? ' is-draft' : ' is-empty'}`}
              data-testid="api-mock-routes-draft"
              title={`${draftCount} draft${draftCount === 1 ? '' : 's'} — saved but not matching`}
            >
              <span className="am-route-tally-dot" aria-hidden="true" />
              <span className="am-route-tally-value">{draftCount}</span>
              <span className="am-route-tally-label">Draft{draftCount === 1 ? '' : 's'}</span>
            </span>
            <span className="am-sr-only">
              {enabledCount} enabled · {draftCount} draft{draftCount === 1 ? '' : 's'}
            </span>
          </div>
          <span className="am-spacer" />
          <label className="am-cli-simulate">
            <code data-testid="api-mock-cli-simulate">{API_MOCK_CLI_SIMULATE_EXAMPLE}</code>
            <button
              type="button"
              className="am-btn small ghost"
              data-testid="api-mock-cli-simulate-copy"
              onClick={() => { void navigator.clipboard.writeText(API_MOCK_CLI_SIMULATE_EXAMPLE).catch(() => undefined); }}
            >
              Copy
            </button>
          </label>
          <label className="am-cli-simulate">
            <code data-testid="api-mock-cli-verify">{API_MOCK_CLI_VERIFY_EXAMPLE}</code>
            <button
              type="button"
              className="am-btn small ghost"
              data-testid="api-mock-cli-verify-copy"
              onClick={() => { void navigator.clipboard.writeText(API_MOCK_CLI_VERIFY_EXAMPLE).catch(() => undefined); }}
            >
              Copy
            </button>
          </label>
          <button className="am-btn small ghost" onClick={onAnalyze} data-testid="api-mock-analyze">Analyze all</button>
        </div>
      )}
    </aside>
  );
}
