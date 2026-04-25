import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ErrorHandlerNodeData } from '../../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';

type ErrorHandlerWorkflowNode = Node<ErrorHandlerNodeData, 'errorHandler'>;
type Props = NodeProps<ErrorHandlerWorkflowNode>;

export default function ErrorHandlerNode({ id, data, selected }: Props) {
  const { stateClass, handleConfigure } = useNodeBase(id);

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
        <button type="button" className="wf-node-configure-badge" title="Configure error handler" onClick={handleConfigure}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} id="body" className="wf-handle wf-handle-errhandler-body" style={{ left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="catch" className="wf-handle wf-handle-errhandler-catch" style={{ left: '50%' }} />
      <Handle type="source" position={Position.Bottom} id="done" className="wf-handle wf-handle-errhandler-done" style={{ left: '75%' }} />

      <span className="wf-handle-label wf-handle-label-errhandler-body">Body</span>
      <span className="wf-handle-label wf-handle-label-errhandler-catch">Catch</span>
      <span className="wf-handle-label wf-handle-label-errhandler-done">Done</span>
    </div>
  );
}
