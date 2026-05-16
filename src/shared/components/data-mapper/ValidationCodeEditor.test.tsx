/** @vitest-environment jsdom */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let mockOnChange: ((v: string | undefined) => void) | undefined;
let mockBeforeMount: ((monaco: unknown) => void) | undefined;
let mockOnMount: ((editor: unknown, monaco: unknown) => void) | undefined;
let lastEditorProps: {
  value?: string;
  beforeMount?: (m: unknown) => void;
  onMount?: (e: unknown, m: unknown) => void;
  loading?: ReactNode;
} | null;

vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: (props: {
    value?: string;
    onChange?: (v: string | undefined) => void;
    beforeMount?: (m: unknown) => void;
    onMount?: (e: unknown, m: unknown) => void;
    loading?: React.ReactNode;
  }) => {
    mockOnChange = props.onChange;
    mockBeforeMount = props.beforeMount;
    mockOnMount = props.onMount;
    lastEditorProps = props;
    return <textarea data-testid="mock-editor" defaultValue={props.value ?? ''} />;
  },
}));

import ValidationCodeEditor from './ValidationCodeEditor';
import * as MonacoTextareaHardening from './utils/monacoTextareaHardening';

const noop = vi.fn();
const noopDisposable = { dispose: noop };
function withEditorDefaults(overrides: Record<string, unknown> = {}) {
  return {
    addAction: vi.fn(),
    addCommand: vi.fn(),
    onDidChangeModelContent: vi.fn().mockReturnValue(noopDisposable),
    onDidChangeCursorPosition: vi.fn().mockReturnValue(noopDisposable),
    onDidDispose: vi.fn().mockReturnValue(noopDisposable),
    trigger: noop,
    executeEdits: vi.fn(),
    focus: vi.fn(),
    getPosition: vi.fn().mockReturnValue(null),
    getModel: vi.fn().mockReturnValue(null),
    getDomNode: vi.fn().mockReturnValue(null),
    deltaDecorations: vi.fn().mockReturnValue([]),
    ...overrides,
  };
}

function createMonacoForRegistration() {
  return {
    languages: {
      register: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      registerCompletionItemProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      CompletionItemKind: { Field: 1, Keyword: 2, Value: 3 },
      CompletionTriggerKind: { Invoke: 0, TriggerCharacter: 1, TriggerForIncompleteCompletions: 2 },
    },
    editor: { defineTheme: vi.fn(), setTheme: vi.fn() },
  };
}

function makeContext(triggerKind = 0) {
  return { triggerKind };
}

