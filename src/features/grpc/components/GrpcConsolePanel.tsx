import { useMemo, useState } from 'react';
import type { GrpcCallHistoryEntryV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import {
  previewGrpcCallHistoryEntryForUi,
  serializeGrpcPreviewJson,
} from '../../../shared/grpc/grpcSafePreview';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import type { UseGrpcCallHistoryResult } from '../hooks/useGrpcCallHistory';

export interface GrpcConsolePanelProps {
  history: UseGrpcCallHistoryResult;
  onReplay: (entry: GrpcCallHistoryEntryV1) => void;
  onCopyGrpcurl: (command: string) => void;
  grpcurlForEntry: (entry: GrpcCallHistoryEntryV1) => string;
}

type GrpcConsoleOutcomeFilter = 'all' | 'ok' | 'error';

function formatHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function isEntryError(entry: GrpcCallHistoryEntryV1): boolean {
  return Boolean(entry.record.error) || (typeof entry.grpcStatus === 'number' && entry.grpcStatus !== 0);
}

function statusChip(entry: GrpcCallHistoryEntryV1): { label: string; variant: 'ok' | 'err' | 'warn' } {
  if (entry.record.error) return { label: 'Error', variant: 'err' };
  if (typeof entry.grpcStatus === 'number' && entry.grpcStatus !== 0) {
    return { label: `Code ${entry.grpcStatus}`, variant: 'warn' };
  }
  return { label: 'OK', variant: 'ok' };
}

export function GrpcConsolePanel({
  history,
  onReplay,
  onCopyGrpcurl,
  grpcurlForEntry,
}: GrpcConsolePanelProps) {
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<GrpcConsoleOutcomeFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.entries.filter((entry) => {
      const entryIsError = isEntryError(entry);
      if (outcome === 'ok' && entryIsError) return false;
      if (outcome === 'error' && !entryIsError) return false;
      if (!q) return true;
      return [
        entry.service,
        entry.method,
        entry.target,
        String(entry.grpcStatus ?? ''),
        JSON.stringify(entry.record.snapshot.body ?? {}),
      ].join(' ').toLowerCase().includes(q);
    });
  }, [history.entries, query, outcome]);

  const selectedEntryRaw = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const selectedEntry = useMemo(
    () => (selectedEntryRaw ? previewGrpcCallHistoryEntryForUi(selectedEntryRaw) : null),
    [selectedEntryRaw],
  );

  return (
    <div className="grpc-console-layout" data-testid="grpc-console-panel">
      <aside className="grpc-console-sidebar">
        <div className="grpc-console-filters">
          <input
            type="search"
            className="grpc-console-filters__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search method, target, payload…"
            aria-label="Search console rows"
            data-testid="grpc-console-search"
          />
          <CustomSelect
            className="grpc-console-filters__select"
            value={outcome}
            onChange={(v) => setOutcome(v as GrpcConsoleOutcomeFilter)}
            aria-label="Filter console rows by status"
            data-testid="grpc-console-filter-status"
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'ok', label: 'OK' },
              { value: 'error', label: 'Errors' },
            ]}
          />
        </div>
        <div className="grpc-console-list" data-testid="grpc-console-list">
          {entries.length === 0 && (
            <p className="grpc-console-list__empty" data-testid="grpc-console-empty">
              {history.entries.length === 0
                ? 'No calls captured yet. Run a gRPC request to populate the Console.'
                : 'No rows match your console filters.'}
            </p>
          )}
          {entries.map((entry) => {
            const chip = statusChip(entry);
            return (
              <button
                key={entry.id}
                type="button"
                className={`grpc-console-row${selectedId === entry.id ? ' grpc-console-row--active' : ''}`}
                onClick={() => setSelectedId(entry.id)}
                data-testid={`grpc-console-entry-${entry.id}`}
              >
                <span className={`grpc-console-row__status grpc-console-row__status--${chip.variant}`}>{chip.label}</span>
                <span className="grpc-console-row__method">{entry.service}/{entry.method}</span>
                <span className="grpc-console-row__meta">{entry.durationMs ?? 0}ms · {formatHistoryTime(entry.capturedAt)}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="grpc-console-detail" data-testid="grpc-console-detail">
        {!selectedEntry && (
          <p className="grpc-console-detail__empty" data-testid="grpc-console-detail-empty">
            Select a row to inspect request and response details.
          </p>
        )}
        {selectedEntry && selectedEntryRaw && (
          <>
            <header className="grpc-console-detail__header">
              <div>
                <h2 className="grpc-console-detail__title">{selectedEntry.service}/{selectedEntry.method}</h2>
                <p className="grpc-console-detail__subtitle">
                  {selectedEntry.target} · {formatHistoryTime(selectedEntry.capturedAt)}
                </p>
              </div>
              <div className="grpc-console-detail__actions">
                <button
                  type="button"
                  className="grpc-btn grpc-btn--ghost grpc-btn--sm"
                  onClick={() => onCopyGrpcurl(grpcurlForEntry(selectedEntryRaw))}
                  data-testid="grpc-console-copy-grpcurl"
                >
                  Copy grpcurl
                </button>
                <button
                  type="button"
                  className="grpc-btn grpc-btn--primary grpc-btn--sm"
                  onClick={() => onReplay(selectedEntryRaw)}
                  data-testid="grpc-console-replay-btn"
                >
                  Replay
                </button>
              </div>
            </header>
            <div className="grpc-console-detail__body">
              <div className="grpc-info-card">
                <div className="grpc-info-card__header">Request body</div>
                <pre className="grpc-info-card__pre">{serializeGrpcPreviewJson(selectedEntry.record.snapshot.body)}</pre>
              </div>
              <div className="grpc-info-card">
                <div className="grpc-info-card__header">Request metadata</div>
                <pre className="grpc-info-card__pre">{serializeGrpcPreviewJson(selectedEntry.record.snapshot.metadata)}</pre>
              </div>
              <div className="grpc-info-card">
                <div className="grpc-info-card__header">Response body</div>
                <pre className="grpc-info-card__pre">
                  {serializeGrpcPreviewJson(selectedEntry.record.result?.body ?? selectedEntry.record.error ?? null)}
                </pre>
              </div>
              <div className="grpc-info-card">
                <div className="grpc-info-card__header">Headers / Trailers</div>
                <pre className="grpc-info-card__pre">
                  {serializeGrpcPreviewJson({
                    headers: selectedEntry.record.result?.headers ?? {},
                    trailers: selectedEntry.record.result?.trailers ?? {},
                    status: selectedEntry.record.result?.status ?? selectedEntry.grpcStatus ?? null,
                    statusMessage: selectedEntry.record.result?.statusMessage ?? selectedEntry.record.error?.message ?? null,
                    durationMs: selectedEntry.durationMs ?? selectedEntry.record.result?.durationMs ?? null,
                  })}
                </pre>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}