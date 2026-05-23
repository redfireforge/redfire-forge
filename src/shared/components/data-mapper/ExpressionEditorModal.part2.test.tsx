/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import * as JsonTreeModel from '../../utils/jsonTreeModel';
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
  monacoTestState,
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

afterEach(async () => {
  // Flush any pending async state updates (e.g. loadExpressionSnippets) to avoid act() warnings
  await act(async () => {});
});

describe('ExpressionEditorModal – editor onMount and completion', () => {
  it('syncs model value when it differs from expression on mount', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    await flushMonacoMount();
    const model = monacoTestState.lastEditor?.getModel();
    expect(model?.getValue()).toBe('$.name');
  });

  it('registers completion provider and disposes on unmount', async () => {
    const { unmount } = renderModal();
    await flushMonacoMount();
    const dispose = monacoTestState.disposeSpies[0];
    expect(dispose).toBeTruthy();
    expect(monacoTestState.completionProvider).toBeTruthy();
    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it('disposes previous completion provider when modal remounts with new key', async () => {
    const { rerender } = render(
      <ExpressionEditorModal
        key="k1"
        mapping={baseMapping}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flushMonacoMount();
    const firstDispose = monacoTestState.disposeSpies[0];
    expect(firstDispose).toBeTruthy();
    rerender(
      <ExpressionEditorModal
        key="k2"
        mapping={baseMapping}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flushMonacoMount();
    expect(firstDispose).toHaveBeenCalled();
  });

  it('suggests source paths for $. completions', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    await flushMonacoMount();
    const p = monacoTestState.completionProvider!;
    const model = {
      getValueInRange: () => '$.',
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 3 }),
    };
    const res = p.provideCompletionItems(
      model as never,
      { lineNumber: 1, column: 3 } as never,
    ) as { suggestions: { label: string }[] };
    expect(res.suggestions.some((s) => s.label.includes('name'))).toBe(true);
    expect(monacoTestState.lastMonaco?.languages.registerCompletionItemProvider).toHaveBeenCalled();
  });

  it('suggests source paths for partial $.path completions', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    await flushMonacoMount();
    const p = monacoTestState.completionProvider!;
    const model = {
      getValueInRange: () => 'prefix $.na',
      getWordUntilPosition: () => ({ startColumn: 8, endColumn: 12 }),
    };
    const res = p.provideCompletionItems(
      model as never,
      { lineNumber: 1, column: 12 } as never,
    ) as { suggestions: { label: string }[] };
    expect(res.suggestions.length).toBeGreaterThan(0);
  });

  it('suggests functions for $ prefix completions', async () => {
    renderModal();
    await flushMonacoMount();
    const p = monacoTestState.completionProvider!;
    const model = {
      getValueInRange: () => 'x + $upp',
      getWordUntilPosition: () => ({ startColumn: 5, endColumn: 9 }),
    };
    const res = p.provideCompletionItems(
      model as never,
      { lineNumber: 1, column: 9 } as never,
    ) as { suggestions: { label: string }[] };
    expect(res.suggestions.length).toBeGreaterThan(0);
    const labels = res.suggestions.map((s) => String(s.label));
    expect(labels.some((l) => l.includes('upper') || l.startsWith('$'))).toBe(true);
  });

  it('returns empty suggestions when context does not match', async () => {
    renderModal();
    await flushMonacoMount();
    const p = monacoTestState.completionProvider!;
    const model = {
      getValueInRange: () => 'plain text',
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 5 }),
    };
    const res = p.provideCompletionItems(
      model as never,
      { lineNumber: 1, column: 5 } as never,
    ) as { suggestions: unknown[] };
    expect(res.suggestions).toEqual([]);
  });

  it('offers no source path suggestions when active source id is missing', async () => {
    renderModal({ activeSourceId: 'missing' });
    await flushMonacoMount();
    const p = monacoTestState.completionProvider!;
    const model = {
      getValueInRange: () => '$.',
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 3 }),
    };
    const res = p.provideCompletionItems(
      model as never,
      { lineNumber: 1, column: 3 } as never,
    ) as { suggestions: unknown[] };
    expect(res.suggestions).toEqual([]);
  });

  it('handles buildJsonTree failure when collecting source paths', async () => {
    const spy = vi.spyOn(JsonTreeModel, 'buildJsonTree').mockImplementation(() => {
      throw new Error('boom');
    });
    renderModal();
    await flushMonacoMount();
    const p = monacoTestState.completionProvider!;
    const model = {
      getValueInRange: () => '$.',
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 3 }),
    };
    const res = p.provideCompletionItems(
      model as never,
      { lineNumber: 1, column: 3 } as never,
    ) as { suggestions: unknown[] };
    expect(res.suggestions).toEqual([]);
    spy.mockRestore();
  });

  it('fires save from editor Ctrl+Enter command', async () => {
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
    await flushMonacoMount();
    const monaco = monacoTestState.lastMonaco!;
    const ed = monacoTestState.lastEditor!;
    ed.__runCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter);
    expect(onSave).toHaveBeenCalledWith('m1', '$.name');
    vi.useRealTimers();
  });

  it('fires onCancel from editor Escape command', async () => {
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
    await flushMonacoMount();
    const monaco = monacoTestState.lastMonaco!;
    const ed = monacoTestState.lastEditor!;
    ed.__runCommand(monaco.KeyCode.Escape);
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows Evaluating before debounced preview resolves', () => {
    vi.useFakeTimers();
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    expect(screen.getByText('Evaluating…')).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows preview error styling when evaluation returns an error', async () => {
    vi.useFakeTimers();
    const evalMod = await import('./utils/mapperExpressionEvaluator');
    const evalSpy = vi.spyOn(evalMod, 'evaluateMapperExpression').mockReturnValue({
      value: undefined,
      preview: '',
      error: 'bad',
    });
    renderModal({ mapping: { ...baseMapping, expression: 'x' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(document.querySelector('.dm-expr-preview-value--error')).toBeTruthy();
    expect(screen.getByText(/Error: bad/)).toBeTruthy();
    evalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('appends function template via React state when editor onMount is suppressed', () => {
    monacoTestState.suppressOnMount = true;
    renderModal();
    fireEvent.click(screen.getByText('$upper'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toContain('$upper(');
  });

  it('prefixes inserted template when custom function name lacks leading $', async () => {
    vi.useFakeTimers();
    const customFns = [{
      name: 'noDollarFn',
      category: 'Custom',
      signature: '$noDollarFn(x)',
      description: 'Custom',
      args: [{ name: 'x', type: 'string', required: true, description: 'In' }],
      returnType: 'string',
      examples: [],
      evaluate: (v: unknown) => v,
    }];
    renderModal({ customFunctions: customFns });
    await act(async () => { vi.advanceTimersByTime(300); });
    await flushMonacoMount();
    await act(async () => { fireEvent.click(screen.getByText('noDollarFn')); });
    const editorTextarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(editorTextarea.value).toContain('$noDollarFn');
    vi.useRealTimers();
  });
});

describe('ExpressionEditorModal – function insert with Monaco', () => {
  it('wraps source path when editor is empty and function is clicked', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(monacoTestState.lastEditor).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText('$upper')); });
    const editorTextarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(editorTextarea.value).toContain('$upper(');
    expect(editorTextarea.value).toContain('$.name');
    vi.useRealTimers();
  });

  it('does not call executeEdits when editor returns no selection', async () => {
    vi.useFakeTimers();
    monacoTestState.lastMountOpts = { getSelectionImpl: () => null };
    renderModal({ mapping: { ...baseMapping, expression: '' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    const ed = monacoTestState.lastEditor;
    expect(ed).toBeTruthy();
    fireEvent.click(screen.getByText('$upper'));
    expect(ed?.executeEdits).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('ExpressionEditorModal – initializes from sourcePath when no expression', () => {
  it('defaults expression to mapping.sourcePath', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    render(
      <ExpressionEditorModal
        mapping={{ id: 'm1', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(onSave).toHaveBeenCalledWith('m1', 'email');
    vi.useRealTimers();
  });
});

describe('ExpressionEditorModal – fixedValueToExpression branches', () => {
  it('applies boolean true as fixed value', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: 'true' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('true');
  });

  it('applies boolean false as fixed value', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: 'false' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('false');
  });

  it('applies null as fixed value', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: 'null' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('null');
  });

  it('applies number as fixed value', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('42');
  });

  it('applies negative decimal number as fixed value', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: '-3.14' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('-3.14');
  });

  it('applies valid JSON object as fixed value', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: '{"key":"val"}' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('{"key":"val"}');
  });

  it('applies valid JSON array as fixed value', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: '[1,2,3]' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('[1,2,3]');
  });

  it('wraps invalid JSON object as string literal', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: '{bad:json}' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('"{bad:json}"');
  });

  it('applies quoted string value (strips outer quotes)', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: '"hello"' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('"hello"');
  });

  it('applies single-quoted string value (strips outer quotes)', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: "'hello'" } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('"hello"');
  });

  it('does nothing for empty fixed value', () => {
    renderModal();
    const input = screen.getByLabelText('Fixed value input');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByText('Use value'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('name');
  });
});

