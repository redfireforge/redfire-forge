import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { StartNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeConfigureButton } from './NodeConfigureButton';

type StartWorkflowNode = Node<StartNodeData, 'start'>;
type Props = NodeProps<StartWorkflowNode>;

export default function StartNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);
  const varCount = Object.keys(data.inputVariables ?? {}).length;

  return (
    <div className={`wf-node wf-node-start ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-start-body">
        <NodeIcon type="start" />
        <div>
          <span className="wf-node-label">{data.label || 'Start'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('start')}</div>
        </div>
        <NodeConfigureButton title="Configure trigger variables" onClick={handleConfigure} />
      </div>
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />
      {varCount > 0 && (
        <div className="wf-start-vars">
          {varCount} input variable{varCount !== 1 ? 's' : ''}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
