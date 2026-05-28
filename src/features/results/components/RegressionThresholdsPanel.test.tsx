// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

  it('calls onSave with updated thresholds when Save is clicked', () => {
    const onSave = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    // Change P95 input from 10 to 5
    const inputs = container.querySelectorAll('.thresholds-input') as NodeListOf<HTMLInputElement>;
    const p95Input = inputs[2]; // avgPercent, p50Percent, p95Percent, ...
    fireEvent.change(p95Input, { target: { value: '5' } });
    fireEvent.click(container.querySelector('.btn-primary')!);
    expect(onSave).toHaveBeenCalledOnce();
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

  it('Reset Defaults restores all values to DEFAULT_THRESHOLDS', () => {
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
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toEqual(DEFAULT_THRESHOLDS);
  });

  it('falls back to default for NaN input on save', () => {
    const onSave = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    const inputs = container.querySelectorAll('.thresholds-input') as NodeListOf<HTMLInputElement>;
    fireEvent.change(inputs[2], { target: { value: '' } }); // empty → NaN
    fireEvent.click(container.querySelector('.btn-primary')!);
    const saved: RegressionThresholds = onSave.mock.calls[0][0];
    expect(saved.p95Percent).toBe(DEFAULT_THRESHOLDS.p95Percent);
  });

  it('falls back to default for negative input on save', () => {
    const onSave = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    const inputs = container.querySelectorAll('.thresholds-input') as NodeListOf<HTMLInputElement>;
    fireEvent.change(inputs[2], { target: { value: '-5' } });
    fireEvent.click(container.querySelector('.btn-primary')!);
    const saved: RegressionThresholds = onSave.mock.calls[0][0];
    expect(saved.p95Percent).toBe(DEFAULT_THRESHOLDS.p95Percent);
  });

  it('falls back to default for Infinity input on save (isFinite guard)', () => {
    const onSave = vi.fn();
    const { container } = render(
      <RegressionThresholdsPanel thresholds={DEFAULT_THRESHOLDS} onSave={onSave} onCancel={vi.fn()} />,
    );
    const inputs = container.querySelectorAll('.thresholds-input') as NodeListOf<HTMLInputElement>;
    // Simulate programmatic Infinity value (e.g., paste)
    fireEvent.change(inputs[2], { target: { value: 'Infinity' } });
    fireEvent.click(container.querySelector('.btn-primary')!);
    const saved: RegressionThresholds = onSave.mock.calls[0][0];
    expect(saved.p95Percent).toBe(DEFAULT_THRESHOLDS.p95Percent);
  });
});
