/**
 * Pure helpers + constants used by `TargetTreeNode` and its sub-components.
 *
 * Split out of `TargetTreeNode.tsx` so the rendering component stays focused
 * on JSX while these stateless utilities can be unit-tested in isolation.
 */
import type { JsonTreeNode } from '../../../utils/jsonTreeModel';
import type { Assertion, ComparisonOperator } from '../../../types';
import { normalizeMapperPath } from './pathNormalization';

/** Drag-and-drop text/plain payload prefixes for source ⇒ target drops. */
export const SOURCE_TEXT_PREFIX = 'mapper-source:';
/** Drag-and-drop text/plain payload prefixes for target ⇒ target reorder drops. */
export const TARGET_FIELD_TEXT_PREFIX = 'mapper-target-field:';
/** Drag-and-drop text/plain payload prefix for mapping remap (move line to new target). */
export const REMAP_TEXT_PREFIX = 'mapper-remap:';

/** Compact type pills shown next to each node ("obj", "arr", …). */
export const TYPE_LABELS: Record<string, string> = {
  object: 'obj',
  array: 'arr',
  string: 'str',
  number: 'num',
  boolean: 'bool',
  null: 'null',
};

/** Array-level assertion presentation metadata (icon, label, CSS class). */
export const ARRAY_ASSERTION_LABELS: Record<string, { icon: string; label: string; description: string; cssClass: string }> = {
  arrayLength: { icon: '#', label: 'LENGTH', description: 'Array size check', cssClass: 'length' },
  arrayContains: { icon: '∋', label: 'CONTAINS', description: 'Has item with exact value', cssClass: 'contains' },
  each: { icon: '∀', label: 'EACH', description: 'Every item must match', cssClass: 'each' },
  containsSubset: { icon: '⊆', label: 'SUBSET', description: 'Has item matching partial object (nested)', cssClass: 'subset' },
  custom: { icon: 'ƒ', label: 'CUSTOM', description: 'Custom assertion', cssClass: 'custom' },
};

/** Comparison operators rendered in inline assertion controls. */
export const COMPARISON_OPS: ComparisonOperator[] = ['=', '!=', '>', '>=', '<', '<='];

/** Does the node match the user-typed search term (key, path, or scalar value)? */
export function matchesSearchTerm(node: JsonTreeNode, lower: string): boolean {
  if (!lower) return true;
  if (node.key.toLowerCase().includes(lower)) return true;
  if (node.path.toLowerCase().includes(lower)) return true;
  if (
    node.type !== 'object'
    && node.type !== 'array'
    && String(node.value ?? '').toLowerCase().includes(lower)
  ) {
    return true;
  }
  return false;
}

/** Does the node match the current mapping filter ("all" | "mapped" | "unmapped")? */
export function matchesFilter(
  path: string,
  mappingFilter: 'all' | 'mapped' | 'unmapped',
  mappedTargetPaths?: Set<string>,
): boolean {
  if (mappingFilter === 'all') return true;
  const normalizedPath = normalizeMapperPath(path);
  const isMapped = mappedTargetPaths?.has(normalizedPath) ?? false;
  return mappingFilter === 'mapped' ? isMapped : !isMapped;
}

/**
 * Combined visibility check: search-term + mapping-filter.
 * Visibility is recursive — a parent stays visible when any descendant matches.
 */
export function matchesNodeVisibility(
  node: JsonTreeNode,
  search: string,
  mappingFilter: 'all' | 'mapped' | 'unmapped',
  mappedTargetPaths?: Set<string>,
): boolean {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const lower = search.toLowerCase();
  const searchMatch = matchesSearchTerm(node, lower);

  if (!hasChildren) {
    return searchMatch && matchesFilter(node.path, mappingFilter, mappedTargetPaths);
  }

  const selfMatch = matchesFilter(node.path, mappingFilter, mappedTargetPaths);
  const childMatch = node.children!.some((child) =>
    matchesNodeVisibility(child, search, mappingFilter, mappedTargetPaths),
  );
  if (mappingFilter === 'all') {
    return searchMatch || childMatch;
  }
  return selfMatch || childMatch;
}

