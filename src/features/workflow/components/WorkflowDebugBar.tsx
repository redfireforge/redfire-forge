import type { DebugController } from '../engine/debugController';

interface Props {
  debugController: DebugController;
  onStop: () => void;
  variableCount: number;
  /** Sub-workflow node ID currently paused, if any. */
  pausedSubWorkflowNodeId?: string | null;
  /** Called when user clicks "Step Into" on a paused sub-workflow node. */
  onStepInto?: (nodeId: string) => void;
}

export default function WorkflowDebugBar({ debugController, onStop, variableCount, pausedSubWorkflowNodeId, onStepInto }: Props) {
  return (
    <div className="wf-debug-bar">
      <div className="wf-debug-bar-left">
        <span className="wf-debug-indicator">🔍 DEBUG MODE</span>
        <span className="wf-debug-vars">Variables: {variableCount}</span>
      </div>
      <div className="wf-debug-bar-right">
        <button className="btn btn-sm btn-outline" onClick={() => debugController.resumeAll()} title="Run remaining nodes without pausing">
          ▶ Resume
        </button>
        <button className="btn btn-sm btn-outline" onClick={() => debugController.stepAll()} title="Step all paused nodes simultaneously">
          ⏭ Step All
        </button>
        {pausedSubWorkflowNodeId && onStepInto && (
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              debugController.stepNode(pausedSubWorkflowNodeId);
              onStepInto(pausedSubWorkflowNodeId);
            }}
            title="Step into sub-workflow and navigate to it"
          >
            ⤵ Step Into
          </button>
        )}
        <button className="btn btn-sm btn-danger" onClick={onStop} title="Stop debug session">
          ⏹ Stop
        </button>
      </div>
    </div>
  );
}
