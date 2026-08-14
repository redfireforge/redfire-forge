const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

/** Count operations across the converted document's paths (for the endpoint chip). */
export function countOperations(openapi: Record<string, unknown>): number {
  const paths = openapi.paths;
  if (!paths || typeof paths !== 'object') return 0;
  let n = 0;
  for (const item of Object.values(paths as Record<string, unknown>)) {
    if (!item || typeof item !== 'object') continue;
    for (const key of Object.keys(item as Record<string, unknown>)) {
      if (HTTP_METHODS.has(key)) n++;
    }
  }
  return n;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Escape a raw line for HTML while wrapping each case-insensitive match of `re`
 * (built against RAW text) in a `<mark>`.
 */
export function highlightRawLine(rawLine: string, re: RegExp, active: boolean): string {
  const cls = active ? 'cat-convert-hit cat-convert-hit--active' : 'cat-convert-hit';
  let html = '';
  let last = 0;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawLine)) !== null) {
    html += escapeHtml(rawLine.slice(last, m.index));
    html += `<mark class="${cls}">${escapeHtml(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  html += escapeHtml(rawLine.slice(last));
  return html;
}

/**
 * Extract a YAML-searchable term from a conversion warning string.
 * Attempts multiple patterns and returns the best search keyword.
 */
export function extractWarningSearchTerm(warning: string): string | null {
  if (/^Removed\b/i.test(warning)) return null;

  const refMatch = warning.match(/#\/components\/[^/]+\/(\w+)/);
  if (refMatch) return refMatch[1];

  const pathMatch = warning.match(/at (?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+(\/[^\s:]+)/i);
  if (pathMatch) return pathMatch[1];

  const quotedField = warning.match(/'([a-zA-Z][\w-]*)'/);
  if (quotedField) return `${quotedField[1]}:`;

  if (/\bexamples?\[\].*\bexample\b/i.test(warning)) return 'example:';

  const extRef = warning.match(/\$ref[^:]*:\s*(.+)/);
  if (extRef) return extRef[1].trim();

  if (/\brequestBody\b/.test(warning)) return 'requestBody:';

  return null;
}
