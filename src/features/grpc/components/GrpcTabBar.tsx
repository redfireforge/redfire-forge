import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { GRPC } from '@shared/selectors/grpc';
import { isGrpcLifecycleInFlight, type GrpcStudioTabState } from '../grpcStudioTypes';
import type { GrpcCallType } from '@shared/grpc/contracts';
import { isGrpcStreamLifecycleInFlight } from '@shared/grpc/streamLifecycle';
import { formatGrpcCallTypeBadge } from '../utils/grpcExplorerUtils';
import { useTabDragReorder } from '@shared/components/studio-tabs/useTabDragReorder';
import {
  buildContextMenuItems,
  useTabContextMenu,
} from '@shared/components/studio-tabs/TabContextMenu';

function tabMethodSubtitle(tab: GrpcStudioTabState): string | null {
  if (!tab.service || !tab.method) return null;
  const shortService = tab.service.split('.').at(-1) ?? tab.service;
  return `${shortService}/${tab.method}`;
}

export interface GrpcTabBarProps {
  tabs: GrpcStudioTabState[];
  activeTabId: string;
  canAddTab: boolean;
  maxTabs?: number;
  tabCallTypes?: Record<string, GrpcCallType | undefined>;
  tabCallCounts?: Record<string, number | undefined>;
  onSelect: (tabId: string) => void;
  onAdd: () => void;
  onClose: (tabId: string) => void;
  onDuplicate: (tabId: string) => void;
  onRename: (tabId: string, title: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onCloseOthers?: (tabId: string) => void;
  onCloseRight?: (tabId: string) => void;
}

export function GrpcTabBar({
  tabs,
  activeTabId,
  canAddTab,
  maxTabs,
  tabCallTypes = {},
  tabCallCounts = {},
  onSelect,
  onAdd,
  onClose,
  onDuplicate,
  onRename,
  onReorder,
  onCloseOthers,
  onCloseRight,
}: GrpcTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tabElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingFocusRef = useRef(false);
  const prevTabsLenRef = useRef(tabs.length);

  const startEditing = useCallback((tabId: string, title: string) => {
    setEditingTabId(tabId);
    setEditValue(title);
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  const commitEdit = useCallback(() => {
    if (editingTabId && editValue.trim()) {
      onRename(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  }, [editingTabId, editValue, onRename]);

  const handleEditKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commitEdit();
    if (event.key === 'Escape') setEditingTabId(null);
  }, [commitEdit]);

  const handleCloseClick = useCallback((event: MouseEvent, tabId: string) => {
    event.stopPropagation();
    onClose(tabId);
  }, [onClose]);

  const handleDuplicateClick = useCallback((event: MouseEvent, tabId: string) => {
    event.stopPropagation();
    onDuplicate(tabId);
  }, [onDuplicate]);

  // ── Drag & Drop ──────────────────────────────────────────────────
  const dnd = useTabDragReorder({
    mimeType: 'text/x-grpc-tab-index',
    isEditing: editingTabId !== null,
    onReorder,
  });

  // ── Keyboard Navigation ──────────────────────────────────────────
  const handleTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, tabId: string) => {
      if (editingTabId) return;
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx < 0) return;

      let targetIndex = -1;
      switch (e.key) {
        case 'ArrowLeft':
          targetIndex = idx > 0 ? idx - 1 : tabs.length - 1;
          break;
        case 'ArrowRight':
          targetIndex = idx < tabs.length - 1 ? idx + 1 : 0;
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
        case 'Delete': {
          const inFlight = isGrpcLifecycleInFlight(tabs[idx].lifecycle)
            || isGrpcStreamLifecycleInFlight(tabs[idx].streamLifecycle);
          if (tabs.length > 1 && !inFlight) {
            e.preventDefault();
            pendingFocusRef.current = true;
            onClose(tabId);
          }
          return;
        }
        case 'F2':
          e.preventDefault();
          startEditing(tabId, tabs[idx].title);
          return;
        default:
          return;
      }

      if (targetIndex >= 0 && targetIndex !== idx) {
        e.preventDefault();
        const el = tabElRefs.current.get(tabs[targetIndex].id);
        el?.focus();
      }
    },
    [tabs, editingTabId, onSelect, onClose, startEditing],
  );

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
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    switch (actionId) {
      case 'rename':
        startEditing(tabId, tab.title);
        break;
      case 'duplicate':
        onDuplicate(tabId);
        break;
      case 'copy-label':
        void navigator.clipboard.writeText(tab.title);
        break;
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
    <div className="grpc-tab-bar" data-testid="grpc-tab-bar">
      <div className="grpc-tab-bar__scroll">
        <div className="grpc-tab-list" role="tablist" aria-label="gRPC studio tabs">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const inFlight = isGrpcLifecycleInFlight(tab.lifecycle)
              || isGrpcStreamLifecycleInFlight(tab.streamLifecycle);
            const callType = tabCallTypes[tab.id];
            const callCount = tabCallCounts[tab.id] ?? 0;
            const closeDisabled = tabs.length <= 1 || inFlight;
            const methodSubtitle = tabMethodSubtitle(tab);
            const tabTitle = [
              tab.title,
              methodSubtitle,
              inFlight ? 'Call in progress' : null,
              callCount > 0 ? `Calls: ${callCount}` : null,
            ].filter(Boolean).join(' · ');
            const isDragging = dnd.draggingTabId === tab.id;
            const dropClass = dnd.dropClassFor(tab.id);
            return (
              <div
                key={tab.id}
                ref={(el) => setTabElRef(tab.id, el)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`grpc-tab-pane-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                className={`grpc-tab${isActive ? ' grpc-tab--active' : ''}${inFlight ? ' grpc-tab--in-flight' : ''}${isDragging ? ' grpc-tab--dragging' : ''} ${dropClass}`}
                data-testid={tab.id}
                title={tabTitle}
                aria-label={tabTitle}
                onClick={() => onSelect(tab.id)}
                onDoubleClick={() => startEditing(tab.id, tab.title)}
                onContextMenu={(e) => ctxMenu.openMenu(tab.id, e)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                draggable={editingTabId !== tab.id}
                onDragStart={(e) => dnd.handleDragStart(e as unknown as React.DragEvent<HTMLElement>, index, tab.id)}
                onDragEnd={dnd.handleDragEnd}
                onDragOver={(e) => dnd.handleDragOver(e as unknown as React.DragEvent<HTMLElement>, tab.id)}
                onDragLeave={(e) => dnd.handleDragLeave(e as unknown as React.DragEvent<HTMLElement>, tab.id)}
                onDrop={(e) => dnd.handleDrop(e as unknown as React.DragEvent<HTMLElement>, index)}
              >
                {editingTabId === tab.id ? (
                  <input
                    ref={inputRef}
                    className="grpc-tab-rename-input"
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleEditKeyDown}
                    aria-label="Rename tab"
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="grpc-tab-labels">
                      <span className="grpc-tab-label">{tab.title}</span>
                      {methodSubtitle && (
                        <span className="grpc-tab-method-subtitle" data-testid={`grpc-tab-method-${tab.id}`}>
                          {methodSubtitle}
                        </span>
                      )}
                    </span>
                    {callType && tab.service && tab.method && (
                      <span
                        className="grpc-tab-call-type-pill"
                        data-testid={`grpc-tab-call-type-pill-${tab.id}`}
                        title={callType}
                      >
                        {formatGrpcCallTypeBadge(callType)}
                      </span>
                    )}
                    {callCount > 0 && (
                      <span
                        className="grpc-tab-call-count-badge"
                        data-testid={`grpc-tab-call-count-${tab.id}`}
                        title={`${callCount} call${callCount === 1 ? '' : 's'} in this tab`}
                      >
                        ={callCount}
                      </span>
                    )}
                    {inFlight && (
                      <span className="grpc-tab-in-flight-dot" aria-label="Call in progress" title="Call in progress" />
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="grpc-tab-action"
                  aria-label={`Duplicate ${tab.title}`}
                  data-testid={`grpc-tab-duplicate-${tab.id}`}
                  onClick={(event) => handleDuplicateClick(event, tab.id)}
                  disabled={!canAddTab}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="grpc-tab-action grpc-tab-action--close"
                  aria-label={`Close ${tab.title}`}
                  data-testid={`grpc-tab-close-${tab.id}`}
                  onClick={(event) => handleCloseClick(event, tab.id)}
                  disabled={closeDisabled}
                  title={inFlight ? 'Cannot close tab while a call is in progress' : undefined}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className="grpc-add-tab-btn"
        data-testid="grpc-add-tab"
        onClick={onAdd}
        disabled={!canAddTab}
        aria-label="New tab"
        title={maxTabs ? `${tabs.length} of ${maxTabs} tabs` : undefined}
      >
        + New tab
        {maxTabs ? (
          <span className="grpc-add-tab-count" aria-hidden="true">
            {tabs.length}/{maxTabs}
          </span>
        ) : null}
      </button>

      {ctxMenu.renderMenu(
        ctxMenu.menuState
          ? buildContextMenuItems({
              tabId: ctxMenu.menuState.tabId,
              tabLabel: tabs.find((t) => t.id === ctxMenu.menuState!.tabId)?.title ?? '',
              tabIndex: tabs.findIndex((t) => t.id === ctxMenu.menuState!.tabId),
              totalTabs: tabs.length,
              canDuplicate: canAddTab,
              canClose: (() => {
                const t = tabs.find((tab) => tab.id === ctxMenu.menuState!.tabId);
                if (!t) return false;
                return tabs.length > 1 && !isGrpcLifecycleInFlight(t.lifecycle) && !isGrpcStreamLifecycleInFlight(t.streamLifecycle);
              })(),
            })
          : [],
        handleContextMenuAction,
      )}
    </div>
  );
}

export { GRPC };
