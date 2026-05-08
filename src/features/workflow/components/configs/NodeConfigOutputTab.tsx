import type { NodeRunStatus } from '../../types/workflow';

interface Props {
  nodeRunStatus?: NodeRunStatus | null;
}

const STATE_LABELS: Record<string, string> = {
  pass: 'Passed',
  fail: 'Failed',
  running: 'Running',
  skipped: 'Skipped',
  paused: 'Paused',
};

export default function NodeConfigOutputTab({ nodeRunStatus }: Props) {
  const hasData = nodeRunStatus && nodeRunStatus.state !== 'idle' && nodeRunStatus.state !== 'pending';

  if (!hasData) {
    return (
      <div className="wf-config-tab-content">
        <div className="wf-config-tab-empty">No execution data yet. Run a Quick Test to see results here.</div>
      </div>
    );
  }

  const stateLabel = nodeRunStatus.statusCode
    ? `${nodeRunStatus.statusCode}`
    : STATE_LABELS[nodeRunStatus.state] ?? nodeRunStatus.state;

  return (
    <div className="wf-config-tab-content">
      <div className="wf-output-header">
        <span className="wf-output-label">Last Quick Test</span>
        <span className={`wf-output-status wf-output-status-${nodeRunStatus.state}`}>
          <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg> {stateLabel}
        </span>
      </div>
      <div className="wf-output-meta">
        {nodeRunStatus.statusCode != null && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Status</div>
            <div className={`wf-output-meta-value ${nodeRunStatus.statusCode < 400 ? 'wf-output-meta-ok' : 'wf-output-meta-err'}`}>{nodeRunStatus.statusCode}</div>
          </div>
        )}
        {nodeRunStatus.responseTimeMs != null && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Duration</div>
            <div className="wf-output-meta-value wf-output-meta-info">{nodeRunStatus.responseTimeMs}ms</div>
          </div>
        )}
        {nodeRunStatus.statusCode == null && nodeRunStatus.responseTimeMs == null && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Result</div>
            <div className={`wf-output-meta-value ${nodeRunStatus.state === 'pass' ? 'wf-output-meta-ok' : nodeRunStatus.state === 'fail' ? 'wf-output-meta-err' : 'wf-output-meta-info'}`}>
              {stateLabel}
            </div>
          </div>
        )}
      </div>
      {nodeRunStatus.extracted && Object.keys(nodeRunStatus.extracted).length > 0 && (
        <div className="wf-output-section">
          <div className="wf-output-section-title">Extracted Variables</div>
          <table className="wf-config-var-table">
            <thead><tr><th>Name</th><th>Value</th></tr></thead>
            <tbody>
              {Object.entries(nodeRunStatus.extracted).map(([k, v]) => (
                <tr key={k}>
                  <td className="wf-config-var-ref">{k}</td>
                  <td className="wf-config-var-source wf-config-var-mono">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nodeRunStatus.responseDetail && (
        <div className="wf-output-section">
          <div className="wf-output-section-title">Response</div>
          <pre className="wf-output-body">{nodeRunStatus.responseDetail}</pre>
        </div>
      )}
      {nodeRunStatus.error && (
        <div className="wf-output-section">
          <div className="wf-output-section-title">Error</div>
          <pre className="wf-output-body wf-output-body-err">{nodeRunStatus.error}</pre>
        </div>
      )}
    </div>
  );
}
