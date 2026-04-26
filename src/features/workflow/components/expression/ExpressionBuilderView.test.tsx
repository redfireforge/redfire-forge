/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import ExpressionBuilderView from './ExpressionBuilderView';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { EXPRESSION_CATEGORIES } from '../../utils/expressionFunctions';

const makeHints = (): WorkflowVariableHint[] => [
  { ref: 'node:n1.status', label: 'status', type: 'number', source: { nodeId: 'n1', nodeLabel: 'Get Users', nodeType: 'http', category: 'HTTP Steps' } },
  { ref: 'node:n1.body', label: 'body', type: 'string', source: { nodeId: 'n1', nodeLabel: 'Get Users', nodeType: 'http', category: 'HTTP Steps' } },
  { ref: 'env', label: 'env', type: 'string', source: { nodeLabel: 'Workflow Defaults', nodeType: 'start', category: 'Workflow' } },
];

describe('ExpressionBuilderView', () => {
  it('renders the three-column layout', () => {
    const { container } = render(<ExpressionBuilderView hints={makeHints()} onInsert={vi.fn()} />);
    expect(container.querySelector('.wf-expr-builder')).toBeTruthy();
    expect(container.querySelector('.wf-expr-left')).toBeTruthy();
    expect(container.querySelector('.wf-expr-middle')).toBeTruthy();
    expect(container.querySelector('.wf-expr-right')).toBeTruthy();
  });

  it('renders category filter buttons', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const btns = container.querySelectorAll('.wf-expr-cat-btn');
    // All + each category
    expect(btns.length).toBe(EXPRESSION_CATEGORIES.length + 1);
    expect(btns[0].textContent).toBe('All');
  });

  it('renders function catalog with items', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const items = container.querySelectorAll('.wf-expr-fn-item');
    expect(items.length).toBeGreaterThan(25);
  });

  it('clicking a function shows its documentation', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const fnItem = container.querySelector('.wf-expr-fn-item');
    expect(fnItem).toBeTruthy();
    fireEvent.click(fnItem!);
    expect(container.querySelector('.wf-expr-doc-header')).toBeTruthy();
    expect(container.querySelector('.wf-expr-doc-sig')).toBeTruthy();
    expect(container.querySelector('.wf-expr-doc-desc')).toBeTruthy();
  });

  it('clicking a function populates the expression textarea', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    // Click $upper
    const items = container.querySelectorAll('.wf-expr-fn-item');
    const upperItem = Array.from(items).find((el) => el.textContent?.includes('$upper'));
    expect(upperItem).toBeTruthy();
    fireEvent.click(upperItem!);

    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('$upper');
  });

  it('shows argument inputs when a function with args is selected', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    // Click $add (has 2 args)
    const items = container.querySelectorAll('.wf-expr-fn-item');
    const addItem = Array.from(items).find((el) => el.textContent?.includes('$add'));
    fireEvent.click(addItem!);

    const argInputs = container.querySelectorAll('.wf-expr-arg-input');
    expect(argInputs.length).toBe(2);
  });

  it('rebuilds the expression when argument values change', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const items = container.querySelectorAll('.wf-expr-fn-item');
    const upperItem = Array.from(items).find((el) => el.textContent?.includes('$upper'));
    fireEvent.click(upperItem!);

    const argInput = container.querySelector('.wf-expr-arg-input') as HTMLInputElement;
    fireEvent.change(argInput, { target: { value: 'hello' } });

    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('$upper("hello")');
  });

  it('shows empty doc pane initially', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    expect(container.querySelector('.wf-expr-doc-empty')).toBeTruthy();
  });

  it('filters functions by category', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    // Click "Math" category
    const catBtns = container.querySelectorAll('.wf-expr-cat-btn');
    const mathBtn = Array.from(catBtns).find((b) => b.textContent === 'Math');
    fireEvent.click(mathBtn!);

    // All visible function items should be math
    const fnItems = container.querySelectorAll('.wf-expr-fn-item');
    const categories = container.querySelectorAll('.wf-expr-fn-category');
    expect(categories.length).toBe(1);
    expect(categories[0].textContent).toBe('Math');
    expect(fnItems.length).toBeGreaterThan(0);
  });

  it('renders variable chips when hints are provided', () => {
    const { container } = render(<ExpressionBuilderView hints={makeHints()} onInsert={vi.fn()} />);
    const chips = container.querySelectorAll('.wf-expr-var-chip');
    expect(chips.length).toBe(3);
  });

  it('clicking a variable chip appends to expression', () => {
    const { container } = render(<ExpressionBuilderView hints={makeHints()} onInsert={vi.fn()} />);
    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    const chips = container.querySelectorAll('.wf-expr-var-chip');
    fireEvent.click(chips[0]);
    expect(textarea.value).toContain('{{node:n1.status}}');
  });

  it('Insert Expression button calls onInsert', () => {
    const onInsert = vi.fn();
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={onInsert} />);

    // Type an expression
    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '$upper("hello")' } });

    // Click insert
    const insertBtn = container.querySelector('.wf-expr-insert-btn') as HTMLButtonElement;
    expect(insertBtn.disabled).toBe(false);
    fireEvent.click(insertBtn);

    expect(onInsert).toHaveBeenCalledWith('{{$upper("hello")}}');
  });

  it('Insert Expression button is disabled when expression is empty', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const insertBtn = container.querySelector('.wf-expr-insert-btn') as HTMLButtonElement;
    expect(insertBtn.disabled).toBe(true);
  });

  it('shows live preview when expression is entered', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '$upper("hello")' } });

    const preview = container.querySelector('.wf-expr-preview-value');
    expect(preview).toBeTruthy();
    expect(preview!.textContent).toBe('HELLO');
  });

  it('shows function examples in documentation', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const items = container.querySelectorAll('.wf-expr-fn-item');
    fireEvent.click(items[0]); // Click first function

    const examples = container.querySelectorAll('.wf-expr-doc-example');
    expect(examples.length).toBeGreaterThan(0);
  });

  it('shows function args table in documentation', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    // Find a function with args
    const items = container.querySelectorAll('.wf-expr-fn-item');
    const upperItem = Array.from(items).find((el) => el.textContent?.includes('$upper'));
    fireEvent.click(upperItem!);

    expect(container.querySelector('.wf-expr-doc-args-table')).toBeTruthy();
  });

  it('shows return type in documentation', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const items = container.querySelectorAll('.wf-expr-fn-item');
    fireEvent.click(items[0]);
    expect(container.querySelector('.wf-expr-doc-returns')).toBeTruthy();
  });
});
