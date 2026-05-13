/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import * as JsonTreeModel from '../../utils/jsonTreeModel';
import ExpressionEditorModal from './ExpressionEditorModal';
import type { Mapping, MapperSource } from './types';
import {
  loadExpressionSnippets,
  saveExpressionSnippet,
  deleteExpressionSnippet,
} from './utils/expressionSnippets';

type SnippetStub = { id: string; name: string; expression: string; updatedAt: number };
const snippetStore: SnippetStub[] = [];
vi.mock('./utils/expressionSnippets', () => ({
  loadExpressionSnippets: vi.fn(),
  saveExpressionSnippet: vi.fn(),
  deleteExpressionSnippet: vi.fn(),
}));

const loadExpressionSnippetsMock = vi.mocked(loadExpressionSnippets);
const saveExpressionSnippetMock = vi.mocked(saveExpressionSnippet);
const deleteExpressionSnippetMock = vi.mocked(deleteExpressionSnippet);

export const monacoTestState: {
  lastEditor: ReturnType<typeof createFakeEditor>['editor'] | null;
  lastMonaco: ReturnType<typeof createFakeMonaco>['monaco'] | null;
  lastMountOpts: { getSelectionImpl?: () => unknown } | null;
  completionProvider: { provideCompletionItems: (model: unknown, position: unknown) => unknown } | null;
  disposeSpies: ReturnType<typeof vi.fn>[];
  suppressOnMount: boolean;
} = {
  lastEditor: null,
  lastMonaco: null,
  lastMountOpts: null,
  completionProvider: null,
  disposeSpies: [],
  suppressOnMount: false,
};

function createFakeMonaco() {
  const monaco = {
    languages: {
      CompletionItemKind: { Field: 1, Function: 2 },
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      registerCompletionItemProvider: vi.fn((_lang: string, provider: { provideCompletionItems: (model: unknown, position: unknown) => unknown }) => {
        monacoTestState.completionProvider = provider;
        const dispose = vi.fn();
        monacoTestState.disposeSpies.push(dispose);
        return { dispose };
      }),
    },
    KeyMod: { CtrlCmd: 2048 },
    KeyCode: { Enter: 3, Escape: 9 },
  };
  return { monaco };
}

function createFakeEditor(
  opts: { modelInitial?: string; getSelectionImpl?: () => unknown } = {},
) {
  const modelValue = { current: opts.modelInitial ?? '' };
  const model = {
    getValue: () => modelValue.current,
    setValue: (v: string) => { modelValue.current = v; },
  };
  const commands = new Map<number, () => void>();
  const defaultRange = () => ({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 1,
  });
  const editor = {
    getModel: () => model,
    getSelection: () => {
      if (opts.getSelectionImpl) return opts.getSelectionImpl();
      return defaultRange();
    },
    executeEdits: vi.fn(),
    focus: vi.fn(),
    addCommand: vi.fn((keybinding: number, handler: () => void) => {
      commands.set(keybinding, handler);
    }),
    __runCommand: (keybinding: number) => {
      commands.get(keybinding)?.();
    },
  };
  return { editor, model };
}

vi.mock('@monaco-editor/react', async () => {
  const React = await import('react');
  const { useEffect, useRef } = React;

  function MockEditor({
    value,
    onChange,
    onMount,
  }: {
    value: string;
    onChange: (v: string | undefined) => void;
    onMount?: (
      editor: ReturnType<typeof createFakeEditor>['editor'],
      monaco: ReturnType<typeof createFakeMonaco>['monaco'],
    ) => void;
  }) {
    const mountedRef = useRef(false);

    useEffect(() => {
      if (monacoTestState.suppressOnMount) return;
      if (!onMount || mountedRef.current) return;
      mountedRef.current = true;
      const getSelectionImpl = monacoTestState.lastMountOpts?.getSelectionImpl;
      const { editor } = createFakeEditor({
        modelInitial: '',
        getSelectionImpl,
      });
      const { monaco } = createFakeMonaco();
      monacoTestState.lastEditor = editor;
      monacoTestState.lastMonaco = monaco;
      onMount(editor, monaco);
    }, [onMount]);

    return React.createElement('textarea', {
      'data-testid': 'monaco-editor',
      value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
      placeholder: 'e.g. $upper($.name) or $concat($.firstName, " ", $.lastName)',
    });
  }

  return {
    default: MockEditor,
  };
});

