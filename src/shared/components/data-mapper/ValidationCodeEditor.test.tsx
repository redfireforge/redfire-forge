/** @vitest-environment jsdom */
import { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
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
import * as _MonacoTextareaHardening from './utils/monacoTextareaHardening';
import {
  withEditorDefaults,
  createMonacoForRegistration,
} from './__test-utils__/validationCodeEditorHelpers';

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
      getModel: () => ({ getLineLength: () => 20 }),
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
      getModel: () => ({ getLineLength: () => 20 }),
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
      getModel: () => ({ getLineLength: () => 20 }),
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
