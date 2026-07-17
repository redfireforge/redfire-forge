import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { GraphqlQueryNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type GraphqlQueryWorkflowNode = Node<GraphqlQueryNodeData, 'graphqlQuery'>;
type Props = NodeProps<GraphqlQueryWorkflowNode>;

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host || endpoint;
  } catch {
    return endpoint || 'No endpoint';
  }
}

export default function GraphqlQueryNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const host = endpointHost(data.endpoint);
  const extractCount = data.extractionRules?.length ?? 0;

  return (
    <div
      className={`wf-node wf-node-graphqlQuery ${stateClass} ${selected ? 'wf-node-selected' : ''}`}
      data-testid="gql-canvas-query-node"
    >
      <div className="wf-ws-body">
        <NodeIcon type="graphqlQuery" />
        <div>
          <span className="wf-node-label">{data.label || 'GraphQL Query'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('graphqlQuery')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-url" title={data.endpoint}>
          <strong>Endpoint:</strong> {host}
        </div>
        {extractCount > 0 && (
          <div className="wf-ws-meta">{extractCount} extraction{extractCount !== 1 ? 's' : ''}</div>
        )}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure GraphQL query" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
