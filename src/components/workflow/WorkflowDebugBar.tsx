import type { DebugController } from '../../engine/workflow/debugController';

interface Props {
  debugController: DebugController;
  onStop: () => void;
  variableCount: number;
}

export default function WorkflowDebugBar({ debugController, onStop, variableCount }: Props) {
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
        <button className="btn btn-sm btn-danger" onClick={onStop} title="Stop debug session">
          ⏹ Stop
        </button>
      </div>
    </div>
  );
}
