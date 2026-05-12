/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddFieldRow from './AddFieldRow';

function renderRow(overrides?: Partial<Parameters<typeof AddFieldRow>[0]>) {
  const defaults = {
    existingPaths: new Set<string>(),
    onAdd: vi.fn(),
  };
  return { ...render(<AddFieldRow {...defaults} {...overrides} />), onAdd: overrides?.onAdd ?? defaults.onAdd };
}

describe('AddFieldRow', () => {
  it('shows "+ Add Field" button initially', () => {
    renderRow();
    expect(screen.getByText('+ Add Field')).toBeTruthy();
  });

  it('opens inline form on button click', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    expect(screen.getByLabelText('Field name')).toBeTruthy();
    expect(screen.getByLabelText('Field type')).toBeTruthy();
  });

  it('calls onAdd with correct field on Enter', () => {
    const onAdd = vi.fn();
    renderRow({ onAdd });
    fireEvent.click(screen.getByText('+ Add Field'));
    const input = screen.getByLabelText('Field name');
    fireEvent.change(input, { target: { value: 'myField' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      path: 'myField',
      label: 'myField',
      type: 'string',
      origin: 'custom',
    }));
  });

  it('calls onAdd on confirm button click', () => {
    const onAdd = vi.fn();
    renderRow({ onAdd });
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'testField' } });
    fireEvent.click(screen.getByLabelText('Confirm add field'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Escape' });
    expect(screen.getByText('+ Add Field')).toBeTruthy();
  });

  it('cancels on cancel button click', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.click(screen.getByLabelText('Cancel add field'));
    expect(screen.getByText('+ Add Field')).toBeTruthy();
  });

  it('shows error for empty name', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Field name cannot be empty')).toBeTruthy();
  });

  it('shows error for name with spaces', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'has space' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByText('Field name cannot contain spaces')).toBeTruthy();
  });

  it('shows error for duplicate path', () => {
    renderRow({ existingPaths: new Set(['existingField']) });
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'existingField' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByText('Field already exists')).toBeTruthy();
  });

  it('supports nested dot-notation names', () => {
    const onAdd = vi.fn();
    renderRow({ onAdd });
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'user.name' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      path: 'user.name',
      label: 'name',
      origin: 'custom',
    }));
  });

  it('allows changing field type', () => {
    const onAdd = vi.fn();
    renderRow({ onAdd });
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'count' } });
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'number' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      path: 'count',
      type: 'number',
    }));
  });

  it('resets form after successful add', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'field1' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByText('+ Add Field')).toBeTruthy();
  });

  it('clears error when user types', () => {
    renderRow();
    fireEvent.click(screen.getByText('+ Add Field'));
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'a' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
