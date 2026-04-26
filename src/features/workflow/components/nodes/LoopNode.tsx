import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { LoopNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';

type LoopWorkflowNode = Node<LoopNodeData, 'loop'>;
type Props = NodeProps<LoopWorkflowNode>;

function modeBadge(data: LoopNodeData): string {
  switch (data.mode) {
    case 'count': {
      const n = data.countExpression || String(data.count ?? 1);
      return `×${n}`;
    }
    case 'forEach': return `∀ ${data.itemVariable || 'item'}`;
    case 'while': {
      if (data.whileLeft && data.whileRight) {
        return `${data.whileLeft} ${data.whileOperator ?? '=='} ${data.whileRight}`;
      }
      return 'while …';
    }
    default: return '';
  }
}

export default function LoopNode({ id, data, selected }: Props) {
  const { stateClass, handleConfigure } = useNodeBase(id);

  const badge = modeBadge(data);

  return (
    <div className={`wf-node wf-node-loop ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-loop-body">
        <NodeIcon type="loop" />
        <div>
          <span className="wf-node-label">{data.label || 'Loop'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('loop')}</div>
        </div>
      </div>
      <div className="wf-loop-badge" title={badge}>{badge}</div>
      {data.maxIterations != null && data.maxIterations !== 100 && (
        <div className="wf-loop-max">max {data.maxIterations}</div>
      )}
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure this loop" onClick={handleConfigure} />
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="body" className="wf-handle wf-handle-loop-body" style={{ left: '35%' }} />
      <Handle type="source" position={Position.Bottom} id="done" className="wf-handle wf-handle-loop-done" style={{ left: '65%' }} />

      <span className="wf-handle-label wf-handle-label-loop-body">Body</span>
      <span className="wf-handle-label wf-handle-label-loop-done">Done</span>
    </div>
  );
}
