import { describe, expect, it } from 'vitest';
import type { GrpcMockRuleSet } from '../../../shared/grpc/grpcMockRuleContracts';
import {
  computeLoadTestProgressPercent,
  countEnabledMockRules,
  filterGrpcSchemaDiffChangesForUi,
  formatLoadTestProgressLabel,
  parseGrpcMockRuleSetJson,
  presentGrpcAdvancedOperationStatus,
  schemaDiffChangeLineClass,
  schemaDiffSeverityBadgeClass,
  summarizeMockRulePredicate,
} from './grpcStudioAdvancedModel';

const baseRule = {
  id: 'r1',
  name: 'Rule',
  enabled: true,
  priority: 1,
  response: {},
} as const;

function ruleWithPredicate(predicate: GrpcMockRuleSet['rules'][number]['predicate']) {
  return { ...baseRule, predicate };
}

describe('grpcStudioAdvancedModel coverage gaps', () => {
  it('presentGrpcAdvancedOperationStatus covers idle, terminal, and default branches', () => {
    expect(presentGrpcAdvancedOperationStatus('idle', false)).toEqual({ label: 'Idle', variant: 'idle' });
    expect(presentGrpcAdvancedOperationStatus('validating', false)).toEqual({ label: 'Validating…', variant: 'running' });
    expect(presentGrpcAdvancedOperationStatus('completed', false)).toEqual({ label: 'Completed', variant: 'ok' });
    expect(presentGrpcAdvancedOperationStatus('failed', false)).toEqual({ label: 'Failed', variant: 'err' });
    expect(presentGrpcAdvancedOperationStatus('cancelled', false)).toEqual({ label: 'Cancelled', variant: 'warn' });
    expect(presentGrpcAdvancedOperationStatus('unknown' as 'idle', false)).toEqual({ label: 'unknown', variant: 'idle' });
  });

  it('computeLoadTestProgressPercent uses duration and returns undefined without limits', () => {
    const counts = {
      scheduled: 10,
      completed: 5,
      succeeded: 5,
      failed: 0,
      warmupScheduled: 0,
      warmupCompleted: 0,
      peakInFlight: 2,
    };
    expect(computeLoadTestProgressPercent({ concurrency: 2, durationMs: 1000 }, counts, 500)).toBe(50);
    expect(computeLoadTestProgressPercent({ concurrency: 2 }, counts, 500)).toBeUndefined();
  });

  it('formatLoadTestProgressLabel formats totalCalls, duration, and open-ended modes', () => {
    const counts = {
      scheduled: 3,
      completed: 3,
      succeeded: 3,
      failed: 0,
      warmupScheduled: 0,
      warmupCompleted: 0,
      peakInFlight: 1,
    };
    expect(formatLoadTestProgressLabel({ concurrency: 1, totalCalls: 10 }, counts)).toBe('3 / 10 calls');
    expect(formatLoadTestProgressLabel({ concurrency: 1, durationMs: 5000 }, counts)).toBe('3 calls completed');
    expect(formatLoadTestProgressLabel({ concurrency: 1 }, counts)).toBe('3 calls');
  });

  it('filterGrpcSchemaDiffChangesForUi filters by severity', () => {
    const changes = [
      { severity: 'breaking' as const, entityType: 'field' as const, entityPath: 'a', changeType: 'removed' as const, description: 'x' },
      { severity: 'informational' as const, entityType: 'field' as const, entityPath: 'b', changeType: 'added' as const, description: 'y' },
    ];
    const breakingOnly = filterGrpcSchemaDiffChangesForUi(changes, 'breaking');
    expect(breakingOnly.visible).toHaveLength(1);
    expect(breakingOnly.visible[0]?.severity).toBe('breaking');
  });

  it('schemaDiffSeverityBadgeClass and schemaDiffChangeLineClass map known values', () => {
    expect(schemaDiffSeverityBadgeClass('breaking')).toContain('breaking');
    expect(schemaDiffSeverityBadgeClass('non_breaking')).toContain('safe');
    expect(schemaDiffSeverityBadgeClass('informational')).toContain('info');
    expect(schemaDiffSeverityBadgeClass('unknown' as 'breaking')).toContain('info');

    expect(schemaDiffChangeLineClass('added')).toContain('add');
    expect(schemaDiffChangeLineClass('removed')).toContain('rem');
    expect(schemaDiffChangeLineClass('modified')).toContain('mod');
    expect(schemaDiffChangeLineClass('renamed')).toContain('mod');
    expect(schemaDiffChangeLineClass('doc_comment_changed')).toContain('ctx');
  });

  it('parseGrpcMockRuleSetJson rejects malformed payloads and validation issues', () => {
    expect(parseGrpcMockRuleSetJson('not-json').ok).toBe(false);
    expect(parseGrpcMockRuleSetJson('null').ok).toBe(false);
    expect(parseGrpcMockRuleSetJson('{"rules":[]}').ok).toBe(true);
    expect(parseGrpcMockRuleSetJson('{"rules":[{"id":"","name":"","enabled":true,"priority":0,"predicate":{"kind":"method_equals","method":""},"response":{}}]}').ok).toBe(false);
  });

  it('countEnabledMockRules counts only enabled rules', () => {
    expect(countEnabledMockRules({
      rules: [
        { ...baseRule, predicate: { kind: 'method_equals', method: 'Echo' } },
        { ...baseRule, id: 'r2', enabled: false, predicate: { kind: 'method_equals', method: 'Ping' } },
      ],
    })).toBe(1);
  });

  it('summarizeMockRulePredicate formats all predicate kinds', () => {
    expect(summarizeMockRulePredicate(ruleWithPredicate({ kind: 'service_equals', service: 'echo.EchoService' })))
      .toBe('service == "echo.EchoService"');
    expect(summarizeMockRulePredicate(ruleWithPredicate({ kind: 'metadata_equals', key: 'x-auth', value: 'token' })))
      .toMatch(/metadata\.x-auth/);
    expect(summarizeMockRulePredicate(ruleWithPredicate({ kind: 'metadata_exists', key: 'trace' })))
      .toBe('metadata.trace exists');
    expect(summarizeMockRulePredicate(ruleWithPredicate({ kind: 'body_path_equals', path: 'message', value: 'hi' })))
      .toContain('body.message');
    expect(summarizeMockRulePredicate(ruleWithPredicate({ kind: 'body_path_exists', path: 'id' })))
      .toBe('body.id exists');
    expect(summarizeMockRulePredicate(ruleWithPredicate({ kind: 'expression', expression: 'true' })))
      .toBe('true');
    expect(summarizeMockRulePredicate(ruleWithPredicate({
      kind: 'and',
      predicates: [
        { kind: 'method_equals', method: 'Echo' },
        { kind: 'service_equals', service: 'echo.EchoService' },
      ],
    }))).toContain('AND');
    expect(summarizeMockRulePredicate(ruleWithPredicate({
      kind: 'or',
      predicates: [
        { kind: 'method_equals', method: 'Echo' },
        { kind: 'method_equals', method: 'Ping' },
      ],
    }))).toContain(' OR ');
    expect(summarizeMockRulePredicate(ruleWithPredicate({
      kind: 'not',
      predicate: { kind: 'method_equals', method: 'Echo' },
    }))).toContain('NOT');
  });
});
