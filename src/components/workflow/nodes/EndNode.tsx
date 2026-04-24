import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { EndNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';

type EndWorkflowNode = Node<EndNodeData, 'end'>;
type Props = NodeProps<EndWorkflowNode>;

export default function EndNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep } = useNodeBase(id);

  return (
    <div className={`wf-node wf-node-end ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="wf-handle" />
      <div className="wf-end-body">
        <NodeIcon type="end" />
        <div>
          <span className="wf-node-label">{data.label || 'End'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('end')}</div>
        </div>
      </div>
      {rs?.state === 'pass' && <span className="wf-status-badge wf-status-pass">✓ Completed</span>}
      {rs?.state === 'fail' && (
        <span className="wf-status-badge wf-status-fail" title={rs.error}>✗ Failed</span>
      )}
      {rs?.responseDetail && rs.state === 'fail' && (
        <div className="wf-end-error">{rs.responseDetail}</div>
      )}
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />
    </div>
  );
}
