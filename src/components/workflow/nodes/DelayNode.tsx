import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { DelayNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';

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
        <NodeIcon type="delay" />
        <div>
          <span className="wf-node-label">{data.label || 'Delay'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('delay')}</div>
        </div>
        <button type="button" className="wf-node-configure-badge" title="Configure this delay" onClick={handleConfigure}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <span className="wf-delay-value">{display}</span>
      </div>
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
