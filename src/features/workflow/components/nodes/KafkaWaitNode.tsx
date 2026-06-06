import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { KafkaWaitNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type KafkaWaitWorkflowNode = Node<KafkaWaitNodeData, 'kafkaWait'>;
type Props = NodeProps<KafkaWaitWorkflowNode>;

export default function KafkaWaitNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const topicPreview = data.topic || 'No topic';

  return (
    <div className={`wf-node wf-node-kafkaWait ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-kafka-body">
        <NodeIcon type="kafkaWait" />
        <div>
          <span className="wf-node-label">{data.label || 'Kafka Wait'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('kafkaWait')}</div>
        </div>
      </div>
      <div className="wf-kafka-details">
        <div className="wf-kafka-topic" title={data.topic}>
          <strong>Topic:</strong> {topicPreview}
        </div>
        {data.clusterId && (
          <div className="wf-kafka-cluster" title={data.clusterId}>
            <strong>Cluster:</strong> {data.clusterId}
          </div>
        )}
        {data.correlationIdExpression && (
          <div className="wf-kafka-meta" title={data.correlationIdExpression}>
            <strong>Correlate:</strong> {data.correlationIdExpression}
          </div>
        )}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure Kafka wait" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
