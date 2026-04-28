import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { CorrelationWaitNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';
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
          🔗 {corrIdPreview}
        </div>
        <div className="wf-correlation-path" title={data.webhookPath}>
          📡 {data.webhookPath || '/webhooks/...'}
        </div>
        <div className="wf-correlation-timeout">
          ⏱ {formatTimeout(data.timeoutMs)}
        </div>
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure correlation wait" onClick={handleConfigure} />
      </div>
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />
      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
