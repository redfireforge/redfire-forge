import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ConditionNodeData } from '../../../types/workflow';
import { useWorkflowInspect } from '../WorkflowInspectContext';
import { useWorkflowNodeRunStatus, useWorkflowDebugStep } from '../WorkflowNodeRunContext';

type ConditionWorkflowNode = Node<ConditionNodeData, 'condition'>;
type Props = NodeProps<ConditionWorkflowNode>;

export default function ConditionNode({ id, data, selected }: Props) {
  const { openNodeConfig } = useWorkflowInspect();
  const rs = useWorkflowNodeRunStatus(id);
  const debugStep = useWorkflowDebugStep();
  const stateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';
  const expr = data.left && data.right
    ? `${data.left} ${data.operator} ${data.right}`
    : 'Configure condition…';

  const handleConfigure = (e: React.MouseEvent) => {
    e.stopPropagation();
    openNodeConfig(id);
  };

  return (
    <div className={`wf-node wf-node-condition ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-condition-diamond">
        <span className="wf-condition-icon">◆</span>
        <span className="wf-node-label">{data.label || 'If/Else'}</span>
        <button type="button" className="wf-node-configure-badge" title="Configure this condition" onClick={handleConfigure}>⚙ Configure</button>
      </div>
      <div className="wf-condition-expr" title={expr}>{expr}</div>
      {rs?.state === 'paused' && debugStep && (
        <button type="button" className="wf-debug-step-btn" title="Step this node" onClick={(e) => { e.stopPropagation(); debugStep(id); }}>⏭ Step</button>
      )}
      {rs?.state === 'paused' && !debugStep && <span className="wf-status-badge wf-status-paused">⏸ Paused</span>}

      <Handle type="source" position={Position.Bottom} id="true" className="wf-handle wf-handle-true" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="false" className="wf-handle wf-handle-false" style={{ left: '70%' }} />

      <span className="wf-handle-label wf-handle-label-true">Yes</span>
      <span className="wf-handle-label wf-handle-label-false">No</span>

      {/* Target last so the top handle is above the diamond (otherwise incoming edges are hard to attach). */}
      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
