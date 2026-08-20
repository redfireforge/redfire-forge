/**
 * API Mock Studio — path matching (Phase 1C).
 * Pure functions for matching request paths against route path matchers.
 */
import type { ApiMockPathMatcherV1, ApiMockPathMatcherKind } from './contracts';
import { compileRegexCached } from './patternCache';

export interface PathMatchResult {
  matched: boolean;
  params: Record<string, string>;
}

const NO_MATCH: PathMatchResult = { matched: false, params: {} };

/**
 * Pick the matcher kind implied by a typed path so `/users/:id` doesn't stay an
 * exact literal that can never match a real request. An explicit `regex` choice
 * is preserved because its syntax overlaps the other kinds.
 */
export function inferPathKind(value: string, current?: ApiMockPathMatcherKind): ApiMockPathMatcherKind {
  if (current === 'regex') return 'regex';
  if (/:[A-Za-z_]\w*/.test(value) || /\{[^}]+\}/.test(value)) return 'parameterized';
  if (/[*?]/.test(value)) return 'glob';
  return 'exact';
}

/**
 * Promote an `exact` matcher whose value is clearly a template (`:id`, `{id}`,
 * globs) so OpenAPI imports and typed paths cannot stay as unmatchable literals.
 * Explicit regex / glob / parameterized kinds are left alone.
 */
export function normalizePathMatcher(matcher: ApiMockPathMatcherV1): ApiMockPathMatcherV1 {
  if (matcher.kind !== 'exact') {
    if (matcher.kind === 'parameterized' && !matcher.paramNames?.length) {
      const paramNames = pathParamNames(matcher.value);
      return paramNames.length > 0 ? { ...matcher, paramNames } : matcher;
    }
    return matcher;
  }
  const kind = inferPathKind(matcher.value, matcher.kind);
  if (kind === 'exact') return matcher;
  const paramNames = kind === 'parameterized' ? pathParamNames(matcher.value) : undefined;
  return {
    ...matcher,
    kind,
    ...(paramNames && paramNames.length > 0 ? { paramNames } : {}),
  };
}

/** Unique `:name` / `{name}` captures from path segments, matching `matchParameterizedPath`. */
export function pathParamNames(value: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split('/')) {
    let name: string | undefined;
    if (part.startsWith(':') && /^:[A-Za-z_]\w*$/.test(part)) name = part.slice(1);
    else if (part.startsWith('{') && part.endsWith('}')) name = part.slice(1, -1);
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

export function matchPath(matcher: ApiMockPathMatcherV1, requestPath: string): PathMatchResult {
  const resolved = normalizePathMatcher(matcher);
  const ci = resolved.flags?.caseInsensitive ?? false;
  switch (resolved.kind) {
    case 'exact': return matchExactPath(resolved.value, requestPath, ci);
    case 'parameterized': return matchParameterizedPath(resolved.value, requestPath, ci);
    case 'glob': return matchGlobPath(resolved.value, requestPath, ci);
    case 'regex': return matchRegexPath(resolved.value, requestPath, ci);
    default: return NO_MATCH;
  }
}

function matchExactPath(pattern: string, path: string, ci: boolean): PathMatchResult {
  const matched = ci ? pattern.toLowerCase() === path.toLowerCase() : pattern === path;
  return { matched, params: {} };
}

function matchParameterizedPath(pattern: string, path: string, ci: boolean): PathMatchResult {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return NO_MATCH;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const rp = pathParts[i];
    if (pp.startsWith(':') || (pp.startsWith('{') && pp.endsWith('}'))) {
      const name = pp.startsWith(':') ? pp.slice(1) : pp.slice(1, -1);
      if (name) params[name] = rp;
    } else {
      const match = ci ? pp.toLowerCase() === rp.toLowerCase() : pp === rp;
      if (!match) return NO_MATCH;
    }
  }
  return { matched: true, params };
}

function matchGlobPath(pattern: string, path: string, ci: boolean): PathMatchResult {
  const regex = globToRegex(pattern, ci);
  return { matched: regex?.test(path) ?? false, params: {} };
}

function globToRegex(glob: string, ci: boolean): RegExp | null {
  let regex = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      regex += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (ch === '*') {
      regex += '[^/]*';
    } else if (ch === '?') {
      regex += '[^/]';
    } else {
      regex += escapeRegexChar(ch);
    }
  }
  return compileRegexCached(`^${regex}$`, ci ? 'i' : '');
}

function matchRegexPath(pattern: string, path: string, ci: boolean): PathMatchResult {
  const re = compileRegexCached(pattern, ci ? 'i' : '');
  return { matched: re ? re.test(path) : false, params: {} };
}

function escapeRegexChar(ch: string): string {
  return '.+*?^${}()|[]\\'.includes(ch) ? `\\${ch}` : ch;
}
