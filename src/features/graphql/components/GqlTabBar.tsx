/**
 * GqlTabBar.tsx — tab bar for the GraphQL Studio editor tabs.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { GlobalAuthProfile } from '@shared/types';
import type { GqlStudioTab } from '../utils/tabPersistence';
import { MAX_TABS, MAX_USER_TABS, countUserTabs, isDemoTab } from '../utils/tabPersistence';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import { findProfileById, resolveTabLabelEndpoint } from '../utils/tabConnectionResolution';
import { resolveTabAuthDotKind } from '../utils/authUtils';
import { getTabPresentation } from '../utils/tabLabelUtils';
import { useTabDragReorder } from '@shared/components/studio-tabs/useTabDragReorder';
import {
  buildContextMenuItems,
  useTabContextMenu,
} from '@shared/components/studio-tabs/TabContextMenu';

interface GqlTabBarProps {
  tabs: GqlStudioTab[];
  activeTabId: string;
  confirmingCloseTabId: string | null;
  pageDefaultEndpoint?: string;
  pageDefaultEndpointResolved?: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
  onAddTab: () => void;
  onRenameTab?: (tabId: string, label: string) => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
  onDuplicateTab?: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseTabsToRight?: (tabId: string) => void;
  profiles?: ConnectionProfile[];
  globalAuthProfiles?: GlobalAuthProfile[];
  batchEnabled?: boolean;
  batchIncludedTabIds?: ReadonlySet<string>;
}

const OP_META: Record<
  NonNullable<GqlStudioTab['operationType']>,
  { letter: string; label: string }
> = {
  query: { letter: 'Q', label: 'Query' },
  mutation: { letter: 'M', label: 'Mutation' },
  subscription: { letter: 'S', label: 'Subscription' },
};

export function GqlTabBar({
  tabs,
  activeTabId,
  confirmingCloseTabId,
  pageDefaultEndpoint = '',
  pageDefaultEndpointResolved,
  onTabClick,
  onTabClose,
  onAddTab,
  onRenameTab,
  onReorderTabs,
  onDuplicateTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  profiles = [],
  globalAuthProfiles = [],
  batchEnabled = false,
  batchIncludedTabIds,
}: GqlTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const tabElRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pendingFocusRef = useRef(false);
  const prevTabsLenRef = useRef(tabs.length);
  const userTabCount = countUserTabs(tabs);
  const atUserTabCap = userTabCount >= MAX_USER_TABS || tabs.length >= MAX_TABS;
  const showAuthDots = tabs.length > 1;

  const startRename = useCallback((tab: GqlStudioTab, title: string, e?: React.MouseEvent) => {
    if (!onRenameTab) return;
    e?.stopPropagation();
    e?.preventDefault();
    setEditingTabId(tab.id);
    setEditValue(title);
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [onRenameTab]);

  const commitRename = useCallback((tabId: string) => {
    const trimmed = editValue.trim();
    if (trimmed && onRenameTab) onRenameTab(tabId, trimmed);
    setEditingTabId(null);
  }, [editValue, onRenameTab]);

  // ── Drag & Drop ──────────────────────────────────────────────────
  const dnd = useTabDragReorder({
    mimeType: 'text/x-gql-tab-index',
    isEditing: editingTabId !== null,
    onReorder: onReorderTabs,
  });

  // ── Keyboard Navigation ──────────────────────────────────────────
  const handleTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, tabId: string) => {
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
          onTabClick(tabId);
          return;
        case 'Delete':
          if (tabs.length > 1 && !isDemoTab(tabs[idx])) {
            e.preventDefault();
            pendingFocusRef.current = true;
            onTabClose(tabId, e as unknown as React.MouseEvent);
          }
          return;
        case 'F2': {
          e.preventDefault();
          const tab = tabs[idx];
          const profileName = findProfileById(profiles, tab.connectionId)?.name ?? null;
          const labelEndpoint = resolveTabLabelEndpoint(tab, profiles, pageDefaultEndpoint, pageDefaultEndpointResolved);
          const { title } = getTabPresentation(tab, profileName, labelEndpoint);
          startRename(tab, title);
          return;
        }
        default:
          return;
      }

      if (targetIndex >= 0 && targetIndex !== idx) {
        e.preventDefault();
        const el = tabElRefs.current.get(tabs[targetIndex].id);
        el?.focus();
      }
    },
    [tabs, editingTabId, onTabClick, onTabClose, startRename, profiles, pageDefaultEndpoint, pageDefaultEndpointResolved],
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
      case 'rename': {
        const profileName = findProfileById(profiles, tab.connectionId)?.name ?? null;
        const labelEndpoint = resolveTabLabelEndpoint(tab, profiles, pageDefaultEndpoint, pageDefaultEndpointResolved);
        const { title } = getTabPresentation(tab, profileName, labelEndpoint);
        startRename(tab, title);
        break;
      }
      case 'duplicate':
        onDuplicateTab?.(tabId);
        break;
      case 'copy-label': {
        const profileName = findProfileById(profiles, tab.connectionId)?.name ?? null;
        const labelEndpoint = resolveTabLabelEndpoint(tab, profiles, pageDefaultEndpoint, pageDefaultEndpointResolved);
        const { title } = getTabPresentation(tab, profileName, labelEndpoint);
        void navigator.clipboard.writeText(title).catch(() => {});
        break;
      }
      case 'close':
        onTabClose(tabId, { stopPropagation: () => {} } as React.MouseEvent);
        break;
      case 'close-others':
        onCloseOtherTabs?.(tabId);
        break;
      case 'close-right':
        onCloseTabsToRight?.(tabId);
        break;
    }
  }, [ctxMenu.menuState, tabs, profiles, pageDefaultEndpoint, pageDefaultEndpointResolved, startRename, onDuplicateTab, onTabClose, onCloseOtherTabs, onCloseTabsToRight]);

  const setTabElRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) tabElRefs.current.set(id, el);
    else tabElRefs.current.delete(id);
  }, []);

  return (
    <div className="gql-tab-bar" data-testid="gql-tab-bar" role="tablist" aria-label="Query tabs">
      <div className="gql-tab-bar__scroll">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isConfirming = confirmingCloseTabId === tab.id;
          const isEditing = editingTabId === tab.id;
          const op = tab.operationType ?? 'query';
          const typeClass =
            op === 'mutation'
              ? 'gql-tab--mutation'
              : op === 'subscription'
                ? 'gql-tab--subscription'
                : 'gql-tab--query';
          const { letter, label: opLabel } = OP_META[op];
          const profileName = findProfileById(profiles, tab.connectionId)?.name ?? null;
          const labelEndpoint = resolveTabLabelEndpoint(
            tab,
            profiles,
            pageDefaultEndpoint,
            pageDefaultEndpointResolved,
          );
          const { title, subtitle } = getTabPresentation(tab, profileName, labelEndpoint);
          const hasSubtitle = Boolean(subtitle);
          const demoTab = isDemoTab(tab);
          const showBatchBadge = batchEnabled && batchIncludedTabIds?.has(tab.id);
          const authDotKind = showAuthDots
            ? resolveTabAuthDotKind(tab, profiles, globalAuthProfiles)
            : null;
          const isDragging = dnd.draggingTabId === tab.id;
          const dropClass = dnd.dropClassFor(tab.id);

          return (
            <button
              key={tab.id}
              ref={(el) => setTabElRef(tab.id, el)}
              type="button"
              className={`gql-tab ${typeClass}${isActive ? ' gql-tab--active' : ''}${hasSubtitle ? ' gql-tab--stacked' : ''}${demoTab ? ' gql-tab--demo' : ''}${isDragging ? ' gql-tab--dragging' : ''} ${dropClass}`}
              role="tab"
              aria-selected={isActive}
              aria-label={`${title}${subtitle ? `, ${subtitle}` : ''}${tab.unsavedChanges ? ', unsaved' : ''}${demoTab ? ', demo tab' : ''}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabClick(tab.id)}
              onContextMenu={(e) => ctxMenu.openMenu(tab.id, e)}
              onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
              draggable={!isEditing && !demoTab}
              onDragStart={(e) => dnd.handleDragStart(e as unknown as React.DragEvent<HTMLElement>, index, tab.id)}
              onDragEnd={dnd.handleDragEnd}
              onDragOver={(e) => dnd.handleDragOver(e as unknown as React.DragEvent<HTMLElement>, tab.id)}
              onDragLeave={(e) => dnd.handleDragLeave(e as unknown as React.DragEvent<HTMLElement>, tab.id)}
              onDrop={(e) => dnd.handleDrop(e as unknown as React.DragEvent<HTMLElement>, index)}
              data-testid={`gql-tab-${tab.id}`}
              data-demo-lesson={demoTab ? tab.demoLessonId : undefined}
            >
              {showBatchBadge && (
                <span
                  className="gql-tab-batch-badge"
                  title="Included in batch — configure in Advanced Settings"
                  aria-label="Included in batch"
                  data-testid={`gql-tab-batch-badge-${tab.id}`}
                >
                  B
                </span>
              )}

              {authDotKind && (
                <span
                  className={`gql-tab-auth-dot gql-tab-auth-dot--${authDotKind}`}
                  title={
                    authDotKind === 'override' ? 'Tab auth override'
                      : authDotKind === 'profile' ? 'Auth from linked profile'
                        : authDotKind === 'inherit' ? 'Inherits workspace auth'
                          : 'No auth override'
                  }
                  aria-label={
                    authDotKind === 'override' ? 'Tab auth override'
                      : authDotKind === 'profile' ? 'Auth from linked profile'
                        : authDotKind === 'inherit' ? 'Inherits workspace auth'
                          : 'Explicit no auth'
                  }
                  data-testid={`gql-tab-auth-dot-${tab.id}`}
                />
              )}

              <span className="gql-tab-type-badge" title={opLabel} aria-label={opLabel}>
                {letter}
              </span>

              {isEditing ? (
                <input
                  ref={renameInputRef}
                  className="gql-tab-rename-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(tab.id)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename(tab.id);
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingTabId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`gql-tab-rename-${tab.id}`}
                  aria-label="Rename tab"
                />
              ) : (
                <span className={`gql-tab-label-wrap${hasSubtitle ? ' gql-tab-label-wrap--stacked' : ''}`}>
                  <span
                    className="gql-tab-label"
                    title={onRenameTab ? `${title} — double-click to rename` : title}
                    aria-hidden="true"
                    onDoubleClick={(e) => startRename(tab, title, e)}
                  >
                    {title}
                  </span>
                  {subtitle && (
                    <span
                      className="gql-tab-subtitle"
                      title={tab.endpoint ?? profileName ?? subtitle}
                      aria-hidden="true"
                      data-testid={`gql-tab-subtitle-${tab.id}`}
                    >
                      {subtitle}
                    </span>
                  )}
                </span>
              )}

              {tab.unsavedChanges && !isConfirming && (
                <span className="gql-tab-dot" aria-hidden="true" title="Unsaved changes" />
              )}

              {onDuplicateTab && !demoTab && (
                <span
                  className="studio-tab-duplicate-btn"
                  role="button"
                  aria-label={`Duplicate ${title}`}
                  aria-disabled={atUserTabCap || undefined}
                  title={atUserTabCap ? 'Maximum tabs reached' : 'Duplicate tab'}
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); if (!atUserTabCap) onDuplicateTab(tab.id); }}
                  data-testid={`gql-tab-duplicate-${tab.id}`}
                >
                  ⧉
                </span>
              )}

              {tabs.length > 1 && !demoTab && (
                <span
                  className={`gql-tab-close${isConfirming ? ' gql-tab-close--confirming' : ''}`}
                  role="button"
                  aria-label={
                    isConfirming
                      ? `Click again to discard changes and close ${title}`
                      : `Close ${title} tab`
                  }
                  title={
                    isConfirming
                      ? 'Unsaved changes — click again to close'
                      : tab.unsavedChanges
                        ? 'Unsaved changes (click to confirm)'
                        : 'Close tab'
                  }
                  onClick={(e) => onTabClose(tab.id, e)}
                  data-testid={`gql-tab-close-${tab.id}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onTabClose(tab.id, e as unknown as React.MouseEvent);
                    }
                  }}
                  tabIndex={isActive || isConfirming ? 0 : -1}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        className="gql-tab-add"
        onClick={atUserTabCap ? undefined : onAddTab}
        disabled={atUserTabCap}
        aria-label={
          atUserTabCap
            ? `Maximum ${MAX_USER_TABS} user tabs — close one to open another`
            : 'Open new tab'
        }
        title={
          atUserTabCap
            ? `Maximum ${MAX_USER_TABS} user tabs — close one to open another (demo lessons use a reserved slot)`
            : `New tab (${userTabCount}/${MAX_USER_TABS})`
        }
        data-testid="gql-tab-add-btn"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="gql-tab-add-count" aria-hidden="true">
          {userTabCount}/{MAX_USER_TABS}
        </span>
      </button>

      {ctxMenu.renderMenu(
        ctxMenu.menuState
          ? (() => {
              const ctxTab = tabs.find((t) => t.id === ctxMenu.menuState!.tabId);
              const isDemo = ctxTab ? isDemoTab(ctxTab) : true;
              return buildContextMenuItems({
                tabId: ctxMenu.menuState.tabId,
                tabLabel: '',
                tabIndex: tabs.findIndex((t) => t.id === ctxMenu.menuState!.tabId),
                totalTabs: tabs.length,
                canDuplicate: !atUserTabCap && Boolean(onDuplicateTab) && !isDemo,
                canClose: tabs.length > 1 && !isDemo,
              });
            })()
          : [],
        handleContextMenuAction,
      )}
    </div>
  );
}
