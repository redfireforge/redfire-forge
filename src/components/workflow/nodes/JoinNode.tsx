import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { JoinNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';

type JoinWorkflowNode = Node<JoinNodeData, 'join'>;
type Props = NodeProps<JoinWorkflowNode>;

export default function JoinNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep } = useNodeBase(id);

  return (
    <div className={`wf-node wf-node-join ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-join-body">
        <span className="wf-join-icon">⑂</span>
        <span className="wf-node-label">{data.label || 'Join'}</span>
      </div>
      {rs?.responseDetail && (rs.state === 'running' || rs.state === 'pending') && (
        <div className="wf-join-waiting">{rs.responseDetail}</div>
      )}
      {rs?.state === 'pass' && <span className="wf-status-badge wf-status-pass">✓ Joined</span>}
      {rs?.state === 'paused' && debugStep && (
        <button type="button" className="wf-debug-step-btn" title="Step this node" onClick={(e) => { e.stopPropagation(); debugStep(id); }}>⏭ Step</button>
      )}
      {rs?.state === 'paused' && !debugStep && <span className="wf-status-badge wf-status-paused">⏸ Paused</span>}

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
