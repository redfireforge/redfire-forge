/**
 * GqlTabBar.tsx — tab bar for the GraphQL Studio editor tabs.
 */

import { useRef, useState } from 'react';
import type { GqlStudioTab } from '../utils/tabPersistence';
import { MAX_TABS, MAX_USER_TABS, countUserTabs, isDemoTab } from '../utils/tabPersistence';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import { findProfileById, resolveTabLabelEndpoint } from '../utils/tabConnectionResolution';
import { getTabPresentation } from '../utils/tabLabelUtils';

interface GqlTabBarProps {
  tabs: GqlStudioTab[];
  activeTabId: string;
  confirmingCloseTabId: string | null;
  pageDefaultEndpoint?: string;
  /** Env-resolved page default — used for auto tab labels when tab inherits page URL. */
  pageDefaultEndpointResolved?: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
  onAddTab: () => void;
  onRenameTab?: (tabId: string, label: string) => void;
  profiles?: ConnectionProfile[];
  batchEnabled?: boolean;
  /** Phase 6G: read-only badge on tabs included in the active batch group. */
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
  profiles = [],
  batchEnabled = false,
  batchIncludedTabIds,
}: GqlTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const userTabCount = countUserTabs(tabs);
  const atUserTabCap = userTabCount >= MAX_USER_TABS || tabs.length >= MAX_TABS;

  const startRename = (tab: GqlStudioTab, title: string, e: React.MouseEvent) => {
    if (!onRenameTab) return;
    e.stopPropagation();
    e.preventDefault();
    setEditingTabId(tab.id);
    setEditValue(title);
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  };

  const commitRename = (tabId: string) => {
    const trimmed = editValue.trim();
    if (trimmed && onRenameTab) onRenameTab(tabId, trimmed);
    setEditingTabId(null);
  };

  return (
    <div className="gql-tab-bar" data-testid="gql-tab-bar" role="tablist" aria-label="Query tabs">
      <div className="gql-tab-bar__scroll">
        {tabs.map((tab) => {
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

          return (
            <button
              key={tab.id}
              type="button"
              className={`gql-tab ${typeClass}${isActive ? ' gql-tab--active' : ''}${hasSubtitle ? ' gql-tab--stacked' : ''}${demoTab ? ' gql-tab--demo' : ''}`}
              role="tab"
              aria-selected={isActive}
              aria-label={`${title}${subtitle ? `, ${subtitle}` : ''}${tab.unsavedChanges ? ', unsaved' : ''}${demoTab ? ', demo tab' : ''}`}
              onClick={() => onTabClick(tab.id)}
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
            : 'New tab'
        }
        data-testid="gql-tab-add-btn"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
