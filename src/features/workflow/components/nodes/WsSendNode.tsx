import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { WsSendNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type WsSendWorkflowNode = Node<WsSendNodeData, 'wsSend'>;
type Props = NodeProps<WsSendWorkflowNode>;

export default function WsSendNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const msgPreview = data.message
    ? (data.message.length > 40 ? data.message.slice(0, 40) + '\u2026' : data.message)
    : 'No message';

  return (
    <div className={`wf-node wf-node-wsSend ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-ws-body">
        <NodeIcon type="wsSend" />
        <div>
          <span className="wf-node-label">{data.label || 'WS Send'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('wsSend')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-connid">
          <strong>Conn:</strong> {data.connectionId || 'ws1'}
        </div>
        <div className="wf-ws-msg" title={data.message}>
          <strong>Msg:</strong> {msgPreview}
        </div>
        {data.waitForResponse && (
          <div className="wf-ws-meta">Wait for response ({data.responseTimeoutMs}ms)</div>
        )}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure WebSocket send" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
