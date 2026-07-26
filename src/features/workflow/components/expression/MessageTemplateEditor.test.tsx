/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MessageTemplateEditor from './MessageTemplateEditor';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

function makeHints(count: number): WorkflowVariableHint[] {
  return Array.from({ length: count }, (_, idx) => ({
    ref: `var${idx + 1}`,
    description: idx % 2 === 0 ? `Variable ${idx + 1}` : undefined,
    source: { nodeId: `n${idx + 1}`, nodeLabel: `Node ${idx + 1}` },
  }));
}

describe('MessageTemplateEditor', () => {
  it('renders default placeholder and no variable controls when hints are empty', () => {
    render(<MessageTemplateEditor value="" onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText('e.g. Status is {{status}}, user {{userId}} created')).toBeTruthy();
    expect(screen.queryByText('Variables')).toBeNull();
    expect(screen.queryByText('Insert...')).toBeNull();
    expect(screen.queryByText('Insert…')).toBeNull();
    expect(screen.queryByText('Preview')).toBeNull();
  });

  it('shows chip bar, deduplicates refs, caps to 12 chips, and supports chip insertion at cursor', () => {
    const onChange = vi.fn();
    const hints = makeHints(12);
    hints.push({ ref: 'var1', description: 'Duplicate', source: { nodeId: 'n99', nodeLabel: 'Duplicate' } });

    const { container } = render(
      <MessageTemplateEditor
        value="hello world"
        onChange={onChange}
        variableHints={hints}
      />,
    );

    expect(screen.getByText('Variables')).toBeTruthy();
    const chips = container.querySelectorAll('.mte-chip');
    expect(chips.length).toBe(12);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(6, 11);

    fireEvent.click(screen.getByText('var1'));
    expect(onChange).toHaveBeenCalledWith('hello {{var1}}');
  });

  it('shows browse button for chip bar and appends snippet returned by callback', () => {
    const onChange = vi.fn();
    const onRequestVariableInsert = vi.fn();

    render(
      <MessageTemplateEditor
        value="prefix"
        onChange={onChange}
        variableHints={[{ ref: 'token', source: { nodeId: 'n1', nodeLabel: 'N1' } }]}
        onRequestVariableInsert={onRequestVariableInsert}
      />,
    );

    fireEvent.click(screen.getByTitle('Browse all variables'));
    expect(onRequestVariableInsert).toHaveBeenCalledTimes(1);

    const apply = onRequestVariableInsert.mock.calls[0][0] as (snippet: string) => void;
    expect(onRequestVariableInsert.mock.calls[0][1]).toBe(false);
    expect(onRequestVariableInsert.mock.calls[0][2]).toBe('');

    apply('{{extra}}');
    expect(onChange).toHaveBeenCalledWith('prefix{{extra}}');
  });

  it('shows standalone insert button when there are no chips and inserts snippet from callback', () => {
    const onChange = vi.fn();
    const onRequestVariableInsert = vi.fn();

    render(
      <MessageTemplateEditor
        value="body:"
        onChange={onChange}
        variableHints={[]}
        onRequestVariableInsert={onRequestVariableInsert}
      />,
    );

    const button = screen.getByTitle('Insert variable from workflow or upstream step');
    expect(button).toBeTruthy();

    fireEvent.click(button);
    expect(onRequestVariableInsert).toHaveBeenCalledTimes(1);

    const apply = onRequestVariableInsert.mock.calls[0][0] as (snippet: string) => void;
    expect(onRequestVariableInsert.mock.calls[0][1]).toBe(false);
    expect(onRequestVariableInsert.mock.calls[0][2]).toBe('');

    apply('{{id}}');
    expect(onChange).toHaveBeenCalledWith('body:{{id}}');
  });

  it('renders syntax overlay tokens and preview with resolved and unresolved variables', () => {
    const { container } = render(
      <MessageTemplateEditor
        value="start {{foo}} middle {{bar}} end"
        onChange={vi.fn()}
        variableValues={{ foo: 'FOO_VALUE' }}
      />,
    );

    const tokenEls = container.querySelectorAll('.mte-var-token');
    expect(tokenEls.length).toBe(2);
    expect(tokenEls[0].textContent).toBe('{{foo}}');
    expect(tokenEls[1].textContent).toBe('{{bar}}');

    expect(screen.getByText('Preview')).toBeTruthy();
    expect(container.querySelector('.mte-preview-resolved')?.textContent).toBe('FOO_VALUE');
    expect(container.querySelector('.mte-preview-unresolved')?.textContent).toBe('{{bar}}');
  });

  it('shows preview hint when template has vars but no preview values', () => {
    render(
      <MessageTemplateEditor
        value="status={{status}}"
        onChange={vi.fn()}
        variableValues={{}}
      />,
    );

    expect(screen.getByText('Run a Quick Test to see resolved values')).toBeTruthy();
  });

  it('does not show preview section when no {{var}} token exists', () => {
    render(
      <MessageTemplateEditor
        value="plain text"
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('Preview')).toBeNull();
  });

  it('applies custom placeholder, rows, and focus class toggling', () => {
    const { container } = render(
      <MessageTemplateEditor
        value=""
        onChange={vi.fn()}
        placeholder="Custom placeholder"
        rows={6}
      />,
    );

    const textarea = screen.getByPlaceholderText('Custom placeholder') as HTMLTextAreaElement;
    expect(textarea.rows).toBe(6);

    const editor = container.querySelector('.mte-editor') as HTMLDivElement;
    expect(editor.className.includes('mte-editor--focused')).toBe(false);

    fireEvent.focus(textarea);
    expect(editor.className.includes('mte-editor--focused')).toBe(true);

    fireEvent.blur(textarea);
    expect(editor.className.includes('mte-editor--focused')).toBe(false);
  });
});
