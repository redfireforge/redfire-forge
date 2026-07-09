import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { GrpcUnaryNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type GrpcUnaryWorkflowNode = Node<GrpcUnaryNodeData, 'grpcUnary'>;
type Props = NodeProps<GrpcUnaryWorkflowNode>;

export default function GrpcUnaryNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const methodLabel = data.service && data.method ? `${data.service}/${data.method}` : data.target || 'Not configured';

  return (
    <div
      className={`wf-node wf-node-grpcUnary ${stateClass} ${selected ? 'wf-node-selected' : ''}`}
      data-testid="grpc-canvas-unary-node"
    >
      <div className="wf-ws-body">
        <NodeIcon type="grpcUnary" />
        <div>
          <span className="wf-node-label">{data.label || 'gRPC Unary'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('grpcUnary')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-url" title={methodLabel}>
          <strong>Method:</strong> {methodLabel}
        </div>
        {data.saveAs && (
          <div className="wf-ws-meta">saves as: {data.saveAs}</div>
        )}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure gRPC Unary call" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
