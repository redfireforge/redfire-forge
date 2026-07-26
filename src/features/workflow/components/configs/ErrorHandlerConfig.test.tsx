/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption, selectOptionByIndex, getCustomSelectValue } from '../../../../test-utils/customSelectHelper';
import ErrorHandlerConfig from './ErrorHandlerConfig';
import type { ErrorHandlerNodeData } from '../../types/workflow';

function makeData(overrides: Partial<ErrorHandlerNodeData> = {}): ErrorHandlerNodeData {
  return {
    label: 'Error Handler',
    errorFilter: 'all',
    retryCount: 0,
    retryDelayMs: 1000,
    retryBackoff: 'fixed',
    retryTimeoutMs: 0,
    continueOnError: false,
    ...overrides,
  };
}

describe('ErrorHandlerConfig', () => {
  it('renders label input', () => {
    render(<ErrorHandlerConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Error Handler')).toBeTruthy();
  });

  it('calls onChange when label changes', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Error Handler'), { target: { value: 'My Handler' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'My Handler' }));
  });

  it('renders error filter dropdown with all options', () => {
    const { container } = render(<ErrorHandlerConfig data={makeData()} onChange={vi.fn()} />);
    expect(getCustomSelectValue(container, 0)).toBe('All Errors');
    fireEvent.click(container.querySelectorAll('.cs-trigger')[0]!);
    expect(screen.getByText('HTTP Errors')).toBeTruthy();
    expect(screen.getByText('Assertion Failures')).toBeTruthy();
    expect(screen.getByText('Network Errors')).toBeTruthy();
  });

  it('calls onChange when error filter changes', () => {
    const onChange = vi.fn();
    const { container } = render(<ErrorHandlerConfig data={makeData()} onChange={onChange} />);
    selectOption(container, 'HTTP Errors');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ errorFilter: 'http-error' }));
  });

  it('shows description matching selected filter', () => {
    render(<ErrorHandlerConfig data={makeData({ errorFilter: 'network-error' })} onChange={vi.fn()} />);
    expect(screen.getByText(/Network\/timeout errors/)).toBeTruthy();
  });

  it('renders retry count input', () => {
    render(<ErrorHandlerConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('0')).toBeTruthy();
  });

  it('calls onChange when retry count changes', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 3 }));
  });

  it('clamps retry count to 0 for negative values', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '-5' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 0 }));
  });

  it('hides retry settings when retryCount is 0', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 0 })} onChange={vi.fn()} />);
    expect(screen.queryByText('Delay')).toBeNull();
    expect(screen.queryByText('Backoff')).toBeNull();
    expect(screen.queryByText('Timeout')).toBeNull();
  });

  it('shows retry settings when retryCount > 0', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 3 })} onChange={vi.fn()} />);
    expect(screen.getByText('Delay')).toBeTruthy();
    expect(screen.getByText('Backoff')).toBeTruthy();
    expect(screen.getByText('Timeout')).toBeTruthy();
  });

  it('calls onChange when retry delay changes', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    const label = screen.getByText('Delay');
    const field = label.closest('.errh-field-inline')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryDelayMs: 2000 }));
  });

  it('renders backoff strategy selector', () => {
    const { container } = render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={vi.fn()} />);
    expect(getCustomSelectValue(container, 1)).toBe('Fixed');
    fireEvent.click(container.querySelectorAll('.cs-trigger')[1]!);
    expect(screen.getByText('Exponential')).toBeTruthy();
  });

  it('calls onChange when backoff strategy changes', () => {
    const onChange = vi.fn();
    const { container } = render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    selectOptionByIndex(container, 1, 'Exponential');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryBackoff: 'exponential' }));
  });

  it('shows retry preview with fixed delays', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2, retryDelayMs: 500, retryBackoff: 'fixed' })} onChange={vi.fn()} />);
    const preview = document.querySelector('.errh-retry-preview');
    expect(preview).toBeTruthy();
    expect(preview!.textContent).toContain('500ms');
    expect(preview!.textContent).toContain('Retry 1');
    expect(preview!.textContent).toContain('Retry 2');
  });

  it('shows retry preview with exponential delays', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 3, retryDelayMs: 500, retryBackoff: 'exponential' })} onChange={vi.fn()} />);
    const preview = document.querySelector('.errh-retry-preview');
    expect(preview).toBeTruthy();
    expect(preview!.textContent).toContain('500ms');
    expect(preview!.textContent).toContain('1s');
    expect(preview!.textContent).toContain('2s');
  });

  it('caps retry preview steps at 5 when retryCount is greater than 5', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 6, retryDelayMs: 100, retryBackoff: 'fixed' })} onChange={vi.fn()} />);
    const preview = document.querySelector('.errh-retry-preview');
    expect(preview).toBeTruthy();
    expect(preview!.textContent).toContain('Retry 5');
    expect(preview!.textContent).not.toContain('Retry 6');
  });

  it('formats retry preview delay with decimal seconds when needed', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 1, retryDelayMs: 1500, retryBackoff: 'fixed' })} onChange={vi.fn()} />);
    const preview = document.querySelector('.errh-retry-preview');
    expect(preview).toBeTruthy();
    expect(preview!.textContent).toContain('1.5s');
  });

  it('calls onChange when retry timeout changes', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    const label = screen.getByText('Timeout');
    const field = label.closest('.errh-field-inline')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '30000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryTimeoutMs: 30000 }));
  });

  it('renders continueOnError checkbox', () => {
    render(<ErrorHandlerConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByText('Continue workflow after catch')).toBeTruthy();
  });

  it('calls onChange when continueOnError is toggled', () => {
    const onChange = vi.fn();
    const { container } = render(<ErrorHandlerConfig data={makeData()} onChange={onChange} />);
    const checkbox = container.querySelector('.errh-checkbox-label input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ continueOnError: true }));
  });

  it('shows continue hint when continueOnError is true', () => {
    render(<ErrorHandlerConfig data={makeData({ continueOnError: true })} onChange={vi.fn()} />);
    expect(screen.getByText(/Workflow continues normally/)).toBeTruthy();
  });

  it('shows fail hint when continueOnError is false', () => {
    render(<ErrorHandlerConfig data={makeData({ continueOnError: false })} onChange={vi.fn()} />);
    expect(screen.getByText(/Workflow marks this handler as failed/)).toBeTruthy();
  });

  it('shows plain timeout unit text when timeout is non-zero', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2, retryTimeoutMs: 1000 })} onChange={vi.fn()} />);
    const label = screen.getByText('Timeout');
    const field = label.closest('.errh-field-inline')!;
    expect(field.textContent).toContain('ms');
    expect(field.textContent).not.toContain('ms (no limit)');
  });

  it('renders output handles guide', () => {
    render(<ErrorHandlerConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByText('Output Handles')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByText('Catch')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('clamps retry count to 0 for NaN input', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('0'), { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 0 }));
  });

  it('clamps retry timeout to 0 for NaN input', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    const label = screen.getByText('Timeout');
    const field = label.closest('.errh-field-inline')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryTimeoutMs: 0 }));
  });

  it('clamps retry delay to 0 for NaN input', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    const label = screen.getByText('Delay');
    const field = label.closest('.errh-field-inline')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryDelayMs: 0 }));
  });

  it('clamps retry delay to 0 for negative input', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    const label = screen.getByText('Delay');
    const field = label.closest('.errh-field-inline')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-100' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryDelayMs: 0 }));
  });

  it('clamps retry timeout to 0 for negative input', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    const label = screen.getByText('Timeout');
    const field = label.closest('.errh-field-inline')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-1000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryTimeoutMs: 0 }));
  });

  it('shows empty filter description when errorFilter does not match options', () => {
    const dataWithUnknownFilter = makeData({
      errorFilter: 'unknown-filter' as unknown as ErrorHandlerNodeData['errorFilter'],
    });
    const { container } = render(<ErrorHandlerConfig data={dataWithUnknownFilter} onChange={vi.fn()} />);
    const desc = container.querySelector('.errh-filter-desc');
    expect(desc).toBeTruthy();
    expect(desc!.textContent).toBe('');
  });

  it('does not show retry preview when retryCount is 0', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 0 })} onChange={vi.fn()} />);
    expect(document.querySelector('.errh-retry-preview')).toBeNull();
  });
});
