import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { LogDebugNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';

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
        <button type="button" className="wf-node-configure-badge" title="Configure log" onClick={handleConfigure}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
