// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlaStatusAccordion } from './SlaStatusAccordion';
import type { SlaTarget } from '../utils/slaTargets';
import { makeSummary, makeResult } from '../../../test-utils/factories';

const slaHelpers = vi.hoisted(() => ({
  evaluateSlaTreeMock: vi.fn(),
  realEvaluateSlaTree: null as (...args: Parameters<typeof import('../utils/slaTargets').evaluateSlaTree>) => ReturnType<typeof import('../utils/slaTargets').evaluateSlaTree>,
}));

vi.mock('../utils/slaTargets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/slaTargets')>();
  slaHelpers.realEvaluateSlaTree = actual.evaluateSlaTree;
  return { ...actual, evaluateSlaTree: slaHelpers.evaluateSlaTreeMock };
});

function makeTarget(overrides: Partial<SlaTarget> = {}): SlaTarget {
  return { id: 't1', metric: 'p95', operator: 'lte', value: 50, ...overrides };
}

// summary.p95ResponseTime=90, p99=95, p50=45, tps=2 by default.
const summary = makeSummary();

beforeEach(() => {
  slaHelpers.evaluateSlaTreeMock.mockImplementation((...args) => slaHelpers.realEvaluateSlaTree(...args));
});

describe('SlaStatusAccordion', () => {
  it('renders nothing when there are no targets', () => {
    const { container } = render(
      <SlaStatusAccordion targets={[]} results={[makeResult()]} summary={summary} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a feature tree, auto-expands on fail, and shows fail/pass counts', () => {
    const results = [makeResult({ scenarioName: 'login', featureGroupName: 'Checkout', responseTimeMs: 100 })];
    const targets = [
      makeTarget({ id: 'fgFail', metric: 'p95', operator: 'lte', value: 50, featureGroupName: 'Checkout' }), // fail
      makeTarget({ id: 'scFail', metric: 'p95', operator: 'lte', value: 50, scenarioName: 'login' }), // fail
      makeTarget({ id: 'scPass', metric: 'p50', operator: 'lte', value: 500, scenarioName: 'login' }), // pass
    ];
    render(<SlaStatusAccordion targets={targets} results={results} summary={summary} />);

    // Summary bar (configured checks only: 2 fail + 1 pass)
    expect(screen.getByText('2 Failing')).toBeTruthy();
    expect(screen.getByText('1 Passing')).toBeTruthy();
    expect(screen.getByText('3 checks total')).toBeTruthy();

    // Feature row content
    expect(screen.getByText('Checkout')).toBeTruthy();
    expect(screen.getByText('2 failing')).toBeTruthy();
    expect(screen.getByText('1 passing')).toBeTruthy();
    expect(screen.getByText('1 scenario')).toBeTruthy();

    // Auto-expanded scenario shows its check rows (level 1 + level 2 CheckRows)
    expect(screen.getByText('2 checks')).toBeTruthy();
    expect(screen.getAllByText('P95 Response Time').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('P50 Response Time')).toBeTruthy();
  });

  it('collapses and re-expands a failing feature/scenario on click', () => {
    const results = [makeResult({ scenarioName: 'login', featureGroupName: 'Checkout', responseTimeMs: 100 })];
    const targets = [
      makeTarget({ id: 'scFail', metric: 'p95', operator: 'lte', value: 50, scenarioName: 'login' }),
    ];
    render(<SlaStatusAccordion targets={targets} results={results} summary={summary} />);

    // Single ungrouped scenario target → skipFeatureLevel → scenario at top level.
    // Auto-expanded (fail) so the check row is visible.
    expect(screen.getByText('P95 Response Time')).toBeTruthy();

    // Collapse the scenario (toggleScenario delete branch)
    fireEvent.click(screen.getByText('login'));
    expect(screen.queryByText('P95 Response Time')).toBeNull();

    // Re-expand (toggleScenario add branch)
    fireEvent.click(screen.getByText('login'));
    expect(screen.getByText('P95 Response Time')).toBeTruthy();
  });

  it('renders a collapsed passing feature and expands it on click', () => {
    const results = [makeResult({ scenarioName: 'login', featureGroupName: 'Checkout', responseTimeMs: 100 })];
    const targets = [
      makeTarget({ id: 'fgPass', metric: 'p95', operator: 'lte', value: 500, featureGroupName: 'Checkout' }), // pass
    ];
    render(<SlaStatusAccordion targets={targets} results={results} summary={summary} />);

    // Passing → not auto-expanded → no check row yet
    expect(screen.queryByText('P95 Response Time')).toBeNull();
    expect(screen.getByText('Checkout')).toBeTruthy();

    // Expand the feature (toggleFeature add branch)
    fireEvent.click(screen.getByText('Checkout'));
    expect(screen.getByText('P95 Response Time')).toBeTruthy();

    // Collapse again (toggleFeature delete branch)
    fireEvent.click(screen.getByText('Checkout'));
    expect(screen.queryByText('P95 Response Time')).toBeNull();
  });

  it('renders ungrouped scenario targets directly at the top level (skipFeatureLevel)', () => {
    // Results have NO featureGroupName, so the scenario maps to the '' feature group
    // and skipFeatureLevel is true → scenarios render at level 0 without a feature row.
    const results = [makeResult({ scenarioName: 'login', responseTimeMs: 100 })];
    const targets = [
      makeTarget({ id: 'scFail', metric: 'p95', operator: 'lte', value: 50, scenarioName: 'login' }), // fail
    ];
    render(<SlaStatusAccordion targets={targets} results={results} summary={summary} />);

    // No feature row (Checkout) — scenario sits at the top level, auto-expanded on fail.
    expect(screen.queryByText('Checkout')).toBeNull();
    expect(screen.getByText('login')).toBeTruthy();
    expect(screen.getByText('P95 Response Time')).toBeTruthy();

    // Collapse and re-expand to exercise the top-level scenario onToggle.
    fireEvent.click(screen.getByText('login'));
    expect(screen.queryByText('P95 Response Time')).toBeNull();
    fireEvent.click(screen.getByText('login'));
    expect(screen.getByText('P95 Response Time')).toBeTruthy();
  });

  it('renders the per-test breakdown for aggregate-only targets', () => {
    const results = [makeResult({ scenarioName: 'login', responseTimeMs: 100 })];
    const targets = [makeTarget({ id: 'agg', metric: 'p95', operator: 'lte', value: 50 })]; // aggregate, fail
    render(<SlaStatusAccordion targets={targets} results={results} summary={summary} />);

    expect(screen.getByText('Per-Test Breakdown')).toBeTruthy();
    expect(screen.getByText('1 Failing')).toBeTruthy();
    // Aggregate check (level 0) + the derived per-test scenario check (auto-expanded on fail)
    expect(screen.getAllByText('P95 Response Time').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('login')).toBeTruthy();
  });

  it('renders no-data dash, gte operator, custom labels, and warning pills', () => {
    const noP999 = makeSummary({ p999ResponseTime: undefined });
    const targets = [
      makeTarget({ id: 'nd', metric: 'p999', operator: 'lte', value: 100 }), // no-data → '—'
      makeTarget({ id: 'tps', metric: 'tps', operator: 'gte', value: 100 }), // fail, op ≥
      makeTarget({ id: 'lbl', metric: 'p95', operator: 'lte', value: 50, label: 'Custom SLA' }), // fail, labeled
      makeTarget({ id: 'w1', metric: 'p99', operator: 'lte', value: 200, warnAt: 50 }), // warn (95)
      makeTarget({ id: 'w2', metric: 'avg', operator: 'lte', value: 200, warnAt: 10 }), // warn (50)
    ];
    render(<SlaStatusAccordion targets={targets} results={[makeResult()]} summary={noP999} />);

    // p999 is absent from the summary → aggregate check shows the no-data dash.
    expect(screen.getByText('—')).toBeTruthy();
    // gte operator renders ≥; the threshold appears in both the aggregate check
    // and the auto-expanded derived per-test scenario, so allow multiple matches.
    expect(screen.getAllByText(/≥ 100/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Custom SLA').length).toBeGreaterThanOrEqual(1);
    // Two warnings → pluralized summary pill (derived nodes excluded from totals)
    expect(screen.getByText('2 Warnings')).toBeTruthy();
  });

  it('pluralizes scenario and check badges correctly', () => {
    const results = [
      makeResult({ id: 'r1', scenarioName: 'login', featureGroupName: 'Checkout', responseTimeMs: 100 }),
      makeResult({ id: 'r2', scenarioName: 'cart', featureGroupName: 'Checkout', responseTimeMs: 100 }),
    ];
    const targets = [
      makeTarget({ id: 's1', metric: 'p95', operator: 'lte', value: 50, scenarioName: 'login' }),
      makeTarget({ id: 's1b', metric: 'p50', operator: 'lte', value: 500, scenarioName: 'login' }),
      makeTarget({ id: 's2', metric: 'p95', operator: 'lte', value: 50, scenarioName: 'cart' }),
    ];
    render(<SlaStatusAccordion targets={targets} results={results} summary={summary} />);

    // Two scenarios in the Checkout feature group
    expect(screen.getByText('2 scenarios')).toBeTruthy();
    // login has 2 checks, cart has 1 check
    expect(screen.getByText('2 checks')).toBeTruthy();
    expect(screen.getByText('1 check')).toBeTruthy();
  });

  it('toggles derived per-test scenario sections in the breakdown', () => {
    const results = [
      makeResult({ id: 'r1', scenarioName: 'login', responseTimeMs: 100 }),
      makeResult({ id: 'r2', scenarioName: 'checkout', responseTimeMs: 100 }),
    ];
    const targets = [makeTarget({ id: 'agg', metric: 'p95', operator: 'lte', value: 50 })];
    render(<SlaStatusAccordion targets={targets} results={results} summary={summary} />);

    expect(screen.getByText('Per-Test Breakdown')).toBeTruthy();
    expect(screen.getByText('login')).toBeTruthy();
    expect(screen.getByText('checkout')).toBeTruthy();

    fireEvent.click(screen.getByText('login'));
    fireEvent.click(screen.getByText('login'));
    expect(screen.getByText('login')).toBeTruthy();
  });

  it('shows pass-only summary pills when all configured checks pass', () => {
    const targets = [makeTarget({ id: 'pass1', metric: 'p95', operator: 'lte', value: 500 })];
    render(<SlaStatusAccordion targets={targets} results={[makeResult()]} summary={summary} />);
    expect(screen.getByText('1 Passing')).toBeTruthy();
    expect(screen.queryByText(/Failing/)).toBeNull();
    expect(screen.getByText('1 check total')).toBeTruthy();
  });

  it('shows warning-only summary when checks warn but none fail', () => {
    const targets = [
      makeTarget({ id: 'w1', metric: 'p99', operator: 'lte', value: 200, warnAt: 50 }),
    ];
    render(<SlaStatusAccordion targets={targets} results={[makeResult()]} summary={summary} />);
    expect(screen.getByText('1 Warning')).toBeTruthy();
    expect(screen.queryByText(/Failing/)).toBeNull();
  });

  it('uses singular warning label in the summary bar', () => {
    const targets = [
      makeTarget({ id: 'w1', metric: 'p99', operator: 'lte', value: 200, warnAt: 50 }),
      makeTarget({ id: 'w2', metric: 'avg', operator: 'lte', value: 200, warnAt: 10 }),
    ];
    render(<SlaStatusAccordion targets={targets} results={[makeResult()]} summary={summary} />);
    expect(screen.getByText('2 Warnings')).toBeTruthy();
  });

  it('renders derived feature sections when multiple derived nodes exist', () => {
    slaHelpers.evaluateSlaTreeMock.mockReturnValue({
      featureNodes: [],
      derivedFeatureNodes: [
        {
          featureGroupName: 'Derived A',
          status: 'fail',
          featureChecks: [],
          scenarios: [{
            scenarioName: 'login',
            status: 'fail',
            checks: [{ target: makeTarget(), actual: 100, status: 'fail' as const }],
          }],
        },
        {
          featureGroupName: 'Derived B',
          status: 'pass',
          featureChecks: [],
          scenarios: [],
        },
      ],
      aggregateChecks: [],
      aggregateStatus: null,
      overall: 'fail',
    });
    render(
      <SlaStatusAccordion
        targets={[makeTarget()]}
        results={[makeResult({ scenarioName: 'login' })]}
        summary={summary}
      />,
    );
    expect(screen.getByText('Per-Test Breakdown')).toBeTruthy();
    expect(screen.getByText('Derived A')).toBeTruthy();
    expect(screen.getByText('Derived B')).toBeTruthy();
    fireEvent.click(screen.getByText('Derived A'));
    expect(screen.getByText('Derived A')).toBeTruthy();
  });
});
