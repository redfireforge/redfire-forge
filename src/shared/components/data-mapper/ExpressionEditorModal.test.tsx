/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ExpressionEditorModal from './ExpressionEditorModal';
import {
  loadExpressionSnippets,
  saveExpressionSnippet,
  deleteExpressionSnippet,
} from './utils/expressionSnippets';
vi.mock('./utils/expressionSnippets', () => ({
  loadExpressionSnippets: vi.fn(),
  saveExpressionSnippet: vi.fn(),
  deleteExpressionSnippet: vi.fn(),
}));

vi.mock('@monaco-editor/react', async () => {
  const h = await import('./__test-utils__/expressionEditorHarness');
  return h.buildMonacoMock();
});

import {
  makeSnippetMockImplementations,
  resetMonacoTestState,
  flushMonacoMount,
  sources,
  baseMapping,
  renderModal,
} from './__test-utils__/expressionEditorHarness';

const loadExpressionSnippetsMock = vi.mocked(loadExpressionSnippets);
const saveExpressionSnippetMock = vi.mocked(saveExpressionSnippet);
const deleteExpressionSnippetMock = vi.mocked(deleteExpressionSnippet);

const snippetMocks = makeSnippetMockImplementations({
  loadExpressionSnippets: loadExpressionSnippetsMock,
  saveExpressionSnippet: saveExpressionSnippetMock,
  deleteExpressionSnippet: deleteExpressionSnippetMock,
});

beforeEach(() => {
  resetMonacoTestState();
  snippetMocks.reset();
});

