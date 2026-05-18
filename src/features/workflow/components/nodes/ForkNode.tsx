import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ForkNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type ForkWorkflowNode = Node<ForkNodeData, 'fork'>;
type Props = NodeProps<ForkWorkflowNode>;

export default function ForkNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep } = useNodeBase(id);

  return (
    <div className={`wf-node wf-node-fork ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-fork-body">
        <NodeIcon type="fork" />
        <div>
          <span className="wf-node-label">{data.label || 'Parallel Fork'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('fork')}</div>
        </div>
      </div>
      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
