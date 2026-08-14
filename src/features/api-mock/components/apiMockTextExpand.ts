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

/** Pretty-print object/array JSON. Returns null when the text is not a JSON object or array. */
export function prettyPrintJsonBody(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed === null || typeof parsed !== 'object') return null;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}
