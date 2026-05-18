/**
 * Shared utilities for JSON tree viewers (JsonTreePreview, RegexAssertionModal, etc.).
 * Provides type-color maps, value preview logic, and SVG toggle icons.
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

/**
 * Best-effort JSON formatting for truncated/malformed JSON strings.
 * Adds newlines and indentation by tracking brace/bracket depth.
 * Returns plain text unchanged if it doesn't look like JSON.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function bestEffortFormat(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { /* fall through */ }

  const looksLikeJson = text.trimStart().startsWith('{') || text.trimStart().startsWith('[');
  if (!looksLikeJson) return text;

  let result = '';
  let indent = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === '\\' && inString) { result += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString) { result += ch; continue; }

    if (ch === '{' || ch === '[') {
      result += ch + '\n' + '  '.repeat(++indent);
    } else if (ch === '}' || ch === ']') {
      result += '\n' + '  '.repeat(--indent < 0 ? (indent = 0) : indent) + ch;
    } else if (ch === ',') {
      result += ',\n' + '  '.repeat(indent);
    } else if (ch === ':') {
      result += ': ';
    } else if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') {
      result += ch;
    }
  }
  return result;
}

/**
 * Count text-level occurrences of a search term (case-insensitive).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function countTextMatches(text: string, term: string): number {
  if (!term) return 0;
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = lower.indexOf(t, pos)) !== -1) { count++; pos += t.length; }
  return count;
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
