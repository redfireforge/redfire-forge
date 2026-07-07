import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { GrpcCallHistoryEntryV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import { grpcErrorCategoryForCode } from '../../../shared/grpc/contracts';
import {
  previewGrpcCallHistoryEntryForUi,
  serializeGrpcPreviewJson,
} from '../../../shared/grpc/grpcSafePreview';
import { resolveGrpcHistoryEntryReplay } from '../utils/grpcReplayBinding';
import type { UseGrpcCallHistoryResult } from '../hooks/useGrpcCallHistory';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import type { GrpcTabConnectionPageDefaults, GrpcConnectionProfile } from '../utils/resolveGrpcTabConnection';
import { prepareGrpcCallMetadata } from '../../../shared/grpc/grpcCompressionPolicy';
import { redactGrpcMetadataForHistory } from '../../../shared/grpc/grpcRedaction';

export interface GrpcHistoryPanelProps {
  history: UseGrpcCallHistoryResult;
  studio: Pick<UseGrpcStudioReturn, 'activeTab' | 'activeTabDescriptor' | 'profiles'>;
  envVarMap: Record<string, string>;
  pageDefaults: GrpcTabConnectionPageDefaults;
  profiles: GrpcConnectionProfile[];
  onReplay: (entry: GrpcCallHistoryEntryV1) => void;
  onOpenDiff?: (entry: GrpcCallHistoryEntryV1) => void;
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

function formatGrpcHistoryAuthSummary(entry: GrpcCallHistoryEntryV1): string {
  const auth = entry.record.snapshot.auth;
  if (!auth || auth.type === 'none') {
    return 'None';
  }
  if (auth.type === 'bearer') {
    return 'Bearer token';
  }
  if (auth.type === 'basic') {
    const user = auth.basicUsername?.trim();
    return user ? `Basic (${user})` : 'Basic';
  }
  if (auth.type === 'api_key') {
    const key = auth.apiKeyName?.trim();
    return key ? `API Key (${key})` : 'API Key';
  }
  if (auth.type === 'oauth2') {
    const clientId = auth.oauth2?.clientId?.trim();
    return clientId ? `OAuth2 (${clientId})` : 'OAuth2';
  }
  if (auth.type === 'inherit') {
    const profile = auth.globalProfileId?.trim();
    return profile ? `Inherited (${profile})` : 'Inherited';
  }
  return 'Configured';
}

function formatGrpcHistoryTransportMode(entry: GrpcCallHistoryEntryV1): string {
  return entry.record.snapshot.transportMode ?? 'unknown';
}

function formatGrpcHistoryCompressionSummary(entry: GrpcCallHistoryEntryV1): string {
  const config = entry.record.snapshot.compression;
  if (!config?.enabled) return 'None (identity)';
  return config.algorithm;
}

function resolveGrpcHistoryEffectiveMetadata(entry: GrpcCallHistoryEntryV1): Record<string, string> {
  const snapshot = entry.record.snapshot;
  try {
    return prepareGrpcCallMetadata(snapshot.metadata, snapshot.auth, snapshot.compression) ?? {};
  } catch {
    return snapshot.metadata ?? {};
  }
}

function buildGrpcHistoryOutcomeSummary(entry: GrpcCallHistoryEntryV1): Record<string, unknown> {
  if (entry.record.error) {
    return {
      outcome: 'error',
      code: entry.record.error.code,
      category: entry.record.error.category ?? grpcErrorCategoryForCode(entry.record.error.code),
      message: entry.record.error.message,
      retryable: entry.record.error.retryable ?? false,
      details: entry.record.error.details,
    };
  }

  return {
    outcome: 'ok',
    grpcStatus: entry.record.result?.status ?? entry.grpcStatus,
    statusMessage: entry.record.result?.statusMessage,
    durationMs: entry.record.result?.durationMs ?? entry.durationMs,
    headers: entry.record.result?.headers ? Object.keys(entry.record.result.headers).length : 0,
    trailers: entry.record.result?.trailers ? Object.keys(entry.record.result.trailers).length : 0,
  };
}

type GrpcHistoryDetailSectionId = 'execution-context' | 'outcome' | 'snapshot' | 'metadata' | 'grpcurl';

interface GrpcHistoryDetailSection {
  id: GrpcHistoryDetailSectionId;
  title: string;
  content: ReactNode;
  tone?: 'success' | 'error';
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
  onOpenDiff,
  onCopyGrpcurl,
  grpcurlForEntry,
}: GrpcHistoryPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<GrpcHistoryDetailSectionId>('execution-context');

  useEffect(() => {
    if (selectedId && !history.filteredEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
    }
  }, [history.filteredEntries, selectedId]);

  const selectedEntry = useMemo(
    () => history.filteredEntries.find((entry) => entry.id === selectedId) ?? null,
    [history.filteredEntries, selectedId],
  );

  useEffect(() => {
    setActiveSectionId('execution-context');
  }, [selectedId]);

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
      const executable = true;
      return {
        executable,
        title: binding.drift.state === 'blocking'
          ? `Replay into active Studio tab (execution may stay blocked: ${binding.drift.message || 'schema drift'})`
          : 'Replay into active Studio tab',
      };
    } catch (error) {
      return {
        executable: false,
        title: error instanceof Error ? error.message : 'Replay blocked',
      };
    }
  }, [selectedEntry, studio, envVarMap, profiles, pageDefaults]);

  const openDiffStatus = useMemo(() => {
    if (!selectedEntry) {
      return { executable: false, title: 'Select a history entry' };
    }
    if (!onOpenDiff) {
      return { executable: false, title: 'Schema diff action unavailable' };
    }
    const currentDescriptorKey = (
      studio.activeTabDescriptor.descriptor?.key
      ?? studio.activeTab.descriptorKey
      ?? ''
    ).trim();
    if (!currentDescriptorKey) {
      return {
        executable: false,
        title: 'Load a descriptor on the active tab before opening schema diff',
      };
    }
    const baselineDescriptorKey = selectedEntry.descriptorKey.trim();
    if (!baselineDescriptorKey) {
      return {
        executable: false,
        title: 'History entry is missing a descriptor key',
      };
    }
    if (baselineDescriptorKey === currentDescriptorKey) {
      return {
        executable: false,
        title: 'History entry already matches the active descriptor',
      };
    }
    return {
      executable: true,
      title: 'Open descriptor diff in Advanced features',
    };
  }, [onOpenDiff, selectedEntry, studio.activeTab.descriptorKey, studio.activeTabDescriptor.descriptor?.key]);

  const previewEntry = selectedEntry
    ? previewGrpcCallHistoryEntryForUi(selectedEntry)
    : null;

  const detailSections = useMemo<GrpcHistoryDetailSection[]>(() => {
    if (!previewEntry) return [];
    const effectiveMetadata = resolveGrpcHistoryEffectiveMetadata(previewEntry);
    const effectiveMetadataKeys = Object.keys(effectiveMetadata).sort();
    return [
      {
        id: 'execution-context',
        title: 'Execution context',
        content: (
          <pre
            className="grpc-info-card__pre"
            data-testid="grpc-history-execution-context"
          >
            {serializeGrpcPreviewJson({
              transportMode: formatGrpcHistoryTransportMode(previewEntry),
              auth: formatGrpcHistoryAuthSummary(previewEntry),
              compression: formatGrpcHistoryCompressionSummary(previewEntry),
              metadataKeys: effectiveMetadataKeys,
              metadataCount: effectiveMetadataKeys.length,
            })}
          </pre>
        ),
      },
      {
        id: 'outcome',
        title: 'Outcome',
        tone: previewEntry.record.error ? 'error' : 'success',
        content: (
          <pre
            className="grpc-info-card__pre"
            data-testid="grpc-history-outcome"
          >
            {serializeGrpcPreviewJson(buildGrpcHistoryOutcomeSummary(previewEntry))}
          </pre>
        ),
      },
      {
        id: 'snapshot',
        title: 'Snapshot',
        content: (
          <pre className="grpc-info-card__pre">{serializeGrpcPreviewJson(previewEntry.record.snapshot.body)}</pre>
        ),
      },
      {
        id: 'metadata',
        title: 'Metadata',
        content: (
          <pre className="grpc-info-card__pre">
            {serializeGrpcPreviewJson(
              redactGrpcMetadataForHistory(
                effectiveMetadata,
                previewEntry.record.snapshot.auth,
              ),
            )}
          </pre>
        ),
      },
      {
        id: 'grpcurl',
        title: 'grpcurl command',
        content: (
          <pre className="grpc-grpcurl-box">{selectedEntry ? grpcurlForEntry(selectedEntry) : ''}</pre>
        ),
      },
    ];
  }, [previewEntry, selectedEntry, grpcurlForEntry]);

  const activeSection = detailSections.find((section) => section.id === activeSectionId) ?? detailSections[0] ?? null;

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
                {onOpenDiff && (
                  <button
                    type="button"
                    className="grpc-btn grpc-btn--ghost grpc-btn--sm"
                    data-testid="grpc-history-open-diff-btn"
                    disabled={!openDiffStatus.executable}
                    title={openDiffStatus.title}
                    onClick={() => selectedEntry && onOpenDiff(selectedEntry)}
                  >
                    Open diff
                  </button>
                )}
              </div>
            </header>
            <div className="grpc-history-detail__body">
              {previewEntry.bodyTruncated && (
                <p className="grpc-history-detail__warning" role="status">
                  Request body was truncated when this entry was captured.
                </p>
              )}
              <div className="grpc-history-detail-split" data-testid="grpc-history-detail-split">
                <nav className="grpc-history-detail-nav" aria-label="History detail sections">
                  {detailSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className={`grpc-history-detail-nav__item${activeSection?.id === section.id ? ' grpc-history-detail-nav__item--active' : ''}${section.tone ? ` grpc-history-detail-nav__item--${section.tone}` : ''}`}
                      data-testid={`grpc-history-detail-nav-${section.id}`}
                      onClick={() => setActiveSectionId(section.id)}
                    >
                      {section.title}
                    </button>
                  ))}
                </nav>
                <section className="grpc-history-detail-content" data-testid="grpc-history-detail-content">
                  {activeSection && (
                    <div
                      className={`grpc-info-card grpc-history-detail-content__card${activeSection.tone ? ` grpc-history-detail-content__card--${activeSection.tone}` : ''}`}
                    >
                      <div className="grpc-info-card__header">{activeSection.title}</div>
                      {activeSection.content}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
