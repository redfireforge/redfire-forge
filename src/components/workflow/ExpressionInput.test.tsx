/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExpressionInput from './ExpressionInput';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

const sampleHints: WorkflowVariableHint[] = [
  { ref: 'myVar', description: 'A test var', source: { nodeId: 'n1', nodeLabel: 'Node1' } },
  { ref: 'userId', description: 'User ID', source: { nodeId: 'n2', nodeLabel: 'Node2' } },
];

function renderInput(value = '', onChange = vi.fn()) {
  return render(
    <ExpressionInput
      value={value}
      onChange={onChange}
      placeholder="Enter expression"
      variableHints={sampleHints}
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
});
