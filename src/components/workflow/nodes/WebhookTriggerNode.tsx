import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { WebhookTriggerNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';

type WebhookWorkflowNode = Node<WebhookTriggerNodeData, 'webhook'>;
type Props = NodeProps<WebhookWorkflowNode>;

export default function WebhookTriggerNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);
  const extractCount = data.extractVariables?.length ?? 0;

  return (
    <div className={`wf-node wf-node-webhook ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-webhook-body">
        <NodeIcon type="webhook" />
        <div>
          <span className="wf-node-label">{data.label || 'Webhook'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('webhook')}</div>
        </div>
        <button type="button" className="wf-node-configure-badge" title="Configure webhook" onClick={handleConfigure}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />
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
