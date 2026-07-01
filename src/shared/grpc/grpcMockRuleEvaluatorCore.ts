/**
 * Phase 11D - Mock rule evaluator core.
 *
 * Deterministic ordering, fallthrough chains, and default response path.
 * Runtime lifecycle and hot-swap belong to Phase 11E.
 */

import {
  assertGrpcMockRuleSet,
  GRPC_MOCK_DEFAULT_STATUS_CODE,
  GRPC_MOCK_DEFAULT_STATUS_MESSAGE,
  type GrpcMockDefaultResponse,
  type GrpcMockEvaluationContext,
  type GrpcMockRule,
  type GrpcMockRuleEvaluationResult,
  type GrpcMockRuleResponse,
  type GrpcMockRuleSet,
} from './grpcMockRuleContracts';
import { evaluateGrpcMockPredicate } from './grpcMockPredicateSandbox';

export interface GrpcMockRuleSortEntry {
  rule: GrpcMockRule;
  index: number;
}

export function compareGrpcMockRules(left: GrpcMockRuleSortEntry, right: GrpcMockRuleSortEntry): number {
  if (left.rule.priority !== right.rule.priority) {
    return left.rule.priority - right.rule.priority;
  }

  const leftCreated = left.rule.createdAt ?? '';
  const rightCreated = right.rule.createdAt ?? '';
  if (leftCreated !== rightCreated) {
    return leftCreated.localeCompare(rightCreated);
  }

  return left.index - right.index;
}

export function sortGrpcMockRules(rules: GrpcMockRule[]): GrpcMockRuleSortEntry[] {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort(compareGrpcMockRules);
}

function resolveDefaultResponse(defaultResponse?: GrpcMockDefaultResponse): GrpcMockRuleResponse {
  return cloneRuleResponse({
    statusCode: defaultResponse?.statusCode ?? GRPC_MOCK_DEFAULT_STATUS_CODE,
    message: defaultResponse?.message ?? GRPC_MOCK_DEFAULT_STATUS_MESSAGE,
    ...(defaultResponse?.body !== undefined ? { body: defaultResponse.body } : {}),
  });
}

function cloneRuleResponse(response: GrpcMockRuleResponse): GrpcMockRuleResponse {
  return structuredClone(response);
}

export function evaluateGrpcMockRuleSet(
  ruleSet: GrpcMockRuleSet,
  context: GrpcMockEvaluationContext,
): GrpcMockRuleEvaluationResult {
  assertGrpcMockRuleSet(ruleSet);

  const ordered = sortGrpcMockRules(ruleSet.rules);
  let fallthroughCandidate: { rule: GrpcMockRule; response: GrpcMockRuleResponse } | undefined;
  const fallthroughChain: string[] = [];

  for (const entry of ordered) {
    const rule = entry.rule;
    if (!rule.enabled) {
      continue;
    }

    if (!evaluateGrpcMockPredicate(rule.predicate, context)) {
      continue;
    }

    const response = cloneRuleResponse(rule.response);
    if (rule.fallthrough) {
      fallthroughCandidate = { rule, response };
      fallthroughChain.push(rule.id);
      continue;
    }

    return {
      matched: true,
      usedDefault: false,
      ruleId: rule.id,
      ruleName: rule.name,
      fallthroughChain,
      response,
    };
  }

  if (fallthroughCandidate) {
    return {
      matched: true,
      usedDefault: false,
      ruleId: fallthroughCandidate.rule.id,
      ruleName: fallthroughCandidate.rule.name,
      fallthroughChain,
      response: fallthroughCandidate.response,
    };
  }

  return {
    matched: false,
    usedDefault: true,
    fallthroughChain: [],
    response: resolveDefaultResponse(ruleSet.defaultResponse),
  };
}

export function evaluateGrpcMockRules(
  rules: GrpcMockRule[],
  context: GrpcMockEvaluationContext,
  defaultResponse?: GrpcMockDefaultResponse,
): GrpcMockRuleEvaluationResult {
  return evaluateGrpcMockRuleSet({ rules, defaultResponse }, context);
}

export function createGrpcMockNoMatchResult(
  defaultResponse?: GrpcMockDefaultResponse,
): GrpcMockRuleEvaluationResult {
  return {
    matched: false,
    usedDefault: true,
    fallthroughChain: [],
    response: resolveDefaultResponse(defaultResponse),
  };
}
