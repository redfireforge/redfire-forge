/**
 * Pure helper factories shared by the three `ValidationCodeEditor.*.test.tsx`
 * files. The Monaco editor mock factory itself stays in each
 * test file because it captures file-local `let` bindings (mockOnChange,
 * mockOnMount, etc.); these helpers don't depend on that file-local state and
 * so can be safely shared.
 */
import { vi } from 'vitest';

/**
 * Build a fake Monaco editor with sensible default spies for every callback
 * referenced by `ValidationCodeEditor`. Pass `overrides` to swap out specific
 * behaviour per test.
 *
 * Every method is a `vi.fn()` spy so tests can assert call args; the
 * `dispose`-returning observers (`onDidChange…`) all return distinct
 * disposable stubs so dispose can be observed individually.
 */
export function withEditorDefaults(overrides: Record<string, unknown> = {}) {
  return {
    addAction: vi.fn(),
    addCommand: vi.fn(),
    onDidChangeModelContent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidChangeCursorPosition: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    trigger: vi.fn(),
    executeEdits: vi.fn(),
    focus: vi.fn(),
    getPosition: vi.fn().mockReturnValue(null),
    getModel: vi.fn().mockReturnValue(null),
    getDomNode: vi.fn().mockReturnValue(null),
    deltaDecorations: vi.fn().mockReturnValue([]),
    ...overrides,
  };
}

/**
 * Build a fake Monaco namespace with `languages.*`/`editor.*` stubs required
 * by the validation language registration hook.
 */
export function createMonacoForRegistration() {
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
