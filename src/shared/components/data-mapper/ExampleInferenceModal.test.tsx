/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExampleInferenceModal from './ExampleInferenceModal';
import * as exampleInference from './utils/exampleInference';

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

  it('does not close on non-Escape keys on overlay', () => {
    const onClose = vi.fn();
    render(<ExampleInferenceModal onClose={onClose} onApply={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
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

  it('flags the output textarea when only output JSON is invalid', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{"a": 1}' } });
    fireEvent.change(textareas[1], { target: { value: '{bad}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(textareas[1].className).toContain('dm-example-textarea--error');
    expect(textareas[0].className).not.toContain('dm-example-textarea--error');
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
    expect(document.querySelectorAll('.dm-example-card').length).toBe(1);
    fireEvent.click(screen.getByText(/Add pair/));
    expect(document.querySelectorAll('.dm-example-card').length).toBe(2);
    const removeButtons = document.querySelectorAll('.dm-example-card-remove');
    fireEvent.click(removeButtons[0]);
    expect(document.querySelectorAll('.dm-example-card').length).toBe(1);
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

  it('re-selects an inferred mapping when checkbox toggled again', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{"a": 1}' } });
    fireEvent.change(textareas[1], { target: { value: '{"x": 1}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    const cb = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    fireEvent.click(cb);
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
  });

  it('does not add rows beyond the maximum', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    for (let i = 0; i < 5; i++) {
      const add = screen.queryByText(/Add pair/);
      if (!add) break;
      fireEvent.click(add);
    }
    expect(document.querySelectorAll('.dm-example-card').length).toBe(5);
    expect(screen.queryByText(/Add pair/)).toBeNull();
  });

  it('uses plural example count in button when multiple rows are valid', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    fireEvent.click(screen.getByText(/Add pair/));
    const cards = document.querySelectorAll('.dm-example-card');
    const ta0 = cards[0].querySelectorAll('textarea');
    const ta1 = cards[1].querySelectorAll('textarea');
    fireEvent.change(ta0[0], { target: { value: '{"a":1}' } });
    fireEvent.change(ta0[1], { target: { value: '{"b":1}' } });
    fireEvent.change(ta1[0], { target: { value: '{"a":2}' } });
    fireEvent.change(ta1[1], { target: { value: '{"b":2}' } });
    expect(screen.getByText(/Analyze \(2\)/)).toBeTruthy();
  });

  it('uses single count in button for a single valid pair', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{"a":1}' } });
    fireEvent.change(textareas[1], { target: { value: '{"b":1}' } });
    expect(screen.getByText(/Analyze \(1\)/)).toBeTruthy();
  });

  it('shows Analyze again when engine returns an empty mapping list', () => {
    vi.spyOn(exampleInference, 'inferMappingsFromExamples').mockReturnValue([]);
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{"a":1}' } });
    fireEvent.change(textareas[1], { target: { value: '{"b":2}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(screen.getByText(/Analyze/)).toBeTruthy();
    expect(screen.getByText('0 mappings inferred')).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('updates rows when one pair fails and another succeeds', () => {
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    fireEvent.click(screen.getByText(/Add pair/));
    const cards = document.querySelectorAll('.dm-example-card');
    const r0 = cards[0].querySelectorAll('textarea');
    const r1 = cards[1].querySelectorAll('textarea');
    fireEvent.change(r0[0], { target: { value: '{bad}' } });
    fireEvent.change(r0[1], { target: { value: '{"b":1}' } });
    fireEvent.change(r1[0], { target: { value: '{"a":1}' } });
    fireEvent.change(r1[1], { target: { value: '{"b":1}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(r0[0].className).toContain('dm-example-textarea--error');
    expect(r1[0].className).not.toContain('dm-example-textarea--error');
    vi.spyOn(exampleInference, 'inferMappingsFromExamples').mockReturnValue([
      { sourcePath: 'a', targetPath: 'b', confidence: 100, reason: 'ok' },
    ]);
    fireEvent.change(r0[0], { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(screen.getByText('1 mapping inferred')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Apply 1 mapping/ })).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('renders confidence tiers and optional expression from inference results', () => {
    vi.spyOn(exampleInference, 'inferMappingsFromExamples').mockReturnValue([
      { sourcePath: 'a', targetPath: 'b', confidence: 85, reason: 'exact' },
      { sourcePath: 'c', targetPath: 'd', confidence: 70, reason: 'mid', expression: '$.c' },
      { sourcePath: 'e', targetPath: 'f', confidence: 50, reason: 'low' },
    ]);
    render(<ExampleInferenceModal onClose={vi.fn()} onApply={vi.fn()} />);
    const textareas = document.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '{"a":1,"c":2,"e":3}' } });
    fireEvent.change(textareas[1], { target: { value: '{"b":1,"d":2,"f":3}' } });
    fireEvent.click(screen.getByText(/Analyze/));
    const rows = document.querySelectorAll('.dm-example-result-row');
    expect(rows.length).toBe(3);
    expect(document.querySelector('.dm-example-score--high')).not.toBeNull();
    expect(document.querySelector('.dm-example-score--mid')).not.toBeNull();
    expect(document.querySelector('.dm-example-score--low')).not.toBeNull();
    expect(document.querySelector('.dm-example-expr')?.textContent).toBe('$.c');
    vi.restoreAllMocks();
  });
});
