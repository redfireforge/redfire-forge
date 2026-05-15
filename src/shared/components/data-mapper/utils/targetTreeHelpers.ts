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
export const ARRAY_ASSERTION_LABELS: Record<string, { icon: string; label: string; cssClass: string }> = {
  arrayLength: { icon: '#', label: 'length', cssClass: 'length' },
  arrayContains: { icon: '∋', label: 'contains', cssClass: 'contains' },
  each: { icon: '∀', label: 'each', cssClass: 'each' },
  containsSubset: { icon: '⊆', label: 'subset', cssClass: 'subset' },
  custom: { icon: 'ƒ', label: 'custom', cssClass: 'custom' },
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

  const childMatch = node.children!.some((child) =>
    matchesNodeVisibility(child, search, mappingFilter, mappedTargetPaths),
  );
  if (mappingFilter === 'all') {
    return searchMatch || childMatch;
  }
  return childMatch;
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

/** Short, one-line summary of an assertion for the inline row chip. */
export function formatAssertionSummary(a: Assertion): string {
  switch (a.type) {
    case 'arrayLength': return String(a.value);
    case 'arrayContains': return `${a.mode}: ${a.value || '(empty)'}`;
    case 'each': return `${a.fieldPath || '*'} ${a.operator} ${a.value ?? ''}`;
    case 'containsSubset': return a.expected.length > 30 ? a.expected.slice(0, 27) + '…' : a.expected;
    case 'custom': return a.expression.length > 30 ? a.expression.slice(0, 27) + '…' : a.expression;
    default: return '';
  }
}
