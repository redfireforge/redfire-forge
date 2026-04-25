/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExpressionTextarea from './ExpressionTextarea';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

const sampleHints: WorkflowVariableHint[] = [
  { ref: 'myVar', description: 'A test var', source: { nodeId: 'n1', nodeLabel: 'Node1' } },
  { ref: 'userId', description: 'User ID', source: { nodeId: 'n2', nodeLabel: 'Node2' } },
];

function renderTextarea(value = '', onChange = vi.fn(), props: Record<string, unknown> = {}) {
  return render(
    <ExpressionTextarea
      value={value}
      onChange={onChange}
      placeholder="Enter body"
      variableHints={sampleHints}
      {...props}
    />,
  );
}

describe('ExpressionTextarea', () => {
  it('renders a textarea element', () => {
    renderTextarea();
    const ta = screen.getByPlaceholderText('Enter body');
    expect(ta).toBeTruthy();
    expect(ta.tagName).toBe('TEXTAREA');
  });

  it('does not show dropdown initially', () => {
    renderTextarea();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('calls onChange when textarea value changes', () => {
    const onChange = vi.fn();
    renderTextarea('', onChange);
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'hello', selectionStart: 5 } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('shows variable dropdown when {{ is typed', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionTextarea value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(ta, { target: { value: '{{', selectionStart: 2 } });
    rerender(<ExpressionTextarea value="{{" onChange={onChange} variableHints={sampleHints} />);

    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();
    expect(listbox!.textContent).toContain('myVar');
    expect(listbox!.textContent).toContain('userId');
  });

  it('shows function dropdown when bare $ is typed', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionTextarea value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(ta, { target: { value: '$', selectionStart: 1 } });
    rerender(<ExpressionTextarea value="$" onChange={onChange} variableHints={sampleHints} />);

    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();
    expect(listbox!.textContent).toContain('$upper');
  });

  it('passes className, disabled, rows, and spellCheck props', () => {
    renderTextarea('', vi.fn(), { className: 'my-class', disabled: true, rows: 8, spellCheck: false });
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(ta.className).toContain('my-class');
    expect(ta.disabled).toBe(true);
    expect(ta.rows).toBe(8);
  });

  it('passes aria-label prop', () => {
    renderTextarea('', vi.fn(), { 'aria-label': 'Body field' });
    expect(screen.getByLabelText('Body field')).toBeTruthy();
  });

  it('navigates with keyboard and selects with Enter', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionTextarea value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(ta, { target: { value: '{{', selectionStart: 2 } });
    rerender(<ExpressionTextarea value="{{" onChange={onChange} variableHints={sampleHints} />);

    fireEvent.keyDown(ta, { key: 'ArrowDown' });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onChange).toHaveBeenCalled();
  });

  it('dismisses dropdown with Escape', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionTextarea value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(ta, { target: { value: '{{', selectionStart: 2 } });
    rerender(<ExpressionTextarea value="{{" onChange={onChange} variableHints={sampleHints} />);
    expect(document.querySelector('[role="listbox"]')).toBeTruthy();

    fireEvent.keyDown(ta, { key: 'Escape' });
    rerender(<ExpressionTextarea value="{{" onChange={onChange} variableHints={sampleHints} />);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('closes dropdown on blur when focus leaves', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionTextarea value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(ta, { target: { value: '{{', selectionStart: 2 } });
    rerender(<ExpressionTextarea value="{{" onChange={onChange} variableHints={sampleHints} />);
    expect(document.querySelector('[role="listbox"]')).toBeTruthy();

    fireEvent.blur(ta);
    await new Promise((r) => requestAnimationFrame(r));
    rerender(<ExpressionTextarea value="{{" onChange={onChange} variableHints={sampleHints} />);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('selects a hint by clicking on it', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExpressionTextarea value="" onChange={onChange} variableHints={sampleHints} />,
    );
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(ta, { target: { value: '{{', selectionStart: 2 } });
    rerender(<ExpressionTextarea value="{{" onChange={onChange} variableHints={sampleHints} />);

    const options = document.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    fireEvent.mouseDown(options[0]);
    expect(onChange).toHaveBeenCalled();
  });

  it('handles change when selectionStart is null', () => {
    const onChange = vi.fn();
    renderTextarea('', onChange);
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
    Object.defineProperty(ta, 'selectionStart', { value: null, writable: true });
    fireEvent.change(ta, { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });
});
