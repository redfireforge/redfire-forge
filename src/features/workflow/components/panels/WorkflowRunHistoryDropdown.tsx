import { useState, useRef, useEffect, useCallback } from 'react';
import type { WorkflowRunHistoryEntry } from '../../hooks/useWorkflowRunCache';
import {
  formatDurationCompactMs,
  formatRelativeTime,
  formatTimeWithSeconds,
} from '../../../../shared/utils/formatRelativeTime';
import { truncate } from '../../../../shared/utils/helpers';

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
  history: WorkflowRunHistoryEntry[];
  activeEntryId: string | null;
  onRestore: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
}

export default function WorkflowRunHistoryDropdown({ history, activeEntryId, onRestore, onDeleteEntry, onClearHistory }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  const handleRestore = useCallback((id: string) => {
    onRestore(id);
    setOpen(false);
  }, [onRestore]);

  const activeEntry = history.find(h => h.id === activeEntryId);
  const triggerLabel = activeEntry
    ? formatRelativeTime(activeEntry.timestamp, undefined, { minuteFormat: 'long', justNow: 'title' })
    : 'Run History';

  const groups: { label: string; entries: WorkflowRunHistoryEntry[] }[] = [];
  for (const entry of history) {
    const lbl = groupLabel(entry.timestamp);
    const existing = groups.find(g => g.label === lbl);
    if (existing) existing.entries.push(entry);
    else groups.push({ label: lbl, entries: [entry] });
  }

  return (
    <div className="wf-run-history-wrapper" ref={wrapRef}>
      <button
        type="button"
        className="wf-run-history-trigger"
        onClick={() => setOpen(o => !o)}
        disabled={history.length === 0}
        title="Quick Test run history"
      >
        {triggerLabel} {history.length > 0 && <span className="wf-run-history-arrow">{open ? '▲' : '▼'}</span>}
      </button>

      {open && (
        <div className="wf-run-history-dropdown">
          <div className="wf-run-history-actions">
            {activeEntryId && (
              <button
                type="button"
                className="wf-run-history-action-btn"
                onClick={() => { onDeleteEntry(activeEntryId); setOpen(false); }}
              >
                <span className="wf-run-history-action-icon">🗑</span> Delete Current Run
              </button>
            )}
            <button
              type="button"
              className="wf-run-history-action-btn wf-run-history-action-danger"
              onClick={() => { onClearHistory(); setOpen(false); }}
            >
              <span className="wf-run-history-action-icon">🗑</span> Clear History
            </button>
          </div>
          <div className="wf-run-history-list">
            {groups.map(group => (
              <div key={group.label} className="wf-run-history-group">
                <div className="wf-run-history-group-label">{group.label}</div>
                {group.entries.map(entry => {
                  const passCount = entry.stepSummaries.filter(s => s.state === 'pass').length;
                  const failCount = entry.stepSummaries.filter(s => s.state === 'fail').length;
                  const skippedCount = entry.stepSummaries.filter(s => s.state === 'skipped').length;
                  const isExpanded = expandedId === entry.id;

                  return (
                    <div key={entry.id} className={`wf-run-history-card ${entry.id === activeEntryId ? 'active' : ''}`}>
                      {/* Summary row — click to restore */}
                      <button
                        type="button"
                        className="wf-run-history-entry"
                        onClick={() => handleRestore(entry.id)}
                        title="Click to restore this run on the canvas"
                      >
                        <span className={`wf-run-history-status ${entry.passed ? 'success' : 'error'}`}>
                          {entry.passed ? 'PASS' : 'FAIL'}
                        </span>
                        <span className="wf-run-history-summary">
                          <span className="wf-run-history-counts">
                            {passCount > 0 && <span className="wf-rh-count pass">{passCount} ✓</span>}
                            {failCount > 0 && <span className="wf-rh-count fail">{failCount} ✗</span>}
                            {skippedCount > 0 && <span className="wf-rh-count skip">{skippedCount} ⊘</span>}
                          </span>
                          <span className="wf-run-history-duration">{formatDurationCompactMs(entry.durationMs)}</span>
                        </span>
                        <span className="wf-run-history-time">{formatTimeWithSeconds(entry.timestamp)}</span>
                      </button>

                      {/* Expand toggle for step details */}
                      {entry.stepSummaries.length > 0 && (
                        <button
                          type="button"
                          className="wf-run-history-expand-btn"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          title={isExpanded ? 'Collapse steps' : 'Show step details'}
                        >
                          {isExpanded ? '▾ Hide steps' : `▸ ${entry.stepSummaries.length} steps`}
                        </button>
                      )}

                      {/* Expanded step details */}
                      {isExpanded && (
                        <div className="wf-run-history-steps-detail">
                          {entry.stepSummaries.map((step, i) => (
                            <div key={step.nodeId} className={`wf-rh-step wf-rh-step-${step.state}`}>
                              <span className="wf-rh-step-idx">{i + 1}</span>
                              <span className={`wf-rh-step-code ${step.state}`}>
                                {step.statusCode ?? (step.state === 'skipped' ? '—' : '!')}
                              </span>
                              <span className="wf-rh-step-label" title={step.label}>{step.label}</span>
                              {step.responseTimeMs != null && (
                                <span className="wf-rh-step-time">{formatDurationCompactMs(step.responseTimeMs)}</span>
                              )}
                              {step.error && (
                                <span className="wf-rh-step-error" title={step.error}>⚠</span>
                              )}
                            </div>
                          ))}
                          {entry.error && (
                            <div className="wf-rh-run-error" title={entry.error}>
                              {truncate(entry.error, 80, '…', false)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
