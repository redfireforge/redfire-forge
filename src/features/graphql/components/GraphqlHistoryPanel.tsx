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

import { useCallback, useMemo, useRef, useState } from 'react';
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';
import type { UseGraphqlHistoryResult } from '../hooks/useGraphqlHistory';
import { DEFAULT_MAX_ITEMS } from '../hooks/useGraphqlHistory';

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
  const [contextMenu, setContextMenu]         = useState<{ x: number; y: number; item: GraphqlHistoryItem } | null>(null);
  const [settingsOpen, setSettingsOpen]       = useState(false);
  const [clearConfirm, setClearConfirm]       = useState(false);
  // Snapshot of "now" captured once per panel mount (used for Today/Yesterday/… grouping).
  // History groupings are relative to mount time — close enough for a history sidebar.
  const [mountTime]                           = useState<number>(() => Date.now());
  const contextMenuRef                        = useRef<HTMLDivElement>(null);
  const lastClickRef                          = useRef<{ id: string; time: number } | null>(null);

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
    const prev = lastClickRef.current;
    const now = Date.now();
    if (prev && prev.id === item.id && now - prev.time < 400) {
      // Double-click: load into editor
      onLoadIntoEditor(item);
      lastClickRef.current = null;
    } else {
      lastClickRef.current = { id: item.id, time: now };
      setSelectedItem(item);
    }
  }, [onLoadIntoEditor]);

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
              onClick={() => { history.clearAll(); setClearConfirm(false); }}
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
          placeholder="Search by name or query…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search history"
          data-testid="gql-history-search"
        />
      </div>

      {/* List + Preview split */}
      <div className="gql-history-body">
        <div className="gql-history-list" role="listbox" aria-label="History entries">
          {history.items.length === 0 && (
            <div className="gql-history-empty">No history yet. Execute a query to see it here.</div>
          )}
          {filtered.length === 0 && history.items.length > 0 && (
            <div className="gql-history-empty">No results for "{searchQuery}"</div>
          )}

          {recent.length > 0 && (
            <HistoryGroup label="Recent" items={recent} selected={selectedItem}
              onItemClick={handleItemClick} onContextMenu={handleContextMenu} />
          )}
          {grouped.today.length > 0 && (
            <HistoryGroup label="Today" items={grouped.today} selected={selectedItem}
              onItemClick={handleItemClick} onContextMenu={handleContextMenu} />
          )}
          {grouped.yesterday.length > 0 && (
            <HistoryGroup label="Yesterday" items={grouped.yesterday} selected={selectedItem}
              onItemClick={handleItemClick} onContextMenu={handleContextMenu} />
          )}
          {grouped.week.length > 0 && (
            <HistoryGroup label="Last 7 days" items={grouped.week} selected={selectedItem}
              onItemClick={handleItemClick} onContextMenu={handleContextMenu} />
          )}
          {grouped.older.length > 0 && (
            <HistoryGroup label="Older" items={grouped.older} selected={selectedItem}
              onItemClick={handleItemClick} onContextMenu={handleContextMenu} />
          )}
        </div>

        {/* Side-panel preview */}
        {selectedItem && (
          <HistoryPreviewPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onLoadIntoEditor={onLoadIntoEditor}
            onRunInEditor={onRunInEditor}
            onSaveToCollection={onSaveToCollection}
          />
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
            history.deleteItem(contextMenu.item.id);
            closeContextMenu();
          }}>Delete</button>
        </div>
      )}
    </div>
  );
}

// ─── History group ──────────────────────────────────────────────────────────

interface HistoryGroupProps {
  label: string;
  items: GraphqlHistoryItem[];
  selected: GraphqlHistoryItem | null;
  onItemClick: (item: GraphqlHistoryItem) => void;
  onContextMenu: (e: React.MouseEvent, item: GraphqlHistoryItem) => void;
}

