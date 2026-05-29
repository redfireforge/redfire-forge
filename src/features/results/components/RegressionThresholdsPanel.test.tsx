// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { RegressionThresholdsPanel } from './RegressionThresholdsPanel';
import { DEFAULT_THRESHOLDS } from '../utils/runBaselines';
import type { RegressionThresholds } from '../utils/runBaselines';

describe('RegressionThresholdsPanel', () => {
  it('renders all 7 threshold rows', () => {
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.querySelectorAll('.thresholds-row')).toHaveLength(7);
  });

  it('shows pp unit for Error Rate row and % unit for all other rows', () => {
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    const unitLabels = [...container.querySelectorAll('.thresholds-unit')].map((el) => el.textContent);
    // 7 rows total; Error Rate is last (index 6) and uses 'pp'
    expect(unitLabels).toHaveLength(7);
    expect(unitLabels[6]).toBe('pp');
    expect(unitLabels.slice(0, 6).every((u) => u === '%')).toBe(true);
  });

  it('calls onSave with updated thresholds when Save is clicked', async () => {
    const onSave = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    // Change P95 input from 10 to 5
    const inputs = container.querySelectorAll('.thresholds-input') as NodeListOf<HTMLInputElement>;
    const p95Input = inputs[2]; // avgPercent, p50Percent, p95Percent, ...
    fireEvent.change(p95Input, { target: { value: '5' } });
    fireEvent.click(container.querySelector('.btn-primary')!);
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved: RegressionThresholds = onSave.mock.calls[0][0];
    expect(saved.p95Percent).toBe(5);
    // Other thresholds unchanged
    expect(saved.p50Percent).toBe(DEFAULT_THRESHOLDS.p50Percent);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={vi.fn()} onCancel={onCancel} />,
    );
    const cancelBtn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Cancel')!;
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Cancel resets edited draft to saved thresholds (stays-mounted tab context)', () => {
    // When the panel stays mounted inside the Baselines tab, clicking Cancel
    // must revert any unsaved edits — it cannot rely on unmount to discard state.
    const onSave = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    const inputs = container.querySelectorAll('.thresholds-input') as NodeListOf<HTMLInputElement>;
    // Edit P95 to 99
    fireEvent.change(inputs[2], { target: { value: '99' } });
    expect((inputs[2] as HTMLInputElement).value).toBe('99');
    // Cancel — must revert
    const cancelBtn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Cancel')!;
    fireEvent.click(cancelBtn);
    // Draft should now show the original saved value, not the edited 99
    const inputsAfter = container.querySelectorAll('.thresholds-input') as NodeListOf<HTMLInputElement>;
    expect((inputsAfter[2] as HTMLInputElement).value).toBe(String(DEFAULT_THRESHOLDS.p95Percent));
    // onSave should NOT have been called
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Reset Defaults restores all values to DEFAULT_THRESHOLDS', async () => {
    const onSave = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel
        thresholds={{ ...DEFAULT_THRESHOLDS, p95Percent: 99, tpsPercent: 50 }}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const resetBtn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Reset Defaults')!;
    fireEvent.click(resetBtn);
    fireEvent.click(container.querySelector('.btn-primary')!);
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toEqual(DEFAULT_THRESHOLDS);
  });

  it('falls back to default for NaN input on save', async () => {
    const onSave = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    const inputs = container.querySelectorAll('.thresholds-input') as NodeListOf<HTMLInputElement>;
    fireEvent.change(inputs[2], { target: { value: '' } }); // empty → NaN
    fireEvent.click(container.querySelector('.btn-primary')!);
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved: RegressionThresholds = onSave.mock.calls[0][0];
    expect(saved.p95Percent).toBe(DEFAULT_THRESHOLDS.p95Percent);
  });

  it('falls back to default for negative input on save', async () => {
    const onSave = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    const inputs = container.querySelectorAll('.thresholds-input') as NodeListOf<HTMLInputElement>;
    fireEvent.change(inputs[2], { target: { value: '-5' } });
    fireEvent.click(container.querySelector('.btn-primary')!);
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved: RegressionThresholds = onSave.mock.calls[0][0];
    expect(saved.p95Percent).toBe(DEFAULT_THRESHOLDS.p95Percent);
  });

  it('falls back to default for Infinity input on save (isFinite guard)', async () => {
    const onSave = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    const inputs = container.querySelectorAll('.thresholds-input') as NodeListOf<HTMLInputElement>;
    // Simulate programmatic Infinity value (e.g., paste)
    fireEvent.change(inputs[2], { target: { value: 'Infinity' } });
    fireEvent.click(container.querySelector('.btn-primary')!);
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved: RegressionThresholds = onSave.mock.calls[0][0];
    expect(saved.p95Percent).toBe(DEFAULT_THRESHOLDS.p95Percent);
  });

  it('shows status message when Reset Defaults is clicked', () => {
    const { container, getByText } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    const resetBtn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Reset Defaults')!;
    fireEvent.click(resetBtn);
    expect(getByText('Thresholds reset to defaults.')).toBeTruthy();
  });

  it('shows status message when Cancel is clicked', () => {
    const { container, getByText } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    const cancelBtn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Cancel')!;
    fireEvent.click(cancelBtn);
    expect(getByText('Unsaved changes discarded.')).toBeTruthy();
  });

  it('shows status message when Save is clicked', async () => {
    const { container, getByText } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    fireEvent.click(container.querySelector('.btn-primary')!);
    await waitFor(() => expect(getByText('Thresholds saved.')).toBeTruthy());
  });

  it('shows saving then success for async save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    fireEvent.click(container.querySelector('.btn-primary')!);
    expect(getByText('Saving thresholds...')).toBeTruthy();
    await waitFor(() => expect(getByText('Thresholds saved.')).toBeTruthy());
  });

  it('shows failure message when async save rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('save failed'));
    const { container, getByText } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    fireEvent.click(container.querySelector('.btn-primary')!);
    expect(getByText('Saving thresholds...')).toBeTruthy();
    await waitFor(() => expect(getByText('Failed to save thresholds.')).toBeTruthy());
  });
});
