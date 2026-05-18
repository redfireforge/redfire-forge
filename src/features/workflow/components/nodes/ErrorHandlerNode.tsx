import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ErrorHandlerNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type ErrorHandlerWorkflowNode = Node<ErrorHandlerNodeData, 'errorHandler'>;
type Props = NodeProps<ErrorHandlerWorkflowNode>;

export default function ErrorHandlerNode({ id, data, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);

  const retryLabel = data.retryCount > 0
    ? `Retry ×${data.retryCount} (${data.retryBackoff === 'exponential' ? 'exp' : 'fixed'} ${data.retryDelayMs}ms)`
    : 'No retry';

  return (
    <div className={`wf-node wf-node-errorHandler ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-errorhandler-body">
        <NodeIcon type="errorHandler" />
        <div>
          <span className="wf-node-label">{data.label || 'Error Handler'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('errorHandler')}</div>
        </div>
      </div>
      <div className="wf-errorhandler-badge" title={retryLabel}>{retryLabel}</div>
      <div className="wf-errorhandler-filter">
        {data.errorFilter === 'all' ? 'Catch all' : data.errorFilter.replace('-', ' ')}
        {data.continueOnError && ' · continue'}
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure error handler" onClick={handleConfigure} />
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="body" className="wf-handle wf-handle-errhandler-body" style={{ left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="catch" className="wf-handle wf-handle-errhandler-catch" style={{ left: '50%' }} />
      <Handle type="source" position={Position.Bottom} id="done" className="wf-handle wf-handle-errhandler-done" style={{ left: '75%' }} />

      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />

      <span className="wf-handle-label wf-handle-label-errhandler-body">Body</span>
      <span className="wf-handle-label wf-handle-label-errhandler-catch">Catch</span>
      <span className="wf-handle-label wf-handle-label-errhandler-done">Done</span>
    </div>
  );
}
