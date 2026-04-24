import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { SetVariableNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';

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
        <button type="button" className="wf-node-configure-badge" title="Configure variables" onClick={handleConfigure}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
