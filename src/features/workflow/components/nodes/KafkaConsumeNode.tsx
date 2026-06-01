import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { KafkaConsumeNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type KafkaConsumeWorkflowNode = Node<KafkaConsumeNodeData, 'kafkaConsume'>;
type Props = NodeProps<KafkaConsumeWorkflowNode>;

export default function KafkaConsumeNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const filterCount = (data.headerFilters?.length ?? 0) + (data.jsonPathFilters?.length ?? 0);
  const topicPreview = data.topic || 'No topic';

  return (
    <div className={`wf-node wf-node-kafkaConsume ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-kafka-body">
        <NodeIcon type="kafkaConsume" />
        <div>
          <span className="wf-node-label">{data.label || 'Kafka Consume'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('kafkaConsume')}</div>
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
        {filterCount > 0 && (
          <div className="wf-kafka-meta">{filterCount} filter{filterCount !== 1 ? 's' : ''}</div>
        )}
        {data.maxMessages != null && data.maxMessages > 0 && (
          <div className="wf-kafka-meta">Max: {data.maxMessages}</div>
        )}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure Kafka consume" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
