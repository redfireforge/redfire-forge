import { useEffect, useMemo, useState } from 'react';
import type { GrpcCallResult } from '../../../shared/grpc/contracts';
import type { GrpcResponseSnapshotBaseline } from '../../../shared/grpc/grpcSavedRequest';
import { serializeGrpcPreviewJson } from '../../../shared/grpc/grpcSafePreview';
import type { GrpcResponseSnapshotDiffEntry } from '../utils/grpcResponseSnapshot';

export interface GrpcResponseSnapshotDiffModalProps {
  open: boolean;
  diffs: GrpcResponseSnapshotDiffEntry[];
  baseline?: GrpcResponseSnapshotBaseline;
  actual?: GrpcCallResult;
  onClose: () => void;
}

function diffMatchesSearch(entry: GrpcResponseSnapshotDiffEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    entry.path,
    entry.change,
    JSON.stringify(entry.baselineValue ?? ''),
    JSON.stringify(entry.actualValue ?? ''),
  ].join(' ').toLowerCase().includes(needle);
}

export function GrpcResponseSnapshotDiffModal({
  open,
  diffs,
  baseline,
  actual,
  onClose,
}: GrpcResponseSnapshotDiffModalProps) {
  const [search, setSearch] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);

  const filteredDiffs = useMemo(
    () => diffs.filter((entry) => diffMatchesSearch(entry, search)),
    [diffs, search],
  );

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setMatchIndex(0);
  }, [open]);

  useEffect(() => {
    if (matchIndex >= filteredDiffs.length) {
      setMatchIndex(0);
    }
  }, [filteredDiffs.length, matchIndex]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('[data-testid="grpc-snapshot-diff-search"]')?.focus();
      }
      if (event.key === 'Enter' && document.activeElement?.getAttribute('data-testid') === 'grpc-snapshot-diff-search') {
        event.preventDefault();
        if (event.shiftKey) {
          setMatchIndex((index) => (filteredDiffs.length ? (index - 1 + filteredDiffs.length) % filteredDiffs.length : 0));
        } else {
          setMatchIndex((index) => (filteredDiffs.length ? (index + 1) % filteredDiffs.length : 0));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredDiffs.length, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="grpc-snapshot-diff-modal"
      data-testid="grpc-snapshot-diff-modal"
      role="dialog"
      aria-label="Response snapshot diff"
    >
      <header className="grpc-snapshot-diff-modal__header">
        <h2 className="grpc-snapshot-diff-modal__title">Response snapshot diff</h2>
        <div className="grpc-snapshot-diff-modal__search-row">
          <input
            type="search"
            className="grpc-snapshot-diff-modal__search"
            data-testid="grpc-snapshot-diff-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setMatchIndex(0);
            }}
            placeholder="Search diff rows…"
            aria-label="Search diff rows"
          />
          <span className="grpc-snapshot-diff-modal__match-count" data-testid="grpc-snapshot-diff-match-count">
            {filteredDiffs.length === 0 ? '0/0' : `${matchIndex + 1}/${filteredDiffs.length}`}
          </span>
          <button
            type="button"
            className="grpc-btn grpc-btn--ghost grpc-btn--xs"
            data-testid="grpc-snapshot-diff-prev"
            disabled={filteredDiffs.length === 0}
            onClick={() => setMatchIndex((index) => (index - 1 + filteredDiffs.length) % filteredDiffs.length)}
            aria-label="Previous match"
          >
            ▲
          </button>
          <button
            type="button"
            className="grpc-btn grpc-btn--ghost grpc-btn--xs"
            data-testid="grpc-snapshot-diff-next"
            disabled={filteredDiffs.length === 0}
            onClick={() => setMatchIndex((index) => (index + 1) % filteredDiffs.length)}
            aria-label="Next match"
          >
            ▼
          </button>
        </div>
      </header>
      <div className="grpc-snapshot-diff-modal__body">
        <table className="grpc-snapshot-diff-table" data-testid="grpc-snapshot-diff-table">
          <thead>
            <tr>
              <th>Change</th>
              <th>Path</th>
              <th>Baseline</th>
              <th>Actual</th>
            </tr>
          </thead>
          <tbody>
            {filteredDiffs.length === 0 && (
              <tr>
                <td colSpan={4} className="grpc-snapshot-diff-table__empty">No diff rows match your search.</td>
              </tr>
            )}
            {filteredDiffs.map((entry, index) => (
              <tr
                key={`${entry.path}-${entry.change}-${index}`}
                className={index === matchIndex ? 'grpc-snapshot-diff-table__row--active' : undefined}
                data-testid={`grpc-snapshot-diff-row-${index}`}
              >
                <td>
                  <span className={`grpc-snapshot-diff-change grpc-snapshot-diff-change--${entry.change}`}>
                    {entry.change}
                  </span>
                </td>
                <td><code>{entry.path}</code></td>
                <td><pre>{serializeGrpcPreviewJson(entry.baselineValue ?? null)}</pre></td>
                <td><pre>{serializeGrpcPreviewJson(entry.actualValue ?? null)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(baseline || actual) && (
          <div className="grpc-snapshot-diff-modal__preview-grid">
            {baseline && (
              <div className="grpc-info-card">
                <div className="grpc-info-card__header">Baseline body</div>
                <pre className="grpc-info-card__pre">{serializeGrpcPreviewJson(baseline.body)}</pre>
              </div>
            )}
            {actual && (
              <div className="grpc-info-card">
                <div className="grpc-info-card__header">Actual body</div>
                <pre className="grpc-info-card__pre">{serializeGrpcPreviewJson(actual.body ?? {})}</pre>
              </div>
            )}
          </div>
        )}
      </div>
      <footer className="grpc-snapshot-diff-modal__footer">
        <button type="button" className="grpc-btn grpc-btn--ghost" data-testid="grpc-snapshot-diff-close" onClick={onClose}>
          Close
        </button>
      </footer>
    </div>
  );
}
