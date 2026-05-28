/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  loadSlaTargetFile,
  evaluateCliSla,
  overallSlaStatus,
  printSlaReport,
  type SlaCheckResult,
} from './slaEval';
import { makeResult, makeSummary } from '../src/test-utils/factories';
import type { SlaTarget } from '../src/shared/types';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTarget(overrides: Partial<SlaTarget> = {}): SlaTarget {
  return {
    id: 'sla-1',
    metric: 'p95',
    operator: 'lte',
    value: 500,
    ...overrides,
  };
}

// ── loadSlaTargetFile ─────────────────────────────────────────────────────

describe('loadSlaTargetFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a valid array of SLA targets', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify([
      { id: 'sla-1', metric: 'p95', operator: 'lte', value: 500 },
    ]));

    const result = loadSlaTargetFile('/fake/sla.json');
    expect(result).toHaveLength(1);
    expect(result[0].metric).toBe('p95');
    expect(result[0].value).toBe(500);
  });

  it('auto-assigns id when missing', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify([
      { metric: 'p95', operator: 'lte', value: 500 },
    ]));

    const result = loadSlaTargetFile('/fake/sla.json');
    expect(result[0].id).toBe('sla-cli-0');
  });

  it('throws when file cannot be read', () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT: no such file'); });

    expect(() => loadSlaTargetFile('/nonexistent.json')).toThrow('Cannot read SLA config file');
  });

  it('throws when content is not valid JSON', () => {
    mockReadFileSync.mockReturnValue('{ invalid json ]');

    expect(() => loadSlaTargetFile('/bad.json')).toThrow('is not valid JSON');
  });

  it('throws when content is not an array', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ metric: 'p95' }));

    expect(() => loadSlaTargetFile('/obj.json')).toThrow('must be a JSON array');
  });

  it('throws when a target is missing required fields', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify([
      { id: 'sla-1', metric: 'p95' }, // missing operator and value
    ]));

    expect(() => loadSlaTargetFile('/incomplete.json')).toThrow('missing required fields');
  });

  it('preserves existing id when provided', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify([
      { id: 'my-custom-id', metric: 'p95', operator: 'lte', value: 500 },
    ]));

    const result = loadSlaTargetFile('/fake/sla.json');
    expect(result[0].id).toBe('my-custom-id');
  });
});

// ── evaluateCliSla — aggregate ────────────────────────────────────────────

