import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { JoinNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';

type JoinWorkflowNode = Node<JoinNodeData, 'join'>;
type Props = NodeProps<JoinWorkflowNode>;

export default function JoinNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep } = useNodeBase(id);

  return (
    <div className={`wf-node wf-node-join ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-join-body">
        <NodeIcon type="join" />
        <div>
          <span className="wf-node-label">{data.label || 'Join'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('join')}</div>
        </div>
      </div>
      {rs?.responseDetail && (rs.state === 'running' || rs.state === 'pending') && (
        <div className="wf-join-waiting">{rs.responseDetail}</div>
      )}
      {rs?.state === 'pass' && <span className="wf-status-badge wf-status-pass">✓ Joined</span>}
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
