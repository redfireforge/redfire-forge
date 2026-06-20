import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { GraphqlIntrospectNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type GraphqlIntrospectWorkflowNode = Node<GraphqlIntrospectNodeData, 'graphqlIntrospect'>;
type Props = NodeProps<GraphqlIntrospectWorkflowNode>;

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host || endpoint;
  } catch {
    return endpoint || 'No endpoint';
  }
}

export default function GraphqlIntrospectNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const host = endpointHost(data.endpoint);
  const hasValidation =
    (data.minTypeCount != null) ||
    (data.requiredTypes?.length ?? 0) > 0 ||
    (data.requiredFields?.length ?? 0) > 0;

  return (
    <div
      className={`wf-node wf-node-graphqlIntrospect ${stateClass} ${selected ? 'wf-node-selected' : ''}`}
      data-testid="gql-canvas-introspect-node"
    >
      <div className="wf-ws-body">
        <NodeIcon type="graphqlIntrospect" />
        <div>
          <span className="wf-node-label">{data.label || 'GraphQL Introspect'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('graphqlIntrospect')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-url" title={data.endpoint}>
          <strong>Endpoint:</strong> {host}
        </div>
        {hasValidation && (
          <div className="wf-ws-meta">Schema validation enabled</div>
        )}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure GraphQL introspection" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
