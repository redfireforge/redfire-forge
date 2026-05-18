/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CascadeSelect } from './CascadeSelect';

const baseProps = {
  label: 'Environment',
  placeholder: 'Select...',
  value: '',
  onChange: vi.fn(),
  options: [
    { id: 'e1', name: 'Dev', detail: 'Development' },
    { id: 'e2', name: 'Prod' },
  ],
};

describe('CascadeSelect', () => {
  it('renders label and placeholder option', () => {
    render(<CascadeSelect {...baseProps} />);
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('Select...')).toBeInTheDocument();
  });

  it('renders options with detail suffix when provided', () => {
    render(<CascadeSelect {...baseProps} />);
    expect(screen.getByText('Dev (Development)')).toBeInTheDocument();
    expect(screen.getByText('Prod')).toBeInTheDocument();
  });

  it('calls onChange when selection changes', () => {
    const onChange = vi.fn();
    render(<CascadeSelect {...baseProps} onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'e1' } });
    expect(onChange).toHaveBeenCalledWith('e1');
  });

  it('shows "+ Create New" option when onCreate is provided', () => {
    render(<CascadeSelect {...baseProps} onCreate={vi.fn()} />);
    expect(screen.getByText('+ Create New')).toBeInTheDocument();
  });

  it('does not show "+ Create New" when onCreate is absent', () => {
    render(<CascadeSelect {...baseProps} />);
    expect(screen.queryByText('+ Create New')).toBeNull();
  });

  it('shows new name input when isCreating and onNewValueChange are set', () => {
    const onNewValueChange = vi.fn();
    render(
      <CascadeSelect
        {...baseProps}
        onCreate={vi.fn()}
        isCreating={true}
        onNewValueChange={onNewValueChange}
        newValue="test"
      />,
    );
    const input = screen.getByPlaceholderText('New environment name...');
    expect(input).toHaveValue('test');
    fireEvent.change(input, { target: { value: 'staging' } });
    expect(onNewValueChange).toHaveBeenCalledWith('staging');
  });

  it('does not show new input when isCreating but onNewValueChange is absent', () => {
    render(
      <CascadeSelect
        {...baseProps}
        onCreate={vi.fn()}
        isCreating={true}
      />,
    );
    expect(screen.queryByPlaceholderText('New environment name...')).toBeNull();
  });

  it('renders settings hint when no options exist', () => {
    render(
      <CascadeSelect
        {...baseProps}
        options={[]}
        settingsHint="Configure in Settings"
      />,
    );
    expect(screen.getByText('Configure in Settings')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('renders inline settings hint when options exist', () => {
    render(
      <CascadeSelect
        {...baseProps}
        settingsHint="Tip: use Settings"
      />,
    );
    expect(screen.getByText('Tip: use Settings')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('does not render settings hint sections when settingsHint is absent', () => {
    const { container } = render(<CascadeSelect {...baseProps} />);
    expect(container.querySelector('.send-harness-settings-hint')).toBeNull();
    expect(container.querySelector('.send-harness-settings-hint-inline')).toBeNull();
  });

  it('renders newValue as empty string when not provided', () => {
    render(
      <CascadeSelect
        {...baseProps}
        onCreate={vi.fn()}
        isCreating={true}
        onNewValueChange={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('New environment name...')).toHaveValue('');
  });

  it('auto-focuses new input when isCreating transitions to true', () => {
    const { rerender } = render(
      <CascadeSelect
        {...baseProps}
        onCreate={vi.fn()}
        isCreating={false}
        onNewValueChange={vi.fn()}
      />,
    );
    rerender(
      <CascadeSelect
        {...baseProps}
        onCreate={vi.fn()}
        isCreating={true}
        onNewValueChange={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText('New environment name...');
    expect(input).toHaveFocus();
  });
});
