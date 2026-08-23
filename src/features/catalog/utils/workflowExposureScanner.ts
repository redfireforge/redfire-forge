import { loadWorkflows, saveWorkflows } from '@shared/utils/storage';
import type { Workflow } from '@workflow/types/workflow';
import type { HttpNodeData } from '@workflow/types/workflow/node-core';

export interface AffectedWorkflowInfo {
  workflowId: string;
  workflowName: string;
  nodeIds: string[];
  nodeLabels: string[];
}

/**
 * Scan all persisted workflows for HTTP nodes whose `catalogRef` matches the
 * given catalog entry + endpoint. Returns an array of affected workflow summaries.
 */
export async function scanWorkflowsForCatalogRef(
  entryId: string,
  endpointId: string,
): Promise<AffectedWorkflowInfo[]> {
  const workflows = await loadWorkflows();
  const results: AffectedWorkflowInfo[] = [];

  for (const wf of workflows) {
    const matchingNodes = wf.nodes.filter(n => {
      const data = n.data as HttpNodeData;
      return data.catalogRef?.entryId === entryId && data.catalogRef?.endpointId === endpointId;
    });
    if (matchingNodes.length > 0) {
      results.push({
        workflowId: wf.id,
        workflowName: wf.name,
        nodeIds: matchingNodes.map(n => n.id),
        nodeLabels: matchingNodes.map(n => (n.data as HttpNodeData).label),
      });
    }
  }
  return results;
}

/**
 * Remove catalog-ref nodes from all affected workflows and persist.
 * Returns the count of nodes removed.
 */
export async function removeCatalogNodesFromWorkflows(
  entryId: string,
  endpointId: string,
): Promise<number> {
  const workflows = await loadWorkflows();
  let removed = 0;

  const updated: Workflow[] = workflows.map(wf => {
    const nodeIdsToRemove = new Set(
      wf.nodes
        .filter(n => {
          const data = n.data as HttpNodeData;
          return data.catalogRef?.entryId === entryId && data.catalogRef?.endpointId === endpointId;
        })
        .map(n => n.id),
    );

    if (nodeIdsToRemove.size === 0) return wf;
    removed += nodeIdsToRemove.size;

    return {
      ...wf,
      nodes: wf.nodes.filter(n => !nodeIdsToRemove.has(n.id)),
      edges: wf.edges.filter(e => !nodeIdsToRemove.has(e.source) && !nodeIdsToRemove.has(e.target)),
    };
  });

  if (removed > 0) await saveWorkflows(updated);
  return removed;
}
