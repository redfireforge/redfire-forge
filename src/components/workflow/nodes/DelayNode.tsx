import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { DelayNodeData } from '../../../types/workflow';
import { useWorkflowInspect } from '../WorkflowInspectContext';
import { useWorkflowNodeRunStatus } from '../WorkflowNodeRunContext';

type DelayWorkflowNode = Node<DelayNodeData, 'delay'>;
type Props = NodeProps<DelayWorkflowNode>;

export default function DelayNode({ id, data, selected }: Props) {
  const { openNodeConfig } = useWorkflowInspect();
  const rs = useWorkflowNodeRunStatus(id);
  const stateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';
  const display = data.mode === 'random'
    ? `${data.minMs ?? 0}–${data.maxMs ?? data.delayMs}ms`
    : `${data.delayMs}ms`;

  const handleConfigure = (e: React.MouseEvent) => {
    e.stopPropagation();
    openNodeConfig(id);
  };

  return (
    <div className={`wf-node wf-node-delay ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-delay-body">
        <span className="wf-delay-icon">⏱</span>
        <span className="wf-node-label">{data.label || 'Delay'}</span>
        <span className="wf-delay-value">{display}</span>
      </div>
      <div className="wf-node-footer">
        <button type="button" className="wf-node-configure-badge" title="Configure this delay" onClick={handleConfigure}>⚙ Configure</button>
      </div>

      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
