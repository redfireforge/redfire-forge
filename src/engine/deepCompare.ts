import type { FailureDetail } from '../shared/types';

export function deepCompare(
  expected: unknown,
  actual: unknown,
  currentPath: string,
  failures: FailureDetail[]
): void {
  if (expected === actual) return;

  if (expected == null || actual == null || typeof expected !== typeof actual) {
    failures.push({
      path: currentPath || '(root)',
      expected: JSON.stringify(expected),
      actual: JSON.stringify(actual),
    });
    return;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      failures.push({
        path: currentPath,
        expected: 'array',
        actual: typeof actual,
      });
      return;
    }
    const maxLen = Math.max(expected.length, actual.length);
    for (let i = 0; i < maxLen; i++) {
      deepCompare(
        expected[i],
        actual[i],
        `${currentPath}[${i}]`,
        failures
      );
    }
    return;
  }

  if (typeof expected === 'object') {
    const expObj = expected as Record<string, unknown>;
    const actObj = actual as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(expObj), ...Object.keys(actObj)]);
    for (const key of allKeys) {
      deepCompare(
        expObj[key],
        actObj[key],
        currentPath ? `${currentPath}.${key}` : key,
        failures
      );
    }
    return;
  }

  failures.push({
    path: currentPath || '(root)',
    expected: JSON.stringify(expected),
    actual: JSON.stringify(actual),
  });
}