describe('ValidationCodeEditor', () => {
  const mockOnChangeHandler = vi.fn();

  beforeEach(() => {
    mockOnChangeHandler.mockClear();
    mockOnChange = undefined;
    mockBeforeMount = undefined;
    mockOnMount = undefined;
    lastEditorProps = null;
  });

  it('renders with header, editor, and footer', () => {
    render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
      />,
    );
    expect(screen.getByRole('region', { name: 'Validation rules editor' })).toBeTruthy();
    expect(screen.getByText('Validation Rules')).toBeTruthy();
    expect(screen.getByTestId('mock-editor')).toBeTruthy();
    expect(screen.getByText(/Syntax:/)).toBeTruthy();
    expect(lastEditorProps?.loading).toBeTruthy();
  });

  it('displays rule count from value', () => {
    render(
      <ValidationCodeEditor
        value={'name equals "test"\n# comment\nage > 5'}
        onChange={mockOnChangeHandler}
        errors={[]}
      />,
    );
    expect(screen.getByText('2 rules')).toBeTruthy();
  });

  it('displays singular rule', () => {
    render(
      <ValidationCodeEditor
        value="name equals 1"
        onChange={mockOnChangeHandler}
        errors={[]}
      />,
    );
    expect(screen.getByText('1 rule')).toBeTruthy();
  });

  it('does not show error stat when there are zero errors', () => {
    render(
      <ValidationCodeEditor
        value="x"
        onChange={mockOnChangeHandler}
        errors={[]}
      />,
    );
    expect(screen.queryByText(/error/)).not.toBeInTheDocument();
  });

  it('displays error count when errors present', () => {
    render(
      <ValidationCodeEditor
        value="invalid"
        onChange={mockOnChangeHandler}
        errors={[{ lineNumber: 1, message: 'bad' }]}
      />,
    );
    expect(screen.getByText('1 error')).toBeTruthy();
  });

  it('displays plural errors', () => {
    render(
      <ValidationCodeEditor
        value="a\nb"
        onChange={mockOnChangeHandler}
        errors={[
          { lineNumber: 1, message: 'e1' },
          { lineNumber: 2, message: 'e2' },
        ]}
      />,
    );
    expect(screen.getByText('2 errors')).toBeTruthy();
  });

  it('shows jump hint when onJumpToNode is provided', () => {
    const { container } = render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        onJumpToNode={() => {}}
      />,
    );
    expect(container.querySelectorAll('.dm-validation-editor-hint').length).toBe(2);
    expect(screen.getByText(/Jump to node/)).toBeTruthy();
  });

  it('does not show jump hint when onJumpToNode is omitted', () => {
    const { container } = render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
      />,
    );
    expect(container.querySelectorAll('.dm-validation-editor-hint').length).toBe(1);
  });

  it('calls onChange when editor value changes', () => {
    render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
      />,
    );
    act(() => { mockOnChange?.('new value'); });
    expect(mockOnChangeHandler).toHaveBeenCalledWith('new value');
  });

  it('handles undefined editor value by passing empty string', () => {
    render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
      />,
    );
    act(() => { mockOnChange?.(undefined); });
    expect(mockOnChangeHandler).toHaveBeenCalledWith('');
  });

  it('beforeMount registers language and completion provider', () => {
    const mockMonaco = createMonacoForRegistration();

    render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
      />,
    );
    act(() => { mockBeforeMount?.(mockMonaco); });

    expect(mockMonaco.languages.register).toHaveBeenCalled();
    expect(mockMonaco.languages.setMonarchTokensProvider).toHaveBeenCalled();
    expect(mockMonaco.languages.registerCompletionItemProvider).toHaveBeenCalled();
  });

  const baseMonaco = {
    KeyMod: { CtrlCmd: 2048, WinCtrl: 4, Alt: 512 },
    KeyCode: { KeyG: 30, Space: 10, Tab: 2, KeyI: 43 },
    editor: { defineTheme: vi.fn(), setTheme: vi.fn() },
  };

  /** Monaco stub when editor.getModel() returns an object (markers effect runs). */
  function mockMonacoForMountedEditor(editorOverrides: Record<string, unknown> = {}) {
    return {
      ...baseMonaco,
      MarkerSeverity: { Error: 8 },
      editor: {
        ...baseMonaco.editor,
        setModelMarkers: vi.fn(),
        ...editorOverrides,
      },
    };
  }

  it('onMount adds jump-to-node action', () => {
    const mockEditor = withEditorDefaults();
    const mockMonaco = { ...baseMonaco };

    render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        onJumpToNode={vi.fn()}
      />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });

    expect(mockEditor.addAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'jump-to-node', label: 'Jump to Node in Tree' }),
    );
  });

  it('jump action no-ops without cursor position', () => {
    const mockEditor = withEditorDefaults();
    const mockMonaco = { ...baseMonaco };
    render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} onJumpToNode={vi.fn()} />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });
    const cfg = mockEditor.addAction.mock.calls[0][0] as { run: (ed: unknown) => void };
    cfg.run({ getPosition: () => undefined, getModel: () => ({ getLineContent: () => 'a.b' }) });
    expect(mockEditor.addAction).toHaveBeenCalled();
  });

  it('jump action no-ops when line content missing', () => {
    const mockEditor = withEditorDefaults();
    const mockMonaco = { ...baseMonaco };
    const onJump = vi.fn();
    render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} onJumpToNode={onJump} />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });
    const cfg = mockEditor.addAction.mock.calls[0][0] as { run: (ed: unknown) => void };
    cfg.run({ getPosition: () => ({ lineNumber: 2 }), getModel: () => ({ getLineContent: () => undefined }) });
    expect(onJump).not.toHaveBeenCalled();
  });

  it('jump action skips comment lines', () => {
    const mockEditor = withEditorDefaults();
    const mockMonaco = { ...baseMonaco };
    const onJump = vi.fn();
    render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} onJumpToNode={onJump} />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });
    const cfg = mockEditor.addAction.mock.calls[0][0] as { run: (ed: unknown) => void };
    cfg.run({
      getPosition: () => ({ lineNumber: 1 }),
      getModel: () => ({ getLineContent: () => '  # not a path' }),
    });
    expect(onJump).not.toHaveBeenCalled();
  });

  it('jump action extracts path and calls onJumpToNode', () => {
    const mockEditor = withEditorDefaults();
    const mockMonaco = { ...baseMonaco };
    const onJump = vi.fn();
    render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} onJumpToNode={onJump} />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });
    const cfg = mockEditor.addAction.mock.calls[0][0] as { run: (ed: unknown) => void };
    cfg.run({
      getPosition: () => ({ lineNumber: 1 }),
      getModel: () => ({ getLineContent: () => '  data.user.id  equals  1' }),
    });
    expect(onJump).toHaveBeenCalledWith('data.user.id');
  });

  it('sets model markers when errors update after mount', () => {
    const setModelMarkers = vi.fn();
    const mockModel = {};
    const mockEditor = withEditorDefaults({ getModel: () => mockModel });
    const mockMonaco = {
      ...baseMonaco,
      MarkerSeverity: { Error: 8 },
      editor: { ...baseMonaco.editor, setModelMarkers },
    };

    const { rerender } = render(
      <ValidationCodeEditor
        value="line"
        onChange={mockOnChangeHandler}
        errors={[]}
        onJumpToNode={vi.fn()}
      />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });

    rerender(
      <ValidationCodeEditor
        value="line"
        onChange={mockOnChangeHandler}
        errors={[{ lineNumber: 1, message: 'oops', column: 2 }]}
        onJumpToNode={vi.fn()}
      />,
    );

    expect(setModelMarkers).toHaveBeenCalledWith(
      mockModel,
      'validation-dsl',
      expect.arrayContaining([
        expect.objectContaining({
          severity: 8,
          message: 'oops',
          startLineNumber: 1,
          startColumn: 2,
          endLineNumber: 1,
          endColumn: 1002,
        }),
      ]),
    );
  });

  it('markers effect no-ops when getModel returns null', () => {
    const setModelMarkers = vi.fn();
    const mockEditor = withEditorDefaults({ getModel: () => null });
    const mockMonaco = {
      ...baseMonaco,
      MarkerSeverity: { Error: 8 },
      editor: { ...baseMonaco.editor, setModelMarkers },
    };

    const { rerender } = render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });
    rerender(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[{ lineNumber: 1, message: 'e' }]}
      />,
    );
    expect(setModelMarkers).not.toHaveBeenCalled();
  });

  it('markers use column 1 when error omits column', () => {
    const setModelMarkers = vi.fn();
    const mockModel = {};
    const mockEditor = withEditorDefaults({ getModel: () => mockModel });
    const mockMonaco = {
      ...baseMonaco,
      MarkerSeverity: { Error: 8 },
      editor: { ...baseMonaco.editor, setModelMarkers },
    };

    const { rerender } = render(
      <ValidationCodeEditor value="line" onChange={mockOnChangeHandler} errors={[]} />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });

    rerender(
      <ValidationCodeEditor
        value="line"
        onChange={mockOnChangeHandler}
        errors={[{ lineNumber: 1, message: 'oops' }]}
      />,
    );

    expect(setModelMarkers).toHaveBeenCalledWith(
      mockModel,
      'validation-dsl',
      expect.arrayContaining([
        expect.objectContaining({
          startColumn: 1,
          endColumn: 1001,
        }),
      ]),
    );
  });

  it('does not throw when errors update before editor mount', () => {
    const { rerender } = render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} />,
    );

    expect(() =>
      rerender(
        <ValidationCodeEditor
          value=""
          onChange={mockOnChangeHandler}
          errors={[{ lineNumber: 1, message: 'e' }]}
        />,
      ),
    ).not.toThrow();

    expect(() =>
      rerender(<ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} />),
    ).not.toThrow();
  });

  it('applies verify line decorations for pass and fail results', () => {
    const deltaDecorations = vi.fn().mockReturnValue(['v-dec-1']);
    const mockEditor = withEditorDefaults({
      deltaDecorations,
      getModel: () => ({}),
    });
    const mockMonaco = mockMonacoForMountedEditor();

    const { rerender } = render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} lineResults={[]} />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });

    rerender(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        lineResults={[
          { lineNumber: 1, passed: true },
          { lineNumber: 2, passed: false, expected: 'x', actual: 'y' },
        ]}
      />,
    );

    expect(deltaDecorations).toHaveBeenCalled();
    const lastCall = deltaDecorations.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          range: expect.objectContaining({ startLineNumber: 1 }),
          options: expect.objectContaining({
            className: 'dm-verify-line--pass',
            linesDecorationsTooltip: 'Passed',
          }),
        }),
        expect.objectContaining({
          range: expect.objectContaining({ startLineNumber: 2 }),
          options: expect.objectContaining({
            className: 'dm-verify-line--fail',
            linesDecorationsTooltip: 'Failed — Expected: x, Got: y',
          }),
        }),
      ]),
    );
  });

  it('verify fail decoration tooltip omits expected/actual when absent', () => {
    const deltaDecorations = vi.fn().mockReturnValue(['dec']);
    const mockEditor = withEditorDefaults({
      deltaDecorations,
      getModel: () => ({}),
    });
    const mockMonaco = mockMonacoForMountedEditor();

    const { rerender } = render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} lineResults={[]} />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });

    rerender(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        lineResults={[{ lineNumber: 1, passed: false }]}
      />,
    );

    const lastCall = deltaDecorations.mock.calls.at(-1);
    expect(lastCall?.[1]?.[0]).toEqual(
      expect.objectContaining({
        options: expect.objectContaining({
          linesDecorationsTooltip: 'Failed',
        }),
      }),
    );
  });

  it('clears verify decorations when lineResults becomes empty', () => {
    const deltaDecorations = vi.fn().mockImplementation((_old: string[], newDecs: unknown[]) =>
      (newDecs.length === 0 ? [] : ['verify-dec']));
    const mockEditor = withEditorDefaults({
      deltaDecorations,
      getModel: () => ({}),
    });
    const mockMonaco = mockMonacoForMountedEditor();

    const { rerender } = render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        lineResults={[{ lineNumber: 1, passed: true }]}
      />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });

    deltaDecorations.mockClear();

    rerender(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} lineResults={[]} />,
    );

    expect(deltaDecorations).toHaveBeenCalledWith(['verify-dec'], []);
  });

  it('applies error line decorations when errors present', () => {
    const deltaDecorations = vi.fn().mockReturnValue(['e-dec']);
    const mockEditor = withEditorDefaults({
      deltaDecorations,
      getModel: () => ({}),
    });
    const mockMonaco = mockMonacoForMountedEditor();

    const { rerender } = render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });

    rerender(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[{ lineNumber: 3, message: 'syntax error' }]}
      />,
    );

    const lastCall = deltaDecorations.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual([
      expect.objectContaining({
        range: expect.objectContaining({ startLineNumber: 3 }),
        options: expect.objectContaining({
          className: 'dm-verify-line--fail',
          linesDecorationsTooltip: 'syntax error',
        }),
      }),
    ]);
  });

  it('clears error decorations when errors becomes empty', () => {
    const deltaDecorations = vi.fn().mockImplementation((_old: string[], newDecs: unknown[]) =>
      (newDecs.length === 0 ? [] : ['err-dec']));
    const mockEditor = withEditorDefaults({
      deltaDecorations,
      getModel: () => ({}),
    });
    const mockMonaco = mockMonacoForMountedEditor();

    const { rerender } = render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[{ lineNumber: 1, message: 'bad' }]}
      />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });

    deltaDecorations.mockClear();

    rerender(<ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} />);

    expect(deltaDecorations).toHaveBeenCalledWith(['err-dec'], []);
  });

  it('shows passed/failed stats in header when lineResults present', () => {
    render(
      <ValidationCodeEditor
        value="a\nb"
        onChange={mockOnChangeHandler}
        errors={[]}
        lineResults={[
          { lineNumber: 1, passed: true },
          { lineNumber: 2, passed: false },
        ]}
      />,
    );
    expect(screen.getByText('1 passed')).toBeTruthy();
    expect(screen.getByText('1 failed')).toBeTruthy();
  });

  it('calls onEditorMount when editor mounts', () => {
    const onEditorMount = vi.fn();
    const mockEditor = withEditorDefaults();
    render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} onEditorMount={onEditorMount} />,
    );
    act(() => { mockOnMount?.(mockEditor, baseMonaco); });
    expect(onEditorMount).toHaveBeenCalledWith(mockEditor);
  });

  it('hides header when hideHeader is true', () => {
    render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} hideHeader />,
    );
    expect(screen.queryByText('Validation Rules')).not.toBeInTheDocument();
  });

  it('hides footer when hideFooter is true', () => {
    render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} hideFooter />,
    );
    expect(screen.queryByText(/Syntax:/)).not.toBeInTheDocument();
  });

  it('trigger-suggest-alt action invokes Monaco trigger', () => {
    const mockEditor = withEditorDefaults();
    render(<ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} />);
    act(() => { mockOnMount?.(mockEditor, baseMonaco); });

    const suggestCfg = mockEditor.addAction.mock.calls[1][0] as {
      run: (ed: unknown) => void;
    };
    suggestCfg.run(mockEditor);

    expect(mockEditor.trigger).toHaveBeenCalledWith(
      'keyboard',
      'editor.action.triggerSuggest',
      {},
    );
  });

  it('re-applies dynamic theme when document theme attributes change', async () => {
    const defineTheme = vi.fn();
    const setTheme = vi.fn();
    const mockEditor = withEditorDefaults({ getModel: () => ({}) });
    const mockMonaco = mockMonacoForMountedEditor({ defineTheme, setTheme });

    render(<ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} />);
    await act(async () => { mockOnMount?.(mockEditor, mockMonaco); });

    defineTheme.mockClear();
    setTheme.mockClear();

    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'light');
    });

    await waitFor(() => {
      expect(defineTheme).toHaveBeenCalled();
      expect(setTheme).toHaveBeenCalled();
    });
  });

  it('beforeMount converts rgb CSS variables when defining theme', () => {
    document.documentElement.style.setProperty('--surface', 'rgb(240, 244, 250)');
    const mockMonaco = createMonacoForRegistration();

    render(<ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} />);
    act(() => { mockBeforeMount?.(mockMonaco); });

    expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        colors: expect.objectContaining({
          'editor.background': expect.stringMatching(/^#/),
        }),
      }),
    );

    document.documentElement.style.removeProperty('--surface');
  });

  it('renders with readOnly option', () => {
    render(
      <ValidationCodeEditor
        value="name equals x"
        onChange={mockOnChangeHandler}
        errors={[]}
        readOnly
      />,
    );
    expect(screen.getByTestId('mock-editor')).toBeTruthy();
  });

  it('renders with custom numeric height', () => {
    const { container } = render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        height={400}
      />,
    );
    const body = container.querySelector('.dm-validation-editor-body');
    expect(body).toBeTruthy();
    expect((body as HTMLElement).style.height).toBe('400px');
  });

  it('renders string height as-is in style', () => {
    const { container } = render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        height="50vh"
      />,
    );
    const body = container.querySelector('.dm-validation-editor-body') as HTMLElement;
    expect(body.style.height).toBe('50vh');
  });
});

