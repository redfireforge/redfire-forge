interface Props {
  nodeCount: number;
  edgeCount: number;
  variableCount: number;
  lastRunStatus?: 'idle' | 'running' | 'pass' | 'fail';
  lastRunTime?: number;
  /** First failed step summary — open full text in a modal instead of cramming the status bar. */
  lastRunError?: string | null;
  onOpenRunError?: () => void;
}

export default function WorkflowStatusBar({
  nodeCount,
  edgeCount,
  variableCount,
  lastRunStatus,
  lastRunTime,
  lastRunError,
  onOpenRunError,
}: Props) {
  return (
    <div className="wf-status-bar">
      <span>Steps: <strong>{nodeCount}</strong></span>
      <span className="wf-status-sep">·</span>
      <span>Connections: <strong>{edgeCount}</strong></span>
      <span className="wf-status-sep">·</span>
      <span>Variables: <strong>{variableCount}</strong></span>
      {lastRunStatus && lastRunStatus !== 'idle' && (
        <>
          <span className="wf-status-sep">·</span>
          <span className={`wf-status-run wf-status-run-${lastRunStatus}`}>
            {lastRunStatus === 'running' ? 'Running…' :
              lastRunStatus === 'pass' ? `PASS${lastRunTime ? ` (${(lastRunTime / 1000).toFixed(1)}s)` : ''}` :
              `FAIL${lastRunTime ? ` (${(lastRunTime / 1000).toFixed(1)}s)` : ''}`}
          </span>
        </>
      )}
      {lastRunError && lastRunStatus === 'fail' && (
        <>
          <span className="wf-status-sep">·</span>
          <button
            type="button"
            className="wf-run-error-open-btn"
            title={lastRunError}
            onClick={() => onOpenRunError?.()}
          >
            View full error
          </button>
        </>
      )}
    </div>
  );
}
