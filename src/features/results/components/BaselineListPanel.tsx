import { useRef, useState } from 'react';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // Used to prevent onBlur from committing when Escape was pressed
  const escapedRef = useRef(false);

  if (baselines.length === 0) return null;

  const startEdit = (mark: BaselineMark) => {
    escapedRef.current = false;
    setEditingId(mark.runId);
    setEditValue(mark.label ?? '');
  };

  // Sole commit path — called only via onBlur
  const commitEdit = (runId: string) => {
    if (escapedRef.current) return;
    const trimmed = editValue.trim();
    if (trimmed) onRename(runId, trimmed);
    setEditingId(null);
  };

  const cancelEdit = () => {
    escapedRef.current = true;
    setEditingId(null);
  };

  return (
    <div className="baseline-list-panel">
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
                    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
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
    </div>
  );
}

