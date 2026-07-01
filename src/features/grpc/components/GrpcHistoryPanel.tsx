import { useEffect, useMemo, useState } from 'react';
import type { GrpcCallHistoryEntryV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import {
  previewGrpcCallHistoryEntryForUi,
  serializeGrpcPreviewJson,
} from '../../../shared/grpc/grpcSafePreview';
import { isGrpcReplayExecutable } from '../utils/grpcReplayBinding';
import { resolveGrpcHistoryEntryReplay } from '../utils/grpcReplayBinding';
import type { UseGrpcCallHistoryResult } from '../hooks/useGrpcCallHistory';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import type { GrpcTabConnectionPageDefaults, GrpcConnectionProfile } from '../utils/resolveGrpcTabConnection';

export interface GrpcHistoryPanelProps {
  history: UseGrpcCallHistoryResult;
  studio: Pick<UseGrpcStudioReturn, 'activeTab' | 'activeTabDescriptor' | 'profiles'>;
  envVarMap: Record<string, string>;
  pageDefaults: GrpcTabConnectionPageDefaults;
  profiles: GrpcConnectionProfile[];
  onReplay: (entry: GrpcCallHistoryEntryV1) => void;
  onCopyGrpcurl: (command: string) => void;
  grpcurlForEntry: (entry: GrpcCallHistoryEntryV1) => string;
}

function formatHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function historyStatusLabel(entry: GrpcCallHistoryEntryV1): { label: string; variant: 'ok' | 'err' | 'warn' } {
  if (entry.record.error) return { label: 'Error', variant: 'err' };
  if (typeof entry.grpcStatus === 'number' && entry.grpcStatus !== 0) {
    return { label: `Code ${entry.grpcStatus}`, variant: 'warn' };
  }
  return { label: 'OK', variant: 'ok' };
}

function hasActiveHistoryFilters(filters: UseGrpcCallHistoryResult['filters']): boolean {
  return Boolean(filters.text?.trim())
    || Boolean(filters.service)
    || Boolean(filters.outcome)
    || filters.grpcStatus !== undefined;
}

type GrpcHistoryEmptyIconVariant = 'clock' | 'filter' | 'inspect';

function GrpcHistoryEmptyIcon({ variant }: { variant: GrpcHistoryEmptyIconVariant }) {
  if (variant === 'filter') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
      </svg>
    );
  }
  if (variant === 'inspect') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 12h6M12 9v6" />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function GrpcHistoryEmptyState({
  testId,
  icon,
  title,
  hint,
  compact = false,
}: {
  testId: string;
  icon: GrpcHistoryEmptyIconVariant;
  title: string;
  hint: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`grpc-history-empty${compact ? ' grpc-history-empty--compact' : ''}`}
      data-testid={testId}
    >
      <div className="grpc-history-empty__icon" aria-hidden="true">
        <GrpcHistoryEmptyIcon variant={icon} />
      </div>
      <p className="grpc-history-empty__title">{title}</p>
      <p className="grpc-history-empty__hint">{hint}</p>
    </div>
  );
}

