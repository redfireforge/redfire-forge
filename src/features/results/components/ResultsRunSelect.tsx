import { useEffect, useRef, useState } from 'react';
import type { TestRun } from '../../../shared/types';
import { isBaseline, type BaselineMark, type RunRegressionStatus } from '../utils/runBaselines';

function formatRunLabel(
  run: TestRun,
  baselines: BaselineMark[],
  runSlaStatuses: Map<string, 'pass' | 'fail' | 'warn' | 'no-data' | null>,
  runRegressionStatuses: Map<string, RunRegressionStatus>,
) {
  const bl = isBaseline(baselines, run.id);
  const isWf = run.config.executionMode === 'workflow';
  const slaStatus = runSlaStatuses.has(run.id) ? runSlaStatuses.get(run.id) : undefined;
  const slaDot = slaStatus === 'pass' ? '🟢' : slaStatus === 'fail' ? '🔴' : slaStatus === 'warn' ? '🟡' : slaStatus === 'no-data' ? '⚪' : slaStatus === null ? '⚫' : '';
  const regStatus = runRegressionStatuses.get(run.id);
  const regDot = regStatus === 'critical' ? '🔴' : regStatus === 'warn' ? '🟡' : regStatus === 'pass' ? '🟢' : '';
  return [
    bl ? '★' : '',
    isWf ? '⚡' : '🧪',
    slaDot,
    regDot ? `R:${regDot}` : '',
    new Date(run.timestamp).toLocaleString(),
    run.projectName,
    run.svcName,
    run.envName,
    `${run.summary.totalRequests} req`,
    `${run.summary.tps} TPS`,
  ].filter(Boolean).join(' — ');
}

interface Props {
  runs: TestRun[];
  value: string;
  baselines: BaselineMark[];
  runSlaStatuses: Map<string, 'pass' | 'fail' | 'warn' | 'no-data' | null>;
  runRegressionStatuses: Map<string, RunRegressionStatus>;
  onChange: (value: string) => void;
}

export function ResultsRunSelect({
  runs,
  value,
  baselines,
  runSlaStatuses,
  runRegressionStatuses,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = 'results-run-select-listbox';
  const selectedRun = runs.find((run) => run.id === value) ?? runs[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  const selectedLabel = selectedRun
    ? formatRunLabel(selectedRun, baselines, runSlaStatuses, runRegressionStatuses)
    : 'Select a run...';

  return (
    <div className="results-run-select" ref={rootRef}>
      <button
        type="button"
        className={`results-run-select-trigger ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <span className="results-run-select-text">{selectedLabel}</span>
        <span className="results-run-select-caret">▾</span>
      </button>

      {open && (
        <div className="results-run-select-menu" role="listbox" id={listboxId}>
          {runs.map((run) => {
            const label = formatRunLabel(run, baselines, runSlaStatuses, runRegressionStatuses);
            const selected = run.id === value;
            return (
              <button
                key={run.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`results-run-select-option ${selected ? 'selected' : ''}`}
                onClick={() => {
                  onChange(run.id);
                  setOpen(false);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
