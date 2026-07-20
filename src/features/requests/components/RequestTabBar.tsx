import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { RequestTab } from '../../../shared/types';
import { REQUEST_MAX_TABS } from '../../../shared/types/requests';
import { METHOD_COLORS } from '../../../shared/constants/httpMethodColors';
import { useTabDragReorder } from '../../../shared/components/studio-tabs/useTabDragReorder';
import {
  buildContextMenuItems,
  useTabContextMenu,
} from '../../../shared/components/studio-tabs/TabContextMenu';

export interface RequestTabBarProps {
  tabs: RequestTab[];
  activeTabId: string;
  methodByRequestId: Record<string, string | undefined>;
  onSelect: (tabId: string) => void;
  onAdd: () => void;
  onClose: (tabId: string) => void;
  onRename: (tabId: string, label: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onDuplicate?: (tabId: string) => void;
  onCloseOthers?: (tabId: string) => void;
  onCloseRight?: (tabId: string) => void;
  onCloseAll?: () => void;
}

export function RequestTabBar({
  tabs,
  activeTabId,
  methodByRequestId,
  onSelect,
  onAdd,
  onClose,
  onRename,
  onReorder,
  onDuplicate,
  onCloseOthers,
  onCloseRight,
  onCloseAll,
}: RequestTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tabElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingFocusRef = useRef(false);
  const prevTabsLenRef = useRef(tabs.length);

  const startEditing = useCallback((tabId: string, currentLabel: string) => {
    setEditingTabId(tabId);
    setEditValue(currentLabel);
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  const commitEdit = useCallback(() => {
    if (editingTabId && editValue.trim()) {
      onRename(editingTabId, editValue.trim().slice(0, 40));
    }
    setEditingTabId(null);
  }, [editingTabId, editValue, onRename]);

  const handleEditKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.stopPropagation();
      if (e.key === 'Enter') commitEdit();
      else setEditingTabId(null);
    }
  }, [commitEdit]);

  const handleCloseClick = useCallback((e: MouseEvent, tabId: string) => {
    e.stopPropagation();
    onClose(tabId);
  }, [onClose]);

  const canAdd = tabs.length < REQUEST_MAX_TABS;

  // ── Drag & Drop ──────────────────────────────────────────────────
  const dnd = useTabDragReorder({
    mimeType: 'text/x-req-tab-index',
    isEditing: editingTabId !== null,
    onReorder,
  });