describe('ExpressionEditorModal', () => {
  it('renders with expression editor title', () => {
    renderModal();
    expect(screen.getByText('Expression Editor')).toBeTruthy();
  });

  it('shows target path', () => {
    renderModal();
    expect(screen.getByText(/userName/)).toBeTruthy();
  });

  it('pre-fills with mapping.sourcePath when no expression', () => {
    renderModal();
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('name');
  });

  it('pre-fills with mapping.expression when present', () => {
    const mapping = { ...baseMapping, expression: '$upper($.name)' };
    renderModal({ mapping });
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$upper($.name)');
  });

  it('shows live preview for valid expression (debounced)', async () => {
    vi.useFakeTimers();
    const mapping = { ...baseMapping, expression: '$upper($.name)' };
    renderModal({ mapping });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('ALICE')).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows preview for unknown function expression (debounced)', async () => {
    vi.useFakeTimers();
    const mapping = { ...baseMapping, expression: '$unknownFn($.name)' };
    renderModal({ mapping });
    await act(async () => { vi.advanceTimersByTime(250); });
    const previewDiv = document.querySelector('.dm-expr-preview-value');
    expect(previewDiv).toBeTruthy();
    expect(previewDiv?.textContent).toBeTruthy();
    vi.useRealTimers();
  });

  it('calls onSave when Save button clicked', () => {
    const { props } = renderModal();
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '$lower($.name)' } });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(props.onSave).toHaveBeenCalledWith('m1', '$lower($.name)');
  });

  it('calls onCancel when Cancel button clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders undo and redo buttons in header', () => {
    renderModal();
    expect(screen.getByLabelText('Undo')).toBeTruthy();
    expect(screen.getByLabelText('Redo')).toBeTruthy();
  });

  it('renders function catalog with categories', () => {
    renderModal();
    const catButtons = document.querySelectorAll('.dm-expr-cat-btn');
    const catNames = Array.from(catButtons).map((b) => b.textContent);
    expect(catNames).toContain('String');
    expect(catNames).toContain('Math');
    expect(catNames).toContain('Conditional');
  });

  it('shows function docs when a function is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('$upper'));
    expect(screen.getByText(/UPPERCASE/)).toBeTruthy();
  });

  it('inserts function template when clicked', async () => {
    renderModal();
    await flushMonacoMount();
    await act(async () => { fireEvent.click(screen.getByText('$upper')); });
    const editorTextarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(editorTextarea.value).toContain('$upper(');
    expect(editorTextarea.value).toContain('name');
  });

  it('filters functions by category', () => {
    renderModal();
    fireEvent.click(screen.getAllByText('Math')[0]);
    expect(screen.getByText('$abs')).toBeTruthy();
  });

  it('shows "All" category by default', () => {
    renderModal();
    expect(screen.getByText('$upper')).toBeTruthy();
    expect(screen.getByText('$abs')).toBeTruthy();
  });

  it('shows hint about $.path syntax', () => {
    renderModal();
    expect(screen.getByText(/source fields/)).toBeTruthy();
  });

  it('applies fixed value helper to expression editor', () => {
    renderModal();
    const fixedValueInput = screen.getByLabelText('Fixed value input');
    fireEvent.change(fixedValueInput, { target: { value: 'hello world' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('"hello world"');
  });

  it('inserts function template using source-path reference', async () => {
    renderModal();
    await flushMonacoMount();
    await act(async () => { fireEvent.click(screen.getByText('Parse number')); });
    const editorTextarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(editorTextarea.value).toContain('$parseFloat($.name)');
  });

  it('composes template using current expression when compose mode is enabled', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$trim($.name)' } });
    await flushMonacoMount();
    fireEvent.change(screen.getByLabelText('Search function templates'), { target: { value: 'Trim' } });
    fireEvent.click(screen.getByLabelText(/Compose current/));
    await act(async () => { fireEvent.click(screen.getByText('Trim')); });
    const editorTextarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(editorTextarea.value).toContain('$trim($trim($.name))');
  });

  it('saves, applies, and deletes reusable snippets', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    await flushMonacoMount();
    fireEvent.change(screen.getByLabelText('Snippet name'), { target: { value: 'Upper Name' } });
    fireEvent.click(screen.getByText('Save'));
    expect(saveExpressionSnippetMock).toHaveBeenCalledWith('Upper Name', '$upper($.name)');
    expect(await screen.findByText('Upper Name')).toBeTruthy();

    fireEvent.change(screen.getByTestId('monaco-editor'), { target: { value: '$lower($.name)' } });
    fireEvent.click(screen.getByText('Use'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$upper($.name)');

    fireEvent.click(screen.getByText('Delete'));
    expect(deleteExpressionSnippetMock).toHaveBeenCalled();
  });
});

describe('ExpressionEditorModal – keyboard shortcuts', () => {
  it('Cmd+Enter saves', () => {
    const { props } = renderModal();
    const overlay = screen.getByText('Expression Editor').closest('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', metaKey: true });
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('Escape cancels', () => {
    const { props } = renderModal();
    const overlay = screen.getByText('Expression Editor').closest('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('ExpressionEditorModal – custom functions', () => {
  it('shows custom functions in sidebar', () => {
    const customFns = [{
      name: '$myFn',
      category: 'Custom',
      signature: '$myFn(x) → string',
      description: 'My custom fn',
      args: [{ name: 'x', type: 'string', required: true, description: 'Input' }],
      returnType: 'string',
      examples: [],
      evaluate: (v: unknown) => `custom:${v}`,
    }];
    renderModal({ customFunctions: customFns });
    expect(screen.getByText('$myFn')).toBeTruthy();
    const catButtons = document.querySelectorAll('.dm-expr-cat-btn');
    const catNames = Array.from(catButtons).map((b) => b.textContent);
    expect(catNames).toContain('Custom');
  });
});

describe('ExpressionEditorModal – additional coverage', () => {
  it('resets expression when mapping.id changes', async () => {
    const { rerender, props } = renderModal();
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('name');

    const newMapping = { ...baseMapping, id: 'm2', sourcePath: 'age', expression: '$abs($.age)' };
    rerender(
      <ExpressionEditorModal {...props} mapping={newMapping} />,
    );
    const updated = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(updated.value).toBe('$abs($.age)');
  });

  it('shows placeholder preview for empty expression', async () => {
    vi.useFakeTimers();
    renderModal();
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '' } });
    await act(async () => { vi.advanceTimersByTime(250); });
    const previewDiv = document.querySelector('.dm-expr-preview-value');
    expect(previewDiv?.textContent).toBe('Enter an expression above');
    vi.useRealTimers();
  });

  it('Ctrl+Enter saves (not just Cmd+Enter)', () => {
    const { props } = renderModal();
    const overlay = screen.getByText('Expression Editor').closest('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', ctrlKey: true });
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('filters by category when category button is clicked', () => {
    renderModal();
    const catButtons = document.querySelectorAll('.dm-expr-cat-btn');
    const mathBtn = Array.from(catButtons).find(b => b.textContent === 'Math');
    fireEvent.click(mathBtn!);
    expect(screen.getByText('$add')).toBeTruthy();
    const allBtn = Array.from(document.querySelectorAll('.dm-expr-cat-btn')).find(b => b.textContent === 'All');
    fireEvent.click(allBtn!);
    expect(screen.getByText('$upper')).toBeTruthy();
  });

  it('shows function docs panel when function is clicked', () => {
    renderModal();
    const fnItem = screen.getByText('$upper').closest('.dm-expr-fn-item')!;
    fireEvent.click(fnItem);
    expect(document.querySelector('.dm-expr-doc-desc')).toBeTruthy();
    expect(document.querySelector('.dm-expr-doc-sig')).toBeTruthy();
  });

  it('inserts function template on click', async () => {
    renderModal();
    await flushMonacoMount();
    const fnItem = screen.getByText('$upper').closest('.dm-expr-fn-item')!;
    await act(async () => { fireEvent.click(fnItem); });
    const editorTextarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(editorTextarea.value).toContain('$upper(');
    expect(editorTextarea.value).toContain('name');
  });
});

describe('ExpressionEditorModal – Monaco integration', () => {
  it('renders Monaco editor mock (data-testid present)', () => {
    renderModal();
    expect(screen.getByTestId('monaco-editor')).toBeTruthy();
  });

  it('Monaco editor reflects value changes', () => {
    renderModal();
    const editor = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '$upper($.name)' } });
    expect(editor.value).toBe('$upper($.name)');
  });

  it('shows updated hint about $. for source fields and $ for functions', () => {
    renderModal();
    const hint = screen.getByText(/source fields/);
    expect(hint).toBeTruthy();
    expect(hint.closest('.dm-expr-source-hint')).toBeTruthy();
  });

  it('shows Ctrl+Enter hint text', () => {
    renderModal();
    expect(screen.getByText(/Ctrl\+Enter/)).toBeTruthy();
  });

  it('Ctrl+Enter from overlay saves expression', () => {
    const { props } = renderModal();
    const overlay = screen.getByText('Expression Editor').closest('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', ctrlKey: true });
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('saves current expression on Cmd+Enter', () => {
    const { props } = renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    const overlay = screen.getByText('Expression Editor').closest('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', metaKey: true });
    expect(props.onSave).toHaveBeenCalledWith('m1', '$upper($.name)');
  });

  it('renders with string sampleData source', () => {
    const strSources: MapperSource[] = [
      { id: 's1', label: 'Response', sampleData: '{"user": "Alice"}' },
    ];
    renderModal({ sources: strSources });
    expect(screen.getByTestId('monaco-editor')).toBeTruthy();
  });

  it('handles null sampleData gracefully', () => {
    const nullSources: MapperSource[] = [
      { id: 's1', label: 'Response', sampleData: null },
    ];
    renderModal({ sources: nullSources });
    expect(screen.getByTestId('monaco-editor')).toBeTruthy();
  });
});

