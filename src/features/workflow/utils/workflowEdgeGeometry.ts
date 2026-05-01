/**
 * Geometry utility for finding the closest workflow edge to a given point.
 * Extracted from useWorkflowDragDrop so it can be independently unit-tested.
 */

interface MinimalNode {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
}

interface MinimalEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

/** Handles that indicate branching edges — these should not be split when dropping a node. */
const BRANCH_HANDLES = new Set(['true', 'false', 'body', 'catch', 'done']);

/**
 * Compute the perpendicular distance from a point to a line segment.
 * Returns Infinity for zero-length segments.
 */
export function pointToSegmentDistance(
  px: number, py: number,
  sx: number, sy: number,
  tx: number, ty: number,
): number {
  const dx = tx - sx;
  const dy = ty - sy;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Infinity;
  const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lenSq));
  const projX = sx + t * dx;
  const projY = sy + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/**
 * Find the closest edge to a given flow-space position, within a threshold.
 * Returns the edge or null if none is close enough.
 */
export function findClosestEdge<E extends MinimalEdge>(
  flowPos: { x: number; y: number },
  nodes: MinimalNode[],
  edges: E[],
  threshold = 60,
): E | null {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  let bestEdge: E | null = null;
  let bestDist = threshold;

  for (const edge of edges) {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) continue;

    // Skip branching edges
    if (edge.sourceHandle && BRANCH_HANDLES.has(edge.sourceHandle)) continue;
    if (edge.sourceHandle && edge.sourceHandle.startsWith('case-')) continue;

    const sw = srcNode.measured?.width ?? srcNode.width ?? 160;
    const sh = srcNode.measured?.height ?? srcNode.height ?? 60;
    const tw = tgtNode.measured?.width ?? tgtNode.width ?? 160;

    // Source bottom-center → Target top-center
    const sx = srcNode.position.x + sw / 2;
    const sy = srcNode.position.y + sh;
    const tx = tgtNode.position.x + tw / 2;
    const ty = tgtNode.position.y;

    const dist = pointToSegmentDistance(flowPos.x, flowPos.y, sx, sy, tx, ty);

    if (dist < bestDist) {
      bestDist = dist;
      bestEdge = edge;
    }
  }

  return bestEdge;
}
