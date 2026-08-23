import { useState, useRef, useEffect, useCallback } from 'react';
import type { ResponseHistoryEntry } from '../hooks/useResponseCache';
import { formatBytes } from '@shared/utils/helpers';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function groupLabel(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const diffMs = now.getTime() - ts;
  const diffMin = diffMs / 60_000;
  if (diffMin < 5) return 'Just Now';
  if (diffMin < 60) return 'Earlier Today';
  const sameDay = now.toDateString() === d.toDateString();
  if (sameDay) return 'Today';
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays < 7) return 'This Week';
  return 'Older';
}

interface Props {
  history: ResponseHistoryEntry[];
  currentEntryId: string | null;
  onRestore: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
}

export function ResponseHistoryDropdown({ history, currentEntryId, onRestore, onDeleteEntry, onClearHistory }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleRestore = useCallback((id: string) => {
    onRestore(id);
    setOpen(false);
  }, [onRestore]);

  const currentEntry = history.find(h => h.id === currentEntryId);
  const triggerLabel = currentEntry ? timeAgo(currentEntry.timestamp) : 'No History';

  const groups: { label: string; entries: ResponseHistoryEntry[] }[] = [];
  for (const entry of history) {
    const lbl = groupLabel(entry.timestamp);
    const existing = groups.find(g => g.label === lbl);
    if (existing) existing.entries.push(entry);
    else groups.push({ label: lbl, entries: [entry] });
  }

  return (
    <div className="resp-history-wrapper" ref={wrapRef}>
      <button
        type="button"
        className="resp-history-trigger"
        onClick={() => setOpen(o => !o)}
        disabled={history.length === 0}
        title="Response history"
        data-testid="req-resp-history-trigger"
      >
        {triggerLabel} {history.length > 0 && <span className="resp-history-arrow">{open ? '▲' : '▼'}</span>}
      </button>

      {open && (
        <div className="resp-history-dropdown" data-testid="req-resp-history-dropdown">
          <div className="resp-history-actions">
            {currentEntryId && (
              <button
                type="button"
                className="resp-history-action-btn"
                onClick={() => { onDeleteEntry(currentEntryId); setOpen(false); }}
              >
                <span className="resp-history-action-icon">🗑</span> Delete Current Response
              </button>
            )}
            <button
              type="button"
              className="resp-history-action-btn resp-history-action-danger"
              onClick={() => { onClearHistory(); setOpen(false); }}
            >
              <span className="resp-history-action-icon">🗑</span> Clear History
            </button>
          </div>

          <div className="resp-history-list">
            {groups.map(g => (
              <div key={g.label} className="resp-history-group">
                <div className="resp-history-group-label">{g.label}</div>
                {g.entries.map(entry => {
                  const isActive = entry.id === currentEntryId;
                  const statusCls = entry.response.status >= 200 && entry.response.status < 300
                    ? 'success' : entry.response.status >= 400 ? 'error' : 'warn';
                  const shortUrl = (() => {
                    try { return new URL(entry.url).hostname + new URL(entry.url).pathname; }
                    catch { return entry.url; }
                  })();
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={`resp-history-entry ${isActive ? 'active' : ''}`}
                      data-testid="req-resp-history-entry"
                      onClick={() => handleRestore(entry.id)}
                    >
                      <span className={`resp-history-status ${statusCls}`}>
                        {entry.response.status} {entry.response.statusText.length > 5
                          ? entry.response.statusText.slice(0, 2).toUpperCase()
                          : entry.response.statusText}
                      </span>
                      <span className="resp-history-method">{entry.method}</span>
                      <span className="resp-history-url" title={entry.url}>{shortUrl}</span>
                      <span className="resp-history-meta">{entry.responseTime} ms</span>
                      <span className="resp-history-meta">{formatBytes(entry.response.body?.length ?? 0)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
