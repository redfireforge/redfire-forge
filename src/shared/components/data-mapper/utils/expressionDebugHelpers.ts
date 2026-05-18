/**
 * Formatting helpers for the expression step debugger display.
 */

export function prettyDebugValue(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

export function truncateDebugValue(raw: string, max = 200): string {
  if (raw.length <= max) return raw;
  return raw.slice(0, max - 1) + '…';
}
