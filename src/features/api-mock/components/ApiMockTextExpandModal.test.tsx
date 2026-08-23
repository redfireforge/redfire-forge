/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { stubScrollIntoView } from '@test-utils/domMocks';

vi.mock('./apiMockTextExpand', () => ({
  findTextExpandMatches: (draft: string, query: string) => (query ? [0] : []),
  formatTextExpandCount: (index: number, length: number) => `${Math.min(index + 1, length)}/${length}`,
  nextTextExpandMatch: () => 5,
  formatJsonBody: () => null,
  prettyPrintJsonBody: () => '',
  minifyJsonBody: () => '',
  textExpandStats: (text: string) => ({ lines: 1, chars: text.length }),
  resolveApiMockExpandPortal: () => document.body,
  isNestedApiMockExpandPortal: () => false,
}));

import { ApiMockTextExpandModal } from './ApiMockTextExpandModal';

function invokeReactClick(element: HTMLElement): void {
  const reactPropsKey = Object.keys(element).find(key => key.startsWith('__reactProps'));
  if (!reactPropsKey) throw new Error('missing react props');
  const reactProps = (element as HTMLElement & Record<string, { onClick?: () => void }>)[reactPropsKey];
  reactProps.onClick?.();
}

describe('ApiMockTextExpandModal branch guards', () => {
  beforeAll(() => stubScrollIntoView());

  it('keeps the search cluster inside the dialog header controls', () => {
    render(
      <ApiMockTextExpandModal
        title="Request body"
        value="<xml/>"
        readOnly
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByTestId('api-mock-text-expand-modal');
    const cluster = screen.getByTestId('api-mock-text-expand-search-cluster');
    expect(dialog.contains(cluster)).toBe(true);
    expect(dialog.querySelector('.am-text-expand-header-controls')).toContainElement(cluster);
  });

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

  it('disables the Tree view when the draft is not valid JSON', () => {
    render(
      <ApiMockTextExpandModal
        title="Request body"
        value="<xml/>"
        readOnly
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-text-expand-view-tree')).toBeDisabled();
    expect(screen.getByTestId('api-mock-text-expand-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('api-mock-text-expand-tree')).toBeNull();
  });

  it('swaps the editor for a JSON tree and drives search from the tree in Tree view', () => {
    render(
      <ApiMockTextExpandModal
        title="Condition body"
        value={'{\n  "query": "{{query \'q\'}}",\n  "results": []\n}'}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const treeBtn = screen.getByTestId('api-mock-text-expand-view-tree');
    expect(treeBtn).not.toBeDisabled();
    fireEvent.click(treeBtn);

    // Editor is gone; interactive tree + its expand/collapse controls appear.
    expect(screen.queryByTestId('api-mock-text-expand-editor')).toBeNull();
    expect(screen.getByTestId('api-mock-text-expand-tree')).toBeInTheDocument();
    expect(screen.getByTestId('api-mock-text-expand-tree-expand-all')).toBeInTheDocument();
    expect(screen.getByTestId('api-mock-text-expand-tree-collapse-all')).toBeInTheDocument();

    // Searching keys/values reports tree-node matches in the shared count.
    fireEvent.change(screen.getByTestId('api-mock-text-expand-search'), { target: { value: 'query' } });
    expect(screen.getByTestId('api-mock-text-expand-count').textContent).not.toBe('0/0');

    // Back to Text restores the editor.
    fireEvent.click(screen.getByTestId('api-mock-text-expand-view-text'));
    expect(screen.getByTestId('api-mock-text-expand-editor')).toBeInTheDocument();
  });
});
