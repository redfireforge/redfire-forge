import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ScheduleTriggerNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';

type ScheduleWorkflowNode = Node<ScheduleTriggerNodeData, 'schedule'>;
type Props = NodeProps<ScheduleWorkflowNode>;

export default function ScheduleTriggerNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);
  const varCount = Object.keys(data.inputVariables ?? {}).length;

  return (
    <div className={`wf-node wf-node-schedule ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-schedule-body">
        <span className="wf-schedule-icon">⏰</span>
        <span className="wf-node-label">{data.label || 'Schedule'}</span>
        <button type="button" className="wf-node-configure-badge" title="Configure schedule" onClick={handleConfigure}>⚙ Configure</button>
      </div>
      {rs?.state === 'paused' && debugStep && (
        <button type="button" className="wf-debug-step-btn" title="Step this node" onClick={(e) => { e.stopPropagation(); debugStep(id); }}>⏭ Step</button>
      )}
      {rs?.state === 'paused' && !debugStep && <span className="wf-status-badge wf-status-paused">⏸ Paused</span>}
      {data.scheduleDescription && (
        <div className="wf-schedule-desc">
          {data.scheduleDescription}
        </div>
      )}
      {data.cronExpression && (
        <div className="wf-schedule-cron">
          <code>{data.cronExpression}</code>
        </div>
      )}
      {varCount > 0 && (
        <div className="wf-schedule-vars">
          {varCount} variable{varCount !== 1 ? 's' : ''}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
