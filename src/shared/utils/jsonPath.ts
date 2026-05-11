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

/**
 * Set a value at a JSONPath-style location in a mutable object,
 * creating intermediate objects as needed.
 *
 * Accepts `$.a.b.c`, `a.b`, plain `key` — the `$.` prefix is optional.
 * Only supports dot-separated keys (no array brackets for set).
 */
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const normalized = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;
  if (!normalized.trim()) return;
  const keys = normalized.split('.').filter(Boolean);
  if (keys.length === 0) return;
  if (keys.some(k => UNSAFE_KEYS.has(k))) return;
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in current) || typeof current[k] !== 'object' || current[k] === null) {
      current[k] = {};
    }
    current = current[k] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}
