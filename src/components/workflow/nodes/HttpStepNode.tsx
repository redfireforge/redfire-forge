import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { HttpNodeData } from '../../../types/workflow';
import { useWorkflowInspect } from '../WorkflowInspectContext';
import { useWorkflowNodeRunStatus } from '../WorkflowNodeRunContext';

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#ef4444',
};

type HttpWorkflowNode = Node<HttpNodeData, 'http'>;
type Props = NodeProps<HttpWorkflowNode>;

export default function HttpStepNode({ id, data, selected }: Props) {
  const { openStepDetail } = useWorkflowInspect();
  const rs = useWorkflowNodeRunStatus(id);
  const method = data.scenario?.method ?? 'GET';
  const url = data.scenario?.url ?? '';
  const extractCount = data.scenario?.extractions?.length ?? 0;

  const stateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';

  const openDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rs?.state === 'pass' || rs?.state === 'fail') openStepDetail(id);
  };

  return (
    <div className={`wf-node wf-node-http ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
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
        {rs?.state === 'pass' && (
          <button
            type="button"
            className="wf-status-badge wf-status-pass wf-status-badge-btn"
            title="Click for full response details"
            onClick={openDetail}
          >
            {rs.statusCode} · {rs.responseTimeMs}ms
          </button>
        )}
        {rs?.state === 'fail' && (
          <button
            type="button"
            className="wf-status-badge wf-status-fail wf-status-badge-btn"
            title={rs.error ? 'Click for full error and response details' : 'Click for details'}
            onClick={openDetail}
          >
            {rs.statusCode || 'ERR'}{rs.responseTimeMs ? ` · ${rs.responseTimeMs}ms` : ''}
          </button>
        )}
        {(rs?.state === 'pass' || rs?.state === 'fail') && (
          <button
            type="button"
            className="wf-node-detail-badge"
            title="Open full response body, validation errors, and request line (troubleshooting)"
            onClick={openDetail}
          >
            Details
          </button>
        )}
        {rs?.state === 'running' && <span className="wf-status-badge wf-status-running">Running…</span>}
      </div>

      {/* Source/target last in DOM so handles stack above content (otherwise top handle sits under the header and blocks connections). */}
      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
