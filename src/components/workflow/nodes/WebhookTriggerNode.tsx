import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { WebhookTriggerNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';

type WebhookWorkflowNode = Node<WebhookTriggerNodeData, 'webhook'>;
type Props = NodeProps<WebhookWorkflowNode>;

export default function WebhookTriggerNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);
  const extractCount = data.extractVariables?.length ?? 0;

  return (
    <div className={`wf-node wf-node-webhook ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-webhook-body">
        <span className="wf-webhook-icon">🪝</span>
        <span className="wf-node-label">{data.label || 'Webhook'}</span>
        <button type="button" className="wf-node-configure-badge" title="Configure webhook" onClick={handleConfigure}>⚙ Configure</button>
      </div>
      {rs?.state === 'paused' && debugStep && (
        <button type="button" className="wf-debug-step-btn" title="Step this node" onClick={(e) => { e.stopPropagation(); debugStep(id); }}>⏭ Step</button>
      )}
      {rs?.state === 'paused' && !debugStep && <span className="wf-status-badge wf-status-paused">⏸ Paused</span>}
      {data.path && (
        <div className="wf-webhook-path">
          <span className="wf-webhook-method">{data.method}</span> {data.path}
        </div>
      )}
      {extractCount > 0 && (
        <div className="wf-webhook-extracts">
          Extracts {extractCount} variable{extractCount !== 1 ? 's' : ''}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
