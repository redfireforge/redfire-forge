import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { WsConnectionHistoryEntry, WsProtocolMode } from '@shared/websocket/types';
import { computeDropIndex } from '@shared/components/studio-tabs/computeDropIndex';
import {
  buildContextMenuItems,
  useTabContextMenu,
} from '@shared/components/studio-tabs/TabContextMenu';

// eslint-disable-next-line react-refresh/only-export-components
export { computeDropIndex };

export interface WsConnectionTabInfo {
  id: string;
  label: string;
  url?: string;
}

export type ConnectionStateHint = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WsConnectionTabBarProps {
  tabs: WsConnectionTabInfo[];
  activeTabId: string;
  maxTabs: number;
  connectionStates: Record<string, ConnectionStateHint>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onAddWithUrl?: (url: string, protocol?: WsProtocolMode) => void;
  onClose: (id: string) => void;
  onRename: (id: string, newLabel: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onDuplicate?: (tabId: string) => void;
  history?: WsConnectionHistoryEntry[];
  onClearHistory?: () => void;
}

const STATE_COLORS: Record<ConnectionStateHint, string> = {
  disconnected: 'var(--text-secondary, #666)',
  connecting: 'var(--warning-color, #ffa726)',
  connected: 'var(--success-color, #66bb6a)',
  error: 'var(--error-color, #ef5350)',
};

const DND_MIME = 'text/x-ws-tab-index';

export function WsConnectionTabBar({
  tabs,
  activeTabId,
  maxTabs,
  connectionStates,
  onSelect,
  onAdd,
  onAddWithUrl,
  onClose,
  onRename,
  onReorder,
  onDuplicate,
  history,
  onClearHistory,
}: WsConnectionTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [historyDropdownOpen, setHistoryDropdownOpen] = useState(false);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tabElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingFocusRef = useRef(false);
  const prevTabsLenRef = useRef(tabs.length);

  const startEditing = useCallback(
    (id: string, currentLabel: string) => {
      setEditingTabId(id);
      setEditValue(currentLabel);
      requestAnimationFrame(() => inputRef.current?.select());
    },
    [],
  );

  const commitEdit = useCallback(() => {
    if (editingTabId && editValue.trim()) {
      onRename(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  }, [editingTabId, editValue, onRename]);

  const handleEditKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commitEdit();
      } else if (e.key === 'Escape') {
        setEditingTabId(null);
      }
    },
    [commitEdit],
  );

  const handleTabDoubleClick = useCallback(
    (id: string, label: string) => {
      startEditing(id, label);
    },
    [startEditing],
  );

  const handleCloseClick = useCallback(
    (e: MouseEvent, id: string) => {
      e.stopPropagation();
      onClose(id);
    },
    [onClose],
  );

  const handleMiddleClick = useCallback(
    (e: MouseEvent, id: string) => {
      if (e.button === 1) {
        e.preventDefault();
        onClose(id);
      }
    },
    [onClose],
  );

  const handleHistorySelect = useCallback(
    (entry: WsConnectionHistoryEntry) => {
      setHistoryDropdownOpen(false);
      onAddWithUrl?.(entry.url, entry.protocol);
    },
    [onAddWithUrl],
  );

  // ── Drag and Drop ───────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, index: number, tabId: string) => {
      if (editingTabId) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(DND_MIME, String(index));
      setDraggingTabId(tabId);
    },
    [editingTabId],
  );

  const handleDragEnd = useCallback(
    () => {
      setDraggingTabId(null);
      setDragOverTabId(null);
      setDropSide(null);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, tabId: string) => {
      if (!e.dataTransfer.types.includes(DND_MIME)) return;
      if (tabId === draggingTabId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const side: 'before' | 'after' = e.clientX < midX ? 'before' : 'after';
      setDragOverTabId(tabId);
      setDropSide(side);
    },
    [draggingTabId],
  );

  const handleDragLeave = useCallback(
    (_e: DragEvent<HTMLDivElement>, tabId: string) => {
      setDragOverTabId((prev) => {
        if (prev === tabId) {
          setDropSide(null);
          return null;
        }
        return prev;
      });
    },
    [],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
      e.preventDefault();
      const fromStr = e.dataTransfer.getData(DND_MIME);
      if (!fromStr) return;
      const fromIndex = parseInt(fromStr, 10);
      if (Number.isNaN(fromIndex)) return;

      setDragOverTabId(null);
      setDropSide(null);

      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const toIndex = computeDropIndex(fromIndex, targetIndex, e.clientX, rect.left, rect.width);

      if (toIndex !== null && onReorder) {
        onReorder(fromIndex, toIndex);
      }
    },
    [onReorder],
  );

  // ── Keyboard Navigation ─────────────────────────────────────────────

  const handleTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, tabId: string, tabLabel: string) => {
      if (editingTabId) return;
      const currentIndex = tabs.findIndex((t) => t.id === tabId);
      if (currentIndex === -1) return;

      let targetIndex: number | undefined;
      switch (e.key) {
        case 'ArrowLeft':
          targetIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          break;
        case 'ArrowRight':
          targetIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'Home':
          targetIndex = 0;
          break;
        case 'End':
          targetIndex = tabs.length - 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect(tabId);
          return;
        case 'Delete':
          e.preventDefault();
          pendingFocusRef.current = true;
          onClose(tabId);
          return;
        case 'F2':
          e.preventDefault();
          startEditing(tabId, tabLabel);
          return;
        default:
          return;
      }

      if (targetIndex !== undefined && targetIndex !== currentIndex) {
        e.preventDefault();
        const targetTab = tabs[targetIndex];
        const el = tabElRefs.current.get(targetTab.id);
        el?.focus();
      }
    },
    [tabs, onSelect, onClose, startEditing, editingTabId],
  );

  useEffect(() => {
    const prevLen = prevTabsLenRef.current;
    prevTabsLenRef.current = tabs.length;
    if (!pendingFocusRef.current) return;
    if (tabs.length >= prevLen) {
      pendingFocusRef.current = false;
      return;
    }
    pendingFocusRef.current = false;
    const el = tabElRefs.current.get(activeTabId);
    el?.focus();
  }, [tabs.length, activeTabId]);

  useEffect(() => {
    if (!historyDropdownOpen) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setHistoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [historyDropdownOpen]);

  const showHistoryArrow = history && history.length > 0 && tabs.length < maxTabs;

  useEffect(() => {
    if (!showHistoryArrow) setHistoryDropdownOpen(false);
  }, [showHistoryArrow]);

  const setTabElRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) tabElRefs.current.set(id, el);
    else tabElRefs.current.delete(id);
  }, []);

  // ── Context Menu ─────────────────────────────────────────────────
  const ctxMenu = useTabContextMenu();

  const handleContextMenuAction = useCallback((actionId: string) => {
    const tabId = ctxMenu.menuState?.tabId;
    if (!tabId) return;
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    switch (actionId) {
      case 'rename':
        startEditing(tabId, tab.label);
        break;
      case 'duplicate':
        onDuplicate?.(tabId);
        break;
      case 'copy-label':
        void navigator.clipboard.writeText(tab.label);
        break;
      case 'close':
        onClose(tabId);
        break;
      case 'close-others':
        tabs
          .filter((t) => t.id !== tabId)
          .filter((t) => {
            const s = connectionStates[t.id];
            return s !== 'connected' && s !== 'connecting';
          })
          .forEach((t) => onClose(t.id));
        break;
      case 'close-right': {
        const idx = tabs.findIndex((t) => t.id === tabId);
        tabs
          .slice(idx + 1)
          .filter((t) => {
            const s = connectionStates[t.id];
            return s !== 'connected' && s !== 'connecting';
          })
          .forEach((t) => onClose(t.id));
        break;
      }
    }
  }, [ctxMenu.menuState, tabs, connectionStates, startEditing, onDuplicate, onClose]);

  return (
    <div
      className="ws-conn-tab-bar"
      data-testid="conn-tab-bar"
      role="tablist"
      aria-label="Connection tabs"
      aria-orientation="horizontal"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const stateHint = connectionStates[tab.id] ?? 'disconnected';
        const isEditing = editingTabId === tab.id;
        const isDragOver = dragOverTabId === tab.id;
        const isDragging = draggingTabId === tab.id;

        const dropClass = isDragOver && dropSide
          ? dropSide === 'before' ? 'ws-conn-tab-drop-before' : 'ws-conn-tab-drop-after'
          : '';

        return (
          <div
            key={tab.id}
            ref={(el) => setTabElRef(tab.id, el)}
            className={`ws-conn-tab ${isActive ? 'ws-conn-tab-active' : ''} ${isDragging ? 'ws-conn-tab-dragging' : ''} ${dropClass}`}
            onClick={() => onSelect(tab.id)}
            onDoubleClick={() => handleTabDoubleClick(tab.id, tab.label)}
            onMouseDown={(e) => handleMiddleClick(e, tab.id)}
            onContextMenu={(e) => ctxMenu.openMenu(tab.id, e)}
            onKeyDown={(e) => handleTabKeyDown(e, tab.id, tab.label)}
            draggable={!isEditing}
            onDragStart={(e) => handleDragStart(e, index, tab.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={(e) => handleDragLeave(e, tab.id)}
            onDrop={(e) => handleDrop(e, index)}
            data-testid={`conn-tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-label={`${tab.label} — ${stateHint}`}
            tabIndex={isActive ? 0 : -1}
          >
            <span
              className="ws-conn-tab-indicator"
              style={{ background: STATE_COLORS[stateHint] }}
              title={stateHint}
              data-testid={`conn-tab-indicator-${tab.id}`}
            />
            {isEditing ? (
              <input
                ref={inputRef}
                className="ws-conn-tab-rename-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                maxLength={40}
                data-testid={`conn-tab-rename-${tab.id}`}
              />
            ) : (
              <span className="ws-conn-tab-label" title={tab.label}>
                {tab.label}
              </span>
            )}
            {tabs.length > 1 && (
              <button
                type="button"
                className="ws-conn-tab-close"
                onClick={(e) => handleCloseClick(e, tab.id)}
                aria-label={`Close ${tab.label}`}
                data-testid={`conn-tab-close-${tab.id}`}
                tabIndex={-1}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="ws-conn-tab-add"
        onClick={tabs.length < maxTabs ? onAdd : undefined}
        disabled={tabs.length >= maxTabs}
        aria-label={tabs.length >= maxTabs ? `Maximum ${maxTabs} tabs` : 'New connection tab'}
        data-testid="conn-tab-add"
        title={`New connection (${tabs.length}/${maxTabs})`}
      >
        +
        <span className="ws-conn-tab-add-count" aria-hidden="true">
          {tabs.length}/{maxTabs}
        </span>
      </button>
      {showHistoryArrow && (
        <div className="ws-conn-tab-history-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="ws-conn-tab-history-trigger"
            onClick={() => setHistoryDropdownOpen((p) => !p)}
            aria-label="Recent connections"
            data-testid="conn-tab-history-trigger"
            title="Recent connections"
          >
            ▾
          </button>
          {historyDropdownOpen && (
            <div className="ws-conn-tab-history-dropdown" data-testid="conn-tab-history-dropdown">
              <div className="ws-conn-tab-history-title">Recent Connections</div>
              {history!.map((entry) => (
                <button
                  key={entry.url}
                  type="button"
                  className="ws-conn-tab-history-item"
                  onClick={() => handleHistorySelect(entry)}
                  title={entry.url}
                  data-testid={`conn-tab-history-item-${entry.url}`}
                >
                  <span className="ws-conn-tab-history-url">{entry.url}</span>
                  <span className="ws-conn-tab-history-meta">
                    {entry.protocol !== 'auto' && entry.protocol !== 'raw' && (
                      <span className="ws-conn-tab-history-protocol">{entry.protocol}</span>
                    )}
                    <span className="ws-conn-tab-history-time">{formatRelativeTime(entry.lastUsed)}</span>
                  </span>
                </button>
              ))}
              {onClearHistory && history!.length > 0 && (
                <>
                  <div className="ws-conn-tab-history-divider" />
                  <button
                    type="button"
                    className="ws-conn-tab-history-item ws-conn-tab-history-clear"
                    onClick={() => { onClearHistory(); setHistoryDropdownOpen(false); }}
                    data-testid="conn-tab-history-clear"
                  >
                    <span className="ws-conn-tab-history-url">Clear History</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {ctxMenu.renderMenu(
        ctxMenu.menuState
          ? buildContextMenuItems({
              tabId: ctxMenu.menuState.tabId,
              tabLabel: tabs.find((t) => t.id === ctxMenu.menuState!.tabId)?.label ?? '',
              tabIndex: tabs.findIndex((t) => t.id === ctxMenu.menuState!.tabId),
              totalTabs: tabs.length,
              canDuplicate: tabs.length < maxTabs && Boolean(onDuplicate),
              canClose: tabs.length > 1,
            })
          : [],
        handleContextMenuAction,
      )}
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 0 || Number.isNaN(diff)) return '';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
