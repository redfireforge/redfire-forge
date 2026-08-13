/**
 * API Mock Studio — predicate tree evaluator (Phase 1C).
 * Pure functions: no side effects, no network, no storage.
 */
import type {
  ApiMockPredicateGroupV1,
  ApiMockPredicateV1,
  ApiMockCapturedRequestV1,
  ApiMockPredicateResultV1,
  ApiMockRouteV1,
  ApiMockMethod,
} from './contracts';
import { matchPath } from './pathMatcher';
import {
  stripBasePath,
  extractValue,
  evaluateOperator,
  describeFailure,
} from './predicateEvaluatorHelpers';

export interface RouteEvaluationResult {
  routeId: string;
  routeName: string;
  priority: number;
  enabled: boolean;
  methodMatch: boolean;
  pathMatch: boolean;
  pathParams: Record<string, string>;
  predicateResults: ApiMockPredicateResultV1[];
  overallMatch: boolean;
}

export function evaluateRoute(route: ApiMockRouteV1, request: ApiMockCapturedRequestV1, basePath: string): RouteEvaluationResult {
  const methodMatch = matchMethod(route.method, request.method);
  const fullPath = stripBasePath(request.path, basePath);
  const pathResult = matchPath(route.path, fullPath);
  const predicateResults: ApiMockPredicateResultV1[] = [];
  const predicatesMatch = methodMatch && pathResult.matched
    ? evaluateGroup(route.predicates, request, pathResult.params, predicateResults)
    : false;

  return {
    routeId: route.id,
    routeName: route.name,
    priority: route.priority,
    enabled: route.enabled,
    methodMatch,
    pathMatch: pathResult.matched,
    pathParams: pathResult.params,
    predicateResults,
    overallMatch: route.enabled && methodMatch && pathResult.matched && predicatesMatch,
  };
}

function matchMethod(routeMethod: ApiMockMethod, requestMethod: string): boolean {
  if (routeMethod === 'ANY') return true;
  return routeMethod === requestMethod.toUpperCase();
}

/** Evaluate a predicate group against a captured request (used for variant conditions). */
export function evaluatePredicateGroup(
  group: ApiMockPredicateGroupV1,
  request: ApiMockCapturedRequestV1,
  pathParams: Record<string, string> = {},
): boolean {
  return evaluateGroup(group, request, pathParams, []);
}

function evaluateGroup(
  group: ApiMockPredicateGroupV1,
  request: ApiMockCapturedRequestV1,
  pathParams: Record<string, string>,
  results: ApiMockPredicateResultV1[],
): boolean {
  switch (group.combinator) {
    case 'all':
      return group.children.every(child =>
        'combinator' in child
          ? evaluateGroup(child, request, pathParams, results)
          : evaluateSinglePredicate(child, request, pathParams, results),
      );
    case 'any':
      return group.children.some(child =>
        'combinator' in child
          ? evaluateGroup(child, request, pathParams, results)
          : evaluateSinglePredicate(child, request, pathParams, results),
      );
    case 'not':
      return !group.children.some(child =>
        'combinator' in child
          ? evaluateGroup(child, request, pathParams, results)
          : evaluateSinglePredicate(child, request, pathParams, results),
      );
    default:
      return false;
  }
}

function evaluateSinglePredicate(
  pred: ApiMockPredicateV1,
  request: ApiMockCapturedRequestV1,
  pathParams: Record<string, string>,
  results: ApiMockPredicateResultV1[],
): boolean {
  const value = extractValue(pred, request, pathParams);
  let passed = evaluateOperator(pred.operator, value, pred.expected, pred.options);
  if (pred.options?.negate) passed = !passed;

  results.push({
    predicateId: pred.id,
    groupId: '',
    source: pred.source,
    operator: pred.operator,
    passed,
    evaluated: true,
    reason: passed ? undefined : describeFailure(pred, value),
  });
  return passed;
}
