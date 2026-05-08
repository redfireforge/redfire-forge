import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorkflowIterationTrace } from '../../../shared/types';
import { formatDurationMs } from '../../../shared/utils/formatDuration';

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
    let list = iterations.map((iter, idx) => ({ iter, idx }));

    if (filter === 'failed') {
      list = list.filter(({ iter }) => !iter.passed);
    } else if (filter === 'slowest') {
      list = list.filter(({ iter }) => iter.durationMs >= p95Threshold);
    }

    if (jumpInput.trim()) {
      const num = parseInt(jumpInput.trim(), 10);
      if (!isNaN(num) && num >= 1) {
        list = list.filter(({ idx }) => idx + 1 === num);
      }
    }

    return list;
  }, [iterations, filter, jumpInput, p95Threshold]);

  const handleSelect = useCallback((idx: number) => {
    onSelect(idx);
    setOpen(false);
    setJumpInput('');
  }, [onSelect]);

  const handleJumpKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredIterations.length === 1) {
      handleSelect(filteredIterations[0].idx);
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

  const buttonLabel = isAggregate
    ? 'Aggregate'
    : `#${selectedIteration + 1} ${iterations[selectedIteration]?.passed ? '✓' : '✗'} ${formatDurationMs(iterations[selectedIteration]?.durationMs)}`;

  return (
    <div className="iter-picker" ref={containerRef} data-testid="view-toggle">
      <button
        ref={toggleRef}
        className={`iter-picker-toggle ${isAggregate ? 'aggregate' : iterations[selectedIteration!]?.passed ? 'pass' : 'fail'}`}
        onClick={() => open ? setOpen(false) : openDropdown()}
        data-testid="iter-picker-toggle"
      >
        <span className="iter-picker-label">{buttonLabel}</span>
        <span className="iter-picker-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="iter-picker-dropdown"
          data-testid="iter-picker-dropdown"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
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
            >
              All ({iterations.length})
            </button>
            <button
              className={`iter-picker-filter failed ${filter === 'failed' ? 'active' : ''}`}
              onClick={() => setFilter('failed')}
              disabled={failedCount === 0}
              data-testid="iter-filter-failed"
            >
              Failed ({failedCount})
            </button>
            <button
              className={`iter-picker-filter ${filter === 'slowest' ? 'active' : ''}`}
              onClick={() => setFilter('slowest')}
              data-testid="iter-filter-slowest"
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

            {filteredIterations.map(({ iter, idx }) => (
              <button
                key={idx}
                className={`iter-picker-item ${iter.passed ? 'pass' : 'fail'} ${selectedIteration === idx ? 'selected' : ''}`}
                onClick={() => handleSelect(idx)}
                data-testid={`iter-picker-item-${idx}`}
              >
                <span className={`iter-item-status ${iter.passed ? 'pass' : 'fail'}`}>
                  {iter.passed ? '✓' : '✗'}
                </span>
                <span className="iter-item-label">#{idx + 1}</span>
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
      )}
    </div>
  );
}
