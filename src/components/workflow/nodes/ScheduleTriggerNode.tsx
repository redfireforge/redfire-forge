import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ScheduleTriggerNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';

type ScheduleWorkflowNode = Node<ScheduleTriggerNodeData, 'schedule'>;
type Props = NodeProps<ScheduleWorkflowNode>;

export default function ScheduleTriggerNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);
  const varCount = Object.keys(data.inputVariables ?? {}).length;

  return (
    <div className={`wf-node wf-node-schedule ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-schedule-body">
        <NodeIcon type="schedule" />
        <div>
          <span className="wf-node-label">{data.label || 'Schedule'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('schedule')}</div>
        </div>
        <button type="button" className="wf-node-configure-badge" title="Configure schedule" onClick={handleConfigure}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />
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
