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
        <span className="wf-debug-indicator"><svg className="wf-inline-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> DEBUG MODE</span>
        <span className="wf-debug-vars">Variables: {variableCount}</span>
      </div>
      <div className="wf-debug-bar-right">
        <button className="btn btn-sm btn-outline" onClick={() => debugController.resumeAll()} title="Run remaining nodes without pausing">
          <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume
        </button>
        <button className="btn btn-sm btn-outline" onClick={() => debugController.stepAll()} title="Step all paused nodes simultaneously">
          <svg className="wf-inline-icon" viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg> Step All
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
            <svg className="wf-inline-icon" viewBox="0 0 24 24"><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><line x1="3" y1="21" x2="21" y2="21"/></svg> Step Into
          </button>
        )}
        <button className="btn btn-sm btn-danger" onClick={onStop} title="Stop debug session">
          <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1"/></svg> Stop
        </button>
      </div>
    </div>
  );
}
