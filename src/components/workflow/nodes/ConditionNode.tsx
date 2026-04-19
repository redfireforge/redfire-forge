import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ConditionNodeData, NodeRunStatus } from '../../../types/workflow';

interface Props extends NodeProps {
  data: ConditionNodeData & { runStatus?: NodeRunStatus };
}

export default function ConditionNode({ data, selected }: Props) {
  const rs = data.runStatus;
  const stateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';
  const expr = data.left && data.right
    ? `${data.left} ${data.operator} ${data.right}`
    : 'Configure condition…';

  return (
    <div className={`wf-node wf-node-condition ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="wf-handle" />

      <div className="wf-condition-diamond">
        <span className="wf-condition-icon">◆</span>
        <span className="wf-node-label">{data.label || 'If/Else'}</span>
      </div>
      <div className="wf-condition-expr" title={expr}>{expr}</div>

      <Handle type="source" position={Position.Bottom} id="true" className="wf-handle wf-handle-true" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="false" className="wf-handle wf-handle-false" style={{ left: '70%' }} />

      <span className="wf-handle-label wf-handle-label-true">Yes</span>
      <span className="wf-handle-label wf-handle-label-false">No</span>
    </div>
  );
}
