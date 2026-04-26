import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { AggregateNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';

type AggregateWorkflowNode = Node<AggregateNodeData, 'aggregate'>;
type Props = NodeProps<AggregateWorkflowNode>;

export default function AggregateNode({ id, data, selected }: Props) {
  const { stateClass, handleConfigure } = useNodeBase(id);

  const count = data.mappings?.length ?? 0;

  return (
    <div className={`wf-node wf-node-aggregate ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-aggregate-body">
        <NodeIcon type="aggregate" />
        <div>
          <span className="wf-node-label">{data.label || 'Aggregate'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('aggregate')}</div>
        </div>
      </div>
      {count > 0 && (
        <div className="wf-aggregate-badge">{count} mapping{count !== 1 ? 's' : ''}</div>
      )}
      {count > 0 && (
        <div className="wf-aggregate-preview">
          {data.mappings.slice(0, 2).map(m => (
            <div key={m.id} className="wf-aggregate-preview-item" title={`${m.sourceExpression} → ${m.targetVariable} (${m.strategy})`}>
              {m.sourceExpression} → {m.targetVariable}
            </div>
          ))}
          {count > 2 && <div className="wf-aggregate-preview-more">+{count - 2} more</div>}
        </div>
      )}
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure aggregation" onClick={handleConfigure} />
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
