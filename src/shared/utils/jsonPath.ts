/**
 * Canonical JSONPath evaluation engine.
 *
 * Supports: `$.a.b`, `a[0].x`, `$.items[*].id`, `$.arr.length`.
 * `[*]` walks every array element and returns an array of nested results.
 * `.length` on arrays returns the count.
 */

const STAR = '__PATH_STAR__';

function tokenizeJsonPath(normalized: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const s = normalized.trim();
  while (i < s.length) {
    if (s[i] === '.') {
      i++;
      continue;
    }
    if (s[i] === '[') {
      const end = s.indexOf(']', i);
      if (end === -1) break;
      const inner = s.slice(i + 1, end).trim();
      tokens.push(inner === '*' ? STAR : inner);
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < s.length && s[j] !== '.' && s[j] !== '[') j++;
    if (j > i) tokens.push(s.slice(i, j));
    i = j;
  }
  return tokens;
}

function walkPath(obj: unknown, tokens: string[], idx: number): unknown {
  if (idx >= tokens.length) return obj;
  const t = tokens[idx];
  if (t === STAR) {
    if (!Array.isArray(obj)) return undefined;
    if (idx === tokens.length - 1) return obj;
    return obj.map((el) => walkPath(el, tokens, idx + 1));
  }
  if (t === 'length' && Array.isArray(obj)) {
    return walkPath(obj.length, tokens, idx + 1);
  }
  if (obj == null || typeof obj !== 'object') return undefined;
  const key = /^\d+$/.test(t) ? Number(t) : t;
  let next: unknown;
  if (Array.isArray(obj)) {
    next = typeof key === 'number' ? obj[key] : undefined;
  } else {
    next = (obj as Record<string, unknown>)[String(key)];
  }
  return walkPath(next, tokens, idx + 1);
}

/**
 * Resolve a JSONPath-style expression against an object.
 *
 * Accepts `$.a.b`, `a[0].x`, `$.items[*].id` — the `$.` prefix is optional.
 * `[*]` walks every array element at that segment and returns an array of nested results.
 */
export function getByPath(obj: unknown, path: string): unknown {
  const normalized = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;
  if (!normalized.trim()) return obj;
  const tokens = tokenizeJsonPath(normalized);
  if (tokens.length === 0) return obj;
  return walkPath(obj, tokens, 0);
}

/**
 * Like `getByPath` but coerces the result to a string.
 * Returns empty string for null/undefined/missing paths.
 * Objects and arrays are JSON-stringified.
 */
export function getByPathAsString(obj: unknown, path: string): string {
  const value = getByPath(obj, path);
  if (value == null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
