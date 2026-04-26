import { v4 as uuidv4 } from 'uuid';
import type { Workflow, WorkflowNode, WorkflowEdge, SubWorkflowNodeData } from '../types/workflow';

/**
 * Result of extracting nodes into a sub-workflow.
 */
export interface ExtractResult {
  /** The new child workflow created from the extracted nodes. */
  childWorkflow: Workflow;
  /** The new SubWorkflow node that replaces the extracted nodes. */
  subWorkflowNode: WorkflowNode;
  /** Node IDs that were extracted (to be removed from parent). */
  extractedNodeIds: Set<string>;
  /** Edge IDs that were internal to the extracted subgraph (to be removed). */
  extractedEdgeIds: Set<string>;
}

/**
 * Extract selected nodes from a parent workflow into a new sub-workflow.
 *
 * - Creates a new workflow containing the selected nodes and their internal edges.
 * - Creates a SubWorkflow node to replace the extracted nodes.
 * - Detects incoming/outgoing edges and generates input/output mappings.
 *
 * @param selectedNodeIds  IDs of nodes to extract.
 * @param parentNodes  All nodes in the parent workflow.
 * @param parentEdges  All edges in the parent workflow.
 * @param childName  Name for the new child workflow.
 * @returns The extraction result, or null if no extractable nodes were selected.
 */
export function extractToSubWorkflow(
  selectedNodeIds: string[],
  parentNodes: WorkflowNode[],
  parentEdges: WorkflowEdge[],
  childName: string,
): ExtractResult | null {
  // Filter out non-extractable node types
  const NON_EXTRACTABLE = new Set(['start', 'end']);
  const extractableIds = new Set(
    selectedNodeIds.filter((id) => {
      const node = parentNodes.find((n) => n.id === id);
      return node && !NON_EXTRACTABLE.has(node.type);
    }),
  );

  if (extractableIds.size === 0) return null;

  const extractedNodes = parentNodes.filter((n) => extractableIds.has(n.id));

  // Classify edges
  const internalEdges: WorkflowEdge[] = [];
  const incomingEdges: WorkflowEdge[] = []; // source outside, target inside
  const outgoingEdges: WorkflowEdge[] = []; // source inside, target outside

  for (const edge of parentEdges) {
    const srcIn = extractableIds.has(edge.source);
    const tgtIn = extractableIds.has(edge.target);
    if (srcIn && tgtIn) {
      internalEdges.push(edge);
    } else if (!srcIn && tgtIn) {
      incomingEdges.push(edge);
    } else if (srcIn && !tgtIn) {
      outgoingEdges.push(edge);
    }
  }

  // Build child workflow
  // Re-center nodes relative to (0,0)
  const minX = Math.min(...extractedNodes.map((n) => n.position.x));
  const minY = Math.min(...extractedNodes.map((n) => n.position.y));

  const childStartId = uuidv4();
  const childEndId = uuidv4();

  const childNodes: WorkflowNode[] = [
    { id: childStartId, type: 'start', position: { x: -minX + 100, y: -minY - 100 }, data: { label: 'Start', inputVariables: {} } },
    ...extractedNodes.map((n) => ({
      ...n,
      position: { x: n.position.x - minX + 100, y: n.position.y - minY },
    })),
    { id: childEndId, type: 'end', position: { x: -minX + 100, y: -minY + Math.max(...extractedNodes.map((n) => n.position.y)) - minY + 200 }, data: { label: 'End' } },
  ];

  // Connect start to the first nodes that had incoming edges (or all if none)
  const entryNodeIds = new Set(incomingEdges.map((e) => e.target));
  if (entryNodeIds.size === 0) {
    // No incoming edges → pick nodes with no internal incoming edge as entries
    const hasInternalIncoming = new Set(internalEdges.map((e) => e.target));
    for (const n of extractedNodes) {
      if (!hasInternalIncoming.has(n.id)) entryNodeIds.add(n.id);
    }
    // Fallback: use all extracted nodes
    if (entryNodeIds.size === 0) extractedNodes.forEach((n) => entryNodeIds.add(n.id));
  }

  const exitNodeIds = new Set(outgoingEdges.map((e) => e.source));
  if (exitNodeIds.size === 0) {
    const hasInternalOutgoing = new Set(internalEdges.map((e) => e.source));
    for (const n of extractedNodes) {
      if (!hasInternalOutgoing.has(n.id)) exitNodeIds.add(n.id);
    }
    if (exitNodeIds.size === 0) extractedNodes.forEach((n) => exitNodeIds.add(n.id));
  }

  const childEdges: WorkflowEdge[] = [
    ...internalEdges,
    ...Array.from(entryNodeIds).map((targetId) => ({
      id: uuidv4(),
      source: childStartId,
      target: targetId,
    })),
    ...Array.from(exitNodeIds).map((sourceId) => ({
      id: uuidv4(),
      source: sourceId,
      target: childEndId,
    })),
  ];

  const childWorkflowId = uuidv4();
  const childWorkflow: Workflow = {
    id: childWorkflowId,
    name: childName,
    variables: {},
    nodes: childNodes,
    edges: childEdges,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Create the replacement SubWorkflow node
  // Position it at the centroid of extracted nodes
  const avgX = extractedNodes.reduce((sum, n) => sum + n.position.x, 0) / extractedNodes.length;
  const avgY = extractedNodes.reduce((sum, n) => sum + n.position.y, 0) / extractedNodes.length;

  const subWorkflowNode: WorkflowNode = {
    id: uuidv4(),
    type: 'subWorkflow',
    position: { x: avgX, y: avgY },
    data: {
      label: childName,
      workflowId: childWorkflowId,
      workflowName: childName,
      inputMappings: [],
      outputMappings: [],
    } satisfies SubWorkflowNodeData,
  };

  const extractedEdgeIds = new Set([
    ...internalEdges.map((e) => e.id),
    ...incomingEdges.map((e) => e.id),
    ...outgoingEdges.map((e) => e.id),
  ]);

  return {
    childWorkflow,
    subWorkflowNode,
    extractedNodeIds: extractableIds,
    extractedEdgeIds,
  };
}
