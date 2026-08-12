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
    return buildResult('unmatched', undefined, undefined, evaluations, settings, summary);
  }

  if (matched.length > 1 && settings.selection.multipleMatchPolicy === 'reject_multiple') {
    return buildResult('ambiguous', undefined, undefined, evaluations, settings, summary);
  }

  const highestPriority = Math.max(...matched.map(m => m.priority));
  const atHighest = matched.filter(m => m.priority === highestPriority);

  const routeIndex = buildRouteIndex(routes);

  if (atHighest.length > 1) {
    if (settings.selection.equalPriorityPolicy === 'reject') {
      return buildResult('ambiguous', undefined, undefined, evaluations, settings, summary);
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
  return buildResult('matched', winner.routeId, selectedResponse?.id, evaluations, settings, summary);
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

function computeSpecificityFromRoute(route: ApiMockRouteV1, evaluation: RouteEvaluationResult): number {
  let score = 0;
  score += route.method === 'ANY' ? 1 : 10;
  switch (route.path.kind) {
    case 'exact': score += 50; break;
    case 'parameterized': score += 30; break;
    case 'glob': score += 15; break;
    case 'regex': score += 10; break;
  }
  for (const result of evaluation.predicateResults) {
    if (!result.passed) continue;
    switch (result.operator) {
      case 'exact': score += 8; break;
      case 'contains': case 'prefix': case 'suffix': score += 5; break;
      case 'present': case 'absent': score += 2; break;
      case 'regex': case 'glob': score += 3; break;
      case 'json_strict': score += 10; break;
      case 'json_subset': score += 7; break;
      case 'jsonPath_exists': case 'jsonPath_equals': score += 6; break;
      default: score += 1; break;
    }
  }
  return score;
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
): SelectionResult {
  const matched = evaluations.filter(e => e.overallMatch);
  const highestPriority = matched.length > 0 ? Math.max(...matched.map(m => m.priority)) : 0;
  const tiedAtHighest = matched.filter(m => m.priority === highestPriority).length;

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
    },
    nearMisses,
  };

  return { outcome, selectedRouteId, selectedResponseId, explanation };
}

function safeDecodeURI(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}
