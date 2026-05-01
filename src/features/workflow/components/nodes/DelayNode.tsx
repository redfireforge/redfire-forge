import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { DelayNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeConfigureButton } from './NodeConfigureButton';

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
        <NodeConfigureButton title="Configure this delay" onClick={handleConfigure} />
        <span className="wf-delay-value">{display}</span>
      </div>
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
