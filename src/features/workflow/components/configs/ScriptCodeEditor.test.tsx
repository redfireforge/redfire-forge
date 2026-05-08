/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import ScriptCodeEditor from './ScriptCodeEditor';

// Capture the onMount callback and options passed to Monaco
let capturedOnMount: ((...args: unknown[]) => void) | null = null;
let capturedProps: Record<string, unknown> = {};

vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    capturedProps = props;
    capturedOnMount = props.onMount as ((...args: unknown[]) => void);
    return <div data-testid="mock-monaco-editor" data-value={props.value as string} />;
  },
}));

// Mock Monaco API for completion provider tests
function createMockMonaco() {
  const disposable = { dispose: vi.fn() };
  return {
    monaco: {
      languages: {
        registerCompletionItemProvider: vi.fn(() => disposable),
        CompletionItemKind: {
          Variable: 5,
          Module: 8,
        },
      },
    },
    editor: {
      getModel: vi.fn(() => ({ getValue: vi.fn(() => ''), setValue: vi.fn() })),
    },
    disposable,
  };
}

beforeEach(() => {
  capturedOnMount = null;
  capturedProps = {};
});

describe('ScriptCodeEditor', () => {
  it('renders the Monaco editor wrapper', () => {
    const { getByTestId } = render(
      <ScriptCodeEditor value="test" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    expect(getByTestId('mock-monaco-editor')).toBeTruthy();
  });

  it('passes the value to Monaco', () => {
    render(
      <ScriptCodeEditor value="output.x = 1;" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    expect(capturedProps.value).toBe('output.x = 1;');
  });

  it('uses JavaScript as the default language', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    expect(capturedProps.defaultLanguage).toBe('javascript');
  });

  it('uses vs-dark theme', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    expect(capturedProps.theme).toBe('vs-dark');
  });

  it('sets default height to 250px', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    expect(capturedProps.height).toBe('250px');
  });

  it('accepts custom height', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} height="400px" />,
    );
    expect(capturedProps.height).toBe('400px');
  });

  it('sets readOnly option when readOnly prop is true', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} readOnly />,
    );
    const options = capturedProps.options as Record<string, unknown>;
    expect(options.readOnly).toBe(true);
  });

  it('calls onChange when editor value changes', () => {
    const onChange = vi.fn();
    render(
      <ScriptCodeEditor value="" onChange={onChange} inputVariables={[]} outputVariables={[]} />,
    );
    const onChangeProp = capturedProps.onChange as (v: string | undefined) => void;
    onChangeProp('new code');
    expect(onChange).toHaveBeenCalledWith('new code');
  });

  it('calls onChange with empty string when editor returns undefined', () => {
    const onChange = vi.fn();
    render(
      <ScriptCodeEditor value="" onChange={onChange} inputVariables={[]} outputVariables={[]} />,
    );
    const onChangeProp = capturedProps.onChange as (v: string | undefined) => void;
    onChangeProp(undefined);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('registers completion provider on mount', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={['x']} outputVariables={['y']} />,
    );
    const mock = createMockMonaco();
    act(() => {
      capturedOnMount?.(mock.editor, mock.monaco);
    });
    expect(mock.monaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
      'javascript',
      expect.objectContaining({ triggerCharacters: ['.'] }),
    );
  });

  it('provides input variable suggestions when typing "input."', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={['userId', 'status']} outputVariables={[]} />,
    );
    const mock = createMockMonaco();
    act(() => {
      capturedOnMount?.(mock.editor, mock.monaco);
    });

    const provider = mock.monaco.languages.registerCompletionItemProvider.mock.calls[0][1];
    const model = {
      getValueInRange: () => 'input.',
      getWordUntilPosition: () => ({ startColumn: 7, endColumn: 7 }),
    };
    const position = { lineNumber: 1, column: 7 };

    const result = provider.provideCompletionItems(model, position);
    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions.map((s: { label: string }) => s.label)).toContain('userId');
    expect(result.suggestions.map((s: { label: string }) => s.label)).toContain('status');
  });

  it('provides output variable suggestions when typing "output."', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={['result', 'count']} />,
    );
    const mock = createMockMonaco();
    act(() => {
      capturedOnMount?.(mock.editor, mock.monaco);
    });

    const provider = mock.monaco.languages.registerCompletionItemProvider.mock.calls[0][1];
    const model = {
      getValueInRange: () => 'output.',
      getWordUntilPosition: () => ({ startColumn: 8, endColumn: 8 }),
    };
    const position = { lineNumber: 1, column: 8 };

    const result = provider.provideCompletionItems(model, position);
    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions.map((s: { label: string }) => s.label)).toContain('result');
    expect(result.suggestions.map((s: { label: string }) => s.label)).toContain('count');
  });

  it('provides top-level input/output/console suggestions', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    const mock = createMockMonaco();
    act(() => {
      capturedOnMount?.(mock.editor, mock.monaco);
    });

    const provider = mock.monaco.languages.registerCompletionItemProvider.mock.calls[0][1];
    const model = {
      getValueInRange: () => '',
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 }),
    };
    const position = { lineNumber: 1, column: 1 };

    const result = provider.provideCompletionItems(model, position);
    const labels = result.suggestions.map((s: { label: string }) => s.label);
    expect(labels).toContain('input');
    expect(labels).toContain('output');
    expect(labels).toContain('console');
  });

  it('provides top-level suggestions after punctuation / whitespace context', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    const mock = createMockMonaco();
    act(() => {
      capturedOnMount?.(mock.editor, mock.monaco);
    });
    const provider = mock.monaco.languages.registerCompletionItemProvider.mock.calls[0][1];
    const model = {
      getValueInRange: () => 'const x = ',
      getWordUntilPosition: () => ({ startColumn: 12, endColumn: 12 }),
    };
    const position = { lineNumber: 1, column: 12 };
    const result = provider.provideCompletionItems(model, position);
    const labels = result.suggestions.map((s: { label: string }) => s.label);
    expect(labels).toContain('input');
  });

  it('returns empty suggestions for unrecognized context', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    const mock = createMockMonaco();
    act(() => {
      capturedOnMount?.(mock.editor, mock.monaco);
    });

    const provider = mock.monaco.languages.registerCompletionItemProvider.mock.calls[0][1];
    const model = {
      getValueInRange: () => 'someObj.',
      getWordUntilPosition: () => ({ startColumn: 9, endColumn: 9 }),
    };
    const position = { lineNumber: 1, column: 9 };

    const result = provider.provideCompletionItems(model, position);
    expect(result.suggestions).toHaveLength(0);
  });

  it('filters out empty variable names from suggestions', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={['', 'valid']} outputVariables={[]} />,
    );
    const mock = createMockMonaco();
    act(() => {
      capturedOnMount?.(mock.editor, mock.monaco);
    });

    const provider = mock.monaco.languages.registerCompletionItemProvider.mock.calls[0][1];
    const model = {
      getValueInRange: () => 'input.',
      getWordUntilPosition: () => ({ startColumn: 7, endColumn: 7 }),
    };
    const position = { lineNumber: 1, column: 7 };

    const result = provider.provideCompletionItems(model, position);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].label).toBe('valid');
  });

  it('sets model value on mount when it lags behind prop value', () => {
    const setValue = vi.fn();
    const getValue = vi.fn(() => 'stale-from-model');
    render(
      <ScriptCodeEditor value="from-props" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    const mock = createMockMonaco();
    mock.editor.getModel = vi.fn(() => ({ getValue, setValue }));
    act(() => {
      capturedOnMount?.(mock.editor, mock.monaco);
    });
    expect(setValue).toHaveBeenCalledWith('from-props');
  });

  it('disposes completion provider on unmount', () => {
    const { unmount } = render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    const mock = createMockMonaco();
    act(() => {
      capturedOnMount?.(mock.editor, mock.monaco);
    });
    const disposable = mock.monaco.languages.registerCompletionItemProvider.mock.results[0]
      .value as { dispose: ReturnType<typeof vi.fn> };
    unmount();
    expect(disposable.dispose).toHaveBeenCalled();
  });

  it('disables minimap', () => {
    render(
      <ScriptCodeEditor value="" onChange={vi.fn()} inputVariables={[]} outputVariables={[]} />,
    );
    const options = capturedProps.options as Record<string, unknown>;
    expect((options.minimap as Record<string, boolean>).enabled).toBe(false);
  });
});
