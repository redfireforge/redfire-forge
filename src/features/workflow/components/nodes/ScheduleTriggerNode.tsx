import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ScheduleTriggerNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeConfigureButton } from './NodeConfigureButton';

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
        <NodeConfigureButton title="Configure schedule" onClick={handleConfigure} />
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
