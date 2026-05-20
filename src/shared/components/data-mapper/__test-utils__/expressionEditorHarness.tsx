/**
 * Shared test harness for `ExpressionEditorModal` test files.
 *
 * All three `ExpressionEditorModal.{test,part2,part3}.test.tsx` files used to
 * duplicate ~200 lines of fake Monaco editor + snippet store setup. This
 * module consolidates those helpers so individual test files only contain
 * the unique test cases.
 *
 * Usage pattern (typical test file):
 * ```tsx
 * import {
 *   monacoTestState,
 *   buildMonacoMock,
 *   installSnippetMocks,
 *   makeSnippetMockImplementations,
 *   sources,
 *   baseMapping,
 *   renderModal,
 *   flushMonacoMount,
 * } from './__test-utils__/expressionEditorHarness';
 *
 * vi.mock('@monaco-editor/react', async () => {
 *   const h = await import('./__test-utils__/expressionEditorHarness');
 *   return h.buildMonacoMock();
 * });
 *
 * vi.mock('./utils/expressionSnippets', () => installSnippetMocks());
 *
 * const snippetMocks = makeSnippetMockImplementations();
 * beforeEach(() => snippetMocks.reset());
 * ```
 *
 * NB: because the harness owns module-scoped state, each test file runs in
 * its own vitest worker so state isolation across files is implicit.
 */
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { act } from '@testing-library/react';
import type { Mock } from 'vitest';
import ExpressionEditorModal from '../ExpressionEditorModal';
import type { Mapping, MapperSource } from '../types';

// ─── Monaco fake editor / monaco ────────────────────────────────────────────

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
 * Async factory body for `vi.mock('@monaco-editor/react', …)`. Returns a
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

// ─── Snippet store mocks ────────────────────────────────────────────────────

type SnippetStub = { id: string; name: string; expression: string; updatedAt: number };

/**
 * Build a fresh snippet-mock helper. Returns the mock functions, the in-memory
 * store, and a `reset()` that wires the standard CRUD behaviour back onto them
 * (clearing store + re-installing mockImplementation calls).
 */
export function makeSnippetMockImplementations(mocks: {
  loadExpressionSnippets: Mock;
  saveExpressionSnippet: Mock;
  deleteExpressionSnippet: Mock;
}) {
  const snippetStore: SnippetStub[] = [];

  function reset() {
    snippetStore.splice(0, snippetStore.length);
    mocks.loadExpressionSnippets.mockReset();
    mocks.saveExpressionSnippet.mockReset();
    mocks.deleteExpressionSnippet.mockReset();
    mocks.loadExpressionSnippets.mockImplementation(async () => [...snippetStore]);
    mocks.saveExpressionSnippet.mockImplementation(async (name: string, expression: string) => {
      const now = Date.now();
      const idx = snippetStore.findIndex((snippet) => snippet.name.toLowerCase() === name.toLowerCase());
      /* v8 ignore next 3 */
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
    mocks.deleteExpressionSnippet.mockImplementation(async (snippetId: string) => {
      const idx = snippetStore.findIndex((snippet) => snippet.id === snippetId);
      /* v8 ignore next */
      if (idx >= 0) snippetStore.splice(idx, 1);
      return [...snippetStore];
    });
  }

  return { snippetStore, reset };
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

// ─── Render helpers ─────────────────────────────────────────────────────────

export async function flushMonacoMount() {
  await act(async () => { await Promise.resolve(); });
}

export const sources: MapperSource[] = [
  { id: 's1', label: 'Response', sampleData: { name: 'Alice', age: 30 } },
];

export const baseMapping: Mapping = {
  id: 'm1',
  sourcePath: 'name',
  sourceId: 's1',
  targetPath: 'userName',
};

export function renderModal(overrides?: Partial<Parameters<typeof ExpressionEditorModal>[0]>) {
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
