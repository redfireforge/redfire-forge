import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { SwitchNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';

type SwitchWorkflowNode = Node<SwitchNodeData, 'switch'>;
type Props = NodeProps<SwitchWorkflowNode>;

export default function SwitchNode({ id, data, selected }: Props) {
  const { stateClass, handleConfigure } = useNodeBase(id);

  const expr = data.expression || 'Configure expression…';
  const caseCount = data.cases?.length ?? 0;

  // Compute handle positions: evenly spread cases + default across the bottom
  const totalHandles = caseCount + 1; // cases + default

  return (
    <div className={`wf-node wf-node-switch ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-switch-diamond">
        <span className="wf-switch-icon">⇅</span>
        <span className="wf-node-label">{data.label || 'Switch'}</span>
      </div>
      <div className="wf-switch-expr" title={expr}>{expr}</div>
      {caseCount > 0 && (
        <div className="wf-switch-cases-badge">{caseCount} case{caseCount !== 1 ? 's' : ''}</div>
      )}
      <div className="wf-node-footer">
        <button type="button" className="wf-node-configure-badge" title="Configure this switch" onClick={handleConfigure}>⚙ Configure</button>
      </div>

      {/* Dynamic case handles */}
      {data.cases?.map((c, i) => {
        const pct = ((i + 1) / (totalHandles + 1)) * 100;
        return (
          <div key={c.id}>
            <Handle
              type="source"
              position={Position.Bottom}
              id={`case-${c.id}`}
              className="wf-handle wf-handle-case"
              style={{ left: `${pct}%` }}
            />
            <span
              className="wf-handle-label wf-handle-label-case"
              style={{ left: `${pct}%` }}
            >
              {c.label || c.value}
            </span>
          </div>
        );
      })}

      {/* Default handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="wf-handle wf-handle-default"
        style={{ left: `${((caseCount + 1) / (totalHandles + 1)) * 100}%` }}
      />
      <span
        className="wf-handle-label wf-handle-label-default"
        style={{ left: `${((caseCount + 1) / (totalHandles + 1)) * 100}%` }}
      >
        Default
      </span>

      <Handle type="target" position={Position.Top} className="wf-handle" />
    </div>
  );
}
