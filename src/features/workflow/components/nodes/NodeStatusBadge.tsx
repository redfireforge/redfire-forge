import type { NodeRunStatus } from '../../types/workflow';

interface NodeStatusBadgeProps {
  rs: NodeRunStatus | undefined;
}

export function NodeStatusBadge({ rs }: NodeStatusBadgeProps) {
  if (!rs) return null;

  if (rs.state === 'running') {
    return (
      <span className="wf-status-badge wf-status-running">
        <span className="wf-spinner" /> Running…
      </span>
    );
  }

  if (rs.state === 'pass') {
    return (
      <span className="wf-status-badge wf-status-pass">
        <span>✓</span> Pass{rs.responseTimeMs != null ? ` · ${rs.responseTimeMs}ms` : ''}
      </span>
    );
  }

  if (rs.state === 'fail') {
    return (
      <span className="wf-status-badge wf-status-fail">
        <span>✗</span> Fail{rs.error ? ` · ${rs.error.slice(0, 30)}` : ''}
      </span>
    );
  }

  return null;
}