  // ── Keyboard Navigation ──────────────────────────────────────────
  const handleTabKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, tabId: string) => {
    if (editingTabId) return;
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;

    let targetIndex = -1;
    switch (e.key) {
      case 'ArrowRight':
        targetIndex = (idx + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        targetIndex = (idx - 1 + tabs.length) % tabs.length;
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
        if (tabs.length > 1) {
          e.preventDefault();
          pendingFocusRef.current = true;
          onClose(tabId);
        }
        return;
      case 'F2':
        e.preventDefault();
        startEditing(tabId, tabs[idx].label);
        return;
      default:
        return;
    }

    if (targetIndex >= 0 && targetIndex !== idx) {
      e.preventDefault();
      const el = tabElRefs.current.get(tabs[targetIndex].id);
      el?.focus();
    }
  }, [tabs, editingTabId, onSelect, onClose, startEditing]);

  useEffect(() => {
    const prevLen = prevTabsLenRef.current;
    prevTabsLenRef.current = tabs.length;
    if (!pendingFocusRef.current) return;
    if (tabs.length >= prevLen) { pendingFocusRef.current = false; return; }
    pendingFocusRef.current = false;
    tabElRefs.current.get(activeTabId)?.focus();
  }, [tabs.length, activeTabId]);

  // ── Context Menu ─────────────────────────────────────────────────
  const ctxMenu = useTabContextMenu();

  const handleContextMenuAction = useCallback((actionId: string) => {
    const tabId = ctxMenu.menuState?.tabId;
    if (!tabId) return;

    switch (actionId) {
      case 'rename': {
        const tab = tabs.find(t => t.id === tabId);
        if (tab) startEditing(tabId, tab.label);
        break;
      }
      case 'duplicate':
        onDuplicate?.(tabId);
        break;
      case 'copy-label': {
        const tab = tabs.find(t => t.id === tabId);
        if (tab) void navigator.clipboard.writeText(tab.label);
        break;
      }
      case 'close':
        onClose(tabId);
        break;
      case 'close-others':
        onCloseOthers?.(tabId);
        break;
      case 'close-right':
        onCloseRight?.(tabId);
        break;
    }
  }, [ctxMenu.menuState, tabs, startEditing, onDuplicate, onClose, onCloseOthers, onCloseRight]);

  const setTabElRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) tabElRefs.current.set(id, el);
    else tabElRefs.current.delete(id);
  }, []);

  return (
    <div className="req-tab-bar" data-testid="req-tab-bar">
      <div className="req-tab-bar__scroll">
        <div className="req-tab-bar__list" role="tablist" aria-label="Request tabs">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const method = (methodByRequestId[tab.requestId] ?? 'GET').toUpperCase();
            const methodColor = METHOD_COLORS[method] ?? '#94a3b8';
            const isDragging = dnd.draggingTabId === tab.id;
            const dropClass = dnd.dropClassFor(tab.id);

            return (
              <div
                key={tab.id}
                ref={(el) => setTabElRef(tab.id, el)}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={`req-tab-bar__tab${isActive ? ' req-tab-bar__tab--active' : ''}${isDragging ? ' req-tab-bar__tab--dragging' : ''} ${dropClass}`}
                data-testid="req-tab-item"
                data-tab-id={tab.id}
                title={tab.label}
                onClick={() => onSelect(tab.id)}
                onDoubleClick={() => startEditing(tab.id, tab.label)}
                onContextMenu={(e) => ctxMenu.openMenu(tab.id, e)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                draggable={editingTabId !== tab.id}
                onDragStart={(e) => dnd.handleDragStart(e as unknown as React.DragEvent<HTMLElement>, index, tab.id)}
                onDragEnd={dnd.handleDragEnd}
                onDragOver={(e) => dnd.handleDragOver(e as unknown as React.DragEvent<HTMLElement>, tab.id)}
                onDragLeave={(e) => dnd.handleDragLeave(e as unknown as React.DragEvent<HTMLElement>, tab.id)}
                onDrop={(e) => dnd.handleDrop(e as unknown as React.DragEvent<HTMLElement>, index)}
              >
                <span
                  className="req-tab-bar__method"
                  style={{ color: methodColor }}
                  aria-label={method}
                >
                  {method}
                </span>

                {editingTabId === tab.id ? (
                  <input
                    ref={inputRef}
                    className="req-tab-bar__rename"
                    value={editValue}
                    maxLength={40}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleEditKeyDown}
                    aria-label="Rename tab"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="req-tab-bar__label" data-testid="req-tab-label">
                    {tab.label}
                  </span>
                )}

                {tabs.length > 1 && (
                  <button
                    type="button"
                    className="req-tab-bar__close"
                    aria-label={`Close ${tab.label}`}
                    data-testid="req-tab-close"
                    onClick={(e) => handleCloseClick(e, tab.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="req-tab-bar__add"
        data-testid="req-tab-add"
        onClick={onAdd}
        disabled={!canAdd}
        aria-label="New request tab"
        title={`${tabs.length}/${REQUEST_MAX_TABS} tabs`}
      >
        +
        <span className="req-tab-bar__counter" aria-hidden="true">
          {tabs.length}/{REQUEST_MAX_TABS}
        </span>
      </button>

      {tabs.length > 1 && onCloseAll && (
        <button
          type="button"
          className="req-tab-bar__close-all"
          data-testid="req-tab-close-all"
          onClick={onCloseAll}
          aria-label="Close other tabs"
          title="Close other tabs (keep active)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M12.5 5v7.5a1.5 1.5 0 01-1.5 1.5H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {ctxMenu.renderMenu(
        ctxMenu.menuState
          ? buildContextMenuItems({
              tabId: ctxMenu.menuState.tabId,
              tabLabel: tabs.find(t => t.id === ctxMenu.menuState!.tabId)?.label ?? '',
              tabIndex: tabs.findIndex(t => t.id === ctxMenu.menuState!.tabId),
              totalTabs: tabs.length,
              canDuplicate: canAdd && Boolean(onDuplicate),
              canClose: tabs.length > 1,
            })
          : [],
        handleContextMenuAction,
      )}
    </div>
  );
}