function HistoryGroup({ label, items, selected, onItemClick, onContextMenu }: HistoryGroupProps) {
  return (
    <div className="gql-history-group">
      <div className="gql-history-group-label">{label}</div>
      {items.map((item) => (
        <HistoryEntryRow
          key={item.id}
          item={item}
          selected={selected?.id === item.id}
          onClick={() => onItemClick(item)}
          onContextMenu={(e) => onContextMenu(e, item)}
        />
      ))}
    </div>
  );
}

// ─── History entry row ──────────────────────────────────────────────────────

interface HistoryEntryRowProps {
  item: GraphqlHistoryItem;
  selected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function HistoryEntryRow({ item, selected, onClick, onContextMenu }: HistoryEntryRowProps) {
  const opType = item.operation.operationType;
  const badge = opType === 'query' ? 'Q' : opType === 'mutation' ? 'M' : 'S';
  const badgeClass = `gql-history-badge gql-history-badge--${opType}`;
  const opName = item.operation.name ?? '(anonymous)';
  const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`gql-history-entry${selected ? ' gql-history-entry--selected' : ''}`}
      role="option"
      aria-selected={selected}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${opType}: ${opName} — ${item.latencyMs}ms`}
      data-testid="gql-history-entry"
    >
      <span className={badgeClass}>{badge}</span>
      <span className="gql-history-entry-name">{opName}</span>
      <span className={`gql-history-status${item.status === 'error' ? ' gql-history-status--error' : ''}`}>
        {item.status === 'success' ? '✓' : '✗'}
      </span>
      <span className="gql-history-latency">{item.latencyMs}ms</span>
      <span className="gql-history-time">{time}</span>
    </div>
  );
}

// ─── Preview panel ──────────────────────────────────────────────────────────

interface HistoryPreviewPanelProps {
  item: GraphqlHistoryItem;
  onClose: () => void;
  onLoadIntoEditor: (item: GraphqlHistoryItem) => void;
  onRunInEditor?: (item: GraphqlHistoryItem) => void;
  onSaveToCollection: (item: GraphqlHistoryItem) => void;
}

function HistoryPreviewPanel({ item, onClose, onLoadIntoEditor, onRunInEditor, onSaveToCollection }: HistoryPreviewPanelProps) {
  const isTruncated = item.response.includes('__TRUNCATED__');
  let prettyResponse = '';
  try {
    const raw = isTruncated ? item.response.replace('\n__TRUNCATED__', '') : item.response;
    prettyResponse = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    prettyResponse = item.response;
  }

  return (
    <div className="gql-history-preview" data-testid="gql-history-preview">
      <div className="gql-history-preview-header">
        <span className="gql-history-preview-title">
          {item.operation.name ?? 'Anonymous'} — {item.latencyMs}ms
        </span>
        <button type="button" className="gql-history-preview-close" onClick={onClose} aria-label="Close preview">✕</button>
      </div>
      <div className="gql-history-preview-query">
        <pre className="gql-history-preview-pre">{item.operation.query}</pre>
      </div>
      {isTruncated && (
        <div className="gql-history-truncation-banner" role="status">
          Response was truncated at 512KB. Re-execute the query to see the full response.
        </div>
      )}
      <div className="gql-history-preview-response">
        <pre className="gql-history-preview-pre">{prettyResponse}</pre>
      </div>
      <div className="gql-history-preview-actions">
        <button type="button" className="gql-history-preview-btn" onClick={() => onLoadIntoEditor(item)} data-testid="gql-history-load">
          Load into editor
        </button>
        {onRunInEditor && (
          <button type="button" className="gql-history-preview-btn gql-history-preview-btn--primary" onClick={() => onRunInEditor(item)} data-testid="gql-history-run">
            Open &amp; Run
          </button>
        )}
        <button type="button" className="gql-history-preview-btn" onClick={() => onSaveToCollection(item)} data-testid="gql-history-save-to-col">
          Save to Collection
        </button>
      </div>
    </div>
  );
}
