/**
 * GqlTabBar.tsx — tab bar for the GraphQL Studio editor tabs.
 *
 * Extracted from GraphqlStudioPage.tsx to keep the page component lean
 * and make the tab bar independently testable.
 */

import type { GqlStudioTab } from '../utils/tabPersistence';
import { MAX_TABS } from '../utils/tabPersistence';

interface GqlTabBarProps {
  tabs: GqlStudioTab[];
  activeTabId: string;
  confirmingCloseTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
  onAddTab: () => void;
  // Phase 3F: batch checkbox
  batchEnabled?: boolean;
  batchedTabIds?: ReadonlySet<string>;
  onToggleBatch?: (tabId: string) => void;
}

export function GqlTabBar({
  tabs,
  activeTabId,
  confirmingCloseTabId,
  onTabClick,
  onTabClose,
  onAddTab,
  batchEnabled = false,
  batchedTabIds,
  onToggleBatch,
}: GqlTabBarProps) {
  return (
    <div className="gql-tab-bar" data-testid="gql-tab-bar" role="tablist" aria-label="Query tabs">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isConfirming = confirmingCloseTabId === tab.id;
        const typeClass =
          tab.operationType === 'mutation'
            ? 'gql-tab--mutation'
            : tab.operationType === 'subscription'
            ? 'gql-tab--subscription'
            : 'gql-tab--query';
        const typeLetter =
          tab.operationType === 'mutation'
            ? 'M'
            : tab.operationType === 'subscription'
            ? 'S'
            : 'Q';
        return (
          <button
            key={tab.id}
            type="button"
            className={`gql-tab ${typeClass}${isActive ? ' gql-tab--active' : ''}`}
            role="tab"
            aria-selected={isActive}
            aria-label={`${tab.label}${tab.unsavedChanges ? ', unsaved' : ''}`}
            onClick={() => onTabClick(tab.id)}
            data-testid={`gql-tab-${tab.id}`}
          >
            {batchEnabled && tab.operationType !== 'subscription' && onToggleBatch && (
              <span
                className={`gql-tab-batch-cb${batchedTabIds?.has(tab.id) ? ' gql-tab-batch-cb--checked' : ''}`}
                role="checkbox"
                aria-checked={batchedTabIds?.has(tab.id) ?? false}
                aria-label={`Include ${tab.label} in batch`}
                title="Include in batch"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onToggleBatch(tab.id); }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleBatch(tab.id);
                  }
                }}
              />
            )}
            <span className="gql-tab-type-badge" aria-hidden="true">{typeLetter}</span>
            <span className="gql-tab-label" title={tab.label} aria-hidden="true">
              {tab.label}
            </span>
            {tab.unsavedChanges && !isConfirming && (
              <span className="gql-tab-dot" aria-hidden="true" title="Unsaved changes" />
            )}
            {tabs.length > 1 && (
              <span
                className={`gql-tab-close${isConfirming ? ' gql-tab-close--confirming' : ''}`}
                role="button"
                aria-label={
                  isConfirming
                    ? `Click again to discard changes and close ${tab.label}`
                    : `Close ${tab.label} tab`
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
                ×
              </span>
            )}
          </button>
        );
      })}

      <button
        className="gql-tab-add"
        onClick={tabs.length < MAX_TABS ? onAddTab : undefined}
        disabled={tabs.length >= MAX_TABS}
        aria-label={tabs.length >= MAX_TABS ? `Maximum ${MAX_TABS} tabs open` : 'Open new tab'}
        title={tabs.length >= MAX_TABS ? `Maximum ${MAX_TABS} tabs — close one to open another` : 'New tab'}
        data-testid="gql-tab-add-btn"
        type="button"
      >
        +
      </button>
    </div>
  );
}
