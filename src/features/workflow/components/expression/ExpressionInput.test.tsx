/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createRef } from 'react';
import ExpressionInput from './ExpressionInput';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

const sampleHints: WorkflowVariableHint[] = [
  { ref: 'myVar', description: 'A test var', source: { nodeId: 'n1', nodeLabel: 'Node1' } },
  { ref: 'userId', description: 'User ID', source: { nodeId: 'n2', nodeLabel: 'Node2' } },
];

function renderInput(value = '', onChange = vi.fn(), props: Record<string, unknown> = {}) {
  return render(
    <ExpressionInput
      value={value}
      onChange={onChange}
      placeholder="Enter expression"
      variableHints={sampleHints}
      {...props}
    />,
  );
}

describe('ExpressionInput', () => {
  it('renders an input field', () => {
    renderInput();
    expect(screen.getByPlaceholderText('Enter expression')).toBeTruthy();
  });

  it('does not show dropdown initially', () => {
    renderInput();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows variable dropdown when {{ is typed', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionInput value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Simulate typing `{{`
    fireEvent.change(input, { target: { value: '{{', selectionStart: 2 } });

    // Re-render with new value (controlled component)
    rerender(
      <ExpressionInput value="{{" onChange={onChange} variableHints={sampleHints} />,
    );

    // The dropdown should appear via portal on document.body
    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();
    // Should contain variable hints
    expect(listbox!.textContent).toContain('myVar');
    expect(listbox!.textContent).toContain('userId');
  });

  it('shows function dropdown when {{$ is typed', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionInput value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '{{$', selectionStart: 3 } });
    rerender(
      <ExpressionInput value="{{$" onChange={onChange} variableHints={sampleHints} />,
    );

    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();
    // Should contain function hints (ƒ icon)
    expect(listbox!.textContent).toContain('$upper');
  });

  it('shows function dropdown when bare $ is typed', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionInput value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '$', selectionStart: 1 } });
    rerender(
      <ExpressionInput value="$" onChange={onChange} variableHints={sampleHints} />,
    );

    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();
    expect(listbox!.textContent).toContain('$upper');
  });

  it('filters functions when bare $co is typed', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionInput value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '$co', selectionStart: 3 } });
    rerender(
      <ExpressionInput value="$co" onChange={onChange} variableHints={sampleHints} />,
    );

    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();
    const text = listbox!.textContent!;
    expect(text).toContain('$concat');
    expect(text).toContain('$count');
    expect(text).toContain('$coalesce');
    // Should NOT contain unrelated functions
    expect(text).not.toContain('$upper');
  });

  it('hides dropdown when no trigger is present', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionInput value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'hello', selectionStart: 5 } });
    rerender(
      <ExpressionInput value="hello" onChange={onChange} variableHints={sampleHints} />,
    );

    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('calls onChange when input value changes', () => {
    const onChange = vi.fn();
    renderInput('', onChange);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'abc', selectionStart: 3 } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('passes className and disabled props', () => {
    renderInput('', vi.fn(), { className: 'custom-class', disabled: true });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.className).toContain('custom-class');
    expect(input.disabled).toBe(true);
  });

  it('passes aria-label prop', () => {
    renderInput('', vi.fn(), { 'aria-label': 'Test label' });
    expect(screen.getByLabelText('Test label')).toBeTruthy();
  });

  it('closes dropdown on blur when focus leaves', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionInput value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Open dropdown
    fireEvent.change(input, { target: { value: '{{', selectionStart: 2 } });
    rerender(<ExpressionInput value="{{" onChange={onChange} variableHints={sampleHints} />);
    expect(document.querySelector('[role="listbox"]')).toBeTruthy();

    // Blur — dropdown should close after rAF
    await act(async () => {
      fireEvent.blur(input);
      await new Promise((r) => requestAnimationFrame(r));
    });
    rerender(<ExpressionInput value="{{" onChange={onChange} variableHints={sampleHints} />);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('navigates items with keyboard and selects with Enter', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionInput value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Open dropdown
    fireEvent.change(input, { target: { value: '{{', selectionStart: 2 } });
    rerender(<ExpressionInput value="{{" onChange={onChange} variableHints={sampleHints} />);

    // Arrow down to select second item, then Enter
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Should have called onChange with completed variable
    expect(onChange).toHaveBeenCalled();
  });

  it('dismisses dropdown with Escape', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionInput value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '{{', selectionStart: 2 } });
    rerender(<ExpressionInput value="{{" onChange={onChange} variableHints={sampleHints} />);
    expect(document.querySelector('[role="listbox"]')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Escape' });
    rerender(<ExpressionInput value="{{" onChange={onChange} variableHints={sampleHints} />);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('selects a hint by clicking on it', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionInput value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '{{', selectionStart: 2 } });
    rerender(<ExpressionInput value="{{" onChange={onChange} variableHints={sampleHints} />);

    const options = document.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    fireEvent.mouseDown(options[0]);
    expect(onChange).toHaveBeenCalled();
  });

  it('exposes input element via forwardRef', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <ExpressionInput ref={ref} value="" onChange={vi.fn()} variableHints={sampleHints} />,
    );
    expect(ref.current).toBeTruthy();
    expect(ref.current?.tagName).toBe('INPUT');
  });

  it('handles change when selectionStart is null', () => {
    const onChange = vi.fn();
    renderInput('', onChange);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    // Simulate event where selectionStart is null
    Object.defineProperty(input, 'selectionStart', { value: null, writable: true });
    fireEvent.change(input, { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });
});
