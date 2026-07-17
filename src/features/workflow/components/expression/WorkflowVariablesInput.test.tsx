/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowVariablesInput from './WorkflowVariablesInput';

describe('WorkflowVariablesInput', () => {
  it('renders title and hint with no variables', () => {
    render(<WorkflowVariablesInput variables={{}} onChange={vi.fn()} />);
    expect(screen.getByText('Initial Variables')).toBeTruthy();
    // no rows
    expect(document.querySelectorAll('.wf-var-row').length).toBe(0);
  });

  it('renders existing variable rows', () => {
    render(<WorkflowVariablesInput variables={{ baseUrl: 'http://x', token: 'abc' }} onChange={vi.fn()} />);
    const rows = document.querySelectorAll('.wf-var-row');
    expect(rows.length).toBe(2);
    expect(screen.getByText('baseUrl')).toBeTruthy();
    expect(screen.getByText('token')).toBeTruthy();
  });

  it('updates a variable value', () => {
    const onChange = vi.fn();
    render(<WorkflowVariablesInput variables={{ a: '1' }} onChange={onChange} />);
    const valueInput = document.querySelector('.wf-var-value-input') as HTMLInputElement;
    fireEvent.change(valueInput, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({ a: '2' });
  });

  it('removes a variable', () => {
    const onChange = vi.fn();
    render(<WorkflowVariablesInput variables={{ a: '1', b: '2' }} onChange={onChange} />);
    const removeBtn = screen.getAllByText('×')[0];
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith({ b: '2' });
  });

  it('adds a new variable via Add button, stripping braces', () => {
    const onChange = vi.fn();
    render(<WorkflowVariablesInput variables={{}} onChange={onChange} />);
    const keyInput = document.querySelector('.wf-var-add-key') as HTMLInputElement;
    const valInput = document.querySelector('.wf-var-add-value') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: '{{newKey}}' } });
    fireEvent.change(valInput, { target: { value: 'val' } });
    fireEvent.click(screen.getByText('+ Add'));
    expect(onChange).toHaveBeenCalledWith({ newKey: 'val' });
  });

  it('does not add when key is blank', () => {
    const onChange = vi.fn();
    render(<WorkflowVariablesInput variables={{}} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds via Enter key on key input', () => {
    const onChange = vi.fn();
    render(<WorkflowVariablesInput variables={{}} onChange={onChange} />);
    const keyInput = document.querySelector('.wf-var-add-key') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'x' } });
    fireEvent.keyDown(keyInput, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ x: '' });
  });

  it('adds via Enter key on value input', () => {
    const onChange = vi.fn();
    render(<WorkflowVariablesInput variables={{}} onChange={onChange} />);
    const keyInput = document.querySelector('.wf-var-add-key') as HTMLInputElement;
    const valInput = document.querySelector('.wf-var-add-value') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'x' } });
    fireEvent.change(valInput, { target: { value: 'y' } });
    fireEvent.keyDown(valInput, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ x: 'y' });
  });

  it('hides add row and disables inputs when disabled', () => {
    render(<WorkflowVariablesInput variables={{ a: '1' }} onChange={vi.fn()} disabled />);
    expect(document.querySelector('.wf-var-add-row')).toBeNull();
    const valueInput = document.querySelector('.wf-var-value-input') as HTMLInputElement;
    expect(valueInput.disabled).toBe(true);
  });
});
