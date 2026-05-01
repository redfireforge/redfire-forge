/**
 * Shared utilities for all JSON tree viewers (JsonTreePreview, JsonPathBuilder, PickerNode).
 * Eliminates duplicated type-color maps, value preview logic, and SVG toggle icons.
 */

/** Canonical type → color map used by all tree nodes. */
// eslint-disable-next-line react-refresh/only-export-components
export const TYPE_COLORS: Record<string, string> = {
  string: '#86efac',
  number: '#fbbf24',
  boolean: '#c084fc',
  null: '#f87171',
};

/** Get the display color for a JSON value type. */
// eslint-disable-next-line react-refresh/only-export-components
export function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? 'var(--text-muted)';
}

/** Format a node for inline preview (collapsed objects/arrays show count). */
// eslint-disable-next-line react-refresh/only-export-components
export function getValuePreview(
  type: string,
  value: unknown,
  childrenLength: number,
  maxStringLen = 60,
): string {
  if (type === 'object') return `{ ${childrenLength} keys }`;
  if (type === 'array') return `[ ${childrenLength} items ]`;
  if (type === 'string') {
    const s = String(value);
    return `"${s.length > maxStringLen ? s.slice(0, maxStringLen) + '...' : s}"`;
  }
  if (type === 'null') return 'null';
  return String(value);
}

/** Shared SVG chevron icon for tree toggle buttons. Uses .jt-toggle CSS for rotation. */
export function ChevronIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth="2.5" stroke="currentColor" width="10" height="10">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
