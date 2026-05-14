/** @vitest-environment jsdom */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
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

function createMonacoForRegistration() {
  return {
    languages: {
      register: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      registerCompletionItemProvider: vi.fn(),
      CompletionItemKind: { Field: 1, Keyword: 2, Value: 3 },
    },
    editor: { defineTheme: vi.fn() },
  };
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

  it('onMount adds jump-to-node action', () => {
    const mockEditor = {
      addAction: vi.fn(),
    };
    const mockMonaco = {
      KeyMod: { CtrlCmd: 2048 },
      KeyCode: { KeyG: 30 },
    };

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
    const mockEditor = { addAction: vi.fn() };
    const mockMonaco = { KeyMod: { CtrlCmd: 2048 }, KeyCode: { KeyG: 30 } };
    render(
      <ValidationCodeEditor value="" onChange={mockOnChangeHandler} errors={[]} onJumpToNode={vi.fn()} />,
    );
    act(() => { mockOnMount?.(mockEditor, mockMonaco); });
    const cfg = mockEditor.addAction.mock.calls[0][0] as { run: (ed: unknown) => void };
    cfg.run({ getPosition: () => undefined, getModel: () => ({ getLineContent: () => 'a.b' }) });
    expect(mockEditor.addAction).toHaveBeenCalled();
  });

  it('jump action no-ops when line content missing', () => {
    const mockEditor = { addAction: vi.fn() };
    const mockMonaco = { KeyMod: { CtrlCmd: 2048 }, KeyCode: { KeyG: 30 } };
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
    const mockEditor = { addAction: vi.fn() };
    const mockMonaco = { KeyMod: { CtrlCmd: 2048 }, KeyCode: { KeyG: 30 } };
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
    const mockEditor = { addAction: vi.fn() };
    const mockMonaco = { KeyMod: { CtrlCmd: 2048 }, KeyCode: { KeyG: 30 } };
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
    const mockEditor = {
      addAction: vi.fn(),
      getModel: () => mockModel,
    };
    const mockMonaco = {
      KeyMod: { CtrlCmd: 2048 },
      KeyCode: { KeyG: 30 },
      MarkerSeverity: { Error: 8 },
      editor: { setModelMarkers },
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
    const mockEditor = {
      addAction: vi.fn(),
      getModel: () => null,
    };
    const mockMonaco = {
      KeyMod: { CtrlCmd: 2048 },
      KeyCode: { KeyG: 30 },
      MarkerSeverity: { Error: 8 },
      editor: { setModelMarkers },
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

  it('shows pop-out when onPopOut is set and not floating', () => {
    const onPopOut = vi.fn();
    render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        onPopOut={onPopOut}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Pop out editor' });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onPopOut).toHaveBeenCalledTimes(1);
  });

  it('hides pop-out when floating', () => {
    render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        onPopOut={vi.fn()}
        isFloating
      />,
    );
    expect(screen.queryByRole('button', { name: 'Pop out editor' })).not.toBeInTheDocument();
  });

  it('applies floating header class when isFloating', () => {
    const { container } = render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        isFloating
      />,
    );
    expect(container.querySelector('.dm-validation-editor-header--floating')).toBeTruthy();
  });

  it('shows pop-in when onPopIn is set and floating', () => {
    const onPopIn = vi.fn();
    render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        onPopIn={onPopIn}
        isFloating
      />,
    );
    const btn = screen.getByRole('button', { name: 'Pop in editor' });
    fireEvent.click(btn);
    expect(onPopIn).toHaveBeenCalledTimes(1);
  });

  it('hides pop-in when not floating', () => {
    render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
        onPopIn={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Pop in editor' })).not.toBeInTheDocument();
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
  });

  async function loadFreshEditor() {
    const mod = await import('./ValidationCodeEditor');
    return mod.default;
  }

  it('second beforeMount skips re-registering language and completion provider', async () => {
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
    expect(m1.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(1);
    expect(m2.languages.registerCompletionItemProvider).not.toHaveBeenCalled();
  });

  it('suggests sample paths at line start', async () => {
    const Fresh = await loadFreshEditor();
    const mockMonaco = createMonacoForRegistration();
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
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }) => { suggestions: { label: string }[] };
    };
    expect(provider).toBeTruthy();

    const result = provider.provideCompletionItems(
      { getLineContent: () => 'data' },
      { lineNumber: 1, column: 5 },
    );
    const labels = result.suggestions.map(s => s.label);
    expect(labels).toContain('data.user');
    expect(labels).toContain('data.order');
  });

  it('suggests operators after path', async () => {
    const Fresh = await loadFreshEditor();
    const mockMonaco = createMonacoForRegistration();
    render(<Fresh value="" onChange={vi.fn()} errors={[]} />);
    await act(async () => {
      mockBeforeMount?.(mockMonaco);
    });
    const provider = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0][1] as {
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }) => { suggestions: { label: string }[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field ' },
      { lineNumber: 1, column: 7 },
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
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }) => { suggestions: { label: string }[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field gre' },
      { lineNumber: 1, column: 10 },
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
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }) => { suggestions: { label: string }[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field is_type ' },
      { lineNumber: 1, column: 15 },
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
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }) => { suggestions: unknown[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field is_true ' },
      { lineNumber: 1, column: 15 },
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
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }) => { suggestions: unknown[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field is_false ' },
      { lineNumber: 1, column: 16 },
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
      provideCompletionItems: (model: { getLineContent: (n: number) => string }, position: { lineNumber: number; column: number }) => { suggestions: { label: string }[] };
    };

    const r = provider.provideCompletionItems(
      { getLineContent: () => 'field equals ' },
      { lineNumber: 1, column: 14 },
    );
    expect(r.suggestions.map(s => s.label).sort()).toEqual(['false', 'true']);
  });
});