describe('ExpressionEditorModal – handleComposeWithFunction', () => {
  it('composes function with zero args', () => {
    const noArgFn = {
      name: '$now',
      category: 'Date' as const,
      signature: '$now()',
      description: 'Current timestamp',
      args: [] as { name: string; type: string; required: boolean; description: string }[],
      returnType: 'number' as const,
      examples: [],
      evaluate: () => Date.now(),
    };
    renderModal({ customFunctions: [noArgFn] });
    const fnItem = Array.from(document.querySelectorAll('.dm-expr-fn-item')).find(el => el.textContent?.includes('$now'));
    fireEvent.click(fnItem!);
    fireEvent.click(screen.getByText('Compose with current'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$now()');
  });

  it('composes function with multiple arg types', async () => {
    const multiArgFn = {
      name: '$custom',
      category: 'Custom' as const,
      signature: '$custom(input, count, flag)',
      description: 'Multi-arg',
      args: [
        { name: 'input', type: 'string', required: true, description: 'Input' },
        { name: 'count', type: 'number', required: true, description: 'Count' },
        { name: 'flag', type: 'boolean', required: false, description: 'Flag' },
      ],
      returnType: 'string' as const,
      examples: [],
      evaluate: (v: unknown) => v,
    };
    renderModal({ customFunctions: [multiArgFn] });
    await act(async () => { fireEvent.click(screen.getByText('$custom')); });
    // Sidebar click wraps the current expression (name) as first arg
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$custom(name, 0, false)');
  });

  it('compose button updates expression with function wrapping current input', async () => {
    const fn = {
      name: '$xyzWrap',
      category: 'Custom' as const,
      signature: '$xyzWrap(input, delim)',
      description: 'Wrap',
      args: [
        { name: 'input', type: 'string', required: true, description: 'In' },
        { name: 'delim', type: 'string', required: true, description: 'Delim' },
      ],
      returnType: 'string' as const,
      examples: [],
      evaluate: (v: unknown) => v,
    };
    monacoTestState.suppressOnMount = true;
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' }, customFunctions: [fn] });
    await act(async () => {
      fireEvent.click(screen.getByText('$xyzWrap'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Compose with current'));
    });
    const textarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(textarea.value).toContain('$xyzWrap(');
    expect(textarea.value).toContain('"value"');
  });

  it('composes function with unknown arg type uses arg name', async () => {
    const fn = {
      name: '$exotic',
      category: 'Custom' as const,
      signature: '$exotic(input, opts)',
      description: 'Exotic',
      args: [
        { name: 'input', type: 'string', required: true, description: 'In' },
        { name: 'opts', type: 'options', required: true, description: 'Options' },
      ],
      returnType: 'string' as const,
      examples: [],
      evaluate: (v: unknown) => v,
    };
    renderModal({ customFunctions: [fn] });
    await act(async () => { fireEvent.click(screen.getByText('$exotic')); });
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$exotic(name, opts)');
  });

  it('compose with current uses arg name for unknown arg types', async () => {
    const fn = {
      name: '$exoticCompose',
      category: 'Custom' as const,
      signature: '$exoticCompose(input, opts)',
      description: 'Exotic compose',
      args: [
        { name: 'input', type: 'string', required: true, description: 'In' },
        { name: 'opts', type: 'options', required: true, description: 'Options' },
      ],
      returnType: 'string' as const,
      examples: [],
      evaluate: (v: unknown) => v,
    };
    monacoTestState.suppressOnMount = true;
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' }, customFunctions: [fn] });
    await act(async () => { fireEvent.click(screen.getByText('$exoticCompose')); });
    await act(async () => { fireEvent.click(screen.getByText('Compose with current')); });
    const textarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(textarea.value).toContain('$exoticCompose(');
    expect(textarea.value).toContain('opts');
  });

  it('uses lambda template for $map when sidebar-clicked', async () => {
    renderModal();
    const mapItem = Array.from(document.querySelectorAll('.dm-expr-fn-item'))
      .find(el => el.textContent?.includes('$map'));
    expect(mapItem).toBeTruthy();
    await act(async () => { fireEvent.click(mapItem!); });
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$map(name, x => x)');
  });

  it('uses lambda template for $filter when sidebar-clicked', async () => {
    renderModal();
    const filterItem = Array.from(document.querySelectorAll('.dm-expr-fn-item'))
      .find(el => el.textContent?.includes('$filter'));
    expect(filterItem).toBeTruthy();
    await act(async () => { fireEvent.click(filterItem!); });
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$filter(name, x => $gt(x, 0))');
  });

  it('Compose-with-current uses lambda template for lambda-supporting function', async () => {
    monacoTestState.suppressOnMount = true;
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    const fnItems = Array.from(document.querySelectorAll('.dm-expr-fn-item'));
    const mapItem = fnItems.find(el => {
      const nameEl = el.querySelector('.dm-expr-fn-name');
      return nameEl?.textContent === '$map';
    });
    expect(mapItem).toBeTruthy();
    await act(async () => { fireEvent.click(mapItem!); });
    await act(async () => {
      fireEvent.click(screen.getByText('Compose with current'));
    });
    const textarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(textarea.value).toContain('$map(');
    expect(textarea.value).toContain('x => x');
  });
});

describe('ExpressionEditorModal – step debugger toggle', () => {
  it('toggles debugger on and off', async () => {
    vi.useFakeTimers();
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$upper($.name)' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    const toggleBtn = screen.getByText('Step Debug');
    fireEvent.click(toggleBtn);
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(document.querySelector('.dm-expr-step-debugger')).toBeTruthy();
    // Toggle off
    fireEvent.click(toggleBtn);
    expect(document.querySelector('.dm-expr-step-debugger')).toBeNull();
    vi.useRealTimers();
  });

  it('does not enable debugger with empty expression', async () => {
    vi.useFakeTimers();
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Step Debug'));
    expect(document.querySelector('.dm-expr-step-debugger')).toBeNull();
    vi.useRealTimers();
  });
});
