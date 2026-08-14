/**
 * API Mock Studio — route selection, specificity, and match explanation (Phase 1D).
 * Implements Section 7.2 deterministic route selection algorithm.
 */
import type {
  ApiMockRouteV1,
  ApiMockCapturedRequestV1,
  ApiMockServerSettingsV1,
  ApiMockMatchExplanationV1,
  ApiMockTransactionOutcome,
  ApiMockResponseVariantV1,
} from './contracts';
import { evaluateRoute, type RouteEvaluationResult } from './predicateEvaluator';

export interface SelectionResult {
  outcome: ApiMockTransactionOutcome;
  selectedRouteId?: string;
  selectedResponseId?: string;
  explanation: ApiMockMatchExplanationV1;
}

export function selectRoute(
  routes: ApiMockRouteV1[],
  request: ApiMockCapturedRequestV1,
  settings: ApiMockServerSettingsV1,
  basePath: string,
): SelectionResult {
  const evaluations = routes.map(r => evaluateRoute(r, request, basePath));
  const matched = evaluations.filter(e => e.overallMatch);
  const summary = buildNormalizedSummary(request);

  if (matched.length === 0) {
    return buildResult('unmatched', undefined, undefined, evaluations, settings, summary, routes);
  }

  if (matched.length > 1 && settings.selection.multipleMatchPolicy === 'reject_multiple') {
    return buildResult('ambiguous', undefined, undefined, evaluations, settings, summary, routes);
  }

  const highestPriority = Math.max(...matched.map(m => m.priority));
  const atHighest = matched.filter(m => m.priority === highestPriority);

  const routeIndex = buildRouteIndex(routes);

  if (atHighest.length > 1) {
    if (settings.selection.equalPriorityPolicy === 'reject') {
      return buildResult('ambiguous', undefined, undefined, evaluations, settings, summary, routes);
    }
    atHighest.sort((a, b) => {
      const specA = routeIndex.has(a.routeId) ? computeSpecificityFromRoute(routeIndex.get(a.routeId)!, a) : 0;
      const specB = routeIndex.has(b.routeId) ? computeSpecificityFromRoute(routeIndex.get(b.routeId)!, b) : 0;
      const specDiff = specB - specA;
      return specDiff !== 0 ? specDiff : a.routeId.localeCompare(b.routeId);
    });
  }

  const winner = atHighest[0];
  const winnerRoute = routeIndex.get(winner.routeId)!;
  const selectedResponse = selectResponse(winnerRoute);
  return buildResult('matched', winner.routeId, selectedResponse?.id, evaluations, settings, summary, routes);
}

function buildRouteIndex(routes: ApiMockRouteV1[]): Map<string, ApiMockRouteV1> {
  const index = new Map<string, ApiMockRouteV1>();
  for (const route of routes) index.set(route.id, route);
  return index;
}

function selectResponse(route: ApiMockRouteV1): ApiMockResponseVariantV1 | undefined {
  if (route.responseMode !== 'rules') return route.responses[0];
  const enabled = route.responses.filter(r => r.enabled);
  return enabled.find(r => r.isDefault) ?? enabled[0];
}

export function computeSpecificity(evaluation: RouteEvaluationResult, routes: ApiMockRouteV1[]): number {
  const route = routes.find(r => r.id === evaluation.routeId);
  if (!route) return 0;
  return computeSpecificityFromRoute(route, evaluation);
}

function operatorSpecificityWeight(operator: string): number {
  switch (operator) {
    case 'exact': return 8;
    case 'contains': case 'prefix': case 'suffix': return 5;
    case 'present': case 'absent': return 2;
    case 'regex': case 'glob': return 3;
    case 'json_strict': return 10;
    case 'json_subset': return 7;
    case 'jsonPath_exists': case 'jsonPath_equals': return 6;
    default: return 1;
  }
}

