import { useEffect, useMemo, useRef, useState } from 'react';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { GraphqlSchemaSnapshot } from '@shared/types/graphql';
import {
  CHANGELOG_VISIBLE_CAP,
  filterSnapshotsByQuery,
  formatSnapshotDayHeader,
  formatSnapshotDate,
  groupSnapshotsByDay,
  isGenericSnapshotLabel,
  snapshotDisplaySubtitle,
  snapshotDisplayTitle,
} from '../../utils/changelogPanelUtils';

export interface ChangelogPanelProps {
  snapshots: GraphqlSchemaSnapshot[];
  currentSdl: string;
  onDelete?: (id: string) => void;
  onClearOlder?: (keepCount?: number) => Promise<number>;
  onOpenDiff?: (snapshot: GraphqlSchemaSnapshot, compareToId?: string) => void;
}

export function ChangelogPanel({ snapshots, currentSdl, onDelete, onClearOlder, onOpenDiff }: ChangelogPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareToId, setCompareToId] = useState('');
  const [clearing, setClearing] = useState(false);

  const sortedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => b.capturedAt - a.capturedAt),
    [snapshots],
  );

  const snapshotIds = useMemo(() => new Set(snapshots.map((s) => s.id)), [snapshots]);
  const prevSnapshotIdsRef = useRef(snapshotIds);

  useEffect(() => {
    const prev = prevSnapshotIdsRef.current;
    prevSnapshotIdsRef.current = snapshotIds;
    const removed = [...prev].filter((id) => !snapshotIds.has(id));
    if (removed.length === 0) return;

    setSelectedId((current) => {
      if (current && snapshotIds.has(current)) return current;
      return sortedSnapshots[0]?.id ?? null;
    });

    if (compareToId && (removed.includes(compareToId) || removed.some((id) => id === compareToId))) {
      setCompareToId('');
    }
  }, [snapshotIds, sortedSnapshots, compareToId]);

  useEffect(() => {
    if (sortedSnapshots.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !snapshotIds.has(selectedId)) {
      setSelectedId(sortedSnapshots[0].id);
    }
  }, [sortedSnapshots, selectedId, snapshotIds]);

  const filteredSnapshots = useMemo(
    () => filterSnapshotsByQuery(sortedSnapshots, searchQuery),
    [sortedSnapshots, searchQuery],
  );

  const visibleSnapshots = useMemo(() => {
    if (showAll || searchQuery.trim()) return filteredSnapshots;
    return filteredSnapshots.slice(0, CHANGELOG_VISIBLE_CAP);
  }, [filteredSnapshots, showAll, searchQuery]);

  const hiddenCount = filteredSnapshots.length - visibleSnapshots.length;
  const groupedVisible = useMemo(() => groupSnapshotsByDay(visibleSnapshots), [visibleSnapshots]);

  const selectedSnapshot = useMemo(
    () => sortedSnapshots.find((s) => s.id === selectedId) ?? null,
    [sortedSnapshots, selectedId],
  );

  const handleClearOlder = async () => {
    if (!onClearOlder || sortedSnapshots.length <= 1 || clearing) return;
    const removeCount = sortedSnapshots.length - 1;
    const ok = window.confirm(
      `Delete ${removeCount} older snapshot${removeCount === 1 ? '' : 's'}? The latest snapshot will be kept.`,
    );
    if (!ok) return;
    setClearing(true);
    try {
      await onClearOlder(1);
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteSnapshot = (snap: GraphqlSchemaSnapshot) => {
    if (!onDelete) return;
    const ok = window.confirm(
      `Delete snapshot "${snapshotDisplayTitle(snap)}"? This cannot be undone.`,
    );
    if (!ok) return;
    onDelete(snap.id);
  };

  if (snapshots.length === 0) {
    return (
      <div className="gql-changelog-empty" data-testid="gql-changelog-empty">
        <div className="gql-changelog-empty-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M8 10h8M8 14h5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="gql-changelog-empty-title">No snapshots yet</div>
        <div className="gql-changelog-empty-body">
          Use <strong>Save Snapshot</strong> on the Types tab to capture the current schema for future diff comparisons.
        </div>
      </div>
    );
  }

  return (
    <div className="gql-changelog-panel" data-testid="gql-changelog-panel">
      <div className="gql-changelog-toolbar">
        <div className="gql-changelog-toolbar-text">
          <span className="gql-changelog-toolbar-title">Schema snapshots</span>
          <span className="gql-changelog-toolbar-hint">
            Select a row to compare or delete. Use <strong>Clear older</strong> to remove duplicates in bulk.
          </span>
        </div>
        <div className="gql-changelog-toolbar-actions">
          {onClearOlder && sortedSnapshots.length > 1 && (
            <button
              type="button"
              className="gql-changelog-clear-btn"
              onClick={() => void handleClearOlder()}
              disabled={clearing}
              title="Delete all snapshots except the latest"
              data-testid="gql-changelog-clear-older-btn"
            >
              {clearing ? 'Clearing…' : 'Clear older'}
            </button>
          )}
          <span className="gql-changelog-toolbar-count">{snapshots.length} saved</span>
        </div>
      </div>

      <div className="gql-changelog-search-row">
        <input
          type="search"
          className="gql-changelog-search"
          placeholder="Search snapshots…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search snapshots"
          data-testid="gql-changelog-search"
        />
        {searchQuery && (
          <span className="gql-changelog-search-meta">
            {filteredSnapshots.length} match{filteredSnapshots.length === 1 ? '' : 'es'}
          </span>
        )}
      </div>

      <div className="gql-changelog-list" data-testid="gql-changelog-list">
        {filteredSnapshots.length === 0 && (
          <div className="gql-changelog-no-results" data-testid="gql-changelog-no-results">
            No snapshots match your search.
          </div>
        )}

        {groupedVisible.map(({ dayKey, items }) => (
          <section key={dayKey} className="gql-changelog-day-group" aria-label={formatSnapshotDayHeader(dayKey)}>
            <div className="gql-changelog-day-header">{formatSnapshotDayHeader(dayKey)}</div>
            <div className="gql-changelog-day-rows">
              {items.map((snap) => {
                const isSelected = snap.id === selectedId;
                const isLatest = snap.id === sortedSnapshots[0]?.id;
                return (
                  <div
                    key={snap.id}
                    className={`gql-changelog-row-wrap${isSelected ? ' gql-changelog-row-wrap--selected' : ''}`}
                  >
                    <button
                      type="button"
                      className={`gql-changelog-row${isSelected ? ' gql-changelog-row--selected' : ''}`}
                      data-testid="gql-changelog-row"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(snap.id)}
                    >
                      <span className="gql-changelog-row-icon" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                          <rect x="3" y="4" width="18" height="16" rx="2" />
                          <path d="M8 10h8M8 14h5" strokeLinecap="round" />
                        </svg>
                      </span>
                      <span className="gql-changelog-row-label">{snapshotDisplayTitle(snap)}</span>
                      <span className="gql-changelog-row-meta-sep" aria-hidden="true">·</span>
                      <span className="gql-changelog-row-date">{snapshotDisplaySubtitle(snap)}</span>
                      {isLatest && <span className="gql-changelog-row-badge">Latest</span>}
                    </button>
                    {onDelete && (
                      <button
                        type="button"
                        className="gql-changelog-row-delete-btn"
                        onClick={() => handleDeleteSnapshot(snap)}
                        title="Delete this snapshot"
                        aria-label={`Delete snapshot ${snapshotDisplayTitle(snap)}`}
                        data-testid="gql-changelog-row-delete-btn"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {hiddenCount > 0 && (
          <button
            type="button"
            className="gql-changelog-show-more"
            onClick={() => setShowAll(true)}
            data-testid="gql-changelog-show-more"
          >
            Show {hiddenCount} older snapshot{hiddenCount === 1 ? '' : 's'}
          </button>
        )}

        {showAll && !searchQuery.trim() && filteredSnapshots.length > CHANGELOG_VISIBLE_CAP && (
          <button
            type="button"
            className="gql-changelog-show-more gql-changelog-show-more--collapse"
            onClick={() => setShowAll(false)}
            data-testid="gql-changelog-show-less"
          >
            Show fewer
          </button>
        )}
      </div>

      {selectedSnapshot && (
        <div className="gql-changelog-compare-bar" data-testid="gql-changelog-compare-bar">
          <div className="gql-changelog-compare-bar-head">
            <span className="gql-changelog-compare-bar-label">Selected</span>
            <span className="gql-changelog-compare-bar-name">{snapshotDisplayTitle(selectedSnapshot)}</span>
          </div>
          <div className="gql-changelog-compare-row">
            <span className="gql-changelog-compare-label">Compare against</span>
            <div className="gql-changelog-row-actions">
              <CustomSelect
                className="gql-changelog-compare-select"
                value={compareToId}
                onChange={(v) => setCompareToId(v)}
                options={[
                  { value: '', label: 'Current schema' },
                  ...sortedSnapshots
                    .filter((s) => s.id !== selectedSnapshot.id)
                    .map((s) => ({
                      value: s.id,
                      label: s.label && !isGenericSnapshotLabel(s.label)
                        ? s.label
                        : formatSnapshotDate(s.capturedAt),
                    })),
                ]}
                aria-label={`Compare ${selectedSnapshot.label ?? 'snapshot'} against`}
                data-testid="gql-changelog-compare-select"
              />
              <button
                type="button"
                className="gql-changelog-diff-btn"
                onClick={() => onOpenDiff?.(selectedSnapshot, compareToId || undefined)}
                disabled={!currentSdl && !compareToId}
                title={compareToId ? 'Compare two snapshots' : 'Compare to current schema'}
                data-testid="gql-changelog-diff-btn"
              >
                View diff
              </button>
              {onDelete && (
                <button
                  type="button"
                  className="gql-changelog-delete-btn gql-changelog-delete-btn--labeled"
                  onClick={() => handleDeleteSnapshot(selectedSnapshot)}
                  title="Delete selected snapshot"
                  data-testid="gql-changelog-delete-btn"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
