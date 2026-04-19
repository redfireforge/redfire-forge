interface Props {
  nodeCount: number;
  edgeCount: number;
  variableCount: number;
  lastRunStatus?: 'idle' | 'running' | 'pass' | 'fail';
  lastRunTime?: number;
}

export default function WorkflowStatusBar({ nodeCount, edgeCount, variableCount, lastRunStatus, lastRunTime }: Props) {
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
    </div>
  );
}
