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
        <svg className="wf-inline-icon" viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>
        Step
      </button>
    );
  }

  return (
    <span className="wf-status-badge wf-status-paused">
      <svg className="wf-inline-icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
      Paused
    </span>
  );
}
