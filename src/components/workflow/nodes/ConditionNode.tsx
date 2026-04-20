import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ConditionNodeData } from '../../../types/workflow';
import { useWorkflowNodeRunStatus } from '../WorkflowNodeRunContext';

interface Props extends NodeProps {
  data: ConditionNodeData;
}

export default function ConditionNode({ id, data, selected }: Props) {
  const rs = useWorkflowNodeRunStatus(id);
  const stateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';
  const expr = data.left && data.right
    ? `${data.left} ${data.operator} ${data.right}`
    : 'Configure condition…';

  return (
    <div className={`wf-node wf-node-condition ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-condition-diamond">
        <span className="wf-condition-icon">◆</span>
        <span className="wf-node-label">{data.label || 'If/Else'}</span>
      </div>
      <div className="wf-condition-expr" title={expr}>{expr}</div>

      <Handle type="source" position={Position.Bottom} id="true" className="wf-handle wf-handle-true" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="false" className="wf-handle wf-handle-false" style={{ left: '70%' }} />

      <span className="wf-handle-label wf-handle-label-true">Yes</span>
      <span className="wf-handle-label wf-handle-label-false">No</span>

      {/* Target last so the top handle is above the diamond (otherwise incoming edges are hard to attach). */}
      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
