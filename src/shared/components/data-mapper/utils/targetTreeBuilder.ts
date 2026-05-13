/**
 * Build a JsonTreeNode tree from TargetField[] definitions.
 *
 * Used when target.sampleData is absent but target.fields is available.
 * Produces a tree compatible with TargetTreeNode rendering, including
 * correct path attributes for drop zones and connection lines.
 */

import type { JsonTreeNode, JsonNodeType } from '../../../utils/jsonTreeModel';
import type { TargetField } from '../types';

const STANDARD_TYPES = new Set<string>([
  'object', 'array', 'string', 'number', 'boolean', 'null',
]);

/**
 * Normalize adapter-specific field types to standard JsonNodeType.
 * Non-standard types (path, param, body, header, validate, etc.) default to 'string'.
 */
export function normalizeFieldType(type?: string): JsonNodeType {
  if (!type) return 'string';
  const lower = type.toLowerCase();
  if (STANDARD_TYPES.has(lower)) return lower as JsonNodeType;
  return 'string';
}

/**
 * Build a JsonTreeNode tree from flat TargetField definitions.
 *
 * - Flat paths (no dots) become leaf nodes directly under root
 * - Dot-separated paths (e.g. "user.name") create intermediate object nodes
 * - Array index paths (e.g. "offers[0].code") split into "offers" -> "[0]" -> "code"
 * - Paths with "::" separators (e.g. "path::userId") stay flat (no nesting on "::")
 * - Duplicate paths are deduplicated (first wins)
 */
export function buildTreeFromFields(fields: TargetField[]): JsonTreeNode {
  const root: JsonTreeNode = {
    key: '(root)',
    path: '',
    type: 'object',
    value: undefined,
    children: [],
  };

  if (!fields || fields.length === 0) return root;

  const seen = new Set<string>();

  for (const field of fields) {
    if (!field.path || seen.has(field.path)) continue;
    seen.add(field.path);

    const segments = splitFieldPath(field.path);

    if (segments.length === 1) {
      root.children!.push({
        key: field.label || field.path,
        path: field.path,
        type: normalizeFieldType(field.type),
        value: field.defaultValue ?? undefined,
        children: [],
      });
    } else {
      insertNestedField(root, segments, field);
    }
  }

  return root;
}

/**
 * Split a field path into segments for tree nesting.
 * Splits on "." and array brackets while preserving array segments as "[n]".
 * "::" separators are kept intact as a single segment.
 */
function splitFieldPath(path: string): string[] {
  if (path.includes('::')) return [path];
  const segments: string[] = [];
  let token = '';
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === '.') {
      if (token) {
        segments.push(token);
        token = '';
      }
      continue;
    }
    if (ch === '[') {
      if (token) {
        segments.push(token);
        token = '';
      }
      const end = path.indexOf(']', i);
      if (end !== -1) {
        segments.push(path.slice(i, end + 1));
        i = end;
        continue;
      }
    }
    token += ch;
  }
  if (token) segments.push(token);
  return segments.filter(Boolean);
}

function joinPathSegments(segments: string[]): string {
  let path = '';
  for (const segment of segments) {
    if (segment.startsWith('[')) {
      path += segment;
    } else {
      path += path ? `.${segment}` : segment;
    }
  }
  return path;
}

/**
 * Insert a nested field into the tree, creating intermediate object nodes as needed.
 */
function insertNestedField(
  root: JsonTreeNode,
  segments: string[],
  field: TargetField,
): void {
  let current = root;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;
    const pathSoFar = joinPathSegments(segments.slice(0, i + 1));

    if (isLast) {
      const existing = current.children!.find((c) => c.path === pathSoFar);
      if (!existing) {
        current.children!.push({
          key: field.label || segment,
          path: field.path,
          type: normalizeFieldType(field.type),
          value: field.defaultValue ?? undefined,
          children: [],
        });
      }
    } else {
      let intermediate = current.children!.find((c) => c.path === pathSoFar);
      if (!intermediate) {
        const nextSegment = segments[i + 1];
        intermediate = {
          key: segment,
          path: pathSoFar,
          type: nextSegment?.startsWith('[') ? 'array' : 'object',
          value: undefined,
          children: [],
        };
        current.children!.push(intermediate);
      }
      current = intermediate;
    }
  }
}

/**
 * Collect all node paths in a tree (for auto-expanding).
 */
export function collectAllPaths(node: JsonTreeNode): Set<string> {
  const paths = new Set<string>();
  const walk = (n: JsonTreeNode) => {
    paths.add(n.path || '__root__');
    n.children?.forEach(walk);
  };
  walk(node);
  return paths;
}
