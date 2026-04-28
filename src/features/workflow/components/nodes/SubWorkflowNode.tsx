import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { SubWorkflowNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { useWorkflowInspect } from '../panels/WorkflowInspectContext';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';

type SubWorkflowWorkflowNode = Node<SubWorkflowNodeData, 'subWorkflow'>;
type Props = NodeProps<SubWorkflowWorkflowNode>;

export default function SubWorkflowNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);
  const { navigateToWorkflow, getWorkflowPreview } = useWorkflowInspect();

  const inCount = data.inputMappings?.length ?? 0;
  const outCount = data.outputMappings?.length ?? 0;
  const hasWorkflow = !!data.workflowId;
  const isDynamic = data.workflowId.includes('{{');
  const preview = hasWorkflow && !isDynamic ? getWorkflowPreview?.(data.workflowId) : undefined;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasWorkflow) navigateToWorkflow(data.workflowId);
  };

  return (
    <div className={`wf-node wf-node-subWorkflow ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-subworkflow-body">
        <NodeIcon type="subWorkflow" />
        <div>
          <span className="wf-node-label">{data.label || 'Sub-Workflow'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('subWorkflow')}</div>
        </div>
      </div>
      <div className="wf-subworkflow-ref">
        {hasWorkflow
          ? isDynamic
            ? <span className="wf-subworkflow-dynamic" title={data.workflowId}>ƒ {data.workflowId}</span>
            : <span className="wf-subworkflow-name" title={data.workflowName || data.workflowId}>{data.workflowName || data.workflowId}</span>
          : <span className="wf-subworkflow-warning">⚠ Select workflow…</span>}
      </div>
      {preview && (
        <div className="wf-subworkflow-preview">
          <span className="wf-subworkflow-preview-stat">{preview.nodeCount} node{preview.nodeCount !== 1 ? 's' : ''}</span>
          <span className="wf-subworkflow-preview-sep">·</span>
          <span className="wf-subworkflow-preview-stat">{preview.edgeCount} edge{preview.edgeCount !== 1 ? 's' : ''}</span>
          {preview.lastRunStatus && preview.lastRunStatus !== 'idle' && (
            <span className={`wf-subworkflow-preview-status wf-subworkflow-preview-status-${preview.lastRunStatus}`}
              title={`Last run: ${preview.lastRunStatus}`}>
              {preview.lastRunStatus === 'pass' ? '✓' : '✗'}
            </span>
          )}
        </div>
      )}
      {data.multiInstance && (
        <div className="wf-subworkflow-multi-instance" title={`forEach: ${data.multiInstance.collection || '(empty)'} → ${data.multiInstance.elementVariable}`}>
          ⟳ {data.multiInstance.mode} · {data.multiInstance.elementVariable}
        </div>
      )}
      {(inCount > 0 || outCount > 0) && (
        <div className="wf-subworkflow-mappings">{inCount} in · {outCount} out</div>
      )}
      <div className="wf-node-footer">
        {hasWorkflow && !isDynamic && (
          <NodeConfigureButton title="Open child workflow" onClick={handleOpen} className="wf-subworkflow-open-btn" variant="open" />
        )}
        <NodeConfigureButton title="Configure sub-workflow" onClick={handleConfigure} />
      </div>

      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
