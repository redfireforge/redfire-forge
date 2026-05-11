/**
 * Unified JSON tree model.
 *
 * Consolidates the previously separate `JsonNode`/`buildTree` (from jsonPathTreeUtils)
 * and `JNode`/`buildJTree` (from JsonTreePreview) into a single canonical implementation.
 *
 * Features:
 * - Optional JSONPath tracking per node
 * - Array/depth truncation with metadata
 * - Utility traversal helpers (leaf paths, all paths, search)
 */

export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonTreeNode {
  key: string;
  /** JSONPath from root (e.g. "address.city", "orders[0].id"). Empty string for root. */
  path: string;
  value: unknown;
  type: JsonNodeType;
  children?: JsonTreeNode[];
  /** When true, the children array was truncated. */
  truncated?: boolean;
  /** Total count of items before truncation. */
  totalCount?: number;
}

export interface BuildTreeOptions {
  /** Max items to show per array (default: unlimited). */
  maxArrayItems?: number;
  /** Max depth to recurse (default: unlimited). */
  maxDepth?: number;
  /** Track JSONPath strings (default: true). Set false for simple preview use cases. */
  trackPaths?: boolean;
}

export function buildJsonTree(
  obj: unknown,
  key: string,
  parentPath?: string,
  opts?: BuildTreeOptions,
  depth?: number,
): JsonTreeNode {
  const d = depth ?? 0;
  const track = opts?.trackPaths !== false;
  const path = track ? (parentPath ?? '') : '';

  if (obj === null || obj === undefined) {
    return { key, path, value: null, type: 'null' };
  }

  if (opts?.maxDepth !== undefined && d >= opts.maxDepth) {
    if (Array.isArray(obj)) {
      return { key, path, value: obj, type: 'array', truncated: true, totalCount: obj.length };
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj as Record<string, unknown>);
      return { key, path, value: obj, type: 'object', truncated: true, totalCount: keys.length };
    }
  }

  if (Array.isArray(obj)) {
    const maxItems = opts?.maxArrayItems;
    const isTruncated = maxItems !== undefined && obj.length > maxItems;
    const items = isTruncated ? obj.slice(0, maxItems) : obj;
    return {
      key,
      path,
      value: obj,
      type: 'array',
      children: items.map((item, i) => {
        const childPath = track ? (path ? `${path}[${i}]` : `[${i}]`) : '';
        return buildJsonTree(item, `[${i}]`, childPath, opts, d + 1);
      }),
      ...(isTruncated ? { truncated: true, totalCount: obj.length } : {}),
    };
  }

  if (typeof obj === 'object') {
    return {
      key,
      path,
      value: obj,
      type: 'object',
      children: Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
        const childPath = track ? (path ? `${path}.${k}` : k) : '';
        return buildJsonTree(v, k, childPath, opts, d + 1);
      }),
    };
  }

  return {
    key,
    path,
    value: obj,
    type: typeof obj as 'string' | 'number' | 'boolean',
  };
}

/** Collect all leaf-node paths (nodes without children). */
export function getAllLeafPaths(node: JsonTreeNode): string[] {
  if (!node.children || node.children.length === 0) return [node.path];
  return node.children.flatMap(getAllLeafPaths);
}

/** Collect all paths including intermediate nodes. */
export function getAllPaths(node: JsonTreeNode): string[] {
  const paths = [node.path];
  if (node.children) {
    for (const child of node.children) {
      paths.push(...getAllPaths(child));
    }
  }
  return paths.filter(Boolean);
}

/** Check if a node or any descendant matches a search term (case-insensitive). */
export function nodeMatchesSearch(node: JsonTreeNode, term: string): boolean {
  try {
    if (!term) return true;
    const lower = term.toLowerCase();
    if ((node.key || '').toLowerCase().includes(lower)) return true;
    if ((node.path || '').toLowerCase().includes(lower)) return true;
    if (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower)) return true;
    if (node.children) return node.children.some((c) => nodeMatchesSearch(c, term));
  } catch { /* ignore search errors */ }
  return false;
}

/**
 * Derive a suggested variable name from the last JSONPath segment.
 * e.g. `$.publication.body.country` -> `country`
 */
export function suggestedVariableNameFromJsonPath(expression: string): string | null {
  const t = expression.trim().replace(/^\$\.?/, '').trim();
  if (!t) return null;
  const parts = t.split('.');
  let last = parts[parts.length - 1] ?? '';
  last = last.replace(/\[\d+\]|\[\*\]$/g, '');
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(last)) return last;
  return null;
}