beforeEach(() => {
  monacoTestState.lastEditor = null;
  monacoTestState.lastMonaco = null;
  monacoTestState.lastMountOpts = null;
  monacoTestState.completionProvider = null;
  monacoTestState.disposeSpies = [];
  monacoTestState.suppressOnMount = false;
  snippetStore.splice(0, snippetStore.length);
  loadExpressionSnippetsMock.mockReset();
  saveExpressionSnippetMock.mockReset();
  deleteExpressionSnippetMock.mockReset();
  loadExpressionSnippetsMock.mockImplementation(async () => [...snippetStore]);
  saveExpressionSnippetMock.mockImplementation(async (name: string, expression: string) => {
    const now = Date.now();
    const idx = snippetStore.findIndex((snippet) => snippet.name.toLowerCase() === name.toLowerCase());
    if (idx >= 0) {
      snippetStore[idx] = { ...snippetStore[idx], name, expression, updatedAt: now };
    } else {
      snippetStore.unshift({
        id: `snippet-${snippetStore.length + 1}`,
        name,
        expression,
        updatedAt: now,
      });
    }
    return [...snippetStore];
  });
  deleteExpressionSnippetMock.mockImplementation(async (snippetId: string) => {
    const idx = snippetStore.findIndex((snippet) => snippet.id === snippetId);
    if (idx >= 0) snippetStore.splice(idx, 1);
    return [...snippetStore];
  });
});

async function flushMonacoMount() {
  await act(async () => { await Promise.resolve(); });
}

const sources: MapperSource[] = [
  { id: 's1', label: 'Response', sampleData: { name: 'Alice', age: 30 } },
];

const baseMapping: Mapping = {
  id: 'm1',
  sourcePath: 'name',
  sourceId: 's1',
  targetPath: 'userName',
};