describe('ValidationCodeEditor completion provider', () => {
  beforeEach(() => {
    vi.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).__validationDsl_languageRegistered;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).__validationDsl_completionDisposable;
  });

  async function loadFreshEditor() {
    const mod = await import('./ValidationCodeEditor');
    return mod.default;
  }

  it('second beforeMount skips re-registering language and reuses completion provider', async () => {
    const Fresh = await loadFreshEditor();
    const m1 = createMonacoForRegistration();
    const m2 = createMonacoForRegistration();
    render(<Fresh value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => {
      mockBeforeMount?.(m1);
      mockBeforeMount?.(m2);
    });
    expect(m1.languages.register).toHaveBeenCalledTimes(1);
    expect(m2.languages.register).not.toHaveBeenCalled();
    // Completion provider is registered once (on m1) and reused
    expect(m1.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(1);
    expect(m2.languages.registerCompletionItemProvider).not.toHaveBeenCalled();
  });

  it('suggests matching paths through Monaco widget in path position', async () => {
    const Fresh = await loadFreshEditor();
    const mockMonaco = createMonacoForRegistration();
    (window as Record<string, unknown>).__REDFIRE_VALIDATION_PATHS = ['data.user', 'data.order'];
    render(
      <Fresh
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user', 'data.order']}
      />,
    );
    await act(async () => {
      mockBeforeMount?.(mockMonaco);
    });

    const provider = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0]?.[1] as {
      provideCompletionItems: (
        model: { getLineContent: (n: number) => string },
        position: { lineNumber: number; column: number },
        context: { triggerKind: number },
      ) => { suggestions: { label: string }[] };
    };
    expect(provider).toBeTruthy();

    const result = provider.provideCompletionItems(
      { getLineContent: () => 'data' },
      { lineNumber: 1, column: 5 },
      makeContext(0),
    );
    expect(result.suggestions.length).toBe(2);
    expect(result.suggestions.map((s: { label: string }) => s.label)).toEqual(['data.user', 'data.order']);

    delete (window as Record<string, unknown>).__REDFIRE_VALIDATION_PATHS;
  });

  it('suggests operators after path', async () => {
    const Fresh = await loadFreshEditor();
    const mockMonaco = createMonacoForRegistration();
    render(<Fresh value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => {
      mockBeforeMount?.(mockMonaco);
    });
    const provider = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0][1] as {
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }, context: { triggerKind: number }) => { suggestions: { label: string }[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field ' },
      { lineNumber: 1, column: 7 },
      makeContext(1),
    );
    expect(r.suggestions.some(s => s.label === 'equals')).toBe(true);
  });

  it('filters partial operator token', async () => {
    const Fresh = await loadFreshEditor();
    const mockMonaco = createMonacoForRegistration();
    render(<Fresh value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => {
      mockBeforeMount?.(mockMonaco);
    });
    const provider = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0][1] as {
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }, context: { triggerKind: number }) => { suggestions: { label: string }[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field gre' },
      { lineNumber: 1, column: 10 },
      makeContext(1),
    );
    expect(r.suggestions.map(s => s.label)).toContain('greater_than');
    expect(r.suggestions.map(s => s.label)).not.toContain('equals');
  });

  it('suggests type names after is_type', async () => {
    const Fresh = await loadFreshEditor();
    const mockMonaco = createMonacoForRegistration();
    render(<Fresh value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => {
      mockBeforeMount?.(mockMonaco);
    });
    const provider = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0][1] as {
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }, context: { triggerKind: number }) => { suggestions: { label: string }[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field is_type ' },
      { lineNumber: 1, column: 15 },
      makeContext(1),
    );
    expect(r.suggestions.map(s => s.label).sort()).toEqual(['array', 'boolean', 'null', 'number', 'object', 'string']);
  });

  it('returns no value suggestions after is_true', async () => {
    const Fresh = await loadFreshEditor();
    const mockMonaco = createMonacoForRegistration();
    render(<Fresh value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => {
      mockBeforeMount?.(mockMonaco);
    });
    const provider = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0][1] as {
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }, context: { triggerKind: number }) => { suggestions: unknown[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field is_true ' },
      { lineNumber: 1, column: 15 },
      makeContext(1),
    );
    expect(r.suggestions).toEqual([]);
  });

  it('returns no value suggestions after is_false', async () => {
    const Fresh = await loadFreshEditor();
    const mockMonaco = createMonacoForRegistration();
    render(<Fresh value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => {
      mockBeforeMount?.(mockMonaco);
    });
    const provider = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0][1] as {
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }, context: { triggerKind: number }) => { suggestions: unknown[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field is_false ' },
      { lineNumber: 1, column: 16 },
      makeContext(1),
    );
    expect(r.suggestions).toEqual([]);
  });

  it('suggests booleans for generic operators', async () => {
    const Fresh = await loadFreshEditor();
    const mockMonaco = createMonacoForRegistration();
    render(<Fresh value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => {
      mockBeforeMount?.(mockMonaco);
    });
    const provider = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0][1] as {
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }, context: { triggerKind: number }) => { suggestions: { label: string }[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field equals ' },
      { lineNumber: 1, column: 14 },
      makeContext(1),
    );
    expect(r.suggestions.map(s => s.label).sort()).toEqual(['false', 'true']);
  });
});