describe('evaluateCliSla — aggregate targets', () => {
  const summary = makeSummary({
    p95ResponseTime: 450,
    p99ResponseTime: 800,
    tps: 120,
    errorRate: 2.5,
  });

  it('passes when metric is within threshold (lte)', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'p95', operator: 'lte', value: 500 })],
    );
    expect(checks[0].status).toBe('pass');
    expect(checks[0].actual).toBe(450);
  });

  it('fails when metric exceeds threshold (lte)', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'p99', operator: 'lte', value: 700 })],
    );
    expect(checks[0].status).toBe('fail');
    expect(checks[0].actual).toBe(800);
  });

  it('warns when metric is in warn zone (lte)', () => {
    // actual=450, warnAt=400, value=500 → 400 < 450 <= 500 → warn
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'p95', operator: 'lte', value: 500, warnAt: 400 })],
    );
    expect(checks[0].status).toBe('warn');
  });

  it('passes when actual is at exact threshold (lte boundary)', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'p95', operator: 'lte', value: 450 })], // actual == value
    );
    expect(checks[0].status).toBe('pass');
  });

  it('passes when metric exceeds min threshold (gte)', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'tps', operator: 'gte', value: 100 })],
    );
    expect(checks[0].status).toBe('pass');
    expect(checks[0].actual).toBe(120);
  });

  it('fails when metric is below min threshold (gte)', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'tps', operator: 'gte', value: 150 })],
    );
    expect(checks[0].status).toBe('fail');
  });

  it('warns when metric is in warn zone (gte)', () => {
    // actual=120tps, value=100(min), warnAt=140 → 100 <= 120 < 140 → warn
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'tps', operator: 'gte', value: 100, warnAt: 140 })],
    );
    expect(checks[0].status).toBe('warn');
  });

  it('uses label from target when provided', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ label: 'My Custom Label' })],
    );
    expect(checks[0].label).toContain('My Custom Label');
    expect(checks[0].label).toContain('[aggregate]');
  });

  it('derives label from metric when no label provided', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'p95', label: undefined })],
    );
    expect(checks[0].label).toContain('P95');
    expect(checks[0].label).toContain('[aggregate]');
  });

  it('includes threshold string in result', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'p95', operator: 'lte', value: 500 })],
    );
    expect(checks[0].threshold).toBe('<= 500ms');
  });

  it('includes warn zone in threshold string', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'p95', operator: 'lte', value: 500, warnAt: 400 })],
    );
    expect(checks[0].threshold).toContain('400ms');
    expect(checks[0].threshold).toContain('warn');
  });

  it('returns no-data when p999 is missing from summary', () => {
    const summaryNoP999 = makeSummary({ p999ResponseTime: undefined });
    const checks = evaluateCliSla(
      summaryNoP999,
      [],
      [makeTarget({ metric: 'p999', operator: 'lte', value: 1000 })],
    );
    expect(checks[0].status).toBe('no-data');
    expect(checks[0].actual).toBeNull();
  });

  it('evaluates multiple targets and returns one check per target', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [
        makeTarget({ id: 'sla-1', metric: 'p95', operator: 'lte', value: 500 }),
        makeTarget({ id: 'sla-2', metric: 'tps', operator: 'gte', value: 200 }), // will fail
      ],
    );
    expect(checks).toHaveLength(2);
    expect(checks[0].status).toBe('pass');
    expect(checks[1].status).toBe('fail');
  });

  it('evaluates errorRate metric correctly', () => {
    const checks = evaluateCliSla(
      summary,
      [],
      [makeTarget({ metric: 'errorRate', operator: 'lte', value: 5 })],
    );
    expect(checks[0].status).toBe('pass');
    expect(checks[0].actual).toBe(2.5);
  });

  it('evaluates p50 metric correctly', () => {
    const summaryWithP50 = makeSummary({ p50ResponseTime: 200 });
    const checks = evaluateCliSla(
      summaryWithP50,
      [],
      [makeTarget({ metric: 'p50', operator: 'lte', value: 300 })],
    );
    expect(checks[0].status).toBe('pass');
    expect(checks[0].actual).toBe(200);
  });

  it('evaluates p999 metric when present', () => {
    const summaryWithP999 = makeSummary({ p999ResponseTime: 900 });
    const checks = evaluateCliSla(
      summaryWithP999,
      [],
      [makeTarget({ metric: 'p999', operator: 'lte', value: 1000 })],
    );
    expect(checks[0].status).toBe('pass');
    expect(checks[0].actual).toBe(900);
  });

  it('evaluates avg metric correctly', () => {
    const summaryWithAvg = makeSummary({ avgResponseTime: 350 });
    const checks = evaluateCliSla(
      summaryWithAvg,
      [],
      [makeTarget({ metric: 'avg', operator: 'lte', value: 400 })],
    );
    expect(checks[0].status).toBe('pass');
    expect(checks[0].actual).toBe(350);
  });
});

// ── evaluateCliSla — scenario-scoped ──────────────────────────────────────

