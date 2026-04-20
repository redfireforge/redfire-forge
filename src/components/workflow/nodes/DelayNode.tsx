import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DelayNodeData } from '../../../types/workflow';
import { useWorkflowNodeRunStatus } from '../WorkflowNodeRunContext';

interface Props extends NodeProps {
  data: DelayNodeData;
}

export default function DelayNode({ id, data, selected }: Props) {
  const rs = useWorkflowNodeRunStatus(id);
  const stateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';
  const display = data.mode === 'random'
    ? `${data.minMs ?? 0}–${data.maxMs ?? data.delayMs}ms`
    : `${data.delayMs}ms`;

  return (
    <div className={`wf-node wf-node-delay ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-delay-body">
        <span className="wf-delay-icon">⏱</span>
        <span className="wf-node-label">{data.label || 'Delay'}</span>
        <span className="wf-delay-value">{display}</span>
      </div>

      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
