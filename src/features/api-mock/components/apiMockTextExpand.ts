/** Case-insensitive substring offsets for the expand-text search bar. */
export function findTextExpandMatches(text: string, query: string): number[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hay = text.toLowerCase();
  const offsets: number[] = [];
  let from = 0;
  while (from <= hay.length - needle.length) {
    const idx = hay.indexOf(needle, from);
    if (idx < 0) break;
    offsets.push(idx);
    from = idx + needle.length;
  }
  return offsets;
}

export function nextTextExpandMatch(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return 0;
  if (current < 0) return direction === 1 ? 0 : count - 1;
  return (current + direction + count) % count;
}

export function formatTextExpandCount(index: number, count: number): string {
  if (count <= 0) return '0/0';
  return `${index + 1}/${count}`;
}

export type JsonBodyFormat = { pretty: string; minified: string };

/**
 * Pretty-print and minify object/array JSON. Returns null when the text is not
 * a JSON object or array (strings, numbers, and invalid JSON stay untouched).
 */
export function formatJsonBody(text: string): JsonBodyFormat | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed === null || typeof parsed !== 'object') return null;
    return {
      pretty: JSON.stringify(parsed, null, 2),
      minified: JSON.stringify(parsed),
    };
  } catch {
    return null;
  }
}

/** Pretty-print object/array JSON. Returns null when the text is not a JSON object or array. */
export function prettyPrintJsonBody(text: string): string | null {
  return formatJsonBody(text)?.pretty ?? null;
}

/** Collapse object/array JSON to one line. Returns null when the text is not a JSON object or array. */
export function minifyJsonBody(text: string): string | null {
  return formatJsonBody(text)?.minified ?? null;
}

/** Request pane inside Rule Simulation — expand popups nest here instead of the viewport. */
export const API_MOCK_EXPAND_PORTAL_HOST = '[data-testid="api-mock-sim-main"]';

export function resolveApiMockExpandPortal(): HTMLElement {
  return document.querySelector<HTMLElement>(API_MOCK_EXPAND_PORTAL_HOST) ?? document.body;
}

export function isNestedApiMockExpandPortal(host: HTMLElement): boolean {
  return host !== document.body;
}

export function textExpandStats(text: string): { lines: number; chars: number } {
  return {
    chars: text.length,
    lines: text === '' ? 1 : text.split('\n').length,
  };
}
