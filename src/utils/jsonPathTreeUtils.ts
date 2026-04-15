export interface JsonNode {
  key: string;
  path: string;
  value: unknown;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  children?: JsonNode[];
}

export function buildTree(obj: unknown, parentPath: string, parentKey: string): JsonNode {
  if (obj === null || obj === undefined) {
    return { key: parentKey, path: parentPath, value: null, type: 'null' };
  }
  if (Array.isArray(obj)) {
    return {
      key: parentKey,
      path: parentPath,
      value: obj,
      type: 'array',
      children: obj.map((item, i) => buildTree(item, parentPath ? `${parentPath}[${i}]` : `[${i}]`, `[${i}]`)),
    };
  }
  if (typeof obj === 'object') {
    return {
      key: parentKey,
      path: parentPath,
      value: obj,
      type: 'object',
      children: Object.entries(obj as Record<string, unknown>).map(([k, v]) =>
        buildTree(v, parentPath ? `${parentPath}.${k}` : k, k)
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
