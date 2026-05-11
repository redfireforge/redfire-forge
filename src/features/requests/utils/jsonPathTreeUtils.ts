/**
 * Re-exports from the canonical shared tree model for backward compatibility.
 *
 * All tree-building logic now lives in `src/shared/utils/jsonTreeModel.ts`.
 * Consumers should migrate to importing from there directly over time.
 */
import {
  buildJsonTree,
  getAllLeafPaths,
  getAllPaths,
  nodeMatchesSearch,
  suggestedVariableNameFromJsonPath,
} from '../../../shared/utils/jsonTreeModel';
import type { JsonTreeNode, BuildTreeOptions } from '../../../shared/utils/jsonTreeModel';

/** @deprecated Use `JsonTreeNode` from `shared/utils/jsonTreeModel` */
export type JsonNode = JsonTreeNode;

export type { BuildTreeOptions };

/**
 * Build a JSON tree from a value.
 * Wraps the canonical `buildJsonTree` with the original signature.
 */
export function buildTree(obj: unknown, parentPath: string, parentKey: string, opts?: BuildTreeOptions, depth?: number): JsonNode {
  return buildJsonTree(obj, parentKey, parentPath, opts, depth);
}

export { getAllLeafPaths, getAllPaths, nodeMatchesSearch, suggestedVariableNameFromJsonPath };