describe('ExpressionEditorModal – Step-Through Debugger', () => {
  it('renders Step Debug button', () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    expect(screen.getByText('Step Debug')).toBeTruthy();
  });

  it('shows debugger panel when Step Debug is clicked', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    const btn = screen.getByText('Step Debug');
    fireEvent.click(btn);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByLabelText('Step-through debugger')).toBeTruthy();
  });

  it('shows step counter', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByText(/Step \d+ \/ \d+/)).toBeTruthy();
  });

  it('has prev/next buttons', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByLabelText('Previous step')).toBeTruthy();
    expect(screen.getByLabelText('Next step')).toBeTruthy();
  });

  it('shows Final Result step', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByText('Final Result')).toBeTruthy();
  });

  it('shows Path Resolution step for path expressions', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByText('Path Resolution')).toBeTruthy();
  });

  it('hides debugger when toggled off', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    const btn = screen.getByText('Step Debug');
    fireEvent.click(btn);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByLabelText('Step-through debugger')).toBeTruthy();

    fireEvent.click(btn);
    expect(screen.queryByLabelText('Step-through debugger')).toBeNull();
  });

  it('marks debug button as active when debugger is open', () => {
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    const btn = screen.getByText('Step Debug');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('does NOT open debugger when expression is empty', () => {
    renderModal();
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '' } });
    fireEvent.click(screen.getByText('Step Debug'));
    expect(screen.queryByLabelText('Step-through debugger')).toBeNull();
    expect(screen.getByText('Step Debug').getAttribute('aria-pressed')).toBe('false');
  });

  it('navigates steps with prev/next buttons', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$concat($.name, " test")' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const counter = screen.getByText(/Step \d+ \/ \d+/);
    expect(counter).toBeTruthy();
    const prevBtn = screen.getByLabelText('Previous step');
    const nextBtn = screen.getByLabelText('Next step');
    fireEvent.click(prevBtn);
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Step \d+ \/ \d+/)).toBeTruthy();
  });

  it('allows clicking a step header to expand it', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const headers = document.querySelectorAll('.dm-expr-step-header');
    if (headers.length > 0) {
      expect(document.querySelectorAll('.dm-expr-step-result')).toHaveLength(0);
      fireEvent.click(headers[0]);
      expect(document.querySelectorAll('.dm-expr-step-result').length).toBeGreaterThan(0);
    }
  });

  it('allows keyboard (Enter) to expand a step', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const headers = document.querySelectorAll('.dm-expr-step-header');
    if (headers.length > 0) {
      fireEvent.keyDown(headers[0], { key: 'Enter' });
      expect(document.querySelectorAll('.dm-expr-step-result').length).toBeGreaterThan(0);
    }
  });

  it('allows keyboard (Space) to expand a step', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const headers = document.querySelectorAll('.dm-expr-step-header');
    if (headers.length > 0) {
      fireEvent.keyDown(headers[0], { key: ' ' });
      expect(document.querySelectorAll('.dm-expr-step-result').length).toBeGreaterThan(0);
    }
  });

  it('clicking expanded result opens the detail popup', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const headers = document.querySelectorAll('.dm-expr-step-header');
    if (headers.length > 0) {
      await act(async () => { fireEvent.click(headers[headers.length - 1]); });
      const results = document.querySelectorAll('.dm-expr-step-result');
      expect(results.length).toBeGreaterThan(0);
      await act(async () => { fireEvent.click(results[results.length - 1]); });
      expect(document.querySelector('.dm-expr-detail-modal')).toBeTruthy();
      expect(document.querySelector('.dm-expr-detail-badge')?.textContent).toBeTruthy();
    }
  });

  it('shows function parameters and examples in docs panel', () => {
    renderModal();
    fireEvent.click(screen.getByText('$concat'));
    expect(document.querySelector('.dm-expr-doc-args')).toBeTruthy();
    expect(document.querySelector('.dm-expr-doc-returns')).toBeTruthy();
  });

  it('shows doc-empty panel when no function selected', () => {
    renderModal();
    expect(document.querySelector('.dm-expr-doc-empty')).toBeTruthy();
  });

  it('inserts function without args as fnName()', async () => {
    const noArgFns = [{
      name: '$myNoArgs',
      category: 'Custom' as const,
      signature: '$myNoArgs() → number',
      description: 'No args function',
      args: [],
      returnType: 'number' as const,
      examples: [],
      evaluate: () => 42,
    }];
    renderModal({ customFunctions: noArgFns });
    await flushMonacoMount();
    await act(async () => { fireEvent.click(screen.getByText('$myNoArgs')); });
    const editorTextarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(editorTextarea.value).toContain('$myNoArgs()');
  });
});

