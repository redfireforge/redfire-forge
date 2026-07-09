import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { GrpcServerStreamNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type GrpcServerStreamWorkflowNode = Node<GrpcServerStreamNodeData, 'grpcServerStream'>;
type Props = NodeProps<GrpcServerStreamWorkflowNode>;

export default function GrpcServerStreamNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const methodLabel = data.service && data.method ? `${data.service}/${data.method}` : data.target || 'Not configured';
  const maxMsgs = data.collect?.maxMessages;

  return (
    <div
      className={`wf-node wf-node-grpcServerStream ${stateClass} ${selected ? 'wf-node-selected' : ''}`}
      data-testid="grpc-canvas-server-stream-node"
    >
      <div className="wf-ws-body">
        <NodeIcon type="grpcServerStream" />
        <div>
          <span className="wf-node-label">{data.label || 'gRPC Server Stream'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('grpcServerStream')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-url" title={methodLabel}>
          <strong>Method:</strong> {methodLabel}
        </div>
        {maxMsgs != null && (
          <div className="wf-ws-meta">max {maxMsgs} message{maxMsgs !== 1 ? 's' : ''}</div>
        )}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure gRPC Server Stream call" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
