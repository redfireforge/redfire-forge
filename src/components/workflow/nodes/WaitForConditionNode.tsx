import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { WaitForConditionNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';

type WaitForConditionWorkflowNode = Node<WaitForConditionNodeData, 'waitForCondition'>;
type Props = NodeProps<WaitForConditionWorkflowNode>;

export default function WaitForConditionNode({ id, data, selected }: Props) {
  const { stateClass, handleConfigure } = useNodeBase(id);

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
        <button type="button" className="wf-node-configure-badge" title="Configure wait condition" onClick={handleConfigure}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="body" className="wf-handle wf-handle-waitcond-body" style={{ left: '35%' }} />
      <Handle type="source" position={Position.Bottom} id="done" className="wf-handle wf-handle-waitcond-done" style={{ left: '65%' }} />

      <span className="wf-handle-label wf-handle-label-waitcond-body">Poll</span>
      <span className="wf-handle-label wf-handle-label-waitcond-done">Done</span>
    </div>
  );
}
