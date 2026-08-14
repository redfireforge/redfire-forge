/**
 * API Mock Studio — compiled-pattern cache (Phase 12A).
 * Compile-once memoization for RegExp used on the request matching hot path.
 * Bounded via LRU so unique adversarial patterns cannot grow memory unbounded.
 */
import { BoundedCache, MAX_COMPILED_PATTERNS } from './perfBudgets';

// `null` is cached for invalid patterns so we do not retry compilation each hit.
const regexCache = new BoundedCache<string, RegExp | null>(MAX_COMPILED_PATTERNS);

/** Compile a RegExp, memoized by source+flags. Returns null when invalid. */
export function compileRegexCached(source: string, flags = ''): RegExp | null {
  const key = `${flags}\u0000${source}`;
  const cached = regexCache.get(key);
  if (cached !== undefined) return cached;
  let re: RegExp | null;
  try {
    re = new RegExp(source, flags);
  } catch {
    re = null;
  }
  regexCache.set(key, re);
  return re;
}

/** Test a value against a cached pattern; false when the pattern is invalid. */
export function testRegexCached(source: string, flags: string, value: string): boolean {
  const re = compileRegexCached(source, flags);
  return re ? re.test(value) : false;
}

/** Test-only: clear the cache to isolate memory-bound assertions. */
export function _clearPatternCache(): void {
  regexCache.clear();
}
