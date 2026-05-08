import type { NodeRunStatus } from '../../types/workflow';

interface Props {
  nodeRunStatus?: NodeRunStatus | null;
}

/**
 * Logs tab for WorkflowNodeConfigModal — shows structured log entries
 * from the last Quick Test execution for this node.
 */
export default function NodeConfigLogsTab({ nodeRunStatus }: Props) {
  const hasData = nodeRunStatus && nodeRunStatus.state !== 'idle' && nodeRunStatus.state !== 'pending';

  if (!hasData) {
    return (
      <div className="wf-config-tab-content">
        <div className="wf-config-tab-empty">No logs yet. Run a Quick Test to see step logs here.</div>
      </div>
    );
  }

  const levelTag = nodeRunStatus.state === 'pass' ? 'ok' : nodeRunStatus.state === 'fail' ? 'err' : 'info';
  const levelLabel = nodeRunStatus.state === 'pass' ? 'OK' : nodeRunStatus.state === 'fail' ? 'ERR' : 'INFO';

  return (
    <div className="wf-config-tab-content">
      <div className="wf-logs-list">
        {nodeRunStatus.statusCode != null && (
          <div className="wf-log-entry">
            <span className={`wf-log-level wf-log-level-${levelTag}`}>{levelLabel}</span>
            <span className="wf-log-msg">
              HTTP {nodeRunStatus.statusCode}
              {nodeRunStatus.responseTimeMs != null && ` (${nodeRunStatus.responseTimeMs}ms)`}
            </span>
          </div>
        )}
        {nodeRunStatus.statusCode == null && (
          <div className="wf-log-entry">
            <span className={`wf-log-level wf-log-level-${levelTag}`}>{levelLabel}</span>
            <span className="wf-log-msg">
              Node {nodeRunStatus.state}
              {nodeRunStatus.responseTimeMs != null && ` (${nodeRunStatus.responseTimeMs}ms)`}
            </span>
          </div>
        )}
        {nodeRunStatus.extracted && Object.entries(nodeRunStatus.extracted).map(([k, v]) => (
          <div key={k} className="wf-log-entry">
            <span className="wf-log-level wf-log-level-info">INFO</span>
            <span className="wf-log-msg">Extracted: {k} = &quot;{v}&quot;</span>
          </div>
        ))}
        {nodeRunStatus.error && (
          <div className="wf-log-entry">
            <span className="wf-log-level wf-log-level-err">ERR</span>
            <span className="wf-log-msg">{nodeRunStatus.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
