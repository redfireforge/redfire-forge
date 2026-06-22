/**
 * GraphqlHistoryPanel — Phase 3A (task 3A-2)
 *
 * Full-height sidebar showing operation history for the current connection.
 * Features:
 *  - "Recent" pinned section (top 5) before recency dividers
 *  - Recency groups: Today / Yesterday / Last 7 days / Older
 *  - Operation type badge (Q/M/S), status icon (✓/✗), latency
 *  - Click → side-panel preview (right of list)
 *  - Double-click → load into editor
 *  - Context menu: Save to Collection, Copy query, Copy as cURL, Delete
 *  - Truncation banner for capped responses
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';
import type { UseGraphqlHistoryResult } from '../hooks/useGraphqlHistory';
import { DEFAULT_MAX_ITEMS } from '../hooks/useGraphqlHistory';
import { historyEntrySummary } from '../utils/historyItemParse';
import { GraphqlHistoryComparePanel } from './GraphqlHistoryComparePanel';
import { HistoryGroup } from './GraphqlHistoryList';
import { GraphqlHistoryPreviewPanel } from './GraphqlHistoryPreviewPanel';

const ONE_DAY_MS = 86_400_000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export interface GraphqlHistoryPanelProps {
  history: UseGraphqlHistoryResult;
  onLoadIntoEditor: (item: GraphqlHistoryItem) => void;
  /** Load the item into the editor AND immediately execute it */
  onRunInEditor?: (item: GraphqlHistoryItem) => void;
  onSaveToCollection: (item: GraphqlHistoryItem) => void;
  /** Current history ring-buffer max (10–500). Passed from parent state. */
  maxItems?: number;
  /** Called when the user changes the max-items setting */
  onMaxItemsChange?: (n: number) => void;
  /** Current endpoint URL — used by "Copy as cURL" to include the real URL */
  endpoint?: string;
}

