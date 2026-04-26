/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import WaitForConditionConfig from './WaitForConditionConfig';
import type { WaitForConditionNodeData } from '../../types/workflow';

function makeData(overrides: Partial<WaitForConditionNodeData> = {}): WaitForConditionNodeData {
  return {
    label: 'Wait',
    conditionExpression: '{{status}} == done',
    pollIntervalMs: 1000,
    timeoutMs: 30000,
    maxAttempts: 10,
    ...overrides,
  };
}

describe('WaitForConditionConfig', () => {
  it('renders label and condition expression fields', () => {
    render(<WaitForConditionConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Wait')).toBeTruthy();
    expect(screen.getByDisplayValue('{{status}} == done')).toBeTruthy();
  });

  it('calls onChange when label is edited', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Wait'), { target: { value: 'Poll' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Poll' }));
  });

  it('calls onChange when condition expression is edited', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{{status}} == done'), { target: { value: '{{count}} > 5' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ conditionExpression: '{{count}} > 5' }));
  });

  it('calls onChange when polling interval is edited', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('1000'), { target: { value: '2000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pollIntervalMs: 2000 }));
  });

  it('clamps polling interval to minimum 100', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('1000'), { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pollIntervalMs: 100 }));
  });

  it('calls onChange when timeout is edited', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('30000'), { target: { value: '60000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 60000 }));
  });

  it('calls onChange when max attempts is edited', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '20' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 20 }));
  });

  it('clamps max attempts to 0-1000', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData({ maxAttempts: 5 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '1500' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 1000 }));
  });

  it('does not render Insert button when onRequestVariableInsert is not provided', () => {
    render(<WaitForConditionConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.queryByText('Insert…')).toBeNull();
  });

  it('renders Insert button when onRequestVariableInsert is provided', () => {
    render(<WaitForConditionConfig data={makeData()} onChange={vi.fn()} onRequestVariableInsert={vi.fn()} />);
    expect(screen.getByText('Insert…')).toBeTruthy();
  });

  it('calls onRequestVariableInsert and applies snippet to condition expression', () => {
    const onRequest = vi.fn();
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} onRequestVariableInsert={onRequest} />);
    fireEvent.click(screen.getByText('Insert…'));
    expect(onRequest).toHaveBeenCalledTimes(1);
    const applyFn = onRequest.mock.calls[0][0];
    applyFn('{{newVar}}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      conditionExpression: '{{status}} == done{{newVar}}',
    }));
  });

  it('renders "How it works" section', () => {
    render(<WaitForConditionConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByText('How it works')).toBeTruthy();
  });

  it('defaults polling interval to 1000 on NaN input', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('1000'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pollIntervalMs: 1000 }));
  });

  it('defaults timeout to 0 on NaN input', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('30000'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 0 }));
  });

  it('defaults maxAttempts to 0 on NaN input', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 0 }));
  });

  it('clamps timeout to minimum 0', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('30000'), { target: { value: '-500' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 0 }));
  });

  it('clamps maxAttempts to minimum 0', () => {
    const onChange = vi.fn();
    render(<WaitForConditionConfig data={makeData({ maxAttempts: 5 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '-1' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 0 }));
  });
});