describe('ExpressionEditorModal — error confirmation', () => {
  it('shows confirm dialog when saving with evaluation error and blocks save on cancel', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const evalMod = await import('./utils/mapperExpressionEvaluator');
    const evalSpy = vi.spyOn(evalMod, 'evaluateMapperExpression').mockReturnValue({
      value: undefined, preview: '', error: 'Unknown function',
    });

    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$bad($.name)' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
    evalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('saves when user confirms despite evaluation error', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const evalMod = await import('./utils/mapperExpressionEvaluator');
    const evalSpy = vi.spyOn(evalMod, 'evaluateMapperExpression').mockReturnValue({
      value: undefined, preview: '', error: 'Unknown function',
    });

    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$bad($.name)' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith('m1', '$bad($.name)');
    confirmSpy.mockRestore();
    evalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('saves without confirm when expression has no error', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$upper($.name)' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith('m1', '$upper($.name)');
    confirmSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('ExpressionEditorModal – Ctrl+Enter keyboard shortcut', () => {
  it('fires handleSave when Ctrl+Enter pressed in overlay', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$.name' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    const overlay = document.querySelector('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith('m1', '$.name');
    vi.useRealTimers();
  });

  it('fires onCancel when Escape pressed in overlay', () => {
    const onCancel = vi.fn();
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$.name' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const overlay = document.querySelector('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});
