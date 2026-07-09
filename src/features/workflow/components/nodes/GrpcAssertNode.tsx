import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { GrpcAssertNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type GrpcAssertWorkflowNode = Node<GrpcAssertNodeData, 'grpcAssert'>;
type Props = NodeProps<GrpcAssertWorkflowNode>;

export default function GrpcAssertNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const assertCount = data.assertions?.length ?? 0;
  const source = data.source || 'No source';

  return (
    <div
      className={`wf-node wf-node-grpcAssert ${stateClass} ${selected ? 'wf-node-selected' : ''}`}
      data-testid="grpc-canvas-assert-node"
    >
      <div className="wf-ws-body">
        <NodeIcon type="grpcAssert" />
        <div>
          <span className="wf-node-label">{data.label || 'gRPC Assert'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('grpcAssert')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-url" title={data.source}>
          <strong>Source:</strong> {source}
        </div>
        <div className="wf-ws-meta">
          {assertCount} assertion{assertCount !== 1 ? 's' : ''} ·{' '}
          {data.onError === 'continue' ? 'warn on fail' : 'halt on fail'}
        </div>
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure gRPC assertions" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
