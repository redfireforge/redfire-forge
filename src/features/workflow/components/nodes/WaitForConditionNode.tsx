import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { WaitForConditionNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';

type WaitForConditionWorkflowNode = Node<WaitForConditionNodeData, 'waitForCondition'>;
type Props = NodeProps<WaitForConditionWorkflowNode>;

export default function WaitForConditionNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const condPreview = data.conditionExpression
    ? data.conditionExpression.length > 35 ? data.conditionExpression.slice(0, 32) + '…' : data.conditionExpression
    : 'No condition';

  const timeoutLabel = data.timeoutMs > 0
    ? `${data.timeoutMs >= 1000 ? `${data.timeoutMs / 1000}s` : `${data.timeoutMs}ms`} timeout`
    : 'No timeout';

  return (
    <div className={`wf-node wf-node-waitForCondition ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-waitcond-body">
        <NodeIcon type="waitForCondition" />
        <div>
          <span className="wf-node-label">{data.label || 'Wait for Condition'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('waitForCondition')}</div>
        </div>
      </div>
      <div className="wf-waitcond-condition" title={data.conditionExpression}>{condPreview}</div>
      <div className="wf-waitcond-meta">
        {data.pollIntervalMs >= 1000 ? `${data.pollIntervalMs / 1000}s` : `${data.pollIntervalMs}ms`} poll
        {' · '}{timeoutLabel}
        {data.maxAttempts > 0 && ` · max ${data.maxAttempts}`}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure wait condition" onClick={handleConfigure} />
      </div>

      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="body" className="wf-handle wf-handle-waitcond-body" style={{ left: '35%' }} />
      <Handle type="source" position={Position.Bottom} id="done" className="wf-handle wf-handle-waitcond-done" style={{ left: '65%' }} />

      <span className="wf-handle-label wf-handle-label-waitcond-body">Poll</span>
      <span className="wf-handle-label wf-handle-label-waitcond-done">Done</span>
    </div>
  );
}
