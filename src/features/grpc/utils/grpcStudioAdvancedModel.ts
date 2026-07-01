import type { GrpcAdvancedOperationStatus } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import type { GrpcLoadTestRunCounts } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import type { GrpcLoadTestConfig } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import type { GrpcSchemaDiffChange, GrpcSchemaDiffSeverity } from '../../../shared/grpc/grpcSchemaDiffContracts';
import type { GrpcMockRuleSet } from '../../../shared/grpc/grpcMockRuleContracts';
import { validateGrpcMockRuleSet } from '../../../shared/grpc/grpcMockRuleContracts';
import {
  GRPC_SCHEMA_DIFF_UI_LIST_CAP,
  type GrpcSchemaDiffSeverityFilter,
} from '../grpcStudioAdvancedTypes';

export interface GrpcAdvancedOperationStatusPresentation {
  label: string;
  variant: 'idle' | 'running' | 'ok' | 'warn' | 'err';
}

export function presentGrpcAdvancedOperationStatus(
  status: GrpcAdvancedOperationStatus,
  cancellationRequested: boolean,
): GrpcAdvancedOperationStatusPresentation {
  if (cancellationRequested && (status === 'running' || status === 'validating')) {
    return { label: 'Cancelling…', variant: 'warn' };
  }
  switch (status) {
    case 'idle':
      return { label: 'Idle', variant: 'idle' };
    case 'validating':
      return { label: 'Validating…', variant: 'running' };
    case 'running':
      return { label: 'Running', variant: 'running' };
    case 'completed':
      return { label: 'Completed', variant: 'ok' };
    case 'failed':
      return { label: 'Failed', variant: 'err' };
    case 'cancelled':
      return { label: 'Cancelled', variant: 'warn' };
    default:
      return { label: status, variant: 'idle' };
  }
}

export function computeLoadTestProgressPercent(
  config: GrpcLoadTestConfig,
  counts: GrpcLoadTestRunCounts,
  elapsedMs: number,
): number | undefined {
  if (config.totalCalls != null && config.totalCalls > 0) {
    return Math.min(100, Math.round((counts.completed / config.totalCalls) * 100));
  }
  if (config.durationMs != null && config.durationMs > 0) {
    return Math.min(100, Math.round((elapsedMs / config.durationMs) * 100));
  }
  return undefined;
}

export function formatLoadTestProgressLabel(
  config: GrpcLoadTestConfig,
  counts: GrpcLoadTestRunCounts,
): string {
  if (config.totalCalls != null) {
    return `${counts.completed} / ${config.totalCalls} calls`;
  }
  if (config.durationMs != null) {
    return `${counts.completed} calls completed`;
  }
  return `${counts.completed} calls`;
}

export function filterGrpcSchemaDiffChangesForUi(
  changes: GrpcSchemaDiffChange[],
  filter: GrpcSchemaDiffSeverityFilter,
  cap: number = GRPC_SCHEMA_DIFF_UI_LIST_CAP,
): { visible: GrpcSchemaDiffChange[]; total: number; truncated: boolean } {
  const filtered = filter === 'all'
    ? changes
    : changes.filter((change) => change.severity === filter);
  const truncated = filtered.length > cap;
  return {
    visible: truncated ? filtered.slice(0, cap) : filtered,
    total: filtered.length,
    truncated,
  };
}

export function schemaDiffSeverityBadgeClass(severity: GrpcSchemaDiffSeverity): string {
  switch (severity) {
    case 'breaking':
      return 'grpc-advanced-diff-badge--breaking';
    case 'non_breaking':
      return 'grpc-advanced-diff-badge--safe';
    case 'informational':
      return 'grpc-advanced-diff-badge--info';
    default:
      return 'grpc-advanced-diff-badge--info';
  }
}

export function schemaDiffChangeLineClass(changeType: string): string {
  switch (changeType) {
    case 'added':
      return 'grpc-advanced-diff-line--add';
    case 'removed':
      return 'grpc-advanced-diff-line--rem';
    case 'modified':
    case 'renamed':
      return 'grpc-advanced-diff-line--mod';
    default:
      return 'grpc-advanced-diff-line--ctx';
  }
}

export type GrpcMockRuleSetParseResult =
  | { ok: true; ruleSet: GrpcMockRuleSet }
  | { ok: false; error: string };

export function parseGrpcMockRuleSetJson(json: string): GrpcMockRuleSetParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
  if (parsed == null || typeof parsed !== 'object' || !('rules' in parsed)) {
    return { ok: false, error: 'Expected object with a rules array' };
  }
  const ruleSet = parsed as GrpcMockRuleSet;
  const issues = validateGrpcMockRuleSet(ruleSet);
  if (issues.length > 0) {
    return {
      ok: false,
      error: issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
    };
  }
  return { ok: true, ruleSet: structuredClone(ruleSet) };
}

export function countEnabledMockRules(ruleSet: GrpcMockRuleSet): number {
  return ruleSet.rules.filter((rule) => rule.enabled).length;
}

export function summarizeMockRulePredicate(rule: GrpcMockRuleSet['rules'][number]): string {
  const predicate = rule.predicate;
  switch (predicate.kind) {
    case 'method_equals':
      return `method == "${predicate.method}"`;
    case 'service_equals':
      return `service == "${predicate.service}"`;
    case 'metadata_equals':
      return `metadata.${predicate.key} == "${predicate.value}"`;
    case 'metadata_exists':
      return `metadata.${predicate.key} exists`;
    case 'body_path_equals':
      return `body.${predicate.path} == ${JSON.stringify(predicate.value)}`;
    case 'body_path_exists':
      return `body.${predicate.path} exists`;
    case 'expression':
      return predicate.expression;
    case 'and':
      return `(${predicate.predicates.map((entry) => summarizeMockRulePredicate({ ...rule, predicate: entry })).join(' AND ')})`;
    case 'or':
      return `(${predicate.predicates.map((entry) => summarizeMockRulePredicate({ ...rule, predicate: entry })).join(' OR ')})`;
    case 'not':
      return `NOT (${summarizeMockRulePredicate({ ...rule, predicate: predicate.predicate })})`;
    default: {
      const _exhaustive: never = predicate;
      return String((_exhaustive as { kind: string }).kind);
    }
  }
}
