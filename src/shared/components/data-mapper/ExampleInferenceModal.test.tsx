/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExampleInferenceModal from './ExampleInferenceModal';

describe('ExampleInferenceModal', () => {
  it('renders with title and input areas', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    expect(screen.getByText('Learn from Examples')).toBeTruthy();
    expect(screen.getByPlaceholderText(/name.*Alice/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/fullName.*Alice/)).toBeTruthy();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ExampleInferenceModal onClose={onClose} onApply={vi.fn()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ExampleInferenceModal onClose={onClose} onApply={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Analyze button disabled when no input', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    const btn = screen.getByText(/Analyze/);
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Analyze button when both fields have content', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{"a": 1}' } });
    fireEvent.change(textareas[1], { target: { value: '{"b": 1}' } });
    const btn = screen.getByText(/Analyze/);
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows error for invalid JSON', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{bad}' } });
    fireEvent.change(textareas[1], { target: { value: '{"a": 1}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(document.querySelector('.dm-example-error')).toBeTruthy();
  });

  it('shows inferred results after valid analysis', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{"name": "Alice"}' } });
    fireEvent.change(textareas[1], { target: { value: '{"fullName": "Alice"}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(screen.getByText(/inferred/)).toBeTruthy();
  });

  it('calls onApply with selected mappings', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<ExampleInferenceModal onClose={onClose} onApply={onApply} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{"name": "Alice"}' } });
    fireEvent.change(textareas[1], { target: { value: '{"fullName": "Alice"}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    fireEvent.click(screen.getByText(/Apply/));
    expect(onApply).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ sourcePath: 'name', targetPath: 'fullName' }),
    ]));
    expect(onClose).toHaveBeenCalled();
  });

  it('can add and remove example rows', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    expect(document.querySelectorAll('.dm-example-row').length).toBe(1);
    fireEvent.click(screen.getByText('+ Add example pair'));
    expect(document.querySelectorAll('.dm-example-row').length).toBe(2);
    const removeButtons = document.querySelectorAll('.dm-example-remove');
    fireEvent.click(removeButtons[0]);
    expect(document.querySelectorAll('.dm-example-row').length).toBe(1);
  });

  it('shows "no mappings" message when inference finds nothing', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{"a": "foo"}' } });
    fireEvent.change(textareas[1], { target: { value: '{"b": "bar"}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(screen.getByText(/No mappings could be inferred/)).toBeTruthy();
  });

  it('can deselect inferred mappings', () => {
    const onApply = vi.fn();
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={onApply} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{"a": 1, "b": 2}' } });
    fireEvent.change(textareas[1], { target: { value: '{"x": 1, "y": 2}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    const checkboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(false);
  });
});
