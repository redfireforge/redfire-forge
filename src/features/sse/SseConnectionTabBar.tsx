import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { SseConnectionState, SseConnectionTab } from './sseTypes';
import { SSE_MAX_TABS } from './sseTypes';
import { computeDropIndex } from '@shared/components/studio-tabs/computeDropIndex';
import {
  buildContextMenuItems,
  useTabContextMenu,
} from '@shared/components/studio-tabs/TabContextMenu';

// eslint-disable-next-line react-refresh/only-export-components
export { computeDropIndex };

export interface SseConnectionTabBarProps {
  tabs: SseConnectionTab[];
  activeTabId: string;
  connectionStates: Record<string, SseConnectionState>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: (id: string) => void;
  onRename: (id: string, newLabel: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onDuplicate?: (tabId: string) => void;
}

const STATE_COLORS: Record<SseConnectionState, string> = {
  idle: 'var(--text-secondary, #666)',
  disconnected: 'var(--text-secondary, #666)',
  connecting: 'var(--warning-color, #ffa726)',
  connected: 'var(--success-color, #66bb6a)',
  error: 'var(--error-color, #ef5350)',
};

const DND_MIME = 'text/x-sse-tab-index';

export function SseConnectionTabBar({
  tabs,
  activeTabId,
  connectionStates,
  onSelect,
  onAdd,
  onClose,
  onRename,
  onReorder,
  onDuplicate,
}: SseConnectionTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingFocusRef = useRef(false);
  const prevTabsLenRef = useRef(tabs.length);

  const startEditing = useCallback((id: string, currentLabel: string) => {
    setEditingTabId(id);
    setEditValue(currentLabel);
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  const commitEdit = useCallback(() => {
    if (editingTabId && editValue.trim()) {
      onRename(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  }, [editingTabId, editValue, onRename]);

  const handleEditKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commitEdit();
      else if (e.key === 'Escape') setEditingTabId(null);
    },
    [commitEdit],
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

  // ── Drag and Drop ──────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, index: number, tabId: string) => {
      if (editingTabId) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(DND_MIME, String(index));
      setDraggingTabId(tabId);
    },
    [editingTabId],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingTabId(null);
    setDragOverTabId(null);
    setDropSide(null);
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, tabId: string) => {
      if (!e.dataTransfer.types.includes(DND_MIME)) return;
      if (tabId === draggingTabId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      setDragOverTabId(tabId);
      setDropSide(e.clientX < midX ? 'before' : 'after');
    },
    [draggingTabId],
  );

  const handleDragLeave = useCallback((_e: DragEvent<HTMLDivElement>, tabId: string) => {
    setDragOverTabId((prev) => {
      if (prev === tabId) { setDropSide(null); return null; }
      return prev;
    });
  }, []);

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
      if (toIndex !== null && onReorder) onReorder(fromIndex, toIndex);
    },
    [onReorder],
  );

  // ── Keyboard Navigation ────────────────────────────────────────

  const handleTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, tabId: string, tabLabel: string) => {
      if (editingTabId) return;
      const currentIndex = tabs.findIndex((t) => t.id === tabId);
      if (currentIndex === -1) return;

      let targetIndex = -1;
      switch (e.key) {
        case 'ArrowLeft':
          targetIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          break;
        case 'ArrowRight':
          targetIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'Home': targetIndex = 0; break;
        case 'End': targetIndex = tabs.length - 1; break;
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
        default: return;
      }

      if (targetIndex >= 0 && targetIndex !== currentIndex) {
        e.preventDefault();
        const el = tabElRefs.current.get(tabs[targetIndex].id);
        el?.focus();
      }
    },
    [tabs, onSelect, onClose, startEditing, editingTabId],
  );

  useEffect(() => {
    const prevLen = prevTabsLenRef.current;
    prevTabsLenRef.current = tabs.length;
    if (!pendingFocusRef.current) return;
    if (tabs.length >= prevLen) { pendingFocusRef.current = false; return; }
    pendingFocusRef.current = false;
    tabElRefs.current.get(activeTabId)?.focus();
  }, [tabs.length, activeTabId]);

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
      className="sse-conn-tab-bar"
      data-testid="sse-conn-tab-bar"
      role="tablist"
      aria-label="SSE connection tabs"
      aria-orientation="horizontal"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const stateHint = connectionStates[tab.id] ?? 'idle';
        const isEditing = editingTabId === tab.id;
        const isDragOver = dragOverTabId === tab.id;
        const isDragging = draggingTabId === tab.id;

        const dropClass = isDragOver && dropSide
          ? dropSide === 'before' ? 'sse-conn-tab-drop-before' : 'sse-conn-tab-drop-after'
          : '';

        return (
          <div
            key={tab.id}
            ref={(el) => setTabElRef(tab.id, el)}
            className={`sse-conn-tab ${isActive ? 'sse-conn-tab-active' : ''} ${isDragging ? 'sse-conn-tab-dragging' : ''} ${dropClass}`}
            onClick={() => onSelect(tab.id)}
            onDoubleClick={() => startEditing(tab.id, tab.label)}
            onMouseDown={(e) => handleMiddleClick(e, tab.id)}
            onContextMenu={(e) => ctxMenu.openMenu(tab.id, e)}
            onKeyDown={(e) => handleTabKeyDown(e, tab.id, tab.label)}
            draggable={!isEditing}
            onDragStart={(e) => handleDragStart(e, index, tab.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={(e) => handleDragLeave(e, tab.id)}
            onDrop={(e) => handleDrop(e, index)}
            data-testid="sse-conn-tab-item"
            data-tab-id={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-label={`${tab.label} — ${stateHint}`}
            tabIndex={isActive ? 0 : -1}
          >
            <span
              className="sse-conn-tab-indicator"
              style={{ background: STATE_COLORS[stateHint] }}
              title={stateHint}
            />
            {isEditing ? (
              <input
                ref={inputRef}
                className="sse-conn-tab-rename-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                maxLength={40}
                data-testid="sse-conn-tab-rename"
              />
            ) : (
              <span className="sse-conn-tab-label" title={tab.label}>
                {tab.label}
              </span>
            )}
            {tabs.length > 1 && (
              <button
                type="button"
                className="sse-conn-tab-close"
                onClick={(e) => handleCloseClick(e, tab.id)}
                aria-label={`Close ${tab.label}`}
                data-testid="sse-conn-tab-close"
                tabIndex={-1}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      {tabs.length < SSE_MAX_TABS && (
        <button
          type="button"
          className="sse-conn-tab-add"
          onClick={onAdd}
          aria-label="New SSE connection tab"
          data-testid="sse-conn-tab-add"
          title={`New connection (${tabs.length}/${SSE_MAX_TABS})`}
        >
          +
        </button>
      )}

      {ctxMenu.renderMenu(
        ctxMenu.menuState
          ? buildContextMenuItems({
              tabId: ctxMenu.menuState.tabId,
              tabLabel: tabs.find((t) => t.id === ctxMenu.menuState!.tabId)?.label ?? '',
              tabIndex: tabs.findIndex((t) => t.id === ctxMenu.menuState!.tabId),
              totalTabs: tabs.length,
              canDuplicate: tabs.length < SSE_MAX_TABS && Boolean(onDuplicate),
              canClose: tabs.length > 1,
            })
          : [],
        handleContextMenuAction,
      )}
    </div>
  );
}
