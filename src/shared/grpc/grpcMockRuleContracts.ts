/**
 * Phase 11D - gRPC mock rule model contracts.
 *
 * Types and validation for deterministic mock rule evaluation.
 * Runtime lifecycle and hot-swap belong to Phase 11E.
 */

import type { GrpcCallType } from './contracts';
import {
  GrpcMockPredicateParseError,
  GrpcMockPredicateSecurityError,
  parseGrpcMockPredicateExpression,
} from './grpcMockPredicateSandbox';

export const GRPC_MOCK_DEFAULT_STATUS_CODE = 12; // UNIMPLEMENTED

export const GRPC_MOCK_DEFAULT_STATUS_MESSAGE = 'No matching mock rule';

export type GrpcMockPredicateKind =
  | 'method_equals'
  | 'service_equals'
  | 'metadata_equals'
  | 'metadata_exists'
  | 'body_path_equals'
  | 'body_path_exists'
  | 'and'
  | 'or'
  | 'not'
  | 'expression';

export interface GrpcMockMethodEqualsPredicate {
  kind: 'method_equals';
  method: string;
}

export interface GrpcMockServiceEqualsPredicate {
  kind: 'service_equals';
  service: string;
}

export interface GrpcMockMetadataEqualsPredicate {
  kind: 'metadata_equals';
  key: string;
  value: string;
}

export interface GrpcMockMetadataExistsPredicate {
  kind: 'metadata_exists';
  key: string;
}

export interface GrpcMockBodyPathEqualsPredicate {
  kind: 'body_path_equals';
  path: string;
  value: string;
}

export interface GrpcMockBodyPathExistsPredicate {
  kind: 'body_path_exists';
  path: string;
}

export interface GrpcMockAndPredicate {
  kind: 'and';
  predicates: GrpcMockPredicate[];
}

export interface GrpcMockOrPredicate {
  kind: 'or';
  predicates: GrpcMockPredicate[];
}

export interface GrpcMockNotPredicate {
  kind: 'not';
  predicate: GrpcMockPredicate;
}

export interface GrpcMockExpressionPredicate {
  kind: 'expression';
  expression: string;
}

export type GrpcMockPredicate =
  | GrpcMockMethodEqualsPredicate
  | GrpcMockServiceEqualsPredicate
  | GrpcMockMetadataEqualsPredicate
  | GrpcMockMetadataExistsPredicate
  | GrpcMockBodyPathEqualsPredicate
  | GrpcMockBodyPathExistsPredicate
  | GrpcMockAndPredicate
  | GrpcMockOrPredicate
  | GrpcMockNotPredicate
  | GrpcMockExpressionPredicate;

export interface GrpcMockRuleResponse {
  statusCode?: number;
  body?: unknown;
  messages?: unknown[];
  latencyMs?: number;
  /** Delay before each subsequent stream message (first message uses resolved unary latency). */
  interMessageDelayMs?: number;
  message?: string;
}

export interface GrpcMockDefaultResponse {
  statusCode?: number;
  body?: unknown;
  message?: string;
}

export interface GrpcMockRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  createdAt?: string;
  fallthrough?: boolean;
  predicate: GrpcMockPredicate;
  response: GrpcMockRuleResponse;
}

export interface GrpcMockRuleSet {
  rules: GrpcMockRule[];
  defaultResponse?: GrpcMockDefaultResponse;
}

export interface GrpcMockEvaluationContext {
  service: string;
  method: string;
  callType: GrpcCallType;
  metadata: Record<string, string>;
  requestBody: unknown;
}

export interface GrpcMockRuleEvaluationResult {
  matched: boolean;
  usedDefault: boolean;
  ruleId?: string;
  ruleName?: string;
  fallthroughChain: string[];
  response: GrpcMockRuleResponse;
}

export interface GrpcMockRuleValidationIssue {
  path: string;
  message: string;
}

export class GrpcMockRuleValidationError extends Error {
  readonly category = 'validation' as const;
  readonly issues: GrpcMockRuleValidationIssue[];

