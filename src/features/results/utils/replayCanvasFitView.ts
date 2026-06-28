/** Shared fit-view options for Results Explorer replay canvas controls. */
import { getNodesBounds } from '@xyflow/react';
import type { Node } from '@xyflow/react';

export const REPLAY_CANVAS_FIT_VIEW_OPTIONS = {
  padding: 0.2,
  duration: 300,
  maxZoom: 1.2,
  includeHiddenNodes: true,
} as const;

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 80;
const MAX_FIT_ATTEMPTS = 14;

type FitViewCapable = {
  fitView: (options?: typeof REPLAY_CANVAS_FIT_VIEW_OPTIONS & { nodes?: Node[] }) => void | Promise<boolean>;
  getNodes?: () => Node[];
};

function normalizeNodesForBounds(nodes: Node[]): Node[] {
  return nodes.map((node) => ({
    ...node,
    width: node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT,
  }));
}

function hasFitBounds(nodes: Node[]): boolean {
  if (nodes.length === 0) return false;
  const bounds = getNodesBounds(normalizeNodesForBounds(nodes));
  return bounds.width > 0 && bounds.height > 0;
}

/**
 * Defer fitView until after React Flow has measured nodes and the diagram pane
 * has its final layout size (detail panel / console resize).
 */
export function scheduleReplayFitView(
  instance: FitViewCapable | null | undefined,
  options: typeof REPLAY_CANVAS_FIT_VIEW_OPTIONS = REPLAY_CANVAS_FIT_VIEW_OPTIONS,
): boolean {
  if (!instance) return false;

  const runFit = (force = false): boolean => {
    const nodes = instance.getNodes?.() ?? [];
    if (nodes.length === 0) return false;
    if (!force && !hasFitBounds(nodes)) return false;
    void instance.fitView({ ...options, nodes });
    return true;
  };

  let attempts = 0;
  const attempt = () => {
    if (runFit()) return;
    attempts += 1;
    if (attempts < MAX_FIT_ATTEMPTS) {
      requestAnimationFrame(attempt);
      return;
    }
    runFit(true);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(attempt);
  });
  return true;
}