// ─── Path hint strip & model-change behaviour ─────────────────────────────────

describe('ValidationCodeEditor path-hint strip and model handlers', () => {
  beforeEach(() => {
    mockOnChange = undefined;
    mockBeforeMount = undefined;
    mockOnMount = undefined;
    lastEditorProps = null;
  });

  /**
   * Construct a mock editor that lets the test drive the model-change and
   * cursor-position callbacks (so the path-prefix tracker becomes observable
   * via the rendered hint chips).
   */
  function buildEditorWithCallbacks(line = 'data', column = 5) {
    const contentHandlers: Array<(e: { changes: Array<{ text: string; rangeOffset: number }> }) => void> = [];
    const cursorHandlers: Array<() => void> = [];
    const model = {
      getLineContent: vi.fn().mockReturnValue(line),
      getPositionAt: vi.fn().mockImplementation((offset: number) => ({ lineNumber: 1, column: offset + 1 })),
    };
    const editor = {
      addAction: vi.fn(),
      addCommand: vi.fn(),
      onDidChangeModelContent: vi.fn().mockImplementation((cb: (e: { changes: Array<{ text: string; rangeOffset: number }> }) => void) => {
        contentHandlers.push(cb);
        return { dispose: vi.fn() };
      }),
      onDidChangeCursorPosition: vi.fn().mockImplementation((cb: (e: { position: { lineNumber: number; column: number } }) => void) => {
        cursorHandlers.push(cb);
        return { dispose: vi.fn() };
      }),
      onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      trigger: vi.fn(),
      executeEdits: vi.fn(),
      setPosition: vi.fn(),
      focus: vi.fn(),
      getPosition: vi.fn().mockReturnValue({ lineNumber: 1, column }),
      getSelection: vi.fn().mockReturnValue(null),
      getModel: vi.fn().mockReturnValue(model),
      getDomNode: vi.fn().mockReturnValue(null),
    };
    const monaco = {
      KeyMod: { CtrlCmd: 2048 },
      KeyCode: { KeyG: 30, Space: 10, Tab: 2 },
      editor: { defineTheme: vi.fn(), setTheme: vi.fn() },
    };
    return {
      editor,
      monaco,
      model,
      triggerContentChange: (changes: Array<{ text: string; rangeOffset: number }>) => {
        for (const h of contentHandlers) h({ changes });
      },
      triggerCursorChange: (override?: { lineNumber: number; column: number }) => {
        const pos = override ?? { lineNumber: 1, column };
        for (const h of cursorHandlers) h({ position: pos });
      },
    };
  }

  it('shows path-hint chips when the typed prefix matches a sample path', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('data', 5);
    render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id', 'data.order.total', 'unrelated']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });

    expect(screen.getByRole('region', { name: 'Matching paths' })).toBeInTheDocument();
    expect(screen.getByText('data.user.id')).toBeInTheDocument();
    expect(screen.getByText('data.order.total')).toBeInTheDocument();
    expect(screen.queryByText('unrelated')).not.toBeInTheDocument();
  });

  it('clicking a path chip inserts that path at the cursor via executeEdits', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('data', 5);
    render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });

    const chip = screen.getByText('data.user.id');
    fireEvent.click(chip);

    expect(editor.executeEdits).toHaveBeenCalledWith(
      'dsl-insert-path',
      expect.arrayContaining([
        expect.objectContaining({
          text: 'data.user.id',
          forceMoveMarkers: true,
        }),
      ]),
    );
    expect(editor.focus).toHaveBeenCalled();
  });

  it('hides path-hint chips when the current line begins with "#"', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('# data', 7);
    const { container } = render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });
    expect(container.querySelector('.dm-validation-editor-pathstrip')).not.toBeInTheDocument();
  });

  it('hides path-hint chips after a space (no longer in path position)', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('data ', 6);
    const { container } = render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });
    expect(container.querySelector('.dm-validation-editor-pathstrip')).not.toBeInTheDocument();
  });

  it('hides path-hint chips after a path is fully typed (more than one token)', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('data equals', 12);
    const { container } = render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });
    expect(container.querySelector('.dm-validation-editor-pathstrip')).not.toBeInTheDocument();
  });

  it('hides path-hint chips when the typed prefix exactly equals a sample path', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('data.user.id', 13);
    const { container } = render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });
    expect(container.querySelector('.dm-validation-editor-pathstrip')).not.toBeInTheDocument();
  });

  it('clears prefix when position is null', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('data', 5);
    editor.getPosition.mockReturnValue(null);
    const { container } = render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });
    expect(container.querySelector('.dm-validation-editor-pathstrip')).not.toBeInTheDocument();
  });

  it('macOS smart-period substitution ". " is reverted to a single " "', async () => {
    const { editor, monaco, triggerContentChange } = buildEditorWithCallbacks('data', 5);
    render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });

    await act(async () => {
      triggerContentChange([{ text: '. ', rangeOffset: 4 }]);
    });

    expect(editor.executeEdits).toHaveBeenCalledWith(
      'block-mac-smart-period',
      expect.arrayContaining([
        expect.objectContaining({
          text: ' ',
          forceMoveMarkers: true,
        }),
      ]),
    );
    expect(editor.setPosition).toHaveBeenCalled();
  });

  it('also reverts the " ." inverted-substitution variant', async () => {
    const { editor, monaco, triggerContentChange } = buildEditorWithCallbacks('data', 5);
    render(
      <ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => {
      triggerContentChange([{ text: ' .', rangeOffset: 4 }]);
    });
    expect(editor.executeEdits).toHaveBeenCalledWith('block-mac-smart-period', expect.anything());
  });

  it('does NOT revert ordinary single-character insertions', async () => {
    const { editor, monaco, triggerContentChange } = buildEditorWithCallbacks('data', 5);
    render(<ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => {
      triggerContentChange([{ text: 'x', rangeOffset: 4 }]);
    });
    expect(editor.executeEdits).not.toHaveBeenCalledWith('block-mac-smart-period', expect.anything());
  });

  it('macOS guard no-ops when getModel returns null inside the handler', async () => {
    const { editor, monaco, triggerContentChange } = buildEditorWithCallbacks('data', 5);
    render(<ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => { mockOnMount?.(editor, monaco); });
    editor.getModel.mockReturnValue(null);
    await act(async () => {
      triggerContentChange([{ text: '. ', rangeOffset: 4 }]);
    });
    expect(editor.executeEdits).not.toHaveBeenCalledWith('block-mac-smart-period', expect.anything());
  });

  it('hardens the Monaco textarea with autocorrect/autocomplete/spellcheck off', async () => {
    const textarea = document.createElement('textarea');
    textarea.className = 'ime-text-area';
    const domNode = document.createElement('div');
    domNode.appendChild(textarea);
    const { editor, monaco } = buildEditorWithCallbacks('data', 5);
    editor.getDomNode.mockReturnValue(domNode);
    render(<ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => { mockOnMount?.(editor, monaco); });

    expect(textarea.getAttribute('autocorrect')).toBe('off');
    expect(textarea.getAttribute('autocomplete')).toBe('off');
    expect(textarea.getAttribute('autocapitalize')).toBe('off');
    expect(textarea.getAttribute('spellcheck')).toBe('false');
    expect(textarea.getAttribute('data-gramm')).toBe('false');
  });

  it('falls back to inputarea class when ime-text-area is absent', async () => {
    const textarea = document.createElement('textarea');
    textarea.className = 'inputarea';
    const domNode = document.createElement('div');
    domNode.appendChild(textarea);
    const { editor, monaco } = buildEditorWithCallbacks('data', 5);
    editor.getDomNode.mockReturnValue(domNode);
    render(<ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => { mockOnMount?.(editor, monaco); });
    expect(textarea.getAttribute('autocorrect')).toBe('off');
  });

  it('falls back to plain <textarea> when no class matches', async () => {
    const textarea = document.createElement('textarea');
    const domNode = document.createElement('div');
    domNode.appendChild(textarea);
    const { editor, monaco } = buildEditorWithCallbacks('data', 5);
    editor.getDomNode.mockReturnValue(domNode);
    render(<ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => { mockOnMount?.(editor, monaco); });
    expect(textarea.getAttribute('autocorrect')).toBe('off');
  });

  it('falls back to document-level selector when editor DOM is empty', async () => {
    const textarea = document.createElement('textarea');
    textarea.className = 'ime-text-area';
    const editorRoot = document.createElement('div');
    editorRoot.className = 'dm-validation-editor';
    editorRoot.appendChild(textarea);
    document.body.appendChild(editorRoot);
    try {
      const { editor, monaco } = buildEditorWithCallbacks('data', 5);
      editor.getDomNode.mockReturnValue(null);
      render(<ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} />);
      await act(async () => { mockOnMount?.(editor, monaco); });
      expect(textarea.getAttribute('autocorrect')).toBe('off');
    } finally {
      editorRoot.remove();
    }
  });

  it('inserts path correctly when getModel is null (no-op gracefully)', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('data', 5);
    const originalModel = editor.getModel.getMockImplementation();
    let calls = 0;
    editor.getModel.mockImplementation(() => {
      calls += 1;
      if (calls > 4) return null;
      return originalModel ? originalModel() : null;
    });
    render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });
    const chip = screen.queryByText('data.user.id');
    if (chip) {
      expect(() => fireEvent.click(chip)).not.toThrow();
    }
  });

  it('path-hint chip onMouseDown preventDefault stops focus loss', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('data', 5);
    render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });
    const chip = screen.getByText('data.user.id');
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    const dispatched = chip.dispatchEvent(event);
    // preventDefault on a cancelable event makes dispatchEvent return false.
    expect(dispatched).toBe(false);
  });

  it('onDidDispose handler disposes both content and cursor listeners', async () => {
    const contentDispose = vi.fn();
    const cursorDispose = vi.fn();
    const disposeDispose = vi.fn();
    const disposeHandlers: Array<() => void> = [];
    const editor = {
      addAction: vi.fn(),
      addCommand: vi.fn(),
      onDidChangeModelContent: vi.fn().mockReturnValue({ dispose: contentDispose }),
      onDidChangeCursorPosition: vi.fn().mockReturnValue({ dispose: cursorDispose }),
      onDidDispose: vi.fn().mockImplementation((cb: () => void) => {
        disposeHandlers.push(cb);
        return { dispose: disposeDispose };
      }),
      trigger: vi.fn(),
      executeEdits: vi.fn(),
      setPosition: vi.fn(),
      focus: vi.fn(),
      getPosition: vi.fn().mockReturnValue(null),
      getModel: vi.fn().mockReturnValue(null),
      getDomNode: vi.fn().mockReturnValue(null),
    };
    const monaco = { KeyMod: { CtrlCmd: 2048 }, KeyCode: { KeyG: 30 }, editor: { defineTheme: vi.fn(), setTheme: vi.fn() } };
    render(<ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => { mockOnMount?.(editor, monaco); });
    expect(disposeHandlers).toHaveLength(1);
    disposeHandlers[0]();
    expect(contentDispose).toHaveBeenCalled();
    expect(cursorDispose).toHaveBeenCalled();
    expect(disposeDispose).toHaveBeenCalled();
  });

  it('Tab accept-path-hint replaces partial token with first matching path', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('dat', 4);
    render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });

    const acceptCfg = editor.addAction.mock.calls[2][0] as { run: (ed: unknown) => void };
    acceptCfg.run(editor);

    expect(editor.executeEdits).toHaveBeenCalledWith(
      'accept-path-hint',
      expect.arrayContaining([
        expect.objectContaining({
          text: 'data.user.id',
          forceMoveMarkers: true,
        }),
      ]),
    );
  });

  it('Tab accept-path-hint no-ops when there are no matching path hints', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('data ', 6);
    render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });

    editor.executeEdits.mockClear();
    const acceptCfg = editor.addAction.mock.calls[2][0] as { run: (ed: unknown) => void };
    acceptCfg.run(editor);

    expect(editor.executeEdits).not.toHaveBeenCalled();
  });

  it('Tab accept-path-hint no-ops when position or model is null', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('dat', 4);
    render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });

    editor.getPosition.mockReturnValue(null);
    editor.executeEdits.mockClear();
    const acceptCfg = editor.addAction.mock.calls[2][0] as { run: (ed: unknown) => void };
    acceptCfg.run(editor);
    expect(editor.executeEdits).not.toHaveBeenCalled();

    editor.getPosition.mockReturnValue({ lineNumber: 1, column: 4 });
    editor.getModel.mockReturnValue(null);
    editor.executeEdits.mockClear();
    acceptCfg.run(editor);
    expect(editor.executeEdits).not.toHaveBeenCalled();
  });

  it('calls onJumpToNode when cursor moves to a different line with a path', async () => {
    const model = {
      getLineContent: vi.fn().mockImplementation((ln: number) =>
        (ln === 2 ? 'other.field equals 1' : 'first.field equals 1')),
      getPositionAt: vi.fn().mockImplementation((offset: number) => ({ lineNumber: 1, column: offset + 1 })),
    };
    const contentHandlers: Array<(e: { changes: Array<{ text: string; rangeOffset: number }> }) => void> = [];
    const cursorHandlers: Array<(e: { position: { lineNumber: number; column: number } }) => void> = [];
    const editor = {
      addAction: vi.fn(),
      addCommand: vi.fn(),
      onDidChangeModelContent: vi.fn().mockImplementation((cb: (e: { changes: Array<{ text: string; rangeOffset: number }> }) => void) => {
        contentHandlers.push(cb);
        return { dispose: vi.fn() };
      }),
      onDidChangeCursorPosition: vi.fn().mockImplementation((cb: (e: { position: { lineNumber: number; column: number } }) => void) => {
        cursorHandlers.push(cb);
        return { dispose: vi.fn() };
      }),
      onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      trigger: vi.fn(),
      executeEdits: vi.fn(),
      setPosition: vi.fn(),
      focus: vi.fn(),
      getPosition: vi.fn().mockReturnValue({ lineNumber: 1, column: 5 }),
      getSelection: vi.fn().mockReturnValue(null),
      getModel: vi.fn().mockReturnValue(model),
      getDomNode: vi.fn().mockReturnValue(null),
    };
    const monaco = {
      KeyMod: { CtrlCmd: 2048 },
      KeyCode: { KeyG: 30, Space: 10, Tab: 2 },
      editor: { defineTheme: vi.fn(), setTheme: vi.fn() },
    };

    const onJump = vi.fn();
    render(
      <ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} onJumpToNode={onJump} />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });

    await act(async () => {
      for (const h of cursorHandlers) h({ position: { lineNumber: 1, column: 8 } });
    });
    await act(async () => {
      for (const h of cursorHandlers) h({ position: { lineNumber: 2, column: 8 } });
    });

    expect(onJump).toHaveBeenCalledWith('first.field');
    expect(onJump).toHaveBeenCalledWith('other.field');
  });

  it('does not call onJumpToNode twice for cursor moves on the same line', async () => {
    const onJump = vi.fn();
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('alpha.beta equals 1', 12);
    render(
      <ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} onJumpToNode={onJump} />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });

    await act(async () => { triggerCursorChange({ lineNumber: 1, column: 5 }); });
    await act(async () => { triggerCursorChange({ lineNumber: 1, column: 18 }); });

    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onJump).toHaveBeenCalledWith('alpha.beta');
  });

  it('skips cursor side-effects while selecting text', async () => {
    const onJump = vi.fn();
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('path.only equals 1', 15);
    editor.getSelection.mockReturnValue({ isEmpty: () => false });

    render(
      <ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} onJumpToNode={onJump} samplePaths={[]} />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });

    await act(async () => { triggerCursorChange({ lineNumber: 1, column: 10 }); });

    expect(onJump).not.toHaveBeenCalled();
  });

  it('path chip click no-ops when getPosition returns null after hints render', async () => {
    const { editor, monaco, triggerCursorChange } = buildEditorWithCallbacks('data', 5);
    render(
      <ValidationCodeEditor
        value=""
        onChange={vi.fn()}
        errors={[]}
        samplePaths={['data.user.id']}
      />,
    );
    await act(async () => { mockOnMount?.(editor, monaco); });
    await act(async () => { triggerCursorChange(); });

    editor.getPosition.mockReturnValue(null);
    editor.executeEdits.mockClear();
    fireEvent.click(screen.getByText('data.user.id'));
    expect(editor.executeEdits).not.toHaveBeenCalled();
  });

  it('calls installTextareaHardening cancel when editor disposes', async () => {
    const cancel = vi.fn();
    const spy = vi.spyOn(MonacoTextareaHardening, 'installTextareaHardening').mockReturnValue({ cancel });

    try {
      const disposeHandlers: Array<() => void> = [];
      const editor = {
        addAction: vi.fn(),
        addCommand: vi.fn(),
        onDidChangeModelContent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidChangeCursorPosition: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidDispose: vi.fn().mockImplementation((cb: () => void) => {
          disposeHandlers.push(cb);
          return { dispose: vi.fn() };
        }),
        trigger: vi.fn(),
        executeEdits: vi.fn(),
        setPosition: vi.fn(),
        focus: vi.fn(),
        getPosition: vi.fn().mockReturnValue(null),
        getModel: vi.fn().mockReturnValue(null),
        getDomNode: vi.fn().mockReturnValue(null),
      };
      const monaco = { KeyMod: { CtrlCmd: 2048 }, KeyCode: { KeyG: 30 }, editor: { defineTheme: vi.fn(), setTheme: vi.fn() } };

      render(<ValidationCodeEditor value="" onChange={vi.fn()} errors={[]} />);
      await act(async () => { mockOnMount?.(editor, monaco); });

      disposeHandlers[0]();

      expect(cancel).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
