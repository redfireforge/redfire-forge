/**
 * Standalone `@monaco-editor/react` mock used by `ExpressionEditorModal`
 * test files.
 *
 * This module intentionally has ZERO dependency on `ExpressionEditorModal`
 * (or anything that imports it). The mock-registration factory for
 * `@monaco-editor/react` (registered in each `ExpressionEditorModal*.test.tsx`
 * file) calls `buildMonacoMock` from this module. If this module
 * (transitively) imported `ExpressionEditorModal`, loading that component —
 * which itself imports `@monaco-editor/react` — would re-enter the
 * still-pending mock factory and deadlock the module graph. See
 * `expressionEditorHarness.tsx` for the higher-level helpers (`renderModal`,
 * snippet mocks, etc.) that are safe to import from test files but must NOT
 * be imported from the `@monaco-editor/react` mock factory itself.
 *
 * CAUTION: do not write the literal Vitest mock-registration call (dot-mock,
 * parens) in this file's comments — Vitest's static hoisting scan can match
 * that text even inside a comment and corrupt this module's exports.
 */
import { vi } from 'vitest';

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

export function createFakeMonaco() {
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

/* v8 ignore start */
export function createFakeEditor(
  opts: { modelInitial?: string; getSelectionImpl?: () => unknown } = {},
) {
  const modelValue = { current: opts.modelInitial ?? '' };
  const model = {
    getValue: () => modelValue.current,
    setValue: (v: string) => { modelValue.current = v; },
    getValueInRange: () => '',
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
    trigger: vi.fn(),
    addCommand: vi.fn((keybinding: number, handler: () => void) => {
      commands.set(keybinding, handler);
    }),
    __runCommand: (keybinding: number) => {
      commands.get(keybinding)?.();
    },
  };
  return { editor, model };
}
/* v8 ignore stop */

/**
 * Async factory body for the Monaco editor Vitest mock. Returns a
 * module-shaped object containing the mocked default export (`MockEditor`).
 *
 * The MockEditor renders a `<textarea data-testid="monaco-editor">` and, on
 * mount, builds a fake editor + monaco pair via `createFakeEditor` /
 * `createFakeMonaco`, records them on `monacoTestState`, and invokes the
 * caller-supplied `onMount` callback.
 */
export async function buildMonacoMock() {
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
      /* v8 ignore next */
      if (monacoTestState.suppressOnMount) return;
      /* v8 ignore next */
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
}

/** Reset all monaco test state (per-test `beforeEach`). */
export function resetMonacoTestState() {
  monacoTestState.lastEditor = null;
  monacoTestState.lastMonaco = null;
  monacoTestState.lastMountOpts = null;
  monacoTestState.completionProvider = null;
  monacoTestState.disposeSpies = [];
  monacoTestState.suppressOnMount = false;
}
