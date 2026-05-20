/** @vitest-environment jsdom */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let mockOnChange: ((v: string | undefined) => void) | undefined;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let mockBeforeMount: ((monaco: unknown) => void) | undefined;
let mockOnMount: ((editor: unknown, monaco: unknown) => void) | undefined;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
