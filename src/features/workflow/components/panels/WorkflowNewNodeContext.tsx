/**
 * Simple module-level tracker for newly added nodes to trigger pop-in animation.
 * The animation class is applied for 300ms after a node is added.
 */

const newNodeIds = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Mark a node as newly added. The node will be considered "new" for 300ms,
 * during which isNodeNew(nodeId) returns true and nodes can apply the wf-node-new class.
 */
export function markNodeAsNew(nodeId: string): void {
  newNodeIds.add(nodeId);

  const existingTimer = timers.get(nodeId);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    newNodeIds.delete(nodeId);
    timers.delete(nodeId);
  }, 300);

  timers.set(nodeId, timer);
}

/**
 * Check if a node is currently in the "new" state (recently added).
 */
export function isNodeNew(nodeId: string): boolean {
  return newNodeIds.has(nodeId);
}
