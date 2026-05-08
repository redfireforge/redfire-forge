/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    render(<ErrorHandlerConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('All Errors')).toBeTruthy();
    expect(screen.getByText('HTTP Errors')).toBeTruthy();
    expect(screen.getByText('Assertion Failures')).toBeTruthy();
    expect(screen.getByText('Network Errors')).toBeTruthy();
  });

  it('calls onChange when error filter changes', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('All Errors'), { target: { value: 'http-error' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ errorFilter: 'http-error' }));
  });

  it('shows hint text matching selected filter', () => {
    render(<ErrorHandlerConfig data={makeData({ errorFilter: 'network-error' })} onChange={vi.fn()} />);
    expect(screen.getByText(/Catch network\/timeout errors/)).toBeTruthy();
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
    expect(screen.queryByText('Retry Delay (ms)')).toBeNull();
    expect(screen.queryByText('Backoff Strategy')).toBeNull();
    expect(screen.queryByText('Retry Timeout (ms)')).toBeNull();
  });

  it('shows retry settings when retryCount > 0', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 3 })} onChange={vi.fn()} />);
    expect(screen.getByText('Retry Delay (ms)')).toBeTruthy();
    expect(screen.getByText('Backoff Strategy')).toBeTruthy();
    expect(screen.getByText('Retry Timeout (ms)')).toBeTruthy();
  });

  it('calls onChange when retry delay changes', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    const label = screen.getByText('Retry Delay (ms)');
    const field = label.closest('.wf-config-field')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryDelayMs: 2000 }));
  });

  it('renders backoff strategy selector', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Fixed')).toBeTruthy();
    expect(screen.getByText('Exponential')).toBeTruthy();
  });

  it('calls onChange when backoff strategy changes', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Fixed'), { target: { value: 'exponential' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryBackoff: 'exponential' }));
  });

  it('shows fixed backoff hint for fixed strategy', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2, retryDelayMs: 500, retryBackoff: 'fixed' })} onChange={vi.fn()} />);
    expect(screen.getByText(/Wait 500ms between each retry/)).toBeTruthy();
  });

  it('shows exponential backoff hint for exponential strategy', () => {
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2, retryDelayMs: 500, retryBackoff: 'exponential' })} onChange={vi.fn()} />);
    expect(screen.getByText(/Wait 500ms, 1000ms, 2000ms/)).toBeTruthy();
  });

  it('calls onChange when retry timeout changes', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    const label = screen.getByText('Retry Timeout (ms)');
    const field = label.closest('.wf-config-field')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '30000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryTimeoutMs: 30000 }));
  });

  it('renders continueOnError checkbox', () => {
    render(<ErrorHandlerConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Continue workflow after catch/)).toBeTruthy();
  });

  it('calls onChange when continueOnError is toggled', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Continue workflow after catch/));
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

  it('renders "How it works" info section', () => {
    render(<ErrorHandlerConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByText('How it works')).toBeTruthy();
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
    const label = screen.getByText('Retry Timeout (ms)');
    const field = label.closest('.wf-config-field')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryTimeoutMs: 0 }));
  });

  it('clamps retry delay to 0 for NaN input', () => {
    const onChange = vi.fn();
    render(<ErrorHandlerConfig data={makeData({ retryCount: 2 })} onChange={onChange} />);
    const label = screen.getByText('Retry Delay (ms)');
    const field = label.closest('.wf-config-field')!;
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ retryDelayMs: 0 }));
  });
});
