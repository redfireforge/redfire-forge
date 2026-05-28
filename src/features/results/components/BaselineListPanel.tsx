import { useState } from 'react';
import type { TestRun } from '../../../shared/types';
import type { BaselineMark } from '../utils/runBaselines';

interface Props {
  baselines: BaselineMark[];
  runs: TestRun[];
  selectedRunId: string;
  onCompare: (runId: string) => void;
  onUnmark: (runId: string) => void;
  onRename: (runId: string, label: string) => void;
}

export function BaselineListPanel({ baselines, runs, selectedRunId, onCompare, onUnmark, onRename }: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (baselines.length === 0) return null;

  const startEdit = (mark: BaselineMark) => {
    setEditingId(mark.runId);
    setEditValue(mark.label ?? '');
  };

  const commitEdit = (runId: string) => {
    const trimmed = editValue.trim();
    if (trimmed) onRename(runId, trimmed);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <div className="baseline-list-panel">
      <button
        className="baseline-list-toggle btn btn-sm"
        onClick={() => setOpen((v) => !v)}
        title={open ? 'Hide baseline list' : 'Manage saved baselines'}
      >
        {open ? '▴' : '▾'} Baselines ({baselines.length})
      </button>

      {open && (
        <div className="baseline-list-items">
          {baselines.map((mark) => {
            const run = runs.find((r) => r.id === mark.runId);
            const defaultLabel = run ? new Date(run.timestamp).toLocaleString() : mark.runId.slice(0, 12);
            const displayLabel = mark.label ?? defaultLabel;
            const isSelected = mark.runId === selectedRunId;

            return (
              <div key={mark.runId} className={`baseline-list-item${isSelected ? ' baseline-list-item-current' : ''}`}>
                <span className="baseline-list-star">★</span>

                {editingId === mark.runId ? (
                  <input
                    className="baseline-list-edit-input"
                    value={editValue}
                    autoFocus
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(mark.runId);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    onBlur={() => commitEdit(mark.runId)}
                  />
                ) : (
                  <span
                    className="baseline-list-label"
                    title="Click to rename"
                    onClick={() => startEdit(mark)}
                  >
                    {displayLabel}
                  </span>
                )}

                {run && (
                  <span className="baseline-list-meta">
                    {run.summary.tps} TPS · {run.summary.p95ResponseTime} ms P95
                  </span>
                )}

                <div className="baseline-list-actions">
                  {!isSelected && (
                    <button
                      className="btn btn-sm"
                      onClick={() => onCompare(mark.runId)}
                      title="Compare selected run against this baseline"
                    >
                      Compare
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onUnmark(mark.runId)}
                    title="Remove this baseline"
                  >
                    Unmark
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