export function GrpcHistoryPanel({
  history,
  studio,
  envVarMap,
  pageDefaults,
  profiles,
  onReplay,
  onCopyGrpcurl,
  grpcurlForEntry,
}: GrpcHistoryPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && !history.filteredEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
    }
  }, [history.filteredEntries, selectedId]);

  const selectedEntry = useMemo(
    () => history.filteredEntries.find((entry) => entry.id === selectedId) ?? null,
    [history.filteredEntries, selectedId],
  );

  const replayStatus = useMemo(() => {
    if (!selectedEntry) {
      return { executable: true, title: 'Replay into active Studio tab' };
    }
    try {
      const binding = resolveGrpcHistoryEntryReplay({
        entry: selectedEntry,
        tab: studio.activeTab,
        requestId: 'preview',
        envVarMap,
        profiles,
        pageDefaults,
        currentDescriptor: studio.activeTabDescriptor.descriptor,
        tabDescriptorState: studio.activeTabDescriptor,
      });
      const executable = isGrpcReplayExecutable(binding.drift);
      return {
        executable,
        title: executable
          ? 'Replay into active Studio tab'
          : (binding.drift.message || 'Replay blocked'),
      };
    } catch (error) {
      return {
        executable: false,
        title: error instanceof Error ? error.message : 'Replay blocked',
      };
    }
  }, [selectedEntry, studio, envVarMap, profiles, pageDefaults]);

  const previewEntry = selectedEntry
    ? previewGrpcCallHistoryEntryForUi(selectedEntry)
    : null;

  const filtersActive = hasActiveHistoryFilters(history.filters);
  const listEmpty = !history.loading && history.filteredEntries.length === 0;
  const hasStoredEntries = history.entries.length > 0;

  const listEmptyState = (() => {
    if (history.loading) return null;
    if (!listEmpty) return null;
    if (hasStoredEntries && filtersActive) {
      return (
        <GrpcHistoryEmptyState
          testId="grpc-history-list-empty-filtered"
          icon="filter"
          title="No matching entries"
          hint="Adjust your search or filters to see more call history."
          compact
        />
      );
    }
    return (
      <GrpcHistoryEmptyState
        testId="grpc-history-list-empty"
        icon="clock"
        title="No call history yet"
        hint="Execute a call in Studio — each response is saved here for replay."
        compact
      />
    );
  })();

  const detailEmptyState = (() => {
    if (previewEntry) return null;
    if (!hasStoredEntries) {
      return (
        <GrpcHistoryEmptyState
          testId="grpc-history-detail-empty"
          icon="clock"
          title="Call history is empty"
          hint="Run a gRPC call from the Studio tab. RedfireForge captures target, request body, metadata, and response snapshots automatically."
        />
      );
    }
    if (listEmpty && filtersActive) {
      return (
        <GrpcHistoryEmptyState
          testId="grpc-history-detail-empty"
          icon="filter"
          title="No entries match your filters"
          hint="Clear or relax filters in the sidebar, then select a call to inspect or replay."
        />
      );
    }
    return (
      <GrpcHistoryEmptyState
        testId="grpc-history-detail-empty"
        icon="inspect"
        title="Select a call to inspect"
        hint="Choose an entry from the list to view its snapshot, metadata, and grpcurl command — or replay it into Studio."
      />
    );
  })();

  return (
    <div className="grpc-history-layout" data-testid="grpc-history-panel">
      {history.lastMutationError && (
        <p className="grpc-panel-action-error" role="alert" data-testid="grpc-history-mutation-error">
          {history.lastMutationError}
        </p>
      )}
      <aside className="grpc-history-sidebar">
        <div className="grpc-history-filters">
          <input
            type="search"
            className="grpc-history-filters__search"
            data-testid="grpc-history-search"
            value={history.filters.text ?? ''}
            onChange={(event) => history.setFilters({ text: event.target.value })}
            placeholder="Search history…"
            aria-label="Search call history"
          />
          <select
            className="grpc-history-filters__select"
            data-testid="grpc-history-filter-service"
            value={history.filters.service ?? ''}
            onChange={(event) => history.setFilters({ service: event.target.value || undefined })}
            aria-label="Filter by service"
          >
            <option value="">All services</option>
            {history.filterOptions.services.map((service) => (
              <option key={service} value={service}>{service}</option>
            ))}
          </select>
          <select
            className="grpc-history-filters__select"
            data-testid="grpc-history-filter-status"
            value={history.filters.outcome ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              history.setFilters({
                outcome: value === '' ? undefined : value as 'ok' | 'error',
                grpcStatus: undefined,
              });
            }}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {history.filterOptions.hasOkEntries && <option value="ok">OK</option>}
            {history.filterOptions.hasErrorEntries && <option value="error">Errors</option>}
          </select>
          <div className="grpc-history-filters__actions">
            <button
              type="button"
              className="grpc-btn grpc-btn--ghost grpc-btn--xs"
              data-testid="grpc-history-clear-filtered"
              onClick={() => {
                history.clearLastMutationError();
                void history.clearFiltered().catch(() => {});
              }}
            >
              Clear filtered
            </button>
            <button
              type="button"
              className="grpc-btn grpc-btn--ghost grpc-btn--xs"
              data-testid="grpc-history-clear-all"
              onClick={() => {
                history.clearLastMutationError();
                void history.clearAll().catch(() => {});
              }}
            >
              Clear all
            </button>
          </div>
        </div>
        <div className="grpc-history-list" data-testid="grpc-history-list">
          {history.loading && (
            <GrpcHistoryEmptyState
              testId="grpc-history-loading"
              icon="clock"
              title="Loading call history"
              hint="Retrieving saved calls from local storage…"
              compact
            />
          )}
          {listEmptyState}
          {history.filteredEntries.map((entry) => {
            const status = historyStatusLabel(entry);
            return (
              <button
                key={entry.id}
                type="button"
                className={`grpc-history-item${selectedId === entry.id ? ' grpc-history-item--active' : ''}`}
                data-testid={`grpc-history-entry-${entry.id}`}
                onClick={() => setSelectedId(entry.id)}
              >
                <span className={`grpc-history-item__status grpc-history-item__status--${status.variant}`}>
                  {status.label}
                </span>
                <span className="grpc-history-item__method">{entry.service}/{entry.method}</span>
                <span className="grpc-history-item__time">{formatHistoryTime(entry.capturedAt)}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <div
        className={`grpc-history-detail${!previewEntry ? ' grpc-history-detail--empty' : ''}`}
        data-testid="grpc-history-detail"
      >
        {detailEmptyState}
        {previewEntry && (
          <>
            <header className="grpc-history-detail__header">
              <div>
                <h2 className="grpc-history-detail__title">{previewEntry.service}/{previewEntry.method}</h2>
                <p className="grpc-history-detail__subtitle">
                  {previewEntry.target} · {formatHistoryTime(previewEntry.capturedAt)}
                </p>
              </div>
              <div className="grpc-history-detail__actions">
                <button
                  type="button"
                  className="grpc-btn grpc-btn--ghost grpc-btn--sm"
                  data-testid="grpc-history-copy-grpcurl"
                  onClick={() => selectedEntry && onCopyGrpcurl(grpcurlForEntry(selectedEntry))}
                >
                  Copy grpcurl
                </button>
                <button
                  type="button"
                  className="grpc-btn grpc-btn--primary grpc-btn--sm"
                  data-testid="grpc-history-replay-btn"
                  disabled={!replayStatus.executable}
                  title={replayStatus.title}
                  onClick={() => selectedEntry && onReplay(selectedEntry)}
                >
                  Replay
                </button>
              </div>
            </header>
            <div className="grpc-history-detail__body">
              {previewEntry.bodyTruncated && (
                <p className="grpc-history-detail__warning" role="status">
                  Request body was truncated when this entry was captured.
                </p>
              )}
              <div className="grpc-info-card">
                <div className="grpc-info-card__header">Snapshot</div>
                <pre className="grpc-info-card__pre">{serializeGrpcPreviewJson(previewEntry.record.snapshot.body)}</pre>
              </div>
              <div className="grpc-info-card">
                <div className="grpc-info-card__header">Metadata</div>
                <pre className="grpc-info-card__pre">{serializeGrpcPreviewJson(previewEntry.record.snapshot.metadata)}</pre>
              </div>
              <div className="grpc-info-card">
                <div className="grpc-info-card__header">grpcurl command</div>
                <pre className="grpc-grpcurl-box">{selectedEntry ? grpcurlForEntry(selectedEntry) : ''}</pre>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
