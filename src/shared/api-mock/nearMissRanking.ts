/**
 * Rank unmatched routes by how close they came — path typos, wrong method,
 * failed predicates, and disabled drafts. Method-only hits on unrelated paths
 * (GET /health vs GET /ordrs/42) are not near misses.
 */
import type { ApiMockMatchExplanationV1, ApiMockRouteV1 } from './contracts';
import type { RouteEvaluationResult } from './predicateEvaluator';

/** Same-arity segment edits at or below this count as a path typo. */
const MAX_CLOSE_PATH_EDITS = 2;

export function pathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function isParamSegment(seg: string): boolean {
  return (seg.startsWith(':') && /^:[A-Za-z_]\w*$/.test(seg))
    || (seg.startsWith('{') && seg.endsWith('}') && seg.length > 2)
    || seg === '*'
    || seg === '**';
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** Edit distance treating `:id` / `{id}` / `*` segments as wildcards (cost 0). */
export function pathMissDistance(pattern: string, requestPath: string): number {
  const pSegs = pathSegments(pattern);
  const rSegs = pathSegments(requestPath);
  if (pSegs.length !== rSegs.length) {
    return levenshtein(pattern.toLowerCase(), requestPath.toLowerCase());
  }
  let dist = 0;
  for (let i = 0; i < pSegs.length; i++) {
    if (isParamSegment(pSegs[i])) continue;
    dist += levenshtein(pSegs[i].toLowerCase(), rSegs[i].toLowerCase());
  }
  return dist;
}

export function isClosePathMiss(pattern: string, requestPath: string): boolean {
  if (pathSegments(pattern).length !== pathSegments(requestPath).length) return false;
  return pathMissDistance(pattern, requestPath) <= MAX_CLOSE_PATH_EDITS;
}

function pathMismatchReason(pattern: string, requestPath: string): string {
  const pSegs = pathSegments(pattern);
  const rSegs = pathSegments(requestPath);
  const n = Math.min(pSegs.length, rSegs.length);
  for (let i = 0; i < n; i++) {
    if (isParamSegment(pSegs[i])) continue;
    if (pSegs[i].toLowerCase() !== rSegs[i].toLowerCase()) {
      return `'${rSegs[i]}' ≠ '${pSegs[i]}'`;
    }
  }
  return `'${requestPath}' ≠ '${pattern}'`;
}

function failedFromEvaluation(e: RouteEvaluationResult): ApiMockMatchExplanationV1['nearMisses'][number]['failedPredicates'] {
  return e.predicateResults.filter(p => !p.passed).map(p => ({
    predicateId: p.predicateId,
    source: p.source,
    reason: p.reason ?? 'failed',
  }));
}

function syntheticFailures(
  e: RouteEvaluationResult,
  route: ApiMockRouteV1,
  requestPath: string,
  requestMethod: string,
): ApiMockMatchExplanationV1['nearMisses'][number]['failedPredicates'] {
  const failed: ApiMockMatchExplanationV1['nearMisses'][number]['failedPredicates'] = [];
  if (!e.methodMatch) {
    failed.push({
      predicateId: 'method',
      source: 'method',
      reason: `${requestMethod} ≠ ${route.method}`,
    });
  }
  if (!e.pathMatch) {
    failed.push({
      predicateId: 'path',
      source: 'path',
      reason: pathMismatchReason(route.path.value, requestPath),
    });
  }
  if (!e.enabled && e.methodMatch && e.pathMatch) {
    failed.push({
      predicateId: 'enabled',
      source: 'enabled',
      reason: 'rule is disabled',
    });
  }
  return failed;
}

/**
 * Near misses include drafts. Unrelated same-method routes are excluded.
 * `missDistance` is lower when closer (path edits, then method, then failures).
 */
export function collectNearMisses(
  evaluations: RouteEvaluationResult[],
  routes: ApiMockRouteV1[],
  requestPath: string,
  requestMethod: string,
): ApiMockMatchExplanationV1['nearMisses'] {
  const index = new Map<string, ApiMockRouteV1>();
  for (const route of routes) index.set(route.id, route);

  const misses: ApiMockMatchExplanationV1['nearMisses'] = [];
  for (const e of evaluations) {
    if (e.overallMatch) continue;
    const route = index.get(e.routeId);
    if (!route) continue;
    const include = e.pathMatch || (e.methodMatch && isClosePathMiss(route.path.value, requestPath));
    if (!include) continue;

    const evaluatedFails = failedFromEvaluation(e);
    const failedPredicates = evaluatedFails.length > 0
      ? evaluatedFails
      : syntheticFailures(e, route, requestPath, requestMethod);
    const pathDistance = e.pathMatch ? 0 : pathMissDistance(route.path.value, requestPath);
    misses.push({
      routeId: e.routeId,
      routeName: e.routeName,
      failedPredicates,
      missDistance: pathDistance * 10
        + (e.methodMatch ? 0 : 50)
        + failedPredicates.length
        + (e.enabled ? 0 : 1),
    });
  }

  return misses.sort((a, b) => a.missDistance - b.missDistance || a.routeId.localeCompare(b.routeId));
}