function specificityComponents(
  route: ApiMockRouteV1,
  evaluation: RouteEvaluationResult,
): Array<{ source: string; weight: number }> {
  const pathWeight = route.path.kind === 'exact' ? 50
    : route.path.kind === 'parameterized' ? 30
      : route.path.kind === 'glob' ? 15
        : 10;
  const components: Array<{ source: string; weight: number }> = [
    { source: 'method', weight: route.method === 'ANY' ? 1 : 10 },
    { source: 'path', weight: pathWeight },
  ];
  for (const result of evaluation.predicateResults) {
    if (!result.passed) continue;
    components.push({ source: result.source, weight: operatorSpecificityWeight(result.operator) });
  }
  return components;
}

function computeSpecificityFromRoute(route: ApiMockRouteV1, evaluation: RouteEvaluationResult): number {
  return specificityComponents(route, evaluation).reduce((sum, c) => sum + c.weight, 0);
}

function buildNormalizedSummary(request: ApiMockCapturedRequestV1): ApiMockMatchExplanationV1['normalizedRequest'] {
  const decodedPath = safeDecodeURI(request.path);
  return {
    method: request.method,
    path: request.path,
    decodedPath,
    pathSegments: decodedPath.split('/').filter(Boolean),
    query: request.query,
    headerKeys: Object.keys(request.headers).sort(),
    cookieKeys: Object.keys(request.cookies).sort(),
    bodyContentType: request.contentType,
    bodySizeBytes: request.body ? new TextEncoder().encode(request.body).length : 0,
  };
}

function buildResult(
  outcome: ApiMockTransactionOutcome,
  selectedRouteId: string | undefined,
  selectedResponseId: string | undefined,
  evaluations: RouteEvaluationResult[],
  settings: ApiMockServerSettingsV1,
  normalizedRequest: ApiMockMatchExplanationV1['normalizedRequest'],
  routes: ApiMockRouteV1[],
): SelectionResult {
  const matched = evaluations.filter(e => e.overallMatch);
  const highestPriority = matched.length > 0 ? Math.max(...matched.map(m => m.priority)) : 0;
  const atHighest = matched.filter(m => m.priority === highestPriority);
  const tiedAtHighest = atHighest.length;
  const routeIndex = buildRouteIndex(routes);
  const specificityBreakdown = atHighest.length > 1
    ? atHighest.map(m => {
      const route = routeIndex.get(m.routeId);
      const components = route ? specificityComponents(route, m) : [];
      return {
        routeId: m.routeId,
        score: components.reduce((sum, c) => sum + c.weight, 0),
        components,
      };
    }).sort((a, b) => b.score - a.score || a.routeId.localeCompare(b.routeId))
    : undefined;

  const nearMisses = evaluations
    .filter(e => e.enabled && !e.overallMatch && (e.methodMatch || e.pathMatch))
    .map(e => ({
      routeId: e.routeId,
      routeName: e.routeName,
      failedPredicates: e.predicateResults.filter(p => !p.passed).map(p => ({
        predicateId: p.predicateId,
        source: p.source,
        reason: p.reason ?? 'failed',
      })),
      missDistance: e.predicateResults.filter(p => p.passed).length,
    }))
    .sort((a, b) => b.missDistance - a.missDistance);

  const explanation: ApiMockMatchExplanationV1 = {
    normalizedRequest,
    candidates: evaluations.map(e => ({
      routeId: e.routeId,
      routeName: e.routeName,
      priority: e.priority,
      enabled: e.enabled,
      methodMatch: e.methodMatch,
      pathMatch: e.pathMatch,
      predicateResults: e.predicateResults,
      overallMatch: e.overallMatch,
    })),
    policyDecision: {
      policy: settings.selection.multipleMatchPolicy,
      equalPriorityPolicy: settings.selection.equalPriorityPolicy,
      matchedCount: matched.length,
      highestPriority,
      tiedAtHighest,
      outcome,
      selectedRouteId,
      selectedResponseId,
      ...(specificityBreakdown ? { specificityBreakdown } : {}),
    },
    nearMisses,
  };

  return { outcome, selectedRouteId, selectedResponseId, explanation };
}

function safeDecodeURI(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}
