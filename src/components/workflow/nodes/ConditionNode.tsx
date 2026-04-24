import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ConditionNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';

type ConditionWorkflowNode = Node<ConditionNodeData, 'condition'>;
type Props = NodeProps<ConditionWorkflowNode>;

export default function ConditionNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);
  const expr = data.left && data.right
    ? `${data.left} ${data.operator} ${data.right}`
    : 'Configure condition…';

  return (
    <div className={`wf-node wf-node-condition ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-condition-diamond">
        <NodeIcon type="condition" />
        <div>
          <span className="wf-node-label">{data.label || 'If/Else'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('condition')}</div>
        </div>
        <button type="button" className="wf-node-configure-badge" title="Configure this condition" onClick={handleConfigure}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>
      <div className="wf-condition-expr" title={expr}>{expr}</div>
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="source" position={Position.Bottom} id="true" className="wf-handle wf-handle-true" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="false" className="wf-handle wf-handle-false" style={{ left: '70%' }} />

      <span className="wf-handle-label wf-handle-label-true">Yes</span>
      <span className="wf-handle-label wf-handle-label-false">No</span>

      {/* Target last so the top handle is above the diamond (otherwise incoming edges are hard to attach). */}
      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
