/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { selectOption } from '../../../../test-utils/customSelectHelper';
import LogDebugConfig from './LogDebugConfig';
import type { LogDebugNodeData } from '../../types/workflow';

function makeData(overrides: Partial<LogDebugNodeData> = {}): LogDebugNodeData {
  return {
    label: 'Log Step',
    logLevel: 'info',
    message: 'Status is {{status}}',
    snapshotVariables: false,
    ...overrides,
  };
}

describe('LogDebugConfig', () => {
  it('renders label, level, and message fields', () => {
    render(<LogDebugConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Log Step')).toBeTruthy();
    expect(screen.getByDisplayValue('Status is {{status}}')).toBeTruthy();
  });

  it('calls onChange when label is edited', () => {
    const onChange = vi.fn();
    render(<LogDebugConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Log Step'), { target: { value: 'Debug' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Debug' }));
  });

  it('calls onChange when log level is changed', () => {
    const onChange = vi.fn();
    const { container } = render(<LogDebugConfig data={makeData()} onChange={onChange} />);
    selectOption(container, 'Error');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ logLevel: 'error' }));
  });

  it('calls onChange when message is edited', () => {
    const onChange = vi.fn();
    render(<LogDebugConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Status is {{status}}'), { target: { value: 'Done' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ message: 'Done' }));
  });

  it('calls onChange when snapshot checkbox is toggled', () => {
    const onChange = vi.fn();
    render(<LogDebugConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Snapshot all variables/));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ snapshotVariables: true }));
  });

  it('does not render Insert button when onRequestVariableInsert is not provided', () => {
    render(<LogDebugConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.queryByText('Insert…')).toBeNull();
  });

  it('renders Insert button when onRequestVariableInsert is provided', () => {
    render(<LogDebugConfig data={makeData()} onChange={vi.fn()} onRequestVariableInsert={vi.fn()} />);
    expect(screen.getByText('Insert…')).toBeTruthy();
  });

  it('calls onRequestVariableInsert and applies snippet to message', () => {
    const onRequest = vi.fn();
    const onChange = vi.fn();
    render(<LogDebugConfig data={makeData()} onChange={onChange} onRequestVariableInsert={onRequest} />);
    fireEvent.click(screen.getByText('Insert…'));
    expect(onRequest).toHaveBeenCalledTimes(1);
    const applyFn = onRequest.mock.calls[0][0];
    applyFn('{{userId}}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ message: 'Status is {{status}}{{userId}}' }));
  });

  it('renders all log level options', () => {
    const { container } = render(<LogDebugConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(container.querySelector('.cs-trigger')!);
    const labels = Array.from(document.querySelectorAll('.cs-item-label')).map(el => el.textContent);
    expect(labels).toContain('Info');
    expect(labels).toContain('Warning');
    expect(labels).toContain('Error');
    expect(labels).toContain('Debug');
  });
});
