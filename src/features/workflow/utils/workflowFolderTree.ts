import type { Workflow, WorkflowFolder } from '../types/workflow';

// ── Tree node type ──────────────────────────────────

export interface FolderTreeNode {
  folder: WorkflowFolder;
  children: FolderTreeNode[];
  workflows: Workflow[];
}

// ── Tree construction ───────────────────────────────

/** Build a nested tree from a flat folder array, attaching workflows to their folders. */
export function buildFolderTree(
  folders: WorkflowFolder[],
  workflows: Workflow[] = [],
): FolderTreeNode[] {
  const nodeMap = new Map<string, FolderTreeNode>();
  for (const folder of folders) {
    nodeMap.set(folder.id, { folder, children: [], workflows: [] });
  }

  const roots: FolderTreeNode[] = [];

  for (const folder of sortByOrder(folders)) {
    const node = nodeMap.get(folder.id)!;
    if (folder.parentId && nodeMap.has(folder.parentId)) {
      nodeMap.get(folder.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortedWorkflows = [...workflows].sort(
    (a, b) => (a.folderOrder ?? 0) - (b.folderOrder ?? 0),
  );
  for (const wf of sortedWorkflows) {
    if (wf.folderId && nodeMap.has(wf.folderId)) {
      nodeMap.get(wf.folderId)!.workflows.push(wf);
    }
  }

  return roots;
}

/** Get workflows that are not assigned to any folder (unfiled). */
export function getUnfiledWorkflows(
  folders: WorkflowFolder[],
  workflows: Workflow[],
): Workflow[] {
  const folderIds = new Set(folders.map((f) => f.id));
  return [...workflows]
    .filter((wf) => !wf.folderId || !folderIds.has(wf.folderId))
    .sort((a, b) => (a.folderOrder ?? 0) - (b.folderOrder ?? 0));
}

// ── Path / breadcrumb ───────────────────────────────

/** Get the full breadcrumb path for a folder: "Performance Tests / Load Tests". */
export function getFolderPath(
  folderId: string,
  folders: WorkflowFolder[],
): string {
  const map = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let current = map.get(folderId);
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? map.get(current.parentId) : undefined;
  }
  return parts.join(' / ');
}

// ── Recursive collection ────────────────────────────

/** Collect all descendant folder IDs of a given folder (not including itself). */
export function getDescendantFolderIds(
  folderId: string,
  folders: WorkflowFolder[],
): Set<string> {
  const childMap = new Map<string, string[]>();
  for (const f of folders) {
    if (f.parentId) {
      const siblings = childMap.get(f.parentId) ?? [];
      siblings.push(f.id);
      childMap.set(f.parentId, siblings);
    }
  }

  const result = new Set<string>();
  const stack = [folderId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const childId of childMap.get(id) ?? []) {
      if (!result.has(childId)) {
        result.add(childId);
        stack.push(childId);
      }
    }
  }
  return result;
}

/** Collect all workflows in a folder and all its sub-folders recursively. */
export function getWorkflowsInFolderRecursive(
  folderId: string,
  folders: WorkflowFolder[],
  workflows: Workflow[],
): Workflow[] {
  const ids = getDescendantFolderIds(folderId, folders);
  ids.add(folderId);
  return workflows.filter((wf) => wf.folderId != null && ids.has(wf.folderId));
}

// ── Runner flattening ───────────────────────────────

export interface RunnerFolderGroup {
  path: string;
  folderId: string | null;
  workflows: Workflow[];
}

/** Flatten nested folders into sorted groups with breadcrumb paths for the runner dropdown. */
export function flattenFoldersForRunner(
  folders: WorkflowFolder[],
  workflows: Workflow[],
): RunnerFolderGroup[] {
  const groups: RunnerFolderGroup[] = [];
  const folderIds = new Set(folders.map((f) => f.id));

  const folderWorkflows = new Map<string, Workflow[]>();
  const unfiled: Workflow[] = [];

  for (const wf of workflows) {
    if (wf.folderId && folderIds.has(wf.folderId)) {
      const list = folderWorkflows.get(wf.folderId) ?? [];
      list.push(wf);
      folderWorkflows.set(wf.folderId, list);
    } else {
      unfiled.push(wf);
    }
  }

  const tree = buildFolderTree(folders);
  const traverse = (nodes: FolderTreeNode[]) => {
    for (const node of nodes) {
      const directWorkflows = folderWorkflows.get(node.folder.id);
      if (directWorkflows && directWorkflows.length > 0) {
        groups.push({
          path: getFolderPath(node.folder.id, folders),
          folderId: node.folder.id,
          workflows: directWorkflows.sort(
            (a, b) => (a.folderOrder ?? 0) - (b.folderOrder ?? 0),
          ),
        });
      }
      traverse(node.children);
    }
  };
  traverse(tree);

  if (unfiled.length > 0) {
    groups.push({
      path: 'Unfiled',
      folderId: null,
      workflows: unfiled.sort(
        (a, b) => (a.folderOrder ?? 0) - (b.folderOrder ?? 0),
      ),
    });
  }

  return groups;
}

// ── Drag-and-drop utilities ─────────────────────────

/** Check if targetId is a descendant of sourceId (prevents circular drops). */
export function isDescendant(
  sourceId: string,
  targetId: string,
  folders: WorkflowFolder[],
): boolean {
  if (sourceId === targetId) return true;
  return getDescendantFolderIds(sourceId, folders).has(targetId);
}

/**
 * Move a folder to a new parent (or root) at a given order position.
 * Returns updated folder array with recalculated order values.
 */
export function moveFolder(
  folderId: string,
  newParentId: string | null,
  newOrder: number,
  folders: WorkflowFolder[],
): WorkflowFolder[] {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return folders;

  if (newParentId && isDescendant(folderId, newParentId, folders)) {
    return folders;
  }

  const targetParent = newParentId ?? undefined;

  const updated = folders.map((f) =>
    f.id === folderId ? { ...f, parentId: targetParent } : f,
  );

  return insertAtPosition(updated, folderId, targetParent, newOrder);
}

/**
 * Move a workflow to a new folder (or root/unfiled) at a given order position.
 * Returns updated workflow array with recalculated folderOrder values.
 */
export function moveWorkflow(
  workflowId: string,
  newFolderId: string | null,
  newOrder: number,
  workflows: Workflow[],
): Workflow[] {
  const wf = workflows.find((w) => w.id === workflowId);
  if (!wf) return workflows;

  const targetFolder = newFolderId ?? undefined;

  const updated = workflows.map((w) =>
    w.id === workflowId ? { ...w, folderId: targetFolder } : w,
  );

  return insertWorkflowAtPosition(updated, workflowId, targetFolder, newOrder);
}

// ── Internal helpers ────────────────────────────────

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/**
 * Insert a folder at a specific position among its siblings and reassign
 * clean 0,1,2,… order values.
 */
function insertAtPosition(
  folders: WorkflowFolder[],
  movedId: string,
  parentId: string | undefined,
  targetIndex: number,
): WorkflowFolder[] {
  const siblings = folders
    .filter((f) => (f.parentId ?? undefined) === parentId && f.id !== movedId)
    .sort((a, b) => a.order - b.order);

  const clamped = Math.max(0, Math.min(targetIndex, siblings.length));
  siblings.splice(clamped, 0, folders.find((f) => f.id === movedId)!);

  const orderMap = new Map<string, number>();
  siblings.forEach((f, i) => orderMap.set(f.id, i));

  return folders.map((f) => {
    const newOrder = orderMap.get(f.id);
    return newOrder !== undefined ? { ...f, order: newOrder } : f;
  });
}

/**
 * Insert a workflow at a specific position among its folder-siblings and
 * reassign clean 0,1,2,… folderOrder values.
 */
function insertWorkflowAtPosition(
  workflows: Workflow[],
  movedId: string,
  folderId: string | undefined,
  targetIndex: number,
): Workflow[] {
  const siblings = workflows
    .filter((w) => (w.folderId ?? undefined) === folderId && w.id !== movedId)
    .sort((a, b) => (a.folderOrder ?? 0) - (b.folderOrder ?? 0));

  const clamped = Math.max(0, Math.min(targetIndex, siblings.length));
  siblings.splice(clamped, 0, workflows.find((w) => w.id === movedId)!);

  const orderMap = new Map<string, number>();
  siblings.forEach((w, i) => orderMap.set(w.id, i));

  return workflows.map((w) => {
    const newOrder = orderMap.get(w.id);
    return newOrder !== undefined ? { ...w, folderOrder: newOrder } : w;
  });
}

/** Recursively count all workflows in a folder tree node and its descendants. */
export function countNodeWorkflows(node: FolderTreeNode): number {
  return node.workflows.length + node.children.reduce((s, c) => s + countNodeWorkflows(c), 0);
}
