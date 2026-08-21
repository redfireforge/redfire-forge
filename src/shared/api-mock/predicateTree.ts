/**
 * API Mock Studio — immutable predicate-tree edits.
 * The matcher is a tree (`ApiMockPredicateGroupV1` may nest groups), so the
 * editor needs id-addressed updates rather than flat array splices.
 */
import type { ApiMockPredicateGroupV1, ApiMockPredicateV1 } from './contracts';

export type PredicateNode = ApiMockPredicateGroupV1 | ApiMockPredicateV1;

export function isPredicateGroup(node: PredicateNode): node is ApiMockPredicateGroupV1 {
  return 'combinator' in node;
}

/** Append a child to the group with `groupId`. */
export function addChildToGroup(
  root: ApiMockPredicateGroupV1,
  groupId: string,
  child: PredicateNode,
): ApiMockPredicateGroupV1 {
  if (root.id === groupId) return { ...root, children: [...root.children, child] };
  return {
    ...root,
    children: root.children.map(c => (isPredicateGroup(c) ? addChildToGroup(c, groupId, child) : c)),
  };
}

/** Patch the leaf predicate with `leafId`. */
export function updateLeafInTree(
  root: ApiMockPredicateGroupV1,
  leafId: string,
  patch: Partial<ApiMockPredicateV1>,
): ApiMockPredicateGroupV1 {
  return {
    ...root,
    children: root.children.map(c => {
      if (isPredicateGroup(c)) return updateLeafInTree(c, leafId, patch);
      return c.id === leafId ? { ...c, ...patch } : c;
    }),
  };
}

/** Patch the group with `groupId` (combinator changes). */
export function updateGroupInTree(
  root: ApiMockPredicateGroupV1,
  groupId: string,
  patch: Partial<Omit<ApiMockPredicateGroupV1, 'children'>>,
): ApiMockPredicateGroupV1 {
  const next = root.id === groupId ? { ...root, ...patch } : root;
  return {
    ...next,
    children: next.children.map(c => (isPredicateGroup(c) ? updateGroupInTree(c, groupId, patch) : c)),
  };
}

/** Remove any node by id. The root itself is never removed. */
export function removeNodeFromTree(
  root: ApiMockPredicateGroupV1,
  nodeId: string,
): ApiMockPredicateGroupV1 {
  return {
    ...root,
    children: root.children
      .filter(c => c.id !== nodeId)
      .map(c => (isPredicateGroup(c) ? removeNodeFromTree(c, nodeId) : c)),
  };
}

/** Total leaf predicates across the whole tree — drives the Match tab badge. */
export function countLeaves(root: ApiMockPredicateGroupV1): number {
  return root.children.reduce(
    (n, c) => n + (isPredicateGroup(c) ? countLeaves(c) : 1),
    0,
  );
}

/** Find a leaf predicate anywhere in the tree. */
export function findLeafInTree(
  root: ApiMockPredicateGroupV1,
  leafId: string,
): ApiMockPredicateV1 | undefined {
  for (const c of root.children) {
    if (isPredicateGroup(c)) {
      const hit = findLeafInTree(c, leafId);
      if (hit) return hit;
    } else if (c.id === leafId) return c;
  }
  return undefined;
}

export const COMBINATOR_LABELS: Record<ApiMockPredicateGroupV1['combinator'], string> = {
  all: 'All of',
  any: 'Any of',
  not: 'None of',
};
