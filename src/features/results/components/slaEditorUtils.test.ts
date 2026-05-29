/**
 * Unit tests for slaEditorUtils: buildSlaTargetScopeLabel and validateRow.
 */
import { describe, it, expect } from 'vitest';
import { buildSlaTargetScopeLabel, validateRow, METRIC_OPTIONS } from './slaEditorUtils';
import type { SlaTarget } from '../utils/slaTargets';

function makeTarget(overrides?: Partial<SlaTarget>): SlaTarget {
  return { id: 't1', metric: 'p95', operator: 'lte', value: 500, ...overrides };
}

// ── buildSlaTargetScopeLabel ──

describe('buildSlaTargetScopeLabel', () => {
  it('returns Aggregate when no scope fields set', () => {
    expect(buildSlaTargetScopeLabel(makeTarget())).toBe('Aggregate');
  });

  it('returns Test: <name> when scenarioName is set', () => {
    expect(buildSlaTargetScopeLabel(makeTarget({ scenarioName: 'Get Users' }))).toBe('Test: Get Users');
  });

  it('returns FG: <name> when featureGroupName is set', () => {
    expect(buildSlaTargetScopeLabel(makeTarget({ featureGroupName: 'Auth' }))).toBe('FG: Auth');
  });

  it('prefers featureGroupName over scenarioName when both set', () => {
    expect(
      buildSlaTargetScopeLabel(makeTarget({ featureGroupName: 'Auth', scenarioName: 'Login' })),
    ).toBe('FG: Auth');
  });
});

// ── METRIC_OPTIONS ──

describe('METRIC_OPTIONS', () => {
  it('contains expected metrics', () => {
    expect(METRIC_OPTIONS).toContain('p95');
    expect(METRIC_OPTIONS).toContain('tps');
    expect(METRIC_OPTIONS).toContain('errorRate');
  });
});

// ── validateRow ──

describe('validateRow', () => {
  it('returns no errors for a valid lte row', () => {
    expect(validateRow(makeTarget({ value: 500 }))).toEqual({});
  });

  it('returns value error for negative value', () => {
    const err = validateRow(makeTarget({ value: -1 }));
    expect(err.value).toBe('Must be a non-negative number');
  });

  it('returns value error for NaN value', () => {
    const err = validateRow(makeTarget({ value: NaN }));
    expect(err.value).toBe('Must be a non-negative number');
  });

  it('returns no error when warnAt is undefined', () => {
    expect(validateRow(makeTarget({ warnAt: undefined }))).toEqual({});
  });

  it('returns warnAt error for negative warnAt', () => {
    const err = validateRow(makeTarget({ warnAt: -1 }));
    expect(err.warnAt).toBe('Must be a non-negative number');
  });

  it('returns warnAt error for NaN warnAt', () => {
    const err = validateRow(makeTarget({ warnAt: NaN }));
    expect(err.warnAt).toBe('Must be a non-negative number');
  });

  it('returns warnAt error when lte warnAt >= value', () => {
    const err = validateRow(makeTarget({ operator: 'lte', value: 500, warnAt: 500 }));
    expect(err.warnAt).toBe('Must be less than 500 (fail threshold)');
  });

  it('returns warnAt error when lte warnAt > value', () => {
    const err = validateRow(makeTarget({ operator: 'lte', value: 500, warnAt: 600 }));
    expect(err.warnAt).toBe('Must be less than 500 (fail threshold)');
  });

  it('returns no error when lte warnAt < value', () => {
    const err = validateRow(makeTarget({ operator: 'lte', value: 500, warnAt: 400 }));
    expect(err.warnAt).toBeUndefined();
  });

  it('returns warnAt error when gte warnAt <= value', () => {
    const err = validateRow(makeTarget({ operator: 'gte', value: 100, warnAt: 100 }));
    expect(err.warnAt).toBe('Must be greater than 100 (fail threshold)');
  });

  it('returns warnAt error when gte warnAt < value', () => {
    const err = validateRow(makeTarget({ operator: 'gte', value: 100, warnAt: 50 }));
    expect(err.warnAt).toBe('Must be greater than 100 (fail threshold)');
  });

  it('returns no error when gte warnAt > value', () => {
    const err = validateRow(makeTarget({ operator: 'gte', value: 100, warnAt: 150 }));
    expect(err.warnAt).toBeUndefined();
  });

  it('returns both value and warnAt errors simultaneously', () => {
    const err = validateRow(makeTarget({ value: -1, warnAt: -1 }));
    expect(err.value).toBeTruthy();
    expect(err.warnAt).toBeTruthy();
  });
});
