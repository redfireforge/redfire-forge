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
import { isUnavailablePredicateOperator } from './unavailableOperators';
import {
  stripBasePath,
  extractValue,
  evaluateOperator,
  describeFailure,
  combinatorLabel,
  describeGroupOutcome,
  predicateResultLabel,
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

function isKnownCombinator(combinator: string): combinator is 'all' | 'any' | 'not' {
  return combinator === 'all' || combinator === 'any' || combinator === 'not';
}

/** Record None-of always (leaves can all pass while the group fails). Record Any-of / unknown only on failure. */
function shouldRecordGroupResult(combinator: string, passed: boolean): boolean {
  if (combinator === 'not') return true;
  if (combinator === 'any' && !passed) return true;
  return !isKnownCombinator(combinator);
}

function evaluateGroup(
  group: ApiMockPredicateGroupV1,
  request: ApiMockCapturedRequestV1,
  pathParams: Record<string, string>,
  results: ApiMockPredicateResultV1[],
  parentGroupId = '',
): boolean {
  const start = results.length;
  const evalChild = (child: ApiMockPredicateGroupV1['children'][number]) => {
    const before = results.length;
    const matched = 'combinator' in child
      ? evaluateGroup(child, request, pathParams, results, group.id)
      : evaluateSinglePredicate(child, request, pathParams, results, group.id);
    return {
      matched,
      unevaluated: results.slice(before).some(r => r.evaluated === false),
    };
  };

  let passed: boolean;
  switch (group.combinator) {
    case 'all':
      passed = group.children.every(child => evalChild(child).matched);
      break;
    case 'any':
      passed = group.children.some(child => evalChild(child).matched);
      break;
    case 'not': {
      // Fail closed: a stubbed operator must not make "None of" match every request.
      let unevaluated = false;
      const anyMatched = group.children.some(child => {
        const result = evalChild(child);
        if (result.unevaluated) unevaluated = true;
        return result.matched;
      });
      passed = !unevaluated && !anyMatched;
      break;
    }
    default:
      passed = false;
  }

  const childResults = results.slice(start);
  if (group.combinator === 'not' && !passed) {
    for (const child of childResults) {
      if (child.passed && !child.combinator) {
        child.reason = child.reason ?? `${predicateResultLabel(child)} matched — rejected by None of`;
      }
    }
  }

  if (shouldRecordGroupResult(group.combinator, passed)) {
    results.push({
      predicateId: `group:${group.id}`,
      groupId: parentGroupId,
      source: combinatorLabel(group.combinator),
      operator: 'present',
      passed,
      evaluated: true,
      reason: describeGroupOutcome(group.combinator, passed, childResults),
      combinator: isKnownCombinator(group.combinator) ? group.combinator : undefined,
    });
  }

  return passed;
}

function evaluateSinglePredicate(
  pred: ApiMockPredicateV1,
  request: ApiMockCapturedRequestV1,
  pathParams: Record<string, string>,
  results: ApiMockPredicateResultV1[],
  groupId = '',
): boolean {
  if (isUnavailablePredicateOperator(pred.operator)) {
    results.push({
      predicateId: pred.id,
      groupId,
      source: pred.source,
      operator: pred.operator,
      passed: false,
      evaluated: false,
      reason: `Operator "${pred.operator}" is not evaluated yet — this condition never matches`,
      selector: pred.selector,
    });
    return false;
  }

  const value = extractValue(pred, request, pathParams);
  const contentType = request.headers['content-type']?.[0] ?? request.contentType;
  let passed = evaluateOperator(pred.operator, value, pred.expected, pred.options, { contentType });
  if (pred.options?.negate) passed = !passed;

  results.push({
    predicateId: pred.id,
    groupId,
    source: pred.source,
    operator: pred.operator,
    passed,
    evaluated: true,
    reason: passed ? undefined : describeFailure(pred, value),
    selector: pred.selector,
  });
  return passed;
}
