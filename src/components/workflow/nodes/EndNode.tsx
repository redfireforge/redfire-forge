import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { EndNodeData } from '../../../types/workflow';
import { useWorkflowNodeRunStatus, useWorkflowDebugStep } from '../WorkflowNodeRunContext';

type EndWorkflowNode = Node<EndNodeData, 'end'>;
type Props = NodeProps<EndWorkflowNode>;

export default function EndNode({ id, data, selected }: Props) {
  const rs = useWorkflowNodeRunStatus(id);
  const debugStep = useWorkflowDebugStep();
  const stateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';

  return (
    <div className={`wf-node wf-node-end ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="wf-handle" />
      <div className="wf-end-body">
        <span className="wf-end-icon">⏹</span>
        <span className="wf-node-label">{data.label || 'End'}</span>
      </div>
      {rs?.state === 'pass' && <span className="wf-status-badge wf-status-pass">✓ Completed</span>}
      {rs?.state === 'fail' && (
        <span className="wf-status-badge wf-status-fail" title={rs.error}>✗ Failed</span>
      )}
      {rs?.responseDetail && rs.state === 'fail' && (
        <div className="wf-end-error">{rs.responseDetail}</div>
      )}
      {rs?.state === 'paused' && debugStep && (
        <button type="button" className="wf-debug-step-btn" title="Step this node" onClick={(e) => { e.stopPropagation(); debugStep(id); }}>⏭ Step</button>
      )}
      {rs?.state === 'paused' && !debugStep && <span className="wf-status-badge wf-status-paused">⏸ Paused</span>}
    </div>
  );
}
