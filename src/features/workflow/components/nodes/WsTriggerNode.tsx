import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { WsTriggerNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type WsTriggerWorkflowNode = Node<WsTriggerNodeData, 'wsTrigger'>;
type Props = NodeProps<WsTriggerWorkflowNode>;

export default function WsTriggerNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const urlPreview = data.url || 'No URL';

  return (
    <div className={`wf-node wf-node-wsTrigger ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-ws-body">
        <NodeIcon type="wsTrigger" />
        <div>
          <span className="wf-node-label">{data.label || 'WS Trigger'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('wsTrigger')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-url" title={data.url}>
          <strong>URL:</strong> {urlPreview}
        </div>
        <div className="wf-ws-connid">
          <strong>ID:</strong> {data.connectionId || 'ws1'}
        </div>
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure WebSocket trigger" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      {/* Trigger node — only outbound connection */}
      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
