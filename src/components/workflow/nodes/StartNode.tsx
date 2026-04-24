import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { StartNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';

type StartWorkflowNode = Node<StartNodeData, 'start'>;
type Props = NodeProps<StartWorkflowNode>;

export default function StartNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);
  const varCount = Object.keys(data.inputVariables ?? {}).length;

  return (
    <div className={`wf-node wf-node-start ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-start-body">
        <span className="wf-start-icon">▶</span>
        <span className="wf-node-label">{data.label || 'Start'}</span>
        <button type="button" className="wf-node-configure-badge" title="Configure trigger variables" onClick={handleConfigure}>⚙ Configure</button>
      </div>
      {rs?.state === 'paused' && debugStep && (
        <button type="button" className="wf-debug-step-btn" title="Step this node" onClick={(e) => { e.stopPropagation(); debugStep(id); }}>⏭ Step</button>
      )}
      {rs?.state === 'paused' && !debugStep && <span className="wf-status-badge wf-status-paused">⏸ Paused</span>}
      {varCount > 0 && (
        <div className="wf-start-vars">
          {varCount} input variable{varCount !== 1 ? 's' : ''}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