export function GraphqlHistoryPanel({
  history,
  onLoadIntoEditor,
  onRunInEditor,
  onSaveToCollection,
  maxItems = DEFAULT_MAX_ITEMS,
  onMaxItemsChange,
  endpoint = '',
}: GraphqlHistoryPanelProps) {
  const [searchQuery, setSearchQuery]         = useState('');
  const [selectedItem, setSelectedItem]       = useState<GraphqlHistoryItem | null>(null);
  const [compareMode, setCompareMode]         = useState(false);
  const [compareAId, setCompareAId]           = useState<string | null>(null);
  const [compareBId, setCompareBId]           = useState<string | null>(null);
  const [compareViewOpen, setCompareViewOpen] = useState(false);
  const [contextMenu, setContextMenu]         = useState<{ x: number; y: number; item: GraphqlHistoryItem } | null>(null);
  const [settingsOpen, setSettingsOpen]       = useState(false);
  const [clearConfirm, setClearConfirm]       = useState(false);
  // Snapshot of "now" captured once per panel mount (used for Today/Yesterday/… grouping).
  // History groupings are relative to mount time — close enough for a history sidebar.
  const [mountTime]                           = useState<number>(() => Date.now());
  const contextMenuRef                        = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => searchQuery.trim() ? history.search(searchQuery) : history.items,
    [history, searchQuery],
  );

  const { recent, grouped } = useMemo(() => {
    const now = mountTime;
    const recentIds = new Set(history.recentItems.map((i) => i.id));
    const nonRecent = filtered.filter((i) => !recentIds.has(i.id));
    const today: GraphqlHistoryItem[] = [];
    const yesterday: GraphqlHistoryItem[] = [];
    const week: GraphqlHistoryItem[] = [];
    const older: GraphqlHistoryItem[] = [];
    for (const item of nonRecent) {
      const age = now - item.timestamp;
      if (age < ONE_DAY_MS) today.push(item);
      else if (age < 2 * ONE_DAY_MS) yesterday.push(item);
      else if (age < SEVEN_DAYS_MS) week.push(item);
      else older.push(item);
    }
    return {
      recent: history.recentItems.filter((i) => filtered.some((f) => f.id === i.id)),
      grouped: { today, yesterday, week, older },
    };
  }, [filtered, history.recentItems, mountTime]);

  const handleItemClick = useCallback((item: GraphqlHistoryItem) => {
    if (compareMode) return;
    setSelectedItem(item);
  }, [compareMode]);

  const toggleCompareMark = useCallback((itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (compareAId === itemId) {
      setCompareAId(null);
      return;
    }
    if (compareBId === itemId) {
      setCompareBId(null);
      return;
    }
    if (!compareAId) {
      setCompareAId(itemId);
      return;
    }
    if (!compareBId) {
      setCompareBId(itemId);
      return;
    }
    setCompareBId(itemId);
  }, [compareAId, compareBId]);

  const compareItemA = compareAId ? history.items.find((i) => i.id === compareAId) ?? null : null;
  const compareItemB = compareBId ? history.items.find((i) => i.id === compareBId) ?? null : null;
  const canOpenCompare = !!(compareItemA && compareItemB);

  const handleCompareToggle = useCallback(() => {
    setContextMenu(null);
    setCompareMode((v) => {
      const next = !v;
      if (!next) {
        setCompareAId(null);
        setCompareBId(null);
        setCompareViewOpen(false);
      }
      return next;
    });
    setSelectedItem(null);
  }, []);

  const handleOpenCompare = useCallback(() => {
    if (compareItemA && compareItemB) {
      setContextMenu(null);
      setSelectedItem(null);
      setCompareViewOpen(true);
    }
  }, [compareItemA, compareItemB]);

  // Close compare view if marked entries were deleted or cleared
  useEffect(() => {
    if (compareViewOpen && (!compareItemA || !compareItemB)) {
      setCompareViewOpen(false);
    }
  }, [compareViewOpen, compareItemA, compareItemB]);

  // Drop stale slot ids when the underlying history row was deleted/evicted
  useEffect(() => {
    if (compareAId && !history.items.some((i) => i.id === compareAId)) {
      setCompareAId(null);
    }
    if (compareBId && !history.items.some((i) => i.id === compareBId)) {
      setCompareBId(null);
    }
  }, [history.items, compareAId, compareBId]);

  const handleItemDoubleClick = useCallback((item: GraphqlHistoryItem) => {
    if (compareMode) return;
    onLoadIntoEditor(item);
    setSelectedItem(null);
  }, [compareMode, onLoadIntoEditor]);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: GraphqlHistoryItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const copyQuery = useCallback((item: GraphqlHistoryItem) => {
    navigator.clipboard.writeText(item.operation.query).catch(() => {});
    closeContextMenu();
  }, [closeContextMenu]);

  const copyAsCurl = useCallback((item: GraphqlHistoryItem, endpointUrl: string) => {
    // Parse variables string to object so JSON.stringify embeds it as a nested object,
    // not a double-encoded string. Fall back to {} if empty or invalid.
    let parsedVars: unknown = {};
    try {
      const raw = item.operation.variables?.trim();
      if (raw && raw !== '{}') parsedVars = JSON.parse(raw);
    } catch { /* leave as {} */ }
    const body = JSON.stringify({ query: item.operation.query, variables: parsedVars });
    const url = endpointUrl.trim() || '<endpoint>';
    const curl = `curl -X POST -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}' '${url}'`;
    navigator.clipboard.writeText(curl).catch(() => {});
    closeContextMenu();
  }, [closeContextMenu]);

  // handleMaxItemsInput MUST be declared before any early return to satisfy React Rules of Hooks
  const handleMaxItemsInput = useCallback((raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) {
      const clamped = Math.max(10, Math.min(500, n));
      onMaxItemsChange?.(clamped);
    }
  }, [onMaxItemsChange]);

  if (history.loading) {
    return <div className="gql-history-panel gql-history-panel--loading" aria-label="Loading history">
      <div className="gql-history-spinner" aria-hidden="true" />
    </div>;
  }

  return (
    <div className="gql-history-panel" data-testid="gql-history-panel">
      {/* Header */}
      <div className="gql-history-header">
        <span className="gql-history-title">History</span>
        <button
          type="button"
          className={`gql-history-compare-toggle${compareMode ? ' gql-history-compare-toggle--active' : ''}`}
          onClick={handleCompareToggle}
          title="Mark two entries to compare variables and response data"
          aria-label="Compare history entries"
          aria-pressed={compareMode}
          data-testid="gql-history-compare-toggle"
        >
          Compare
        </button>
        <button
          type="button"
          className={`gql-history-settings-btn${settingsOpen ? ' gql-history-settings-btn--active' : ''}`}
          onClick={() => setSettingsOpen((v) => !v)}
          title="History settings"
          aria-label="History settings"
          aria-expanded={settingsOpen}
          data-testid="gql-history-settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        {clearConfirm ? (
          <span className="gql-history-clear-confirm" data-testid="gql-history-clear-confirm">
            <span className="gql-history-clear-confirm-label">Clear all?</span>
            <button
              type="button"
              className="gql-history-clear-confirm-yes"
              onClick={() => {
                history.clearAll();
                setClearConfirm(false);
                setContextMenu(null);
                setSelectedItem(null);
                setSearchQuery('');
                setCompareMode(false);
                setCompareAId(null);
                setCompareBId(null);
                setCompareViewOpen(false);
              }}
              aria-label="Confirm clear all history"
              data-testid="gql-history-clear-yes"
            >
              Yes
            </button>
            <button
              type="button"
              className="gql-history-clear-confirm-no"
              onClick={() => setClearConfirm(false)}
              aria-label="Cancel clear history"
              data-testid="gql-history-clear-no"
            >
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="gql-history-clear-btn"
            onClick={() => setClearConfirm(true)}
            title="Clear all history for this connection"
            aria-label="Clear history"
            data-testid="gql-history-clear"
          >
            Clear
          </button>
        )}
      </div>

      {/* Settings row — 3A-7: history max-items configuration */}
      {settingsOpen && (
        <div className="gql-history-settings-row" data-testid="gql-history-settings-row">
          <label className="gql-history-settings-label" htmlFor="gql-history-max-items">
            Max entries
          </label>
          <input
            id="gql-history-max-items"
            type="number"
            className="gql-history-settings-input"
            min={10}
            max={500}
            step={10}
            value={maxItems}
            onChange={(e) => handleMaxItemsInput(e.target.value)}
            aria-label="Maximum history entries (10–500)"
            data-testid="gql-history-max-items"
          />
          <span className="gql-history-settings-hint">10–500</span>
        </div>
      )}

      {/* Search */}
      <div className="gql-history-search">
        <input
          type="search"
          className="gql-history-search-input"
          placeholder="Search name, query, variables, response…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search history"
          data-testid="gql-history-search"
        />
      </div>

      {compareMode && (
        <div className="gql-history-compare-bar" data-testid="gql-history-compare-bar">
          <span className="gql-history-compare-bar-hint">
            Mark two runs with <strong>A</strong> / <strong>B</strong>, then compare.
          </span>
          <div className="gql-history-compare-slots">
            <span
              className={`gql-history-compare-slot${compareItemA ? ' gql-history-compare-slot--filled' : ''}`}
              data-testid="gql-history-compare-slot-a"
              data-filled={compareItemA ? 'true' : 'false'}
            >
              A: {compareItemA ? historyEntrySummary(compareItemA) : '—'}
            </span>
            <span
              className={`gql-history-compare-slot${compareItemB ? ' gql-history-compare-slot--filled' : ''}`}
              data-testid="gql-history-compare-slot-b"
              data-filled={compareItemB ? 'true' : 'false'}
            >
              B: {compareItemB ? historyEntrySummary(compareItemB) : '—'}
            </span>
          </div>
          <button
            type="button"
            className="gql-history-compare-btn"
            disabled={!canOpenCompare}
            onClick={handleOpenCompare}
            data-testid="gql-history-compare-btn"
          >
            View comparison
          </button>
        </div>
      )}

      {/* List OR preview OR compare — keeps the main editor visible */}
      <div className={`gql-history-body${selectedItem || compareViewOpen ? ' gql-history-body--detail' : ''}`}>
        {compareViewOpen && compareItemA && compareItemB ? (
          <GraphqlHistoryComparePanel
            itemA={compareItemA}
            itemB={compareItemB}
            onClose={() => {
              setCompareViewOpen(false);
              setCompareMode(false);
              setCompareAId(null);
              setCompareBId(null);
            }}
            onBack={() => setCompareViewOpen(false)}
          />
        ) : selectedItem ? (
          <GraphqlHistoryPreviewPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onLoadIntoEditor={onLoadIntoEditor}
            onRunInEditor={onRunInEditor}
            onSaveToCollection={onSaveToCollection}
          />
        ) : (
          <div className="gql-history-list" role="listbox" aria-label="History entries">
            {history.items.length === 0 && (
              <div className="gql-history-empty">No history yet. Execute a query to see it here.</div>
            )}
            {filtered.length === 0 && history.items.length > 0 && (
              <div className="gql-history-empty">No results for "{searchQuery}"</div>
            )}

            {recent.length > 0 && (
              <HistoryGroup label="Recent" items={recent} selected={selectedItem}
                compareMode={compareMode} compareAId={compareAId} compareBId={compareBId}
                onCompareMark={toggleCompareMark}
                onItemClick={handleItemClick} onItemDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} />
            )}
            {grouped.today.length > 0 && (
              <HistoryGroup label="Today" items={grouped.today} selected={selectedItem}
                compareMode={compareMode} compareAId={compareAId} compareBId={compareBId}
                onCompareMark={toggleCompareMark}
                onItemClick={handleItemClick} onItemDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} />
            )}
            {grouped.yesterday.length > 0 && (
              <HistoryGroup label="Yesterday" items={grouped.yesterday} selected={selectedItem}
                compareMode={compareMode} compareAId={compareAId} compareBId={compareBId}
                onCompareMark={toggleCompareMark}
                onItemClick={handleItemClick} onItemDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} />
            )}
            {grouped.week.length > 0 && (
              <HistoryGroup label="Last 7 days" items={grouped.week} selected={selectedItem}
                compareMode={compareMode} compareAId={compareAId} compareBId={compareBId}
                onCompareMark={toggleCompareMark}
                onItemClick={handleItemClick} onItemDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} />
            )}
            {grouped.older.length > 0 && (
              <HistoryGroup label="Older" items={grouped.older} selected={selectedItem}
                compareMode={compareMode} compareAId={compareAId} compareBId={compareBId}
                onCompareMark={toggleCompareMark}
                onItemClick={handleItemClick} onItemDoubleClick={handleItemDoubleClick} onContextMenu={handleContextMenu} />
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="gql-history-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
          data-testid="gql-history-context-menu"
          onMouseLeave={closeContextMenu}
        >
          <button type="button" role="menuitem" onClick={() => { onSaveToCollection(contextMenu.item); closeContextMenu(); }}>Save to Collection</button>
          <button type="button" role="menuitem" onClick={() => copyQuery(contextMenu.item)}>Copy query</button>
          <button type="button" role="menuitem" onClick={() => copyAsCurl(contextMenu.item, endpoint)}>Copy as cURL</button>
          <button type="button" role="menuitem" className="gql-history-ctx-danger" onClick={() => {
            // Clear the preview panel if the deleted item is currently selected so
            // the side-panel doesn't keep showing a deleted entry.
            if (selectedItem?.id === contextMenu.item.id) setSelectedItem(null);
            if (compareAId === contextMenu.item.id) setCompareAId(null);
            if (compareBId === contextMenu.item.id) setCompareBId(null);
            if (compareViewOpen && (compareAId === contextMenu.item.id || compareBId === contextMenu.item.id)) {
              setCompareViewOpen(false);
            }
            history.deleteItem(contextMenu.item.id);
            closeContextMenu();
          }}>Delete</button>
        </div>
      )}
    </div>
  );
}
