/**
 * Shared debug-mode overlay for workflow nodes.
 * Renders the Step / Paused button that appears at the bottom of
 * any node when the workflow is paused on that node during Debug mode.
 */

interface NodePausedOverlayProps {
  nodeId: string;
  state?: string;
  debugStep: ((nodeId: string) => void) | null;
}

export function NodePausedOverlay({ nodeId, state, debugStep }: NodePausedOverlayProps) {
  if (state !== 'paused') return null;

  if (debugStep) {
    return (
      <button
        type="button"
        className="wf-debug-step-btn"
        title="Step this node"
        onClick={(e) => { e.stopPropagation(); debugStep(nodeId); }}
      >
        ⏭ Step
      </button>
    );
  }

  return <span className="wf-status-badge wf-status-paused">⏸ Paused</span>;
}
