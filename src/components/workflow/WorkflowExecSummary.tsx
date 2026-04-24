import { useEffect, useState } from 'react';
import type { RunProgress } from './WorkflowToolbar';

interface Props {
  runProgress: RunProgress | null;
  /** Label of the step that failed (if any). */
  failedStepLabel?: string | null;
  onOpenConsole?: () => void;
}

export default function WorkflowExecSummary({ runProgress, failedStepLabel, onOpenConsole }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!runProgress || runProgress.lastRunStatus === 'idle') {
      setVisible(false);
      return;
    }
    setVisible(true);

    // Auto-dismiss after 10s for pass results
    if (runProgress.lastRunStatus === 'pass') {
      const t = window.setTimeout(() => setVisible(false), 10_000);
      return () => window.clearTimeout(t);
    }
  }, [runProgress]);

  if (!visible || !runProgress || runProgress.lastRunStatus === 'idle') return null;

  const status = runProgress.lastRunStatus;
  const pct = runProgress.total > 0 ? (runProgress.completed / runProgress.total) * 100 : 0;

  return (
    <div
      className={`wf-exec-strip wf-exec-strip-${status}`}
      onClick={status !== 'running' ? onOpenConsole : undefined}
      style={status !== 'running' ? { cursor: 'pointer' } : undefined}
      role={status !== 'running' ? 'button' : undefined}
      title={status !== 'running' ? 'Click to open console' : undefined}
    >
      <div className={`wf-exec-strip-icon wf-exec-strip-icon-${status}`}>
        {status === 'running' && <span className="wf-spinner" />}
        {status === 'pass' && '✓'}
        {status === 'fail' && '✗'}
      </div>
      <div className="wf-exec-strip-body">
        <div className="wf-exec-strip-title">
          {status === 'running' && 'Running Quick Test…'}
          {status === 'pass' && 'All Steps Passed'}
          {status === 'fail' && `${runProgress.failed} Step${runProgress.failed !== 1 ? 's' : ''} Failed`}
        </div>
        <div className="wf-exec-strip-sub">
          {status === 'running' && `Step ${runProgress.completed + 1} of ${runProgress.total}`}
          {status === 'pass' && `Completed in ${(runProgress.elapsedMs / 1000).toFixed(1)}s — click to view details`}
          {status === 'fail' && (failedStepLabel ? `"${failedStepLabel}" — click to view error details` : 'Click to view error details')}
        </div>
        <div className="wf-exec-strip-progress-wrap">
          <div className={`wf-exec-strip-progress wf-exec-strip-progress-${status}`} style={{ width: `${status === 'pass' ? 100 : pct}%` }} />
        </div>
      </div>
      <div className="wf-exec-strip-stats">
        <div className="wf-exec-stat wf-exec-stat-pass">
          <div className="wf-exec-stat-val">{runProgress.completed - runProgress.failed}</div>
          <div className="wf-exec-stat-label">Passed</div>
        </div>
        {status === 'fail' && (
          <div className="wf-exec-stat wf-exec-stat-fail">
            <div className="wf-exec-stat-val">{runProgress.failed}</div>
            <div className="wf-exec-stat-label">Failed</div>
          </div>
        )}
        <div className="wf-exec-stat wf-exec-stat-time">
          <div className="wf-exec-stat-val">{(runProgress.elapsedMs / 1000).toFixed(1)}s</div>
          <div className="wf-exec-stat-label">{status === 'running' ? 'Elapsed' : 'Duration'}</div>
        </div>
      </div>
      <button
        type="button"
        className="wf-exec-strip-close"
        onClick={(e) => { e.stopPropagation(); setVisible(false); }}
        title="Dismiss"
      >✕</button>
    </div>
  );
}
