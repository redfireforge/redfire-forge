import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ScriptNodeData } from '../../types/workflow';
import { useNodeBase } from './useNodeBase';
import { NodeIcon, getNodeCategory } from './NodeIcon';
import { NodeConfigureButton } from './NodeConfigureButton';

type ScriptWorkflowNode = Node<ScriptNodeData, 'script'>;
type Props = NodeProps<ScriptWorkflowNode>;

const MODE_LABELS: Record<string, string> = {
  transform: '🔄 Transform',
  validate: '✅ Validate',
  generate: '⚡ Generate',
};

export default function ScriptNode({ id, data, selected }: Props) {
  const { stateClass, handleConfigure } = useNodeBase(id);

  const codePreview = data.code
    ? data.code.replace(/\/\/.*$/gm, '').trim().split('\n').filter(Boolean)[0]?.slice(0, 40) || 'Empty script'
    : 'No code';

  return (
    <div className={`wf-node wf-node-script ${stateClass} ${selected ? 'wf-node-selected' : ''}`}>
      <div className="wf-script-body">
        <NodeIcon type="script" />
        <div>
          <span className="wf-node-label">{data.label || 'Script'}</span>
          <div className="wf-node-sublabel">{getNodeCategory('script')}</div>
        </div>
      </div>
      <div className="wf-script-mode">
        {MODE_LABELS[data.mode] ?? data.mode}
      </div>
      <div className="wf-script-preview" title={data.code}>{codePreview}</div>
      <div className="wf-node-footer">
        <NodeConfigureButton title="Configure script" onClick={handleConfigure} />
      </div>

      <Handle type="target" position={Position.Top} className="wf-handle" />
      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
