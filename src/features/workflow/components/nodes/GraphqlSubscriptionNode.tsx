import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { GraphqlSubscriptionNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type GraphqlSubscriptionWorkflowNode = Node<GraphqlSubscriptionNodeData, 'graphqlSubscription'>;
type Props = NodeProps<GraphqlSubscriptionWorkflowNode>;

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host || endpoint;
  } catch {
    return endpoint || 'No endpoint';
  }
}

export default function GraphqlSubscriptionNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const host = endpointHost(data.endpoint);
  const stopMsg =
    data.stopAfterMessages != null
      ? `Stop after ${data.stopAfterMessages} msg${data.stopAfterMessages !== 1 ? 's' : ''}`
      : data.stopAfterMs != null
      ? `Stop after ${data.stopAfterMs}ms`
      : data.stopCondition
      ? 'Conditional stop'
      : 'No stop condition';

  return (
    <div
      className={`wf-node wf-node-graphqlSubscription ${stateClass} ${selected ? 'wf-node-selected' : ''}`}
      data-testid="gql-canvas-subscription-node"
    >
      <div className="wf-ws-body">
        <NodeIcon type="graphqlSubscription" />
        <div>
          <span className="wf-node-label">{data.label || 'GraphQL Subscription'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('graphqlSubscription')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-url" title={data.endpoint}>
          <strong>Endpoint:</strong> {host}
        </div>
        <div className="wf-ws-meta">{stopMsg}</div>
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure GraphQL subscription" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
