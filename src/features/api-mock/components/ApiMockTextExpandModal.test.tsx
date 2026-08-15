/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('./apiMockTextExpand', () => ({
  findTextExpandMatches: (draft: string, query: string) => (query ? [0] : []),
  formatTextExpandCount: (index: number, length: number) => `${Math.min(index + 1, length)}/${length}`,
  nextTextExpandMatch: () => 5,
  formatJsonBody: () => null,
  prettyPrintJsonBody: () => '',
  minifyJsonBody: () => '',
  textExpandStats: (text: string) => ({ lines: 1, chars: text.length }),
}));

import { ApiMockTextExpandModal } from './ApiMockTextExpandModal';

function invokeReactClick(element: HTMLElement): void {
  const reactPropsKey = Object.keys(element).find(key => key.startsWith('__reactProps'));
  if (!reactPropsKey) throw new Error('missing react props');
  const reactProps = (element as HTMLElement & Record<string, { onClick?: () => void }>)[reactPropsKey];
  reactProps.onClick?.();
}

describe('ApiMockTextExpandModal branch guards', () => {
  it('safely no-ops when pretty, undo, and redo have no work and out-of-range next match is requested', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <ApiMockTextExpandModal
        title="Expanded body"
        value="same"
        onApply={onApply}
        onClose={onClose}
      />,
    );

    const editor = screen.getByTestId('api-mock-text-expand-editor') as HTMLTextAreaElement;
    expect(editor).toHaveValue('same');

    const pretty = screen.getByTestId('api-mock-text-expand-pretty') as HTMLButtonElement;
    invokeReactClick(pretty);
    expect(editor).toHaveValue('same');

    const minify = screen.getByTestId('api-mock-text-expand-minify') as HTMLButtonElement;
    invokeReactClick(minify);
    expect(editor).toHaveValue('same');

    const undo = screen.getByTestId('api-mock-text-expand-undo') as HTMLButtonElement;
    invokeReactClick(undo);
    expect(editor).toHaveValue('same');

    const redo = screen.getByTestId('api-mock-text-expand-redo') as HTMLButtonElement;
    invokeReactClick(redo);
    expect(editor).toHaveValue('same');

    fireEvent.change(screen.getByTestId('api-mock-text-expand-search'), { target: { value: 's' } });
    fireEvent.click(screen.getByTestId('api-mock-text-expand-next'));
    expect(editor.selectionStart).toBe(0);
    expect(editor.selectionEnd).toBe(1);

    fireEvent.click(screen.getByTestId('api-mock-text-expand-apply'));
    expect(onApply).toHaveBeenCalledWith('same');
    expect(onClose).toHaveBeenCalled();
  });
});
