import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorkflowIterationTrace } from '@shared/types';
import { formatDurationMs } from '@shared/utils/formatDuration';

type FilterMode = 'all' | 'failed' | 'slowest';

interface Props {
  iterations: WorkflowIterationTrace[];
  selectedIteration: number | undefined;
  onSelect: (iteration: number | undefined) => void;
  failedCount: number;
}

export default function IterationPicker({ iterations, selectedIteration, onSelect, failedCount }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [jumpInput, setJumpInput] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);

  const isAggregate = selectedIteration === undefined;

  const openDropdown = useCallback(() => {
    if (toggleRef.current) {
      const rect = toggleRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open && jumpInputRef.current) {
      jumpInputRef.current.focus();
    }
  }, [open]);

  const p95Threshold = useMemo(() => {
    if (iterations.length === 0) return Infinity;
    const sorted = [...iterations].sort((a, b) => a.durationMs - b.durationMs);
    return sorted[Math.floor(sorted.length * 0.9)]?.durationMs ?? Infinity;
  }, [iterations]);

  const filteredIterations = useMemo(() => {
    let list = iterations.map((iter) => ({ iter, iterIndex: iter.index }));

    if (filter === 'failed') {
      list = list.filter(({ iter }) => !iter.passed);
    } else if (filter === 'slowest') {
      list = list.filter(({ iter }) => iter.durationMs >= p95Threshold);
    }

    if (jumpInput.trim()) {
      const num = parseInt(jumpInput.trim(), 10);
      if (!isNaN(num) && num >= 1) {
        list = list.filter(({ iterIndex }) => iterIndex + 1 === num);
      }
    }

    return list;
  }, [iterations, filter, jumpInput, p95Threshold]);

  const handleSelect = useCallback((iterIndex: number) => {
    onSelect(iterIndex);
    setOpen(false);
    setJumpInput('');
  }, [onSelect]);

  const handleJumpKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredIterations.length === 1) {
      handleSelect(filteredIterations[0].iterIndex);
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
    e.stopPropagation();
  }, [filteredIterations, handleSelect]);

  const slowestCount = useMemo(
    () => iterations.filter(i => i.durationMs >= p95Threshold).length,
    [iterations, p95Threshold],
  );

  const selectedIter = useMemo(
    () => selectedIteration !== undefined ? iterations.find(i => i.index === selectedIteration) : undefined,
    [iterations, selectedIteration],
  );

  const buttonLabel = isAggregate
    ? 'Aggregate'
    : `#${selectedIteration! + 1} ${selectedIter?.passed ? '✓' : '✗'} ${formatDurationMs(selectedIter?.durationMs)}`;

  return (
    <div className="iter-picker" ref={containerRef} data-testid="view-toggle">
      <button
        ref={toggleRef}
        className={`iter-picker-toggle ${isAggregate ? 'aggregate' : selectedIter?.passed ? 'pass' : 'fail'}`}
        onClick={() => open ? setOpen(false) : openDropdown()}
        data-testid="iter-picker-toggle"
      >
        <span className="iter-picker-label">{buttonLabel}</span>
        <span className="iter-picker-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
        <div
          className="iter-picker-backdrop"
          data-testid="iter-picker-backdrop"
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        />
        <div
          className="iter-picker-dropdown"
          data-testid="iter-picker-dropdown"
          style={{ top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
        >
          <div className="iter-picker-header">
            <input
              ref={jumpInputRef}
              className="iter-picker-jump"
              type="text"
              placeholder="Jump to #..."
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={handleJumpKeyDown}
              data-testid="iter-picker-jump"
            />
          </div>

          <div className="iter-picker-filters">
            <button
              className={`iter-picker-filter ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
              data-testid="iter-filter-all"
              title={`Show all ${iterations.length} iteration${iterations.length === 1 ? '' : 's'} (each = one full workflow run).`}
            >
              All ({iterations.length})
            </button>
            <button
              className={`iter-picker-filter failed ${filter === 'failed' ? 'active' : ''}`}
              onClick={() => setFilter('failed')}
              disabled={failedCount === 0}
              data-testid="iter-filter-failed"
              title={`${failedCount} of ${iterations.length} iteration${iterations.length === 1 ? '' : 's'} failed (had at least one failing node).`}
            >
              Failed ({failedCount})
            </button>
            <button
              className={`iter-picker-filter ${filter === 'slowest' ? 'active' : ''}`}
              onClick={() => setFilter('slowest')}
              data-testid="iter-filter-slowest"
              title={`Slowest ${slowestCount} iteration${slowestCount === 1 ? '' : 's'} by total duration.`}
            >
              Slowest ({slowestCount})
            </button>
          </div>

          <div className="iter-picker-list" data-testid="iter-picker-list">
            <button
              className={`iter-picker-item aggregate ${isAggregate ? 'selected' : ''}`}
              onClick={() => { onSelect(undefined); setOpen(false); setJumpInput(''); }}
              data-testid="iter-picker-aggregate"
            >
              <span className="iter-item-icon">◉</span>
              <span className="iter-item-label">Aggregate View</span>
              <span className="iter-item-meta">{iterations.length} iterations</span>
            </button>

            {filteredIterations.map(({ iter, iterIndex }) => (
              <button
                key={iterIndex}
                className={`iter-picker-item ${iter.passed ? 'pass' : 'fail'} ${selectedIteration === iterIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(iterIndex)}
                data-testid={`iter-picker-item-${iterIndex}`}
              >
                <span className={`iter-item-status ${iter.passed ? 'pass' : 'fail'}`}>
                  {iter.passed ? '✓' : '✗'}
                </span>
                <span className="iter-item-label">#{iterIndex + 1}</span>
                <span className="iter-item-duration">{formatDurationMs(iter.durationMs)}</span>
                {iter.durationMs >= p95Threshold && (
                  <span className="iter-item-slow-badge">slow</span>
                )}
              </button>
            ))}

            {filteredIterations.length === 0 && (
              <div className="iter-picker-empty" data-testid="iter-picker-empty">
                {jumpInput.trim() ? `No iteration #${jumpInput.trim()}` : 'No matching iterations'}
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
