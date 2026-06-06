import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { KafkaTriggerNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type KafkaTriggerWorkflowNode = Node<KafkaTriggerNodeData, 'kafkaTrigger'>;
type Props = NodeProps<KafkaTriggerWorkflowNode>;

export default function KafkaTriggerNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const topicPreview = data.topic || 'No topic';

  return (
    <div className={`wf-node wf-node-kafkaTrigger ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-kafka-body">
        <NodeIcon type="kafkaTrigger" />
        <div>
          <span className="wf-node-label">{data.label || 'Kafka Trigger'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('kafkaTrigger')}</div>
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
        {data.startPosition && data.startPosition !== 'latest' && (
          <div className="wf-kafka-meta">Offset: {data.startPosition}</div>
        )}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure Kafka trigger" onClick={handleConfigure} />
      </div>

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      {/* Trigger node — only outbound connection */}
      <Handle type="source" position={Position.Bottom} id="out" className="wf-handle" />
    </div>
  );
}
