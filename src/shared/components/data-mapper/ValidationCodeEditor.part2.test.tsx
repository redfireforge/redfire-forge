/** @vitest-environment jsdom */
import { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let mockOnChange: ((v: string | undefined) => void) | undefined;
let mockBeforeMount: ((monaco: unknown) => void) | undefined;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ValidationCodeEditor from './ValidationCodeEditor';
import * as _MonacoTextareaHardening from './utils/monacoTextareaHardening';
import { createMonacoForRegistration } from './__test-utils__/validationCodeEditorHelpers';

function makeContext(triggerKind = 0) {
  return { triggerKind };
}

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

  it('second beforeMount re-registers completion provider (disposes previous)', async () => {
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
    // Completion provider is re-registered on m2 (old one disposed)
    expect(m1.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(1);
    expect(m2.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(1);
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
