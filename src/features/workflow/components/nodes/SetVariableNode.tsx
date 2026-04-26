import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { SetVariableNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';

type SetVariableWorkflowNode = Node<SetVariableNodeData, 'setVariable'>;
type Props = NodeProps<SetVariableWorkflowNode>;

export default function SetVariableNode({ id, data, selected }: Props) {
  const { stateClass, handleConfigure } = useNodeBase(id);

  const count = data.assignments?.length ?? 0;

  return (
    <div className={`wf-node wf-node-setVariable ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-setvar-body">
        <NodeIcon type="setVariable" />
        <div>
          <span className="wf-node-label">{data.label || 'Set Variable'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('setVariable')}</div>
        </div>
      </div>
      {count > 0 && (
        <div className="wf-setvar-badge">{count} assignment{count !== 1 ? 's' : ''}</div>
      )}
      {count > 0 && (
        <div className="wf-setvar-preview">
          {data.assignments.slice(0, 2).map(a => (
            <div key={a.id} className="wf-setvar-preview-item" title={`${a.name} = ${a.expression}`}>
              {a.name} = {a.expression}
            </div>
          ))}
          {count > 2 && <div className="wf-setvar-preview-more">+{count - 2} more</div>}
        </div>
      )}
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure variables" onClick={handleConfigure} />
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
