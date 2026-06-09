// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyValueEditor } from './KeyValueEditor';
import type { WsKeyValueEntry } from '../../shared/websocket/types';

function makeEntries(...keys: string[]): WsKeyValueEntry[] {
  return keys.map((key) => ({ key, value: `val-${key}`, enabled: true }));
}

describe('KeyValueEditor', () => {
  it('renders label and add button', () => {
    render(<KeyValueEditor entries={[]} onChange={vi.fn()} label="Headers" />);
    expect(screen.getByText('Headers')).toBeInTheDocument();
    expect(screen.getByText('+ Add')).toBeInTheDocument();
  });

  it('renders entries with correct values', () => {
    const entries = makeEntries('Authorization', 'Content-Type');
    render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="Headers" testIdPrefix="h" />);
    expect(screen.getByDisplayValue('Authorization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('val-Authorization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Content-Type')).toBeInTheDocument();
  });

  it('calls onChange with new empty entry when Add is clicked', () => {
    const onChange = vi.fn();
    const entries = makeEntries('X-Key');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    fireEvent.click(screen.getByText('+ Add'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const newEntries = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(newEntries).toHaveLength(2);
    expect(newEntries[1]).toEqual({ key: '', value: '', enabled: true });
  });

  it('calls onChange when key input changes', () => {
    const onChange = vi.fn();
    const entries = makeEntries('X-Key');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    fireEvent.change(screen.getByDisplayValue('X-Key'), { target: { value: 'New-Key' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(updated[0].key).toBe('New-Key');
  });

  it('calls onChange when value input changes', () => {
    const onChange = vi.fn();
    const entries = makeEntries('X-Key');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    fireEvent.change(screen.getByDisplayValue('val-X-Key'), { target: { value: 'new-val' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(updated[0].value).toBe('new-val');
  });

  it('calls onChange when checkbox is toggled', () => {
    const onChange = vi.fn();
    const entries = makeEntries('X-Key');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(updated[0].enabled).toBe(false);
  });

  it('calls onChange with entry removed when remove button is clicked', () => {
    const onChange = vi.fn();
    const entries = makeEntries('A', 'B');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const remaining = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].key).toBe('B');
  });

  it('disables inputs and buttons when disabled=true', () => {
    const entries = makeEntries('X-Key');
    render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="Headers" disabled />);
    expect(screen.getByText('+ Add')).toBeDisabled();
    expect(screen.getByDisplayValue('X-Key')).toBeDisabled();
    expect(screen.getByDisplayValue('val-X-Key')).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('×')).toBeDisabled();
  });

  it('renders with custom section/header/label class names', () => {
    const { container } = render(
      <KeyValueEditor
        entries={[]}
        onChange={vi.fn()}
        label="Headers"
        sectionClassName="custom-section"
        headerClassName="custom-header"
        labelClassName="custom-label"
      />,
    );
    expect(container.querySelector('.custom-section')).toBeInTheDocument();
    expect(container.querySelector('.custom-header')).toBeInTheDocument();
    expect(container.querySelector('.custom-label')).toBeInTheDocument();
  });

  it('renders test-id attributes when testIdPrefix is provided', () => {
    const entries = makeEntries('A');
    render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="H" testIdPrefix="my" />);
    expect(screen.getByTestId('my-section')).toBeInTheDocument();
    expect(screen.getByTestId('my-add-btn')).toBeInTheDocument();
    expect(screen.getByTestId('my-row-0')).toBeInTheDocument();
  });

  it('does not render test-id attributes when testIdPrefix is not provided', () => {
    const entries = makeEntries('A');
    const { container } = render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="H" />);
    const section = container.querySelector('.ws-connect-kv-section');
    expect(section).toBeInTheDocument();
    expect(section?.getAttribute('data-testid')).toBeNull();
  });

  it('renders correct aria labels', () => {
    const entries = makeEntries('A');
    render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="Headers" />);
    expect(screen.getByLabelText('Add headers')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable headers 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Headers key 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Headers value 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove headers 1')).toBeInTheDocument();
  });
});