/**
 * Render the node key for display. For indexed array elements (`[0]` / `[*]`)
 * we prefer the dotted-suffix form (`offers[0]`) so the user can see context.
 */
export function formatNodeDisplayKey(node: JsonTreeNode): string {
  const raw = node.key || '(root)';
  if (!/^\[(\d+|\*)\]$/.test(raw)) return raw;
  const normalizedPath = normalizeMapperPath(node.path);
  const match = normalizedPath.match(/(?:^|\.)([^.[\]]+\[(?:\d+|\*)\])$/);
  return match?.[1] ?? raw;
}

/** Apply a flash animation to a tree node element, removing it after `ms`. */
export function flashTreeNode(el: Element | null, ms = 1500): void {
  if (!el) return;
  (el as HTMLElement).classList.add('dm-tree-node--flash');
  setTimeout(() => (el as HTMLElement).classList.remove('dm-tree-node--flash'), ms);
}

export const OPERATOR_DISPLAY: Record<string, string> = {
  equals: '=',
  not_equals: '!=',
  greater_than: '>',
  greater_than_or_equal: '>=',
  less_than: '<',
  less_than_or_equal: '<=',
  contains: 'contains',
  not_contains: 'not_contains',
  starts_with: 'starts_with',
  ends_with: 'ends_with',
  exists: 'exists',
  not_exists: 'not_exists',
  is_true: 'is_true',
  is_false: 'is_false',
  is_null: 'is_null',
  is_not_null: 'is_not_null',
  is_empty: 'is_empty',
  is_not_empty: 'is_not_empty',
  is_type: 'is_type',
  regex: 'regex',
  in: 'in',
  not_in: 'not_in',
  between: 'between',
  close_to: 'close_to',
};

function displayOp(op: string): string {
  return OPERATOR_DISPLAY[op] ?? op;
}

const DISPLAY_TO_OPERATOR: Record<string, string> = {};
for (const [internal, display] of Object.entries(OPERATOR_DISPLAY)) {
  DISPLAY_TO_OPERATOR[display] = internal;
  DISPLAY_TO_OPERATOR[internal] = internal;
}

/**
 * Parse a user-entered "each" assertion value string back into its components.
 * Accepts formats like "rank >= 0", "* exists", "name contains foo".
 * Returns { fieldPath, operator, value } or null if unparseable.
 */
export function parseEachInput(input: string): { fieldPath: string; operator: string; value: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  const fieldPath = tokens[0] === '*' ? '' : tokens[0];
  const opToken = tokens[1];
  const operator = DISPLAY_TO_OPERATOR[opToken] ?? opToken;
  const value = tokens.slice(2).join(' ');

  return { fieldPath, operator, value };
}

/** Short, one-line summary of an assertion for the inline row chip. */
export function formatAssertionSummary(a: Assertion): string {
  switch (a.type) {
    case 'arrayLength': return String(a.value);
    case 'arrayContains': return `${a.mode}: ${a.value || '(empty)'}`;
    case 'each': {
      const field = a.fieldPath || '*';
      const op = displayOp(a.operator);
      const val = a.value ?? '';
      return `${field} ${op} ${val}`.trim();
    }
    case 'containsSubset': return a.expected.length > 30 ? a.expected.slice(0, 27) + '…' : a.expected;
    case 'custom': return a.expression.length > 30 ? a.expression.slice(0, 27) + '…' : a.expression;
    default: return '';
  }
}

/** Safely extract jsonPath from any assertion variant that carries one. */
export function getAssertionJsonPath(a: Assertion): string {
  if ('jsonPath' in a && typeof (a as { jsonPath?: string }).jsonPath === 'string') {
    return (a as { jsonPath: string }).jsonPath;
  }
  return '';
}

/** Full one-line description for Code view: "path  TYPE  summary". */
export function formatAssertionLine(a: Assertion): string {
  const meta = ARRAY_ASSERTION_LABELS[a.type];
  const label = meta?.label ?? a.type.toUpperCase();
  const shortPath = getAssertionJsonPath(a).replace(/^\$\.?/, '');
  const summary = formatAssertionSummary(a);
  return `${shortPath}  ${label}  ${summary}`;
}
