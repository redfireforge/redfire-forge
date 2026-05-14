/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let mockOnChange: ((v: string | undefined) => void) | undefined;
let mockBeforeMount: ((monaco: unknown) => void) | undefined;
let mockOnMount: ((editor: unknown, monaco: unknown) => void) | undefined;

vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: (props: { value?: string; onChange?: (v: string | undefined) => void; beforeMount?: (m: unknown) => void; onMount?: (e: unknown, m: unknown) => void; loading?: React.ReactNode }) => {
    mockOnChange = props.onChange;
    mockBeforeMount = props.beforeMount;
    mockOnMount = props.onMount;
    return <textarea data-testid="mock-editor" defaultValue={props.value ?? ''} />;
  },
}));

import ValidationCodeEditor from './ValidationCodeEditor';

describe('ValidationCodeEditor', () => {
  const mockOnChangeHandler = vi.fn();

  beforeEach(() => {
    mockOnChangeHandler.mockClear();
    mockOnChange = undefined;
    mockBeforeMount = undefined;
    mockOnMount = undefined;
  });

  it('renders with header, editor, and footer', () => {
    render(
      <ValidationCodeEditor
        value=""
        onChange={mockOnChangeHandler}
        errors={[]}
      />,
    );
    expect(screen.getByText('Validation Rules')).toBeTruthy();
    expect(screen.getByTestId('mock-editor')).toBeTruthy();
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
    const mockMonaco = {
      languages: {
        register: vi.fn(),
        setMonarchTokensProvider: vi.fn(),
        setLanguageConfiguration: vi.fn(),
        registerCompletionItemProvider: vi.fn(),
      },
      editor: { defineTheme: vi.fn() },
    };

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

  it('renders with custom height', () => {
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
});