  constructor(issues: GrpcMockRuleValidationIssue[]) {
    super(issues[0]?.message ?? 'Invalid mock rule configuration');
    this.name = 'GrpcMockRuleValidationError';
    this.issues = issues;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validatePredicate(predicate: unknown, path: string): GrpcMockRuleValidationIssue[] {
  if (typeof predicate !== 'object' || predicate === null) {
    return [{ path, message: 'predicate must be an object.' }];
  }

  const record = predicate as Record<string, unknown>;
  const kind = record.kind;
  if (typeof kind !== 'string') {
    return [{ path: `${path}.kind`, message: 'predicate.kind is required.' }];
  }

  switch (kind as GrpcMockPredicateKind) {
    case 'method_equals':
      return isNonEmptyString(record.method)
        ? []
        : [{ path: `${path}.method`, message: 'method is required.' }];
    case 'service_equals':
      return isNonEmptyString(record.service)
        ? []
        : [{ path: `${path}.service`, message: 'service is required.' }];
    case 'metadata_equals':
      if (!isNonEmptyString(record.key)) {
        return [{ path: `${path}.key`, message: 'metadata key is required.' }];
      }
      if (typeof record.value !== 'string') {
        return [{ path: `${path}.value`, message: 'metadata value must be a string.' }];
      }
      return [];
    case 'metadata_exists':
      return isNonEmptyString(record.key)
        ? []
        : [{ path: `${path}.key`, message: 'metadata key is required.' }];
    case 'body_path_equals':
      if (!isNonEmptyString(record.path)) {
        return [{ path: `${path}.path`, message: 'body path is required.' }];
      }
      if (typeof record.value !== 'string') {
        return [{ path: `${path}.value`, message: 'body path value must be a string.' }];
      }
      return [];
    case 'body_path_exists':
      return isNonEmptyString(record.path)
        ? []
        : [{ path: `${path}.path`, message: 'body path is required.' }];
    case 'and':
    case 'or': {
      if (!Array.isArray(record.predicates) || record.predicates.length === 0) {
        return [{ path: `${path}.predicates`, message: 'predicates must be a non-empty array.' }];
      }
      return record.predicates.flatMap((child, index) =>
        validatePredicate(child, `${path}.predicates[${index}]`),
      );
    }
    case 'not':
      return validatePredicate(record.predicate, `${path}.predicate`);
    case 'expression': {
      if (!isNonEmptyString(record.expression)) {
        return [{ path: `${path}.expression`, message: 'expression is required.' }];
      }
      try {
        parseGrpcMockPredicateExpression(record.expression);
        return [];
      } catch (error) {
        if (error instanceof GrpcMockPredicateParseError || error instanceof GrpcMockPredicateSecurityError) {
          return [{ path: `${path}.expression`, message: error.message }];
        }
        return [{ path: `${path}.expression`, message: 'expression failed to parse.' }];
      }
    }
    default:
      return [{ path: `${path}.kind`, message: `unsupported predicate kind: ${kind}` }];
  }
}

export function validateGrpcMockRule(rule: GrpcMockRule, index: number): GrpcMockRuleValidationIssue[] {
  const path = `rules[${index}]`;
  const issues: GrpcMockRuleValidationIssue[] = [];

  if (!isNonEmptyString(rule.id)) {
    issues.push({ path: `${path}.id`, message: 'id is required.' });
  }
  if (!isNonEmptyString(rule.name)) {
    issues.push({ path: `${path}.name`, message: 'name is required.' });
  }
  if (typeof rule.enabled !== 'boolean') {
    issues.push({ path: `${path}.enabled`, message: 'enabled must be a boolean.' });
  }
  if (!Number.isInteger(rule.priority)) {
    issues.push({ path: `${path}.priority`, message: 'priority must be an integer.' });
  }
  if (rule.response == null || typeof rule.response !== 'object') {
    issues.push({ path: `${path}.response`, message: 'response is required.' });
  } else if (
    rule.response.statusCode != null
    && (!Number.isInteger(rule.response.statusCode) || rule.response.statusCode < 0)
  ) {
    issues.push({ path: `${path}.response.statusCode`, message: 'statusCode must be a non-negative integer.' });
  }

  issues.push(...validatePredicate(rule.predicate, `${path}.predicate`));
  return issues;
}

export function validateGrpcMockRuleSet(ruleSet: GrpcMockRuleSet): GrpcMockRuleValidationIssue[] {
  const issues: GrpcMockRuleValidationIssue[] = [];

  if (!Array.isArray(ruleSet.rules)) {
    issues.push({ path: 'rules', message: 'rules must be an array.' });
    return issues;
  }

  const seenIds = new Set<string>();
  for (const [index, rule] of ruleSet.rules.entries()) {
    issues.push(...validateGrpcMockRule(rule, index));
    if (isNonEmptyString(rule.id)) {
      if (seenIds.has(rule.id)) {
        issues.push({ path: `rules[${index}].id`, message: `duplicate rule id: ${rule.id}` });
      }
      seenIds.add(rule.id);
    }
  }

  if (
    ruleSet.defaultResponse?.statusCode != null
    && (!Number.isInteger(ruleSet.defaultResponse.statusCode) || ruleSet.defaultResponse.statusCode < 0)
  ) {
    issues.push({
      path: 'defaultResponse.statusCode',
      message: 'defaultResponse.statusCode must be a non-negative integer.',
    });
  }

  return issues;
}

export function assertGrpcMockRuleSet(ruleSet: GrpcMockRuleSet): void {
  const issues = validateGrpcMockRuleSet(ruleSet);
  if (issues.length > 0) {
    throw new GrpcMockRuleValidationError(issues);
  }
}

export function createDefaultGrpcMockResponse(): GrpcMockRuleResponse {
  return {
    statusCode: GRPC_MOCK_DEFAULT_STATUS_CODE,
    message: GRPC_MOCK_DEFAULT_STATUS_MESSAGE,
  };
}