function renderModal(overrides?: Partial<Parameters<typeof ExpressionEditorModal>[0]>) {
  const defaults = {
    mapping: baseMapping,
    sources,
    activeSourceId: 's1',
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  const result = render(<ExpressionEditorModal {...props} />);
  return { ...result, props };
}

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
    const { container } = renderModal({ mapping });
    await act(async () => { vi.advanceTimersByTime(250); });
    const previewDiv = container.querySelector('.dm-expr-preview-value');
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

  it('calls onCancel when close button clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('Close expression editor'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders function catalog with categories', () => {
    const { container } = renderModal();
    const catButtons = container.querySelectorAll('.dm-expr-cat-btn');
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
    fireEvent.click(screen.getByText('$upper'));
    const text = monacoTestState.lastEditor?.executeEdits.mock.calls[0]?.[1]?.[0]?.text ?? '';
    expect(text).toContain('$upper(');
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
    fireEvent.click(screen.getByText('Parse number'));
    const inserted = monacoTestState.lastEditor?.executeEdits.mock.calls[0]?.[1]?.[0]?.text ?? '';
    expect(inserted).toContain('$parseFloat($.name)');
  });

  it('composes template using current expression when compose mode is enabled', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$trim($.name)' } });
    await flushMonacoMount();
    fireEvent.change(screen.getByLabelText('Search function templates'), { target: { value: 'Trim' } });
    fireEvent.click(screen.getByLabelText(/Compose current/));
    fireEvent.click(screen.getByText('Trim'));
    const inserted = monacoTestState.lastEditor?.executeEdits.mock.calls[0]?.[1]?.[0]?.text ?? '';
    expect(inserted).toContain('$trim($trim($.name))');
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
    const { container } = renderModal({ customFunctions: customFns });
    expect(screen.getByText('$myFn')).toBeTruthy();
    const catButtons = container.querySelectorAll('.dm-expr-cat-btn');
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
    const { container } = renderModal();
    const catButtons = container.querySelectorAll('.dm-expr-cat-btn');
    const mathBtn = Array.from(catButtons).find(b => b.textContent === 'Math');
    fireEvent.click(mathBtn!);
    expect(screen.getByText('$add')).toBeTruthy();
    const allBtn = Array.from(container.querySelectorAll('.dm-expr-cat-btn')).find(b => b.textContent === 'All');
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
    fireEvent.click(fnItem);
    const text = monacoTestState.lastEditor?.executeEdits.mock.calls[0]?.[1]?.[0]?.text ?? '';
    expect(text).toContain('$upper(');
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

  it('allows clicking a step to select it', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const steps = document.querySelectorAll('.dm-expr-step');
    if (steps.length > 1) {
      fireEvent.click(steps[0]);
      expect(steps[0].className).toContain('dm-expr-step--active');
    }
  });

  it('allows keyboard (Enter) to select a step', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const steps = document.querySelectorAll('.dm-expr-step');
    if (steps.length > 1) {
      fireEvent.keyDown(steps[0], { key: 'Enter' });
      expect(steps[0].className).toContain('dm-expr-step--active');
    }
  });

  it('allows keyboard (Space) to select a step', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const steps = document.querySelectorAll('.dm-expr-step');
    if (steps.length > 1) {
      fireEvent.keyDown(steps[0], { key: ' ' });
      expect(steps[0].className).toContain('dm-expr-step--active');
    }
  });

  it('shows title tooltip on truncated step values', async () => {
    const longExpr = '$concat($.name, "' + 'x'.repeat(100) + '")';
    renderModal({ mapping: { ...baseMapping, expression: longExpr } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const codeEls = document.querySelectorAll('.dm-expr-step-value');
    if (codeEls.length > 0) {
      expect(codeEls[codeEls.length - 1].getAttribute('title')).toBeTruthy();
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
    fireEvent.click(screen.getByText('$myNoArgs'));
    const text = monacoTestState.lastEditor?.executeEdits.mock.calls[0]?.[1]?.[0]?.text ?? '';
    expect(text).toContain('$myNoArgs()');
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
    const { container } = render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$.name' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    const overlay = container.querySelector('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith('m1', '$.name');
    vi.useRealTimers();
  });

  it('fires onCancel when Escape pressed in overlay', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$.name' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const overlay = container.querySelector('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
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
    const { container } = renderModal({ mapping: { ...baseMapping, expression: 'x' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(container.querySelector('.dm-expr-preview-value--error')).toBeTruthy();
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
    fireEvent.click(screen.getByText('noDollarFn'));
    const text = monacoTestState.lastEditor?.executeEdits.mock.calls[0]?.[1]?.[0]?.text ?? '';
    expect(text).toContain('$noDollarFn');
    vi.useRealTimers();
  });
});

describe('ExpressionEditorModal – function insert with Monaco', () => {
  it('inserts function template via executeEdits when editor is mounted', async () => {
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
    fireEvent.click(screen.getByText('$upper'));
    expect(monacoTestState.lastEditor?.executeEdits).toHaveBeenCalled();
    const editArg = monacoTestState.lastEditor?.executeEdits.mock.calls[0]?.[1]?.[0]?.text ?? '';
    expect(editArg).toContain('$upper');
    expect(monacoTestState.lastEditor?.focus).toHaveBeenCalled();
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
    const { container } = renderModal({ customFunctions: [noArgFn] });
    const fnItem = Array.from(container.querySelectorAll('.dm-expr-fn-item')).find(el => el.textContent?.includes('$now'));
    fireEvent.click(fnItem!);
    fireEvent.click(screen.getByText('Compose with current'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$now()');
  });

  it('composes function with multiple arg types', () => {
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
    fireEvent.click(screen.getByText('$custom'));
    fireEvent.click(screen.getByText('Compose with current'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$custom($.name, 0, false)');
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

  it('composes function with unknown arg type uses arg name', () => {
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
    fireEvent.click(screen.getByText('$exotic'));
    fireEvent.click(screen.getByText('Compose with current'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$exotic($.name, opts)');
  });
});

describe('ExpressionEditorModal – step debugger toggle', () => {
  it('toggles debugger on and off', async () => {
    vi.useFakeTimers();
    const { container } = render(
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
    expect(container.querySelector('.dm-expr-step-debugger')).toBeTruthy();
    // Toggle off
    fireEvent.click(toggleBtn);
    expect(container.querySelector('.dm-expr-step-debugger')).toBeNull();
    vi.useRealTimers();
  });

  it('does not enable debugger with empty expression', async () => {
    vi.useFakeTimers();
    const { container } = render(
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
    expect(container.querySelector('.dm-expr-step-debugger')).toBeNull();
    vi.useRealTimers();
  });
});
