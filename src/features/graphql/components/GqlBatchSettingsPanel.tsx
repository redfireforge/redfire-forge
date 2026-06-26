/**
 * Phase 6G — batch group + tab checklist inside Advanced Settings → Batch tab.
 */
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import type { BatchEndpointGroup } from '../utils/batchEndpointUtils';
import { findProfileById } from '../utils/tabConnectionResolution';
import { getTabPresentation } from '../utils/tabLabelUtils';

export interface GqlBatchSettingsPanelProps {
  groups: BatchEndpointGroup[];
  activeGroupKey: string | null;
  onGroupChange: (groupKey: string) => void;
  batchedTabIds: ReadonlySet<string>;
  onToggleBatchTab: (tabId: string) => void;
  tabs: GqlStudioTab[];
  profiles?: ConnectionProfile[];
  pageDefaultEndpoint?: string;
  pageDefaultEndpointResolved?: string;
  demoLessonActive?: boolean;
}

const OP_LETTER: Record<NonNullable<GqlStudioTab['operationType']>, string> = {
  query: 'Q',
  mutation: 'M',
  subscription: 'S',
};

function normalizeQueryPreview(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}

function isEmptyGraphqlQuery(normalized: string): boolean {
  if (!normalized) return true;
  return /^(query|mutation|subscription)\s*\{\s*\}$/i.test(normalized);
}

