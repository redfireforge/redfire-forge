import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { WsReceiveNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type WsReceiveWorkflowNode = Node<WsReceiveNodeData, 'wsReceive'>;
type Props = NodeProps<WsReceiveWorkflowNode>;

export default function WsReceiveNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const mc = data.matchCriteria;
  const hasTypeFilter = mc?.messageType && mc.messageType !== 'any';
  const filterPreview = mc?.contentContains
    ? `contains "${mc.contentContains}"`
    : mc?.contentRegex
      ? `/${mc.contentRegex}/`
      : mc?.jsonPathMatch
        ? mc.jsonPathMatch
        : hasTypeFilter
          ? `${mc!.messageType} only`
          : 'any message';

  return (
    <div className={`wf-node wf-node-wsReceive ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-ws-body">
        <NodeIcon type="wsReceive" />
        <div>
          <span className="wf-node-label">{data.label || 'WS Receive'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('wsReceive')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-connid">
          <strong>Conn:</strong> {data.connectionId || 'ws1'}
        </div>
        <div className="wf-ws-match" title={filterPreview}>
          <strong>Match:</strong> {filterPreview}
        </div>
        {(data.extractionRules ?? []).length > 0 && (
          <div className="wf-ws-meta">{(data.extractionRules ?? []).length} extraction{(data.extractionRules ?? []).length !== 1 ? 's' : ''}</div>
        )}
        {data.timeoutMs > 0 && (
          <div className="wf-ws-meta">Timeout: {data.timeoutMs}ms</div>
        )}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure WebSocket receive" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
