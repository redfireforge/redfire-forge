export function deepSubsetMatch(
  actual: unknown,
  expected: unknown,
  path: string = '',
): { match: boolean; path?: string; expected?: string; actual?: string } {
  if (expected === null) {
    return actual === null
      ? { match: true }
      : { match: false, path: path || '(root)', expected: 'null', actual: JSON.stringify(actual) };
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return { match: false, path: path || '(root)', expected: 'array', actual: typeof actual };
    }
    for (let i = 0; i < expected.length; i++) {
      const found = actual.some(item => deepSubsetMatch(item, expected[i], '').match);
      if (!found) {
        return { match: false, path: `${path}[${i}]`, expected: JSON.stringify(expected[i]), actual: 'not found in array' };
      }
    }
    return { match: true };
  }

  if (typeof expected === 'object' && expected !== null) {
    if (Array.isArray(actual)) {
      const found = actual.some(item => deepSubsetMatch(item, expected, '').match);
      if (found) return { match: true };
      return { match: false, path: path || '(root)', expected: JSON.stringify(expected), actual: 'no matching element in array' };
    }
    if (typeof actual !== 'object' || actual === null) {
      return { match: false, path: path || '(root)', expected: 'object', actual: actual === null ? 'null' : typeof actual };
    }
    const actObj = actual as Record<string, unknown>;
    const expObj = expected as Record<string, unknown>;
    for (const key of Object.keys(expObj)) {
      if (!(key in actObj)) {
        return { match: false, path: path ? `${path}.${key}` : key, expected: JSON.stringify(expObj[key]), actual: 'missing key' };
      }
      const sub = deepSubsetMatch(actObj[key], expObj[key], path ? `${path}.${key}` : key);
      if (!sub.match) return sub;
    }
    return { match: true };
  }

  if (actual === expected) return { match: true };
  return { match: false, path: path || '(root)', expected: JSON.stringify(expected), actual: JSON.stringify(actual) };
}
