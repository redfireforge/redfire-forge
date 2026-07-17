/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphqlVariablesPanel } from './GraphqlVariablesPanel';

vi.mock('@monaco-editor/react', () => ({
  default: ({ onChange, path, defaultValue, beforeMount }: {
    onChange?: (val: string | undefined) => void;
    path?: string;
    defaultValue?: string;
    beforeMount?: (monaco: unknown) => void;
  }) => {
    // Invoke beforeMount immediately (mirrors Monaco's behaviour) so handleBeforeMount is covered.
    beforeMount?.({ fake: 'monaco' });
    return (
      <textarea
        data-testid="mock-monaco-editor"
        data-path={path}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value === '__undefined__' ? undefined : e.target.value)}
      />
    );
  },
}));

vi.mock('../utils/monacoGraphqlSetup', () => ({
  GRAPHQL_THEME_ID: 'graphql-dark',
  getVariablesEditorOptions: vi.fn(() => ({ readOnly: false })),
  registerGraphqlLanguage: vi.fn(),
}));

describe('GraphqlVariablesPanel', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('renders the wrapper div with testid', () => {
    render(<GraphqlVariablesPanel modelPath="test://vars" />);
    expect(screen.getByTestId('gql-variables-panel')).toBeInTheDocument();
  });

  it('does not apply error class by default', () => {
    render(<GraphqlVariablesPanel modelPath="test://vars" />);
    const panel = screen.getByTestId('gql-variables-panel');
    expect(panel.className).not.toContain('gql-vars-panel--error');
  });

  it('applies error class when hasError is true', () => {
    render(<GraphqlVariablesPanel modelPath="test://vars" hasError />);
    const panel = screen.getByTestId('gql-variables-panel');
    expect(panel.className).toContain('gql-vars-panel--error');
  });

  it('passes the modelPath to the editor as path prop', () => {
    render(<GraphqlVariablesPanel modelPath="model://my-tab" />);
    const editor = screen.getByTestId('mock-monaco-editor');
    expect(editor).toHaveAttribute('data-path', 'model://my-tab');
  });

  it('passes defaultValue to the editor', () => {
    render(<GraphqlVariablesPanel modelPath="test://vars" defaultValue='{"x":1}' />);
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    // React renders defaultValue as the textarea's initial value in the DOM
    expect(editor.defaultValue).toBe('{"x":1}');
  });

  it('calls onChange when the editor value changes', () => {
    const onChange = vi.fn();
    render(<GraphqlVariablesPanel modelPath="test://vars" onChange={onChange} />);
    const editor = screen.getByTestId('mock-monaco-editor');
    fireEvent.change(editor, { target: { value: '{"b":2}' } });
    expect(onChange).toHaveBeenCalledWith('{"b":2}');
  });

  it('calls onChange with empty string when editor emits undefined (val ?? \'\')', () => {
    const onChange = vi.fn();
    render(<GraphqlVariablesPanel modelPath="test://vars" onChange={onChange} />);
    const editor = screen.getByTestId('mock-monaco-editor');
    // Trigger the undefined path through the special sentinel
    fireEvent.change(editor, { target: { value: '__undefined__' } });
    expect(onChange).toHaveBeenCalledWith('');
  });
});
