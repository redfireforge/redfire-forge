/**
 * Shared test harness for `ExpressionEditorModal` test files.
 *
 * All three `ExpressionEditorModal.{test,part2,part3}.test.tsx` files used to
 * duplicate ~200 lines of fake Monaco editor + snippet store setup. This
 * module consolidates those helpers so individual test files only contain
 * the unique test cases.
 *
 * Usage pattern (typical test file) — see `ExpressionEditorModal.test.tsx`
 * for a full working example:
 *  1. Import `monacoTestState`, `makeSnippetMockImplementations`, `sources`,
 *     `baseMapping`, `renderModal`, `flushMonacoMount` from this module.
 *  2. Register `./utils/expressionSnippets` as mocked, with stub CRUD fns.
 *  3. Register `@monaco-editor/react` as mocked, using a synchronous factory
 *     that calls `mockBuildMonacoMock` (imported with a `mock`-prefixed alias
 *     from `./monacoMockCore`, per Vitest's mock-hoisting rules for factories
 *     that reference outside bindings).
 *  4. Build snippet mocks via `makeSnippetMockImplementations(...)` and call
 *     `.reset()` in `beforeEach`.
 *
 * CAUTION: do not write the literal Vitest mock-registration call (dot-mock,
 * parens) anywhere in this file's comments — even inside a code-fenced
 * example. Vitest's static hoisting scan can match that text inside a
 * comment and corrupt this module's exports (properties exist on the
 * namespace object but their values stay `undefined`). This was a confirmed,
 * reproducible bug in this codebase; keep documentation examples using
 * prose or a non-literal placeholder instead of the real call syntax.
 *
 * IMPORTANT: the `@monaco-editor/react` mock factory must reference
 * `./monacoMockCore` (NOT this file). This file imports `ExpressionEditorModal`,
 * which itself imports `@monaco-editor/react` — if the mock factory imported
 * this file, loading `ExpressionEditorModal` would re-enter the still-pending
 * mock factory and deadlock the module graph (the test run hangs indefinitely
 * with no error).
 *
 * NB: because the harness owns module-scoped state, each test file runs in
 * its own vitest worker so state isolation across files is implicit.
 */
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { act } from '@testing-library/react';
import type { Mock } from 'vitest';
import type { Mapping, MapperSource } from '../types';
// Import monacoMockCore BEFORE ExpressionEditorModal so it is fully loaded
// and cached prior to ExpressionEditorModal triggering the '@monaco-editor/react'
// mock factory's dynamic re-import of this same module (see note above).
import {
  monacoTestState,
  createFakeMonaco,
  createFakeEditor,
  buildMonacoMock,
  resetMonacoTestState,
} from './monacoMockCore';
import ExpressionEditorModal from '../ExpressionEditorModal';

export {
  monacoTestState,
  createFakeMonaco,
  createFakeEditor,
  buildMonacoMock,
  resetMonacoTestState,
};

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
    // Use a synchronous thenable so the component's `.then(setSnippets)` fires
    // inside useEffect (still within React's act() wrapper), preventing
    // "not wrapped in act()" warnings in every test that renders the modal.
    mocks.loadExpressionSnippets.mockImplementation(() => {
      const result = [...snippetStore];
      const thenable = {
        then(fn: (v: typeof result) => unknown) { fn(result); return thenable; },
        catch() { return thenable; },
        finally() { return thenable; },
      };
      return thenable as unknown as Promise<typeof result>;
    });
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
