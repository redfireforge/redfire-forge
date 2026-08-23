// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SlaCompactBar } from './SlaCompactBar';
import type { SlaTarget } from '../utils/slaTargets';
import { makeSummary, makeResult } from '@test-utils/factories';

// Mock the editor so we can drive onSave / onCancel deterministically without
// depending on its internal markup.
vi.mock('./SlaTargetEditor', () => ({
  SlaTargetEditor: ({
    onSave,
    onCancel,
    saving,
  }: {
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
  }) => (
    <div data-testid="sla-editor">
      <span data-testid="editor-saving">{String(saving)}</span>
      <button onClick={onSave}>editor-save</button>
      <button onClick={onCancel}>editor-cancel</button>
    </div>
  ),
}));

function makeTarget(overrides: Partial<SlaTarget> = {}): SlaTarget {
  return { id: 't1', metric: 'p95', operator: 'lte', value: 50, ...overrides };
}

// summary.p95ResponseTime defaults to 90 in the factory.
const summary = makeSummary();
const results = [makeResult()];

function setup(props: Partial<React.ComponentProps<typeof SlaCompactBar>> = {}) {
  const onSaveTargets = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <SlaCompactBar
      targets={[]}
      results={results}
      summary={summary}
      scope={null}
      onSaveTargets={onSaveTargets}
      {...props}
    />,
  );
  return { onSaveTargets, ...utils };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('SlaCompactBar — empty state', () => {
  it('shows "Add First Target" for an editable (null) scope and opens the editor', () => {
    setup({ scope: null });
    expect(screen.getByText('No SLA targets defined')).toBeTruthy();
    // null scope → no badge
    expect(screen.queryByText('🔒 This Run')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add First Target/ }));
    expect(screen.getByTestId('sla-editor')).toBeTruthy();
  });

  it('shows read-only and a "This Run" badge for run scope', () => {
    setup({ scope: 'run' });
    expect(screen.getByText('🔒 This Run')).toBeTruthy();
    expect(screen.getByText('Read-only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add First Target/ })).toBeNull();
  });

  it('shows the "Workflow" badge for workflow-def scope', () => {
    setup({ scope: 'workflow-def' });
    expect(screen.getByText('📋 Workflow')).toBeTruthy();
    expect(screen.getByText('Read-only')).toBeTruthy();
  });

  it('cancels the editor opened from the empty state', () => {
    setup({ scope: null });
    fireEvent.click(screen.getByRole('button', { name: /Add First Target/ }));
    fireEvent.click(screen.getByRole('button', { name: 'editor-cancel' }));
    // Back to empty state
    expect(screen.getByText('No SLA targets defined')).toBeTruthy();
  });

  it('saves a new target from the empty-state editor', async () => {
    const { onSaveTargets } = setup({ scope: null });
    fireEvent.click(screen.getByRole('button', { name: /Add First Target/ }));
    fireEvent.click(screen.getByRole('button', { name: 'editor-save' }));
    await waitFor(() => expect(onSaveTargets).toHaveBeenCalledTimes(1));
  });
});

