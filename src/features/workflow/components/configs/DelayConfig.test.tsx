/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption, getCustomSelectValue } from '../../../../test-utils/customSelectHelper';
import DelayConfig from './DelayConfig';
import type { DelayNodeData } from '../../types/workflow';

function makeData(overrides: Partial<DelayNodeData> = {}): DelayNodeData {
  return { label: 'Wait', delayMs: 500, mode: 'fixed', ...overrides };
}

describe('DelayConfig', () => {
  it('renders label input with current value', () => {
    render(<DelayConfig data={makeData({ label: 'My Delay' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('My Delay')).toBeTruthy();
  });

  it('calls onChange when label changes', () => {
    const onChange = vi.fn();
    render(<DelayConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Wait'), { target: { value: 'Pause' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Pause' }));
  });

  it('renders mode select with fixed selected', () => {
    const { container } = render(<DelayConfig data={makeData({ mode: 'fixed' })} onChange={vi.fn()} />);
    expect(getCustomSelectValue(container)).toBe('Fixed');
  });

  it('switches mode to random', () => {
    const onChange = vi.fn();
    const { container } = render(<DelayConfig data={makeData()} onChange={onChange} />);
    selectOption(container, 'Random Range');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'random' }));
  });

  it('shows delay input for fixed mode', () => {
    render(<DelayConfig data={makeData({ mode: 'fixed', delayMs: 1234 })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('1234')).toBeTruthy();
    expect(screen.getByLabelText('Delay (ms)')).toBeTruthy();
  });

  it('applies a quick preset in fixed mode', () => {
    const onChange = vi.fn();
    render(<DelayConfig data={makeData({ mode: 'fixed', delayMs: 100 })} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '1 s' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ delayMs: 1000 }));
  });

  it('renders how-it-works tips', () => {
    render(<DelayConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByTestId('delay-config')).toBeTruthy();
    expect(screen.getByText('How delay works')).toBeTruthy();
  });

  it('calls onChange when delay changes in fixed mode', () => {
    const onChange = vi.fn();
    render(<DelayConfig data={makeData({ mode: 'fixed', delayMs: 500 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('500'), { target: { value: '2000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ delayMs: 2000 }));
  });

  it('defaults delayMs to 0 on invalid input', () => {
    const onChange = vi.fn();
    render(<DelayConfig data={makeData({ mode: 'fixed', delayMs: 500 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('500'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ delayMs: 0 }));
  });

  it('shows min/max inputs for random mode', () => {
    render(<DelayConfig data={makeData({ mode: 'random', minMs: 100, maxMs: 2000 })} onChange={vi.fn()} />);
    expect(screen.getByText('Min')).toBeTruthy();
    expect(screen.getByText('Max')).toBeTruthy();
    expect(screen.getByLabelText('Min (ms)')).toBeTruthy();
    expect(screen.getByLabelText('Max (ms)')).toBeTruthy();
    expect(screen.getByDisplayValue('100')).toBeTruthy();
    expect(screen.getByDisplayValue('2000')).toBeTruthy();
  });

  it('hides delay input in random mode', () => {
    render(<DelayConfig data={makeData({ mode: 'random', minMs: 0, maxMs: 1000 })} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Delay (ms)')).toBeNull();
    expect(screen.queryByText('Quick presets')).toBeNull();
  });

  it('calls onChange when minMs changes', () => {
    const onChange = vi.fn();
    render(<DelayConfig data={makeData({ mode: 'random', minMs: 100, maxMs: 2000 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '250' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minMs: 250 }));
  });

  it('calls onChange when maxMs changes', () => {
    const onChange = vi.fn();
    render(<DelayConfig data={makeData({ mode: 'random', minMs: 100, maxMs: 2000 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('2000'), { target: { value: '5000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxMs: 5000 }));
  });

  it('defaults minMs to 0 when undefined', () => {
    render(<DelayConfig data={makeData({ mode: 'random', minMs: undefined, maxMs: 1000 })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('0')).toBeTruthy();
  });

  it('defaults maxMs to delayMs when undefined', () => {
    render(<DelayConfig data={makeData({ mode: 'random', delayMs: 3000, maxMs: undefined })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('3000')).toBeTruthy();
  });

  it('coerces invalid minMs input to 0 in random mode', () => {
    const onChange = vi.fn();
    render(<DelayConfig data={makeData({ mode: 'random', minMs: 100, maxMs: 500 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('100'), { target: { value: 'not-a-number' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minMs: 0 }));
  });

  it('coerces invalid maxMs input to 0 in random mode', () => {
    const onChange = vi.fn();
    render(<DelayConfig data={makeData({ mode: 'random', minMs: 10, maxMs: 500 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('500'), { target: { value: 'xyz' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxMs: 0 }));
  });
});