describe('evaluateCliSla — scenario-scoped targets', () => {
  const t0 = 1000000;
  const results = [
    makeResult({ scenarioName: 'Login', responseTimeMs: 100, timestamp: t0, passed: true }),
    makeResult({ scenarioName: 'Login', responseTimeMs: 200, timestamp: t0 + 50, passed: true }),
    makeResult({ scenarioName: 'Login', responseTimeMs: 300, timestamp: t0 + 100, passed: false }),
    makeResult({ scenarioName: 'Search', responseTimeMs: 800, timestamp: t0, passed: true }),
    makeResult({ scenarioName: 'Search', responseTimeMs: 900, timestamp: t0 + 100, passed: true }),
  ];

  const summary = makeSummary();

  it('evaluates scenario-scoped target against grouped results', () => {
    const checks = evaluateCliSla(
      summary,
      results,
      [makeTarget({ metric: 'p95', operator: 'lte', value: 500, scenarioName: 'Login' })],
    );
    expect(checks[0].status).toBe('pass');
    expect(checks[0].label).toContain('[Login]');
  });

  it('fails scenario-scoped target when metrics exceed threshold', () => {
    const checks = evaluateCliSla(
      summary,
      results,
      [makeTarget({ metric: 'p99', operator: 'lte', value: 250, scenarioName: 'Search' })],
    );
    expect(checks[0].status).toBe('fail');
  });

  it('returns no-data when scenario name has no matching results', () => {
    const checks = evaluateCliSla(
      summary,
      results,
      [makeTarget({ metric: 'p95', operator: 'lte', value: 500, scenarioName: 'NonExistent' })],
    );
    expect(checks[0].status).toBe('no-data');
    expect(checks[0].actual).toBeNull();
  });

  it('computes errorRate correctly for scenario', () => {
    // Login has 3 results, 1 failed → errorRate = 33.33%
    const checks = evaluateCliSla(
      summary,
      results,
      [makeTarget({ metric: 'errorRate', operator: 'lte', value: 10, scenarioName: 'Login' })],
    );
    expect(checks[0].status).toBe('fail');
    expect(checks[0].actual).toBeCloseTo(33.33, 1);
  });

  it('does not mix results between scenarios', () => {
    // Login p95 should not include Search results
    const checks = evaluateCliSla(
      summary,
      results,
      [makeTarget({ metric: 'p95', operator: 'lte', value: 400, scenarioName: 'Login' })],
    );
    // Login max is 300ms so p95 should be 300ms, passing <= 400
    expect(checks[0].status).toBe('pass');
  });
});

// ── evaluateCliSla — feature-group-scoped ─────────────────────────────────

describe('evaluateCliSla — feature-group-scoped targets', () => {
  const t0 = 1000000;
  const results = [
    makeResult({ featureGroupName: 'Auth', responseTimeMs: 100, timestamp: t0, passed: true }),
    makeResult({ featureGroupName: 'Auth', responseTimeMs: 200, timestamp: t0 + 100, passed: true }),
    makeResult({ featureGroupName: 'Catalog', responseTimeMs: 900, timestamp: t0, passed: true }),
  ];

  const summary = makeSummary();

  it('evaluates feature-group-scoped target against grouped results', () => {
    const checks = evaluateCliSla(
      summary,
      results,
      [makeTarget({ metric: 'p50', operator: 'lte', value: 300, featureGroupName: 'Auth' })],
    );
    expect(checks[0].status).toBe('pass');
    expect(checks[0].label).toContain('[FG: Auth]');
  });

  it('fails feature-group-scoped target when metrics exceed threshold', () => {
    const checks = evaluateCliSla(
      summary,
      results,
      [makeTarget({ metric: 'p99', operator: 'lte', value: 500, featureGroupName: 'Catalog' })],
    );
    expect(checks[0].status).toBe('fail');
  });

  it('returns no-data when feature group has no matching results', () => {
    const checks = evaluateCliSla(
      summary,
      results,
      [makeTarget({ metric: 'p95', operator: 'lte', value: 500, featureGroupName: 'Unknown' })],
    );
    expect(checks[0].status).toBe('no-data');
  });
});

// ── overallSlaStatus ──────────────────────────────────────────────────────

