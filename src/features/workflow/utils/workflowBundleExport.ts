import type { Workflow, SubWorkflowNodeData } from '../types/workflow';
import { v4 as uuidv4 } from 'uuid';

/**
 * A self-contained bundle containing a root workflow and all transitive
 * sub-workflow dependencies. Used for export/import of workflows that
 * reference other workflows.
 */
export interface WorkflowBundle {
  /** The root workflow being exported. */
  root: Workflow;
  /** All child workflows referenced (transitively). Deduplicated by ID. */
  children: Workflow[];
}

/**
 * Collect a workflow and all its transitive sub-workflow dependencies
 * into a self-contained bundle for export.
 *
 * Deduplicates children referenced by multiple parents.
 * Handles missing references gracefully (skips them).
 */
export function collectWorkflowBundle(
  rootId: string,
  allWorkflows: Workflow[],
): WorkflowBundle | null {
  const workflowMap = new Map(allWorkflows.map((w) => [w.id, w]));
  const root = workflowMap.get(rootId);
  if (!root) return null;

  const collected = new Map<string, Workflow>();
  const visited = new Set<string>();

  function walk(workflowId: string): void {
    if (visited.has(workflowId)) return;
    visited.add(workflowId);

    const wf = workflowMap.get(workflowId);
    if (!wf) return;

    if (workflowId !== rootId) {
      collected.set(workflowId, wf);
    }

    const subNodes = wf.nodes.filter((n) => n.type === 'subWorkflow');
    for (const node of subNodes) {
      const data = node.data as SubWorkflowNodeData;
      if (data.workflowId) {
        walk(data.workflowId);
      }
    }
  }

  walk(rootId);

  return {
    root,
    children: Array.from(collected.values()),
  };
}

/**
 * Resolution strategy for handling ID conflicts during import.
 */
export type ImportConflictResolution = 'keep' | 'replace' | 'copy';

/**
 * A conflict detected during bundle import.
 */
export interface ImportConflict {
  /** The workflow ID that conflicts. */
  workflowId: string;
  /** The name of the incoming workflow. */
  incomingName: string;
  /** The name of the existing local workflow. */
  existingName: string;
}

/**
 * The result of resolving a workflow bundle for import.
 */
export interface ResolvedImport {
  /** Workflows to add (new or copies). */
  toAdd: Workflow[];
  /** Workflows to replace (existing IDs with new content). */
  toReplace: Workflow[];
  /** IDs that were kept as-is (no action needed). */
  kept: string[];
}

/**
 * Detect conflicts between an incoming bundle and existing local workflows.
 * Returns a list of conflicts that need user resolution.
 *
 * Workflows with matching ID and identical content are auto-resolved as 'keep'.
 */
export function detectImportConflicts(
  bundle: WorkflowBundle,
  existingWorkflows: Workflow[],
): ImportConflict[] {
  const existingMap = new Map(existingWorkflows.map((w) => [w.id, w]));
  const conflicts: ImportConflict[] = [];

  const allIncoming = [bundle.root, ...bundle.children];
  for (const incoming of allIncoming) {
    const existing = existingMap.get(incoming.id);
    if (!existing) continue;

    // Same content → no conflict (auto-keep)
    if (workflowContentEqual(existing, incoming)) continue;

    conflicts.push({
      workflowId: incoming.id,
      incomingName: incoming.name,
      existingName: existing.name,
    });
  }

  return conflicts;
}

/**
 * Resolve a bundle import given user-provided conflict resolutions.
 *
 * @param bundle  The incoming workflow bundle.
 * @param existingWorkflows  All existing local workflows.
 * @param resolutions  Map of workflowId → resolution for each conflict.
 *                     Unresolved conflicts default to 'keep'.
 */
export function resolveImportBundle(
  bundle: WorkflowBundle,
  existingWorkflows: Workflow[],
  resolutions: Map<string, ImportConflictResolution>,
): ResolvedImport {
  const existingMap = new Map(existingWorkflows.map((w) => [w.id, w]));
  const result: ResolvedImport = { toAdd: [], toReplace: [], kept: [] };

  // Track ID remapping for 'copy' resolutions
  const idRemap = new Map<string, string>();

  const allIncoming = [bundle.root, ...bundle.children];

  // First pass: determine ID remaps for 'copy' resolutions
  for (const incoming of allIncoming) {
    const existing = existingMap.get(incoming.id);
    if (!existing) continue;
    if (workflowContentEqual(existing, incoming)) continue;

    const resolution = resolutions.get(incoming.id) ?? 'keep';
    if (resolution === 'copy') {
      idRemap.set(incoming.id, uuidv4());
    }
  }

  // Second pass: build resolved workflows
  for (const incoming of allIncoming) {
    const existing = existingMap.get(incoming.id);

    if (!existing) {
      // New workflow — add as-is (with any ID remaps applied)
      result.toAdd.push(applyIdRemaps(incoming, idRemap));
      continue;
    }

    if (workflowContentEqual(existing, incoming)) {
      // Identical content — keep existing
      result.kept.push(incoming.id);
      continue;
    }

    const resolution = resolutions.get(incoming.id) ?? 'keep';
    switch (resolution) {
      case 'keep':
        result.kept.push(incoming.id);
        break;
      case 'replace':
        result.toReplace.push(applyIdRemaps(incoming, idRemap));
        break;
      case 'copy': {
        const newId = idRemap.get(incoming.id)!;
        const copy = applyIdRemaps(
          { ...incoming, id: newId, name: `${incoming.name} (imported)` },
          idRemap,
        );
        result.toAdd.push(copy);
        break;
      }
    }
  }

  return result;
}

/**
 * Apply ID remaps to all sub-workflow references within a workflow.
 * Used when importing workflows as copies (new UUIDs).
 */
function applyIdRemaps(
  workflow: Workflow,
  idRemap: Map<string, string>,
): Workflow {
  if (idRemap.size === 0) return workflow;

  const nodes = workflow.nodes.map((node) => {
    if (node.type !== 'subWorkflow') return node;
    const data = node.data as SubWorkflowNodeData;
    const newId = idRemap.get(data.workflowId);
    if (!newId) return node;
    return {
      ...node,
      data: { ...data, workflowId: newId },
    };
  });

  // Also remap the workflow's own ID if it was copied
  const newId = idRemap.get(workflow.id);
  return {
    ...workflow,
    ...(newId ? { id: newId } : {}),
    nodes,
  };
}

/**
 * Compare two workflows for content equality (ignoring timestamps).
 */
function workflowContentEqual(a: Workflow, b: Workflow): boolean {
  const strip = (w: Workflow) => {
    const { createdAt: _c, updatedAt: _u, ...rest } = w;
    return rest;
  };
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}
