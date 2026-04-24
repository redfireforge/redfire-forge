import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ForkNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';

type ForkWorkflowNode = Node<ForkNodeData, 'fork'>;
type Props = NodeProps<ForkWorkflowNode>;

export default function ForkNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep } = useNodeBase(id);

  return (
    <div className={`wf-node wf-node-fork ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-fork-body">
        <span className="wf-fork-icon">⑃</span>
        <span className="wf-node-label">{data.label || 'Parallel Fork'}</span>
      </div>
      {rs?.state === 'paused' && debugStep && (
        <button type="button" className="wf-debug-step-btn" title="Step this node" onClick={(e) => { e.stopPropagation(); debugStep(id); }}>⏭ Step</button>
      )}
      {rs?.state === 'paused' && !debugStep && <span className="wf-status-badge wf-status-paused">⏸ Paused</span>}

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
