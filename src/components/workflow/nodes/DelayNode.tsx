import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { DelayNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';

type DelayWorkflowNode = Node<DelayNodeData, 'delay'>;
type Props = NodeProps<DelayWorkflowNode>;

export default function DelayNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);
  const display = data.mode === 'random'
    ? `${data.minMs ?? 0}–${data.maxMs ?? data.delayMs}ms`
    : `${data.delayMs}ms`;

  return (
    <div className={`wf-node wf-node-delay ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-delay-body">
        <span className="wf-delay-icon">⏱</span>
        <span className="wf-node-label">{data.label || 'Delay'}</span>
        <button type="button" className="wf-node-configure-badge" title="Configure this delay" onClick={handleConfigure}>⚙ Configure</button>
        <span className="wf-delay-value">{display}</span>
      </div>
      {rs?.state === 'paused' && debugStep && (
        <button type="button" className="wf-debug-step-btn" title="Step this node" onClick={(e) => { e.stopPropagation(); debugStep(id); }}>⏭ Step</button>
      )}
      {rs?.state === 'paused' && !debugStep && <span className="wf-status-badge wf-status-paused">⏸ Paused</span>}

      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
