/**
 * Shared canvas node for API Mock workflow lifecycle / assert nodes.
 */
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { WorkflowNodeData, WorkflowNodeType } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';
import { NodePausedOverlay } from './NodePausedOverlay';
import { NodeStatusBadge } from './NodeStatusBadge';

type Props = NodeProps<Node<WorkflowNodeData, WorkflowNodeType>>;

const SUBLABEL: Record<string, (data: WorkflowNodeData) => string> = {
  apiMockStart: d => `Start · ${(d as { serverId?: string }).serverId || 'pick server'}`,
  apiMockApply: d => `Apply · ${(d as { serverId?: string }).serverId || 'pick server'}`,
  apiMockResetState: d => `Reset · ${(d as { serverId?: string }).serverId || 'pick server'}`,
  apiMockStop: d => `Stop · ${(d as { serverId?: string }).serverId || 'pick server'}`,
  apiMockAssertCalls: d => {
    const a = d as { serverId?: string; expectedCount?: number; expectedMinCount?: number };
    const count = a.expectedCount != null
      ? `count=${a.expectedCount}`
      : a.expectedMinCount != null
        ? `min=${a.expectedMinCount}`
        : 'assertions';
    return `Assert · ${a.serverId || 'pick server'} · ${count}`;
  },
};

export default function ApiMockWorkflowNode({ id, data, type, selected }: Props) {
  const { rs, stateClass, debugStep, handleConfigure } = useNodeBase(id);
  const nodeType = type || 'apiMockStart';
  const detail = (SUBLABEL[nodeType] ?? (() => 'API Mock'))(data);

  return (
    <div
      className={`wf-node wf-node-apimock ${stateClass} ${selected ? 'wf-node-selected' : ''}`}
      data-testid={`api-mock-canvas-${nodeType}`}
    >
      <div className="wf-ws-body">
        <NodeIcon type={nodeType} />
        <div>
          <span className="wf-node-label">{data.label || 'API Mock'}</span>
          <div className="wf-node-sublabel">{getNodeCategory(nodeType)}</div>
        </div>
      </div>
      <div className="wf-ws-details">
        <div className="wf-ws-url" title={detail}>{detail}</div>
      </div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure API Mock node" onClick={handleConfigure} />
      </div>
      <NodeStatusBadge rs={rs} />
      <NodePausedOverlay nodeId={id} state={rs?.state} debugStep={debugStep} />
      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
