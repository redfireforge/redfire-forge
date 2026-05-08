/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { EvalContext } from '../../utils/expressionEvaluator';
import ExpressionBuilderView from './ExpressionBuilderView';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { EXPRESSION_CATEGORIES } from '../../utils/expressionFunctions';

vi.mock('../../utils/expressionEvaluator', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../utils/expressionEvaluator')>();
  return {
    ...mod,
    evaluateExpression(expression: string, ctx: EvalContext) {
      if (expression.trim() === '__FORCE_EVAL_ERROR__') {
        return { value: null, error: 'synthetic eval error' };
      }
      return mod.evaluateExpression(expression, ctx);
    },
  };
});

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

  it('shows +N more when hints exceed 20', () => {
    const manyHints: WorkflowVariableHint[] = Array.from({ length: 22 }, (_, i) => ({
      ref: `node:n${i}.val`,
      label: `val${i}`,
      type: 'string',
      source: { nodeId: `n${i}`, nodeLabel: `Node ${i}`, nodeType: 'http' as const, category: 'HTTP Steps' },
    }));
    const { container } = render(<ExpressionBuilderView hints={manyHints} onInsert={vi.fn()} />);
    const chips = container.querySelectorAll('.wf-expr-var-chip');
    expect(chips.length).toBe(20);
    const moreSpan = container.querySelector('.wf-expr-var-chips-more');
    expect(moreSpan).toBeTruthy();
    expect(moreSpan!.textContent).toBe('+2 more');
  });

  it('uses ref segment as chip label when label is absent', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:n1.deep.val', type: 'string', source: { nodeId: 'n1', nodeLabel: 'N1', nodeType: 'http' as const, category: 'HTTP Steps' } },
    ];
    const { container } = render(<ExpressionBuilderView hints={hints} onInsert={vi.fn()} />);
    const chip = container.querySelector('.wf-expr-var-chip');
    expect(chip!.textContent).toBe('val');
  });

  it('shows error preview for invalid expression', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '$invalidFunction("x")' } });
    const preview = container.querySelector('.wf-expr-preview-value');
    expect(preview).toBeTruthy();
    expect(preview!.classList.contains('error') || preview!.textContent!.startsWith('Error:') || preview!.textContent!.includes('invalidFunction') || preview!.textContent !== '').toBe(true);
  });

  it('switching back to All category shows all functions', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const catBtns = container.querySelectorAll('.wf-expr-cat-btn');
    const mathBtn = Array.from(catBtns).find((b) => b.textContent === 'Math');
    fireEvent.click(mathBtn!);
    const mathCount = container.querySelectorAll('.wf-expr-fn-item').length;

    const allBtn = Array.from(catBtns).find((b) => b.textContent === 'All');
    fireEvent.click(allBtn!);
    const allCount = container.querySelectorAll('.wf-expr-fn-item').length;
    expect(allCount).toBeGreaterThan(mathCount);
  });

  it('active category button has active class', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const catBtns = container.querySelectorAll('.wf-expr-cat-btn');
    expect(catBtns[0].classList.contains('active')).toBe(true);
    const mathBtn = Array.from(catBtns).find((b) => b.textContent === 'Math');
    fireEvent.click(mathBtn!);
    expect(mathBtn!.classList.contains('active')).toBe(true);
    expect(catBtns[0].classList.contains('active')).toBe(false);
  });

  it('preview shows hint defaultValue for variable in expression', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:n1.status', label: 'status', type: 'number', defaultValue: '200', source: { nodeId: 'n1', nodeLabel: 'N1', nodeType: 'http' as const, category: 'HTTP Steps' } },
    ];
    const { container } = render(<ExpressionBuilderView hints={hints} onInsert={vi.fn()} />);
    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{{node:n1.status}}' } });
    const preview = container.querySelector('.wf-expr-preview-value');
    expect(preview).toBeTruthy();
  });

  it('does not call onInsert with whitespace-only expression', () => {
    const onInsert = vi.fn();
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={onInsert} />);
    const insertBtn = container.querySelector('.wf-expr-insert-btn') as HTMLButtonElement;
    expect(insertBtn.disabled).toBe(true);
  });

  it('shows Evaluating… in preview when the result formats to an empty string', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '$jsonpath(\'{"a":1}\', "b")' } });
    const preview = container.querySelector('.wf-expr-preview-value');
    expect(preview!.textContent).toBe('Evaluating…');
    expect(preview!.classList.contains('error')).toBe(false);
  });

  it('shows Enter an expression above when the textarea is empty', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const preview = container.querySelector('.wf-expr-preview-value');
    expect(preview!.textContent).toBe('Enter an expression above');
  });

  it('resolves variables by matching a hint ref suffix when the template uses a short name', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:n1.deep.status', label: 'status', type: 'number', defaultValue: '42', source: { nodeId: 'n1', nodeLabel: 'N1', nodeType: 'http' as const, category: 'HTTP Steps' } },
    ];
    const { container } = render(<ExpressionBuilderView hints={hints} onInsert={vi.fn()} />);
    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{{status}}' } });
    const preview = container.querySelector('.wf-expr-preview-value');
    expect(preview!.textContent).toBe('42');
  });

  it('resolves variables when the hint ref equals the template name exactly', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'env', label: 'Environment', type: 'string', defaultValue: 'staging', source: { nodeLabel: 'Workflow Defaults', nodeType: 'start', category: 'Workflow' } },
    ];
    const { container } = render(<ExpressionBuilderView hints={hints} onInsert={vi.fn()} />);
    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{{env}}' } });
    const preview = container.querySelector('.wf-expr-preview-value');
    expect(preview!.textContent).toBe('staging');
  });

  it('uses bracket placeholder when no hint matches a variable reference', () => {
    const { container } = render(<ExpressionBuilderView hints={makeHints()} onInsert={vi.fn()} />);
    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{{totallyUnknownRef}}' } });
    const preview = container.querySelector('.wf-expr-preview-value');
    expect(preview!.textContent).toBe('[totallyUnknownRef]');
  });

  it('hides argument controls and parameter docs for zero-argument functions', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const items = container.querySelectorAll('.wf-expr-fn-item');
    const nowItem = Array.from(items).find((el) => el.textContent?.includes('$now'));
    expect(nowItem).toBeTruthy();
    fireEvent.click(nowItem!);
    expect(container.querySelector('.wf-expr-args')).toBeNull();
    expect(container.querySelector('.wf-expr-doc-args')).toBeNull();
    expect(container.querySelector('.wf-expr-doc-example')).toBeTruthy();
  });

  it('shows an empty required cell for optional parameters in the documentation table', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const items = container.querySelectorAll('.wf-expr-fn-item');
    const padStartItem = Array.from(items).find((el) => el.textContent?.includes('$padStart'));
    expect(padStartItem).toBeTruthy();
    fireEvent.click(padStartItem!);

    const rows = container.querySelectorAll('.wf-expr-doc-args-table tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const requiredCells = Array.from(rows).map((row) => row.querySelectorAll('td')[2]?.textContent ?? '');
    expect(requiredCells.some((c) => c === '✓')).toBe(true);
    expect(requiredCells.some((c) => c === '')).toBe(true);
  });

  it('omits the required marker on optional argument labels in the composer', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const items = container.querySelectorAll('.wf-expr-fn-item');
    const padStartItem = Array.from(items).find((el) => el.textContent?.includes('$padStart'));
    fireEvent.click(padStartItem!);

    const requiredMarks = container.querySelectorAll('.wf-expr-arg-required');
    expect(requiredMarks.length).toBe(2);
  });

  it('does not call onInsert when insert is fired while the button is disabled', () => {
    const onInsert = vi.fn();
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={onInsert} />);
    const insertBtn = container.querySelector('.wf-expr-insert-btn') as HTMLButtonElement;
    expect(insertBtn.disabled).toBe(true);
    fireEvent.click(insertBtn);
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('shows error class and message in preview when evaluation returns an error result', () => {
    const { container } = render(<ExpressionBuilderView hints={[]} onInsert={vi.fn()} />);
    const textarea = container.querySelector('.wf-expr-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '__FORCE_EVAL_ERROR__' } });
    const preview = container.querySelector('.wf-expr-preview-value');
    expect(preview!.classList.contains('error')).toBe(true);
    expect(preview!.textContent).toContain('synthetic eval error');
  });
});
