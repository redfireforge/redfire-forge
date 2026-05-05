/**
 * Recursively sort object keys to produce a stable representation.
 * Useful for fingerprinting objects regardless of key insertion order.
 */
export function canonicalize(val: unknown): unknown {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(canonicalize);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(val as Record<string, unknown>).sort()) {
    out[k] = canonicalize((val as Record<string, unknown>)[k]);
  }
  return out;
}
