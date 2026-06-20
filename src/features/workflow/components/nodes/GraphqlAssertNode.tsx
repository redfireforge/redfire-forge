import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { GraphqlAssertNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type GraphqlAssertWorkflowNode = Node<GraphqlAssertNodeData, 'graphqlAssert'>;
type Props = NodeProps<GraphqlAssertWorkflowNode>;

export default function GraphqlAssertNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const assertCount = data.assertions?.length ?? 0;
  const sourceVar = data.sourceVariable || 'No source variable';

  return (
    <div
      className={`wf-node wf-node-graphqlAssert ${stateClass} ${selected ? 'wf-node-selected' : ''}`}
      data-testid="gql-canvas-assert-node"
    >
      <div className="wf-ws-body">
        <NodeIcon type="graphqlAssert" />
        <div>
          <span className="wf-node-label">{data.label || 'GraphQL Assert'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('graphqlAssert')}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-url" title={data.sourceVariable}>
          <strong>Source:</strong> {sourceVar}
        </div>
        <div className="wf-ws-meta">
          {assertCount} assertion{assertCount !== 1 ? 's' : ''} ·{' '}
          {data.failBehavior === 'warn' ? 'warn on fail' : 'halt on fail'}
        </div>
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure GraphQL assertions" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