describe('overallSlaStatus', () => {
  it('returns null for empty checks', () => {
    expect(overallSlaStatus([])).toBeNull();
  });

  it('returns pass when all checks pass', () => {
    const checks: SlaCheckResult[] = [
      { label: 'a', metric: 'p95', actual: 100, threshold: '<= 500ms', status: 'pass' },
      { label: 'b', metric: 'tps', actual: 200, threshold: '>= 100req/s', status: 'pass' },
    ];
    expect(overallSlaStatus(checks)).toBe('pass');
  });

  it('returns fail when any check fails', () => {
    const checks: SlaCheckResult[] = [
      { label: 'a', metric: 'p95', actual: 100, threshold: '<= 500ms', status: 'pass' },
      { label: 'b', metric: 'p99', actual: 900, threshold: '<= 500ms', status: 'fail' },
    ];
    expect(overallSlaStatus(checks)).toBe('fail');
  });

  it('fail takes priority over warn', () => {
    const checks: SlaCheckResult[] = [
      { label: 'a', metric: 'p95', actual: 450, threshold: '<= 500ms', status: 'warn' },
      { label: 'b', metric: 'p99', actual: 900, threshold: '<= 500ms', status: 'fail' },
    ];
    expect(overallSlaStatus(checks)).toBe('fail');
  });

  it('returns warn when only warn and pass', () => {
    const checks: SlaCheckResult[] = [
      { label: 'a', metric: 'p95', actual: 450, threshold: '<= 500ms', status: 'warn' },
      { label: 'b', metric: 'tps', actual: 200, threshold: '>= 100req/s', status: 'pass' },
    ];
    expect(overallSlaStatus(checks)).toBe('warn');
  });

  it('returns no-data when only no-data and pass', () => {
    const checks: SlaCheckResult[] = [
      { label: 'a', metric: 'p95', actual: null, threshold: '<= 500ms', status: 'no-data' },
      { label: 'b', metric: 'tps', actual: 200, threshold: '>= 100req/s', status: 'pass' },
    ];
    expect(overallSlaStatus(checks)).toBe('no-data');
  });

  it('warn takes priority over no-data', () => {
    const checks: SlaCheckResult[] = [
      { label: 'a', metric: 'p95', actual: null, threshold: '<= 500ms', status: 'no-data' },
      { label: 'b', metric: 'p95', actual: 450, threshold: '<= 500ms', status: 'warn' },
    ];
    expect(overallSlaStatus(checks)).toBe('warn');
  });
});

// ── printSlaReport ────────────────────────────────────────────────────────

describe('printSlaReport', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  const passChecks: SlaCheckResult[] = [
    { label: 'P95 [aggregate]', metric: 'p95', actual: 450, threshold: '<= 500ms', status: 'pass' },
  ];

  const failChecks: SlaCheckResult[] = [
    { label: 'P95 [aggregate]', metric: 'p95', actual: 600, threshold: '<= 500ms', status: 'fail' },
    { label: 'TPS [aggregate]', metric: 'tps', actual: 80, threshold: '>= 100req/s', status: 'fail' },
  ];

  const warnChecks: SlaCheckResult[] = [
    { label: 'P95 [aggregate]', metric: 'p95', actual: 450, threshold: '<= 500ms', status: 'warn' },
  ];

  it('prints nothing when quiet is true', () => {
    printSlaReport(passChecks, true);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('prints SLA header when quiet is false', () => {
    printSlaReport(passChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('SLA Evaluation');
  });

  it('prints pass summary with count', () => {
    printSlaReport(passChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('1 target passing');
  });

  it('prints fail summary with count', () => {
    printSlaReport(failChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('2 violations');
  });

  it('prints warn summary', () => {
    printSlaReport(warnChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('1 warning');
  });

  it('prints ✓ icon for passing check', () => {
    printSlaReport(passChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('✓');
  });

  it('prints ✗ icon for failing check', () => {
    printSlaReport(failChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('✗');
  });

  it('prints ⚠ icon for warning check', () => {
    printSlaReport(warnChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('⚠');
  });

  it('prints actual value with unit', () => {
    printSlaReport(passChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('450.0ms');
  });

  it('prints n/a for no-data actual', () => {
    const noDataChecks: SlaCheckResult[] = [
      { label: 'P95 [NonExistent]', metric: 'p95', actual: null, threshold: '<= 500ms', status: 'no-data' },
    ];
    printSlaReport(noDataChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('n/a');
  });

  it('prints target threshold in each row', () => {
    printSlaReport(passChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('<= 500ms');
  });

  it('prints correct count for plural violations', () => {
    printSlaReport(failChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('2 violations');
  });

  it('prints singular target for 1 passing target', () => {
    printSlaReport(passChecks, false);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    // Should say "1 target passing" not "1 targets passing"
    expect(output).toMatch(/1 target passing/);
  });
});


