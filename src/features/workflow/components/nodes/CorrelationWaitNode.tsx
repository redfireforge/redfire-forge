import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { CorrelationWaitNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';
import { NodeConfigureButton } from './NodeConfigureButton';

type CorrelationWaitWorkflowNode = Node<CorrelationWaitNodeData, 'correlationWait'>;
type Props = NodeProps<CorrelationWaitWorkflowNode>;

function formatTimeout(ms: number): string {
  if (ms <= 0) return 'No timeout';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60000).toFixed(0)}m`;
}

export default function CorrelationWaitNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const corrIdPreview = data.correlationIdExpression
    ? data.correlationIdExpression.length > 25
      ? data.correlationIdExpression.slice(0, 25) + '…'
      : data.correlationIdExpression
    : 'Not configured';

  return (
    <div className={`wf-node wf-node-correlationWait ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-correlation-body">
        <NodeIcon type="correlationWait" />
        <div>
          <span className="wf-node-label">{data.label || 'Correlation Wait'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('correlationWait')}</div>
        </div>
      </div>
      <div className="wf-correlation-details">
        <div className="wf-correlation-id" title={data.correlationIdExpression}>
          <svg className="wf-inline-icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          <span>{corrIdPreview}</span>
        </div>
        <div className="wf-correlation-path" title={data.webhookPath}>
          <svg className="wf-inline-icon" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          <span>{data.webhookPath || '/webhooks/...'}</span>
        </div>
        <div className="wf-correlation-timeout">
          <svg className="wf-inline-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <span className="wf-correlation-timeout-val">{formatTimeout(data.timeoutMs)}</span>
        </div>
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure correlation wait" onClick={handleConfigure} />
      </div>
      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />
      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
