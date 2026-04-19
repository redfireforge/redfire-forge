import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { HttpNodeData } from '../../../types/workflow';
import type { NodeRunStatus } from '../../../types/workflow';

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#ef4444',
};

interface Props extends NodeProps {
  data: HttpNodeData & { runStatus?: NodeRunStatus };
}

export default function HttpStepNode({ data, selected }: Props) {
  const method = data.scenario?.method ?? 'GET';
  const url = data.scenario?.url ?? '';
  const extractCount = data.scenario?.extractions?.length ?? 0;
  const rs = data.runStatus;

  const stateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';

  return (
    <div className={`wf-node wf-node-http ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="wf-handle" />

      <div className="wf-node-header">
        <span className="wf-method-badge" style={{ background: METHOD_COLORS[method] ?? '#6b7280' }}>
          {method}
        </span>
        <span className="wf-node-label" title={data.label}>{data.label}</span>
        {data.sourceType && <span className="wf-source-badge">{data.sourceType === 'catalog' ? 'CAT' : 'REQ'}</span>}
      </div>

      <div className="wf-node-url" title={url}>
        {url.length > 40 ? '...' + url.slice(-37) : url}
      </div>

      <div className="wf-node-footer">
        {extractCount > 0 && <span className="wf-extract-badge">{extractCount} extract{extractCount > 1 ? 's' : ''}</span>}
        {rs?.state === 'pass' && <span className="wf-status-badge wf-status-pass">{rs.statusCode} · {rs.responseTimeMs}ms</span>}
        {rs?.state === 'fail' && <span className="wf-status-badge wf-status-fail">{rs.statusCode || 'ERR'}{rs.responseTimeMs ? ` · ${rs.responseTimeMs}ms` : ''}</span>}
        {rs?.state === 'running' && <span className="wf-status-badge wf-status-running">Running…</span>}
      </div>

      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
