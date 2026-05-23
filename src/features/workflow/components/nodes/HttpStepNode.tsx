import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { HttpNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeConfigureButton } from './NodeConfigureButton';

import { WORKFLOW_METHOD_COLORS as METHOD_COLORS } from '../../../../shared/constants/httpMethodColors';

type HttpWorkflowNode = Node<HttpNodeData, 'http'>;
type Props = NodeProps<HttpWorkflowNode>;

export default function HttpStepNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure, openStepDetail } = useNodeBase(id);
  const method = data.scenario?.method ?? 'GET';
  const url = data.scenario?.url ?? '';
  const extractCount = data.scenario?.extractions?.length ?? 0;
  const dataRowCount = data.scenario?.dataSource?.rows?.filter(r => r.enabled).length ?? 0;

  const openDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rs?.state === 'pass' || rs?.state === 'fail') openStepDetail(id);
  };

  return (
    <div className={`wf-node wf-node-http ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-node-header">
        <NodeIcon type="http" />
        {data.sourceType && <span className="wf-source-badge">{data.sourceType === 'catalog' ? 'CAT' : 'REQ'}</span>}
        {data.serviceId && (
          <span className="wf-source-badge wf-svc-badge" title="Bound to Service Registry — multi-env URLs and auth managed">
            <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            SVC
          </span>
        )}
        <span className="wf-method-badge" style={{ background: METHOD_COLORS[method] ?? '#6b7280' }}>
          {method}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="wf-node-label" title={data.label}>{data.label}</span>
          <div className="wf-node-sublabel">{getNodeCategory('http')}</div>
        </div>
        <NodeConfigureButton title="Configure this step" onClick={handleConfigure} />
      </div>

      <div className="wf-node-url" title={url}>
        {url.length > 40 ? '...' + url.slice(-37) : url}
      </div>

      <div className="wf-node-footer">
        {extractCount > 0 && <span className="wf-extract-badge">{extractCount} extract{extractCount > 1 ? 's' : ''}</span>}
        {dataRowCount > 0 && (
          <span className="wf-extract-badge" title="Data source rows">
            <svg className="wf-inline-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
            {dataRowCount} row{dataRowCount > 1 ? 's' : ''}
          </span>
        )}
        {rs?.state === 'pass' && (
          <button
            type="button"
            className="wf-status-badge wf-status-pass wf-status-badge-btn"
            title="Click for full response details"
            onClick={openDetail}
          >
            <span>✓</span> {rs.statusCode} · {rs.responseTimeMs}ms
          </button>
        )}
        {rs?.state === 'fail' && (
          <button
            type="button"
            className="wf-status-badge wf-status-fail wf-status-badge-btn"
            title={rs.error ? 'Click for full error and response details' : 'Click for details'}
            onClick={openDetail}
          >
            <span>✗</span> {rs.statusCode || 'ERR'}{rs.responseTimeMs ? ` · ${rs.responseTimeMs}ms` : ''}
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
        {rs?.state === 'running' && <span className="wf-status-badge wf-status-running"><span className="wf-spinner" /> Running…</span>}
        <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />
      </div>

      {/* Source/target last in DOM so handles stack above content (otherwise top handle sits under the header and blocks connections). */}
      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
