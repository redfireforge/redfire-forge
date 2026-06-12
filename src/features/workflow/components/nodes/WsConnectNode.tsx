import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { WsConnectNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type WsConnectWorkflowNode = Node<WsConnectNodeData, 'wsConnect'>;
type Props = NodeProps<WsConnectWorkflowNode>;

export default function WsConnectNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const urlPreview = data.url || 'No URL';
  const headerCount = data.headers?.filter((h) => h.enabled && h.key.trim()).length ?? 0;

  return (
    <div className={`wf-node wf-node-wsConnect ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-ws-body">
        <NodeIcon type="wsConnect" />
        <div>
          <span className="wf-node-label">{data.label || 'WS Connect'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('wsConnect')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-url" title={data.url}>
          <strong>URL:</strong> {urlPreview}
        </div>
        <div className="wf-ws-connid">
          <strong>ID:</strong> {data.connectionId || 'ws1'}
        </div>
        {headerCount > 0 && (
          <div className="wf-ws-meta">{headerCount} header{headerCount !== 1 ? 's' : ''}</div>
        )}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure WebSocket connection" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
