import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { LogDebugNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';

type LogDebugWorkflowNode = Node<LogDebugNodeData, 'logDebug'>;
type Props = NodeProps<LogDebugWorkflowNode>;

const LEVEL_LABELS: Record<string, string> = {
  info: 'ℹ️ Info',
  warn: '⚠️ Warn',
  error: '❌ Error',
  debug: '🐛 Debug',
};

export default function LogDebugNode({ id, data, selected }: Props) {
  const { stateClass, handleConfigure } = useNodeBase(id);

  const msgPreview = data.message
    ? data.message.length > 40 ? data.message.slice(0, 37) + '…' : data.message
    : 'No message';

  return (
    <div className={`wf-node wf-node-logDebug ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-logdebug-body">
        <NodeIcon type="logDebug" />
        <div>
          <span className="wf-node-label">{data.label || 'Log/Debug'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('logDebug')}</div>
        </div>
      </div>
      <div className="wf-logdebug-message" title={data.message}>{msgPreview}</div>
      <div className="wf-logdebug-level">
        {LEVEL_LABELS[data.logLevel] ?? data.logLevel}
        {data.snapshotVariables && ' · snapshot'}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure log" onClick={handleConfigure} />
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
