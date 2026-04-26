export interface JsonNode {
  key: string;
  path: string;
  value: unknown;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  children?: JsonNode[];
  /** When true, the children array was truncated (array had more items). */
  truncated?: boolean;
  /** Total count of items before truncation. */
  totalCount?: number;
}

export interface BuildTreeOptions {
  /** Max items to show per array (default: unlimited). */
  maxArrayItems?: number;
  /** Max depth to recurse (default: unlimited). */
  maxDepth?: number;
}

export function buildTree(obj: unknown, parentPath: string, parentKey: string, opts?: BuildTreeOptions, depth?: number): JsonNode {
  const d = depth ?? 0;
  if (obj === null || obj === undefined) {
    return { key: parentKey, path: parentPath, value: null, type: 'null' };
  }
  // Stop recursing at maxDepth — show leaf preview only
  if (opts?.maxDepth !== undefined && d >= opts.maxDepth) {
    if (Array.isArray(obj)) {
      return { key: parentKey, path: parentPath, value: obj, type: 'array', truncated: true, totalCount: obj.length };
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj as Record<string, unknown>);
      return { key: parentKey, path: parentPath, value: obj, type: 'object', truncated: true, totalCount: keys.length };
    }
  }
  if (Array.isArray(obj)) {
    const maxItems = opts?.maxArrayItems;
    const isTruncated = maxItems !== undefined && obj.length > maxItems;
    const items = isTruncated ? obj.slice(0, maxItems) : obj;
    return {
      key: parentKey,
      path: parentPath,
      value: obj,
      type: 'array',
      children: items.map((item, i) => buildTree(item, parentPath ? `${parentPath}[${i}]` : `[${i}]`, `[${i}]`, opts, d + 1)),
      ...(isTruncated ? { truncated: true, totalCount: obj.length } : {}),
    };
  }
  if (typeof obj === 'object') {
    return {
      key: parentKey,
      path: parentPath,
      value: obj,
      type: 'object',
      children: Object.entries(obj as Record<string, unknown>).map(([k, v]) =>
        buildTree(v, parentPath ? `${parentPath}.${k}` : k, k, opts, d + 1)
      ),
    };
  }
  return {
    key: parentKey,
    path: parentPath,
    value: obj,
    type: typeof obj as 'string' | 'number' | 'boolean',
  };
}

export function getAllLeafPaths(node: JsonNode): string[] {
  if (!node.children || node.children.length === 0) return [node.path];
  return node.children.flatMap(getAllLeafPaths);
}

export function getAllPaths(node: JsonNode): string[] {
  const paths = [node.path];
  if (node.children) {
    for (const child of node.children) {
      paths.push(...getAllPaths(child));
    }
  }
  return paths.filter(Boolean);
}

export function nodeMatchesSearch(node: JsonNode, term: string): boolean {
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
 * Last JSONPath segment as a suggested extraction variable name, e.g. `$.publication.body.country` → `country`.
 * Strips trailing `[n]` / `[*]` from the last segment. Returns null if not a simple identifier.
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
