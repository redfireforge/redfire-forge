/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { ApiMockBodyEditor } from './ApiMockBodyEditor';

let capturedOnMount: ((editor: unknown, monaco: unknown) => void) | null = null;
let capturedOnChange: ((v?: string) => void) | undefined;

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value: string; onChange?: (v?: string) => void; onMount?: (editor: unknown, monaco: unknown) => void }) => {
    capturedOnMount = props.onMount ?? null;
    capturedOnChange = props.onChange;
    return (
      <textarea
        data-testid="api-mock-variant-body"
        value={props.value}
        onChange={e => props.onChange?.(e.target.value)}
      />
    );
  },
}));

describe('ApiMockBodyEditor', () => {
  it('registers {{ completion items and disposes providers', () => {
    const disposable = { dispose: vi.fn() };
    const monaco = {
      languages: {
        registerCompletionItemProvider: vi.fn(() => disposable),
        CompletionItemKind: { Function: 1 },
      },
    };
    const { unmount } = render(<ApiMockBodyEditor value="{}" onChange={vi.fn()} language="xml" readOnly />);
    const ownedModel = { getLineContent: (line: number) => (line === 1 ? '{"id": "{{f' : '') };
    const editor = { getModel: () => ownedModel };
    act(() => {
      capturedOnMount?.(editor, monaco);
      capturedOnMount?.(editor, monaco);
    });
    const provider = monaco.languages.registerCompletionItemProvider.mock.calls[0][1];
    const result = provider.provideCompletionItems(ownedModel, { lineNumber: 1, column: 12 });
    expect(result.suggestions.some((s: { label: string }) => String(s.label).includes('faker'))).toBe(true);
    expect(provider.provideCompletionItems(
      { getLineContent: () => '{"id": "{{f' },
      { lineNumber: 1, column: 12 },
    ).suggestions).toEqual([]);
    expect(provider.provideCompletionItems(
      { getLineContent: () => '{"id": "{{uuid}} extra' },
      { lineNumber: 1, column: 22 },
    ).suggestions).toEqual([]);
    ownedModel.getLineContent = () => '{"id": "{{uuid}} extra';
    expect(provider.provideCompletionItems(ownedModel, { lineNumber: 1, column: 22 }).suggestions).toEqual([]);
    ownedModel.getLineContent = () => '"id"';
    expect(provider.provideCompletionItems(ownedModel, { lineNumber: 1, column: 5 }).suggestions).toEqual([]);
    unmount();
    expect(disposable.dispose).toHaveBeenCalled();
  });

  it('forwards Monaco onChange including undefined', () => {
    const onChange = vi.fn();
    render(<ApiMockBodyEditor value="x" onChange={onChange} />);
    fireEvent.change(document.querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'y' } });
    expect(onChange).toHaveBeenCalledWith('y');
    capturedOnChange?.(undefined);
    expect(onChange).toHaveBeenCalledWith('');
  });
});
