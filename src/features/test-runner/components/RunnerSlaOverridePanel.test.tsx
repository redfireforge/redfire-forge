/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  selectOption,
  getCustomSelectValue,
  getCustomSelectOptionLabels,
  isCustomSelectDisabled,
} from '../../../test-utils/customSelectHelper';
import RunnerSlaOverridePanel from './RunnerSlaOverridePanel';
import type { SlaTarget } from '../../../shared/types';

function makeTarget(overrides?: Partial<SlaTarget>): SlaTarget {
  return {
    id: 'target-1',
    metric: 'p95',
    operator: 'lte',
    value: 500,
    ...overrides,
  };
}

const defaultProps = {
  onSave: vi.fn(),
  definitionTargetCount: 0,
  scenarioNames: ['Login', 'Search'],
};

describe('RunnerSlaOverridePanel', () => {
  // ── Trigger bar ──

  it('renders trigger bar with SLA Override label', () => {
    render(<RunnerSlaOverridePanel {...defaultProps} />);
    expect(screen.getByText(/SLA Override/)).toBeTruthy();
  });

  it('shows optional badge when no overrides', () => {
    render(<RunnerSlaOverridePanel {...defaultProps} />);
    expect(screen.getByText('optional')).toBeTruthy();
  });

  it('shows configured count on trigger bar', () => {
    render(<RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={3} />);
    expect(screen.getByText(/3 configured/)).toBeTruthy();
  });

  it('shows override stats on trigger bar', () => {
    const defTargets = [{ ...makeTarget({ id: 'd1' }), scopeLabel: 'Aggregate' }];
    const targets = [makeTarget({ id: 'a' })];
    render(
      <RunnerSlaOverridePanel {...defaultProps} initialTargets={targets}
        definitionTargetCount={1} definitionTargets={defTargets} />
    );
    expect(screen.getByText(/1 override/)).toBeTruthy();
  });

  it('shows new count on trigger bar for new targets', () => {
    // A target that doesn't match any definition → counted as "new"
    const targets = [makeTarget({ id: 'x', metric: 'tps', operator: 'gte', value: 50 })];
    render(<RunnerSlaOverridePanel {...defaultProps} initialTargets={targets} />);
    expect(screen.getByText(/1 new/)).toBeTruthy();
  });

  it('disables Configure button when disabled', () => {
    render(<RunnerSlaOverridePanel {...defaultProps} disabled />);
    const btn = screen.getByRole('button', { name: /Configure/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('adds disabled class when disabled', () => {
    const { container } = render(<RunnerSlaOverridePanel {...defaultProps} disabled />);
    expect(container.querySelector('.sla-trigger--disabled')).toBeTruthy();
  });

  it('does not add disabled class when not disabled', () => {
    const { container } = render(<RunnerSlaOverridePanel {...defaultProps} />);
    expect(container.querySelector('.sla-trigger--disabled')).toBeNull();
  });

  // ── Modal ──

  it('opens modal when Configure clicked', () => {
    render(<RunnerSlaOverridePanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    expect(screen.getByText(/Configure SLA thresholds/)).toBeTruthy();
    expect(screen.getByText('+ Add Target')).toBeTruthy();
  });

  it('shows definitions table in modal (expanded by default)', () => {
    const defTargets = [
      { ...makeTarget({ id: 'd1', value: 800 }), scopeLabel: 'Test: Get Users' },
      { ...makeTarget({ id: 'd2', metric: 'errorRate' as const, value: 1 }), scopeLabel: 'Test: Create Post' },
    ];
    render(
      <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={2} definitionTargets={defTargets} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    expect(screen.getByText(/Configured Targets \(2\)/)).toBeTruthy();
    expect(screen.getByText('Test: Get Users')).toBeTruthy();
    expect(screen.getByText('Test: Create Post')).toBeTruthy();
  });

  it('shows Override button per definition row', () => {
    const defTargets = [
      { ...makeTarget({ id: 'd1' }), scopeLabel: 'Aggregate' },
    ];
    render(
      <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    expect(screen.getByRole('button', { name: /Override/ })).toBeTruthy();
  });

  it('clones definition row when Override clicked', () => {
    const defTargets = [
      { ...makeTarget({ id: 'd1', value: 800 }), scopeLabel: 'Aggregate' },
    ];
    render(
      <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    fireEvent.click(screen.getByRole('button', { name: /Override/ }));
    // Should now show "Overridden" instead of "Override"
    expect(screen.getByText('Overridden')).toBeTruthy();
    // Override row appears with the value and "was" hint
    expect(screen.getByDisplayValue('800')).toBeTruthy();
    expect(screen.getByText('was 800')).toBeTruthy();
    // Badge
    expect(screen.getByText('override')).toBeTruthy();
  });

  it('adds new row via + Add Target with dropdowns', () => {
    render(<RunnerSlaOverridePanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    fireEvent.click(screen.getByText('+ Add Target'));
    // New row has "new" badge
    expect(screen.getByText('new')).toBeTruthy();
    // Has editable dropdowns (select elements)
    const selects = document.querySelectorAll('.sla-ovr-select');
    expect(selects.length).toBeGreaterThanOrEqual(2); // scope + metric
  });

  it('removes override row when ✕ clicked', () => {
    const defTargets = [
      { ...makeTarget({ id: 'd1', value: 800 }), scopeLabel: 'Aggregate' },
    ];
    render(
      <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    fireEvent.click(screen.getByRole('button', { name: /Override/ }));
    expect(screen.getByText('Overridden')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Remove override/ }));
    // "Override" button should reappear
    expect(screen.getByRole('button', { name: /Override/ })).toBeTruthy();
    expect(screen.queryByText('Overridden')).toBeNull();
  });

  it('calls onSave with clean targets (no internal fields)', () => {
    const onSave = vi.fn();
    const targets = [makeTarget({ id: 'a', value: 300 })];
    render(<RunnerSlaOverridePanel {...defaultProps} initialTargets={targets} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved[0]).not.toHaveProperty('_source');
    expect(saved[0]).not.toHaveProperty('_originalValue');
  });

  it('resets draft and closes modal on Cancel', () => {
    const targets = [makeTarget()];
    render(<RunnerSlaOverridePanel {...defaultProps} initialTargets={targets} />);
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    expect(screen.getByText(/Configure SLA thresholds/)).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    // Modal should be closed
    expect(screen.queryByText(/Configure SLA thresholds/)).toBeNull();
  });

  it('syncs draft when initialTargets changes', () => {
    const defTargets = [{ ...makeTarget({ id: 'd1' }), scopeLabel: 'Aggregate' }];
    const { rerender } = render(
      <RunnerSlaOverridePanel {...defaultProps} initialTargets={[makeTarget({ id: 'a', value: 100 })]}
        definitionTargetCount={1} definitionTargets={defTargets} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    expect(screen.getByDisplayValue('100')).toBeTruthy();

    const newTargets = [makeTarget({ id: 'b', value: 200 })];
    rerender(
      <RunnerSlaOverridePanel {...defaultProps} initialTargets={newTargets}
        definitionTargetCount={1} definitionTargets={defTargets} />
    );
    expect(screen.getByDisplayValue('200')).toBeTruthy();
  });

  it('shows scope-first column order in definitions', () => {
    const defTargets = [
      { ...makeTarget({ id: 'd1' }), scopeLabel: 'Aggregate' },
    ];
    render(
      <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    const headers = screen.getAllByRole('columnheader');
    // First table headers: Scope, Metric, Threshold, Warn, Label, (action)
    expect(headers[0].textContent).toBe('Scope');
    expect(headers[1].textContent).toBe('Metric');
  });

  it('renders gte operator and warnAt in definitions', () => {
    const defTargets = [
      { metric: 'tps' as const, operator: 'gte' as const, value: 100, warnAt: 80, id: 't1', scopeLabel: 'Aggregate' },
    ];
    render(
      <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    expect(screen.getByText(/≥/)).toBeTruthy();
    expect(screen.getByText('80')).toBeTruthy();
  });

  it('shows footer summary in modal', () => {
    const defTargets = [{ ...makeTarget({ id: 'd1' }), scopeLabel: 'Aggregate' }];
    const targets = [makeTarget({ id: 'a' })];
    render(
      <RunnerSlaOverridePanel {...defaultProps} initialTargets={targets}
        definitionTargetCount={1} definitionTargets={defTargets} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    // Footer summary shows configured count — multiple elements may match, just verify at least one exists
    expect(screen.getAllByText(/1 configured/).length).toBeGreaterThanOrEqual(1);
  });

  it('collapses definitions when toggle clicked', () => {
    const defTargets = [
      { ...makeTarget({ id: 'd1', value: 800 }), scopeLabel: 'Test: Get Users' },
    ];
    render(
      <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    expect(screen.getByText('Test: Get Users')).toBeTruthy();
    // Collapse
    fireEvent.click(screen.getByText(/Configured Targets/));
    expect(screen.queryByText('Test: Get Users')).toBeNull();
  });

  // ─── Modal-specific tests ()
  describe('modal behavior', () => {
    it('renders modal with role=dialog and aria-modal=true', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('renders modal with sla-modal-overlay and sla-override-modal classes', () => {
      const { container } = render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      expect(container.querySelector('.sla-modal-overlay')).toBeTruthy();
      expect(container.querySelector('.sla-override-modal')).toBeTruthy();
    });

    it('closes modal when Cancel button is clicked', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      expect(screen.getByText(/Configure SLA thresholds/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
      expect(screen.queryByText(/Configure SLA thresholds/)).toBeNull();
    });

    it('does NOT close modal when overlay is clicked (closeOnOverlayClick=false)', () => {
      const { container } = render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      const overlay = container.querySelector('.sla-modal-overlay') as HTMLElement;
      expect(overlay).toBeTruthy();
      fireEvent.click(overlay);
      // Subtitle should still be visible because clicking overlay does NOT close
      expect(screen.getByText(/Configure SLA thresholds/)).toBeTruthy();
    });

    it('does not show expand button in modal header', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      expect(screen.queryByRole('button', { name: /Expand modal|Shrink modal/ })).toBeNull();
    });

    it('does not show close (×) button in modal header', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    });

    it('does not render modal when closed', () => {
      const { container } = render(<RunnerSlaOverridePanel {...defaultProps} />);
      expect(container.querySelector('.sla-override-modal')).toBeNull();
      expect(container.querySelector('.sla-modal-overlay')).toBeNull();
    });
  });

  // ── Override row interactions ──

  describe('override row editing', () => {
    it('updates value when input changes', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      fireEvent.click(screen.getByText('+ Add Target'));
      const input = screen.getByDisplayValue('500');
      fireEvent.change(input, { target: { value: '300' } });
      expect(screen.getByDisplayValue('300')).toBeTruthy();
    });

    it('coerces empty value to 0', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      fireEvent.click(screen.getByText('+ Add Target'));
      const input = screen.getByDisplayValue('500');
      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByDisplayValue('0')).toBeTruthy();
    });

    it('changes scope to aggregate via dropdown', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      fireEvent.click(screen.getByText('+ Add Target'));
      selectOption(document.querySelectorAll('.sla-ovr-select')[0]!, 'Login');
      expect(getCustomSelectValue(document.querySelectorAll('.sla-ovr-select')[0]!)).toBe('Login');
      // Switch back to aggregate
      selectOption(document.querySelectorAll('.sla-ovr-select')[0]!, 'Aggregate');
      expect(getCustomSelectValue(document.querySelectorAll('.sla-ovr-select')[0]!)).toBe('Aggregate');
    });

    it('changes metric via dropdown on new row', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      fireEvent.click(screen.getByText('+ Add Target'));
      selectOption(document.querySelectorAll('.sla-ovr-select')[1]!, 'TPS');
      expect(getCustomSelectValue(document.querySelectorAll('.sla-ovr-select')[1]!)).toBe('TPS');
    });

    it('edits warnAt input on override row', () => {
      const defTargets = [
        { ...makeTarget({ id: 'd1', value: 800, warnAt: 600 }), scopeLabel: 'Aggregate' },
      ];
      render(
        <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets} />
      );
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      fireEvent.click(screen.getByRole('button', { name: /Override/ }));
      // Find the warnAt input (has placeholder "—")
      const warnInput = screen.getByPlaceholderText('—');
      fireEvent.change(warnInput, { target: { value: '700' } });
      expect(screen.getByDisplayValue('700')).toBeTruthy();
      // Clear warnAt
      fireEvent.change(warnInput, { target: { value: '' } });
    });

    it('shows was hint for originalWarnAt on cloned row', () => {
      const defTargets = [
        { ...makeTarget({ id: 'd1', value: 800, warnAt: 600 }), scopeLabel: 'Aggregate' },
      ];
      render(
        <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets} />
      );
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      fireEvent.click(screen.getByRole('button', { name: /Override/ }));
      expect(screen.getByText('was 800')).toBeTruthy();
      expect(screen.getByText('was 600')).toBeTruthy();
    });

    it('cloned row from definition without warnAt shows no was-hint for warnAt', () => {
      const defTargets = [
        { ...makeTarget({ id: 'd1', value: 800 }), scopeLabel: 'Aggregate' },
      ];
      render(
        <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets} />
      );
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      fireEvent.click(screen.getByRole('button', { name: /Override/ }));
      expect(screen.getByText('was 800')).toBeTruthy();
      // No warnAt in definition → only one "was X" hint
      expect(screen.getAllByText(/^was \d+$/).length).toBe(1);
    });

    it('shows FG scope badge for featureGroupName target on cloned override row', () => {
      const defTargets = [
        { ...makeTarget({ id: 'd1' }), featureGroupName: 'Auth', scopeLabel: 'FG: Auth' },
      ];
      render(
        <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets} />
      );
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      fireEvent.click(screen.getByRole('button', { name: /Override/ }));
      // Cloned row shows scope badge with sla-scope-fg class
      const { container } = render(
        <RunnerSlaOverridePanel {...defaultProps} definitionTargetCount={1} definitionTargets={defTargets}
          initialTargets={[{ ...makeTarget({ id: 'd1' }), featureGroupName: 'Auth' }]} />
      );
      fireEvent.click(container.querySelector('.sla-trigger-btn')!);
      const fgBadge = container.querySelector('.sla-scope-fg');
      expect(fgBadge).toBeTruthy();
      expect(fgBadge!.textContent).toBe('FG: Auth');
    });

    it('uses featureGroupName in scope dropdown value for non-cloned override row', () => {
      // 'Payments' must be in scenarioNames so it appears as an option in the dropdown
      const targets = [{ ...makeTarget({ id: 'x', value: 100 }), featureGroupName: 'Payments' }];
      render(
        <RunnerSlaOverridePanel
          {...defaultProps}
          scenarioNames={['Login', 'Search', 'Payments']}
          initialTargets={targets}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      expect(getCustomSelectValue(document.querySelectorAll('.sla-ovr-select')[0]!)).toBe('Payments');
    });

    it('includes testNames in scope dropdown options', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} testNames={['GetUsers', 'CreatePost']} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      fireEvent.click(screen.getByText('+ Add Target'));
      const labels = getCustomSelectOptionLabels(document.querySelectorAll('.sla-ovr-select')[0]!);
      expect(labels).toContain('GetUsers');
      expect(labels).toContain('CreatePost');
    });

    it('disables Save when validation errors exist', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      fireEvent.click(screen.getByText('+ Add Target'));
      const input = screen.getByDisplayValue('500');
      fireEvent.change(input, { target: { value: '-5' } });
      const saveBtn = screen.getByRole('button', { name: /Save/ });
      expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows empty state when no overrides', () => {
      render(<RunnerSlaOverridePanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      expect(screen.getByText(/No overrides configured/)).toBeTruthy();
    });

    it('shows Overrides for This Run with count badge', () => {
      const targets = [makeTarget({ id: 'x', metric: 'tps', operator: 'gte', value: 50 })];
      render(<RunnerSlaOverridePanel {...defaultProps} initialTargets={targets} />);
      fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
      expect(screen.getByText('1')).toBeTruthy(); // count badge
      expect(screen.getByText('Overrides for This Run')).toBeTruthy();
    });
  });
});