describe('SlaCompactBar — populated state', () => {
  it('renders a failing pill and detail text', () => {
    // p95=90 > 50 → fail
    setup({ targets: [makeTarget({ value: 50 })], scope: null });
    expect(screen.getByText('⚠ 1 Failing')).toBeTruthy();
    expect(screen.getByText(/1 violation/)).toBeTruthy();
    expect(screen.getByText('⚗ Ad-hoc')).toBeTruthy();
  });

  it('renders a passing pill and evaluated count', () => {
    setup({ targets: [makeTarget({ value: 200 })], scope: null });
    expect(screen.getByText('✓ All Passing')).toBeTruthy();
    expect(screen.getByText('1 target evaluated')).toBeTruthy();
  });

  it('pluralizes the evaluated targets count', () => {
    setup({
      targets: [makeTarget({ id: 'a', value: 200 }), makeTarget({ id: 'b', metric: 'p99', value: 200 })],
      scope: null,
    });
    expect(screen.getByText('2 targets evaluated')).toBeTruthy();
  });

  it('renders a warning pill and detail text', () => {
    // lte value 200, warnAt 50 → 50 < 90 <= 200 → warn
    setup({ targets: [makeTarget({ value: 200, warnAt: 50 })], scope: null });
    expect(screen.getByText('! 1 Warning')).toBeTruthy();
    expect(screen.getByText(/1 warning/)).toBeTruthy();
  });

  it('derives feature-group names from results and evaluates fg-scoped checks', () => {
    // A result carrying a featureGroupName exercises the featureGroupNames memo
    // (filter + map callbacks) and the featureNodes branch of the allChecks memo.
    const fgResults = [makeResult({ scenarioName: 'login', featureGroupName: 'Checkout', responseTimeMs: 100 })];
    render(
      <SlaCompactBar
        targets={[makeTarget({ id: 'fg', metric: 'p95', operator: 'lte', value: 500, featureGroupName: 'Checkout' })]}
        results={fgResults}
        summary={summary}
        scope={null}
        onSaveTargets={vi.fn()}
      />,
    );
    // p95 of a single 100ms result is 100 <= 500 → passing
    expect(screen.getByText('✓ All Passing')).toBeTruthy();
    expect(screen.getByText('1 target evaluated')).toBeTruthy();
  });

  it('composes fail detail with warnings and passing parts', () => {
    setup({
      targets: [
        makeTarget({ id: 'fail', metric: 'p95', value: 50 }), // fail (90 > 50)
        makeTarget({ id: 'warn', metric: 'p99', operator: 'lte', value: 200, warnAt: 50 }), // warn (95)
        makeTarget({ id: 'pass', metric: 'p50', operator: 'lte', value: 200 }), // pass (45)
      ],
      scope: null,
    });
    expect(screen.getByText(/1 violation — 1 warning — 1 passing/)).toBeTruthy();
  });

  it('shows the run-scope badge and read-only label, hiding the edit button', () => {
    setup({ targets: [makeTarget({ value: 200 })], scope: 'run' });
    expect(screen.getByText('🔒 This Run')).toBeTruthy();
    expect(screen.getByText('Read-only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Targets' })).toBeNull();
  });

  it('opens the editor with existing targets when Edit Targets is clicked', () => {
    setup({ targets: [makeTarget({ value: 200 })], scope: null });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Targets' }));
    expect(screen.getByTestId('sla-editor')).toBeTruthy();
    // cancel returns to the bar
    fireEvent.click(screen.getByRole('button', { name: 'editor-cancel' }));
    expect(screen.getByRole('button', { name: 'Edit Targets' })).toBeTruthy();
  });

  it('saves edited targets and flashes a saved confirmation', async () => {
    vi.useFakeTimers();
    const onSaveTargets = vi.fn().mockResolvedValue(undefined);
    render(
      <SlaCompactBar
        targets={[makeTarget({ value: 200 })]}
        results={results}
        summary={summary}
        scope={null}
        onSaveTargets={onSaveTargets}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Targets' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'editor-save' }));
    });
    expect(onSaveTargets).toHaveBeenCalledTimes(1);
    expect(screen.getByText('✓ Saved')).toBeTruthy();
    // After the timer the flash disappears
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.queryByText('✓ Saved')).toBeNull();
    vi.useRealTimers();
  });

  it('shows "No data" when the only target has no matching metric', () => {
    // p999 metric, summary lacks p999 → check status 'no-data' → overall 'no-data'.
    // (checkCount is always > 0 when targets exist, so the pill resolves to 'No data'.)
    const noP999 = makeSummary({ p999ResponseTime: undefined });
    render(
      <SlaCompactBar
        targets={[makeTarget({ metric: 'p999', value: 100 })]}
        results={results}
        summary={noP999}
        scope={null}
        onSaveTargets={vi.fn()}
      />,
    );
    expect(screen.getByText('No data')).toBeTruthy();
    // no-data overall produces an empty detail string and the ad-hoc scope badge
    expect(screen.getByText('⚗ Ad-hoc')).toBeTruthy();
  });

  it('includes scenario-scoped checks in the allChecks memo via flatMap', () => {
    const fgResults = [
      makeResult({ scenarioName: 'login', featureGroupName: 'Checkout', responseTimeMs: 100 }),
    ];
    render(
      <SlaCompactBar
        targets={[
          makeTarget({ id: 'fg', metric: 'p95', operator: 'lte', value: 500, featureGroupName: 'Checkout' }),
          makeTarget({ id: 'sc', metric: 'p50', operator: 'lte', value: 500, scenarioName: 'login' }),
        ]}
        results={fgResults}
        summary={summary}
        scope={null}
        onSaveTargets={vi.fn()}
      />,
    );
    expect(screen.getByText('✓ All Passing')).toBeTruthy();
    expect(screen.getByText('2 targets evaluated')).toBeTruthy();
  });

  it('pluralizes warning pill and warn-only detail text', () => {
    setup({
      targets: [
        makeTarget({ id: 'w1', metric: 'p99', operator: 'lte', value: 200, warnAt: 50 }),
        makeTarget({ id: 'w2', metric: 'avg', operator: 'lte', value: 200, warnAt: 10 }),
      ],
      scope: null,
    });
    expect(screen.getByText('! 2 Warnings')).toBeTruthy();
    expect(screen.getByText(/2 warnings/)).toBeTruthy();
  });

  it('pluralizes violation count in fail detail when multiple targets fail', () => {
    setup({
      targets: [
        makeTarget({ id: 'f1', metric: 'p95', value: 50 }),
        makeTarget({ id: 'f2', metric: 'p99', value: 50 }),
      ],
      scope: null,
    });
    expect(screen.getByText('⚠ 2 Failing')).toBeTruthy();
    expect(screen.getByText(/2 violations/)).toBeTruthy();
  });
});