/** Single-line preview — full query when short, ellipsis when long (tooltip holds full text). */
function queryPreview(query: string, maxLen = 80): string {
  const normalized = normalizeQueryPreview(query);
  if (isEmptyGraphqlQuery(normalized)) return '(empty query)';
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen - 1)}…` : normalized;
}

export function GqlBatchSettingsPanel({
  groups,
  activeGroupKey,
  onGroupChange,
  batchedTabIds,
  onToggleBatchTab,
  tabs,
  profiles = [],
  pageDefaultEndpoint = '',
  pageDefaultEndpointResolved,
  demoLessonActive = false,
}: GqlBatchSettingsPanelProps) {
  if (groups.length === 0) {
    return (
      <div className="gql-adv-batch-panel gql-adv-batch-panel--empty" data-testid="gql-adv-batch-panel">
        <p className="gql-adv-batch-panel__empty-text" role="note">
          No query or mutation tabs are open. Add tabs to configure a batch.
        </p>
      </div>
    );
  }

  const activeGroup = groups.find((g) => g.key === activeGroupKey) ?? groups[0]!;
  const groupTabs = activeGroup.tabIds
    .map((id) => tabs.find((t) => t.id === id))
    .filter((t): t is GqlStudioTab => Boolean(t));
  const checkedInGroup = groupTabs.filter((t) => batchedTabIds.has(t.id)).length;
  const needsMoreTabs = groupTabs.length < 2;
  const readyToSend = !needsMoreTabs && checkedInGroup >= 2;
  const multipleGroups = groups.length > 1;

  const handleSelectAll = () => {
    for (const tab of groupTabs) {
      if (!batchedTabIds.has(tab.id)) onToggleBatchTab(tab.id);
    }
  };

  const handleClearAll = () => {
    for (const tab of groupTabs) {
      if (batchedTabIds.has(tab.id)) onToggleBatchTab(tab.id);
    }
  };

  return (
    <div className="gql-adv-batch-panel" data-testid="gql-adv-batch-panel">
      <div className="gql-adv-batch-panel__setup-card">
        <div className="gql-adv-batch-panel__group-bar">
          <span className="gql-adv-batch-panel__field-label">Endpoint group</span>
          <div className="gql-adv-batch-panel__group-ctrl">
            {multipleGroups ? (
              <select
                className="gql-advsettings-select gql-adv-batch-panel__select"
                value={activeGroup.key}
                onChange={(e) => onGroupChange(e.target.value)}
                aria-label="Select endpoint group for batch execution"
                data-testid="gql-adv-batch-group-select"
              >
                {groups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.displayLabel} · {group.tabIds.length} tab{group.tabIds.length === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            ) : (
              <span className="gql-adv-batch-panel__endpoint-chip" data-testid="gql-adv-batch-group-label">
                <span className="gql-adv-batch-panel__endpoint-host">{activeGroup.displayLabel}</span>
                <span className="gql-adv-batch-panel__endpoint-meta">
                  {groupTabs.length} tab{groupTabs.length === 1 ? '' : 's'}
                </span>
              </span>
            )}
          </div>
        </div>

        <div
          className={`gql-adv-batch-panel__status${readyToSend ? ' gql-adv-batch-panel__status--ready' : ''}${needsMoreTabs ? ' gql-adv-batch-panel__status--warn' : ''}`}
          data-testid="gql-adv-batch-selection-hint"
          role="status"
        >
          {demoLessonActive && (
            <span className="gql-adv-batch-panel__demo-badge" title="Only demo tabs are listed during this lesson">
              Demo workspace
            </span>
          )}
          <span className="gql-adv-batch-panel__status-text">
            {needsMoreTabs
              ? 'Add another tab with this endpoint to enable batching.'
              : readyToSend
                ? `Ready — use Send Batch (${checkedInGroup}) on the connection bar.`
                : `${checkedInGroup} of ${groupTabs.length} selected — pick at least 2 tabs to batch.`}
          </span>
          {!needsMoreTabs && (
            <span className="gql-adv-batch-panel__status-count" aria-hidden="true">
              {checkedInGroup}/{groupTabs.length}
            </span>
          )}
        </div>
      </div>

      <div className="gql-adv-batch-panel__list-card">
        <div className="gql-adv-batch-panel__list-header">
          <span className="gql-adv-batch-panel__list-title">
            Operations in this group
            <span className="gql-adv-batch-panel__list-count">
              ({groupTabs.length})
            </span>
          </span>
          {groupTabs.length >= 2 && (
            <span className="gql-adv-batch-panel__list-actions">
              <button type="button" className="gql-adv-batch-panel__link-btn" onClick={handleSelectAll}>
                Select all
              </button>
              <span className="gql-adv-batch-panel__list-actions-sep" aria-hidden="true">·</span>
              <button type="button" className="gql-adv-batch-panel__link-btn" onClick={handleClearAll}>
                Clear
              </button>
            </span>
          )}
        </div>

        <div className="gql-adv-batch-panel__table">
          <div className="gql-adv-batch-panel__table-head" aria-hidden="true">
            <span className="gql-adv-batch-panel__table-head-check" />
            <span className="gql-adv-batch-panel__table-head-op" />
            <span className="gql-adv-batch-panel__table-head-name">Operation</span>
            <span className="gql-adv-batch-panel__table-head-query">Query</span>
          </div>

          <ul className="gql-adv-batch-panel__tab-list" aria-label="Tabs in batch group">
          {groupTabs.map((tab) => {
            const profileName = findProfileById(profiles, tab.connectionId)?.name ?? null;
            const labelEndpoint = tab.endpoint?.trim() || pageDefaultEndpointResolved || pageDefaultEndpoint;
            const { title } = getTabPresentation(tab, profileName, labelEndpoint);
            const checked = batchedTabIds.has(tab.id);
            const op = tab.operationType ?? 'query';
            const opLetter = OP_LETTER[op];
            return (
              <li
                key={tab.id}
                className={`gql-adv-batch-panel__tab-row${checked ? ' gql-adv-batch-panel__tab-row--checked' : ''}`}
                data-testid={`gql-adv-batch-tab-row-${tab.id}`}
              >
                <label
                  className="gql-adv-batch-panel__tab-label"
                  data-testid={`gql-adv-batch-tab-label-${tab.id}`}
                >
                  <input
                    type="checkbox"
                    className="gql-adv-batch-panel__tab-cb-input"
                    checked={checked}
                    onChange={() => onToggleBatchTab(tab.id)}
                    aria-label={`Include ${title} in batch`}
                    data-testid={`gql-adv-batch-tab-cb-${tab.id}`}
                  />
                  <span className="gql-adv-batch-panel__tab-cb-box" aria-hidden="true" />
                  <span className={`gql-adv-batch-panel__op-badge gql-adv-batch-panel__op-badge--${op}`}>
                    {opLetter}
                  </span>
                  <span className="gql-adv-batch-panel__tab-name" title={title}>{title}</span>
                  <span className="gql-adv-batch-panel__tab-query" title={tab.query}>
                    {queryPreview(tab.query)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        </div>
      </div>
    </div>
  );
}
