import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { LoopNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';

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
        <button type="button" className="wf-node-configure-badge" title="Configure this loop" onClick={handleConfigure}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="body" className="wf-handle wf-handle-loop-body" style={{ left: '35%' }} />
      <Handle type="source" position={Position.Bottom} id="done" className="wf-handle wf-handle-loop-done" style={{ left: '65%' }} />

      <span className="wf-handle-label wf-handle-label-loop-body">Body</span>
      <span className="wf-handle-label wf-handle-label-loop-done">Done</span>
    </div>
  );
}
