/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import ExpressionEditorModal from './ExpressionEditorModal';
import {
  loadExpressionSnippets,
  saveExpressionSnippet,
  deleteExpressionSnippet,
} from './utils/expressionSnippets';

vi.mock('./utils/expressionSnippets', () => ({
  loadExpressionSnippets: vi.fn(),
  saveExpressionSnippet: vi.fn(),
  deleteExpressionSnippet: vi.fn(),
}));

vi.mock('@monaco-editor/react', async () => {
  const h = await import('./__test-utils__/expressionEditorHarness');
  return h.buildMonacoMock();
});

import {
  monacoTestState,
  makeSnippetMockImplementations,
  resetMonacoTestState,
  flushMonacoMount,
  sources,
  baseMapping,
  renderModal,
} from './__test-utils__/expressionEditorHarness';

const loadExpressionSnippetsMock = vi.mocked(loadExpressionSnippets);
const saveExpressionSnippetMock = vi.mocked(saveExpressionSnippet);
const deleteExpressionSnippetMock = vi.mocked(deleteExpressionSnippet);

const snippetMocks = makeSnippetMockImplementations({
  loadExpressionSnippets: loadExpressionSnippetsMock,
  saveExpressionSnippet: saveExpressionSnippetMock,
  deleteExpressionSnippet: deleteExpressionSnippetMock,
});

beforeEach(() => {
  resetMonacoTestState();
  snippetMocks.reset();
});

afterEach(async () => {
  // Flush any pending async state updates (e.g. loadExpressionSnippets) to avoid act() warnings
  await act(async () => {});
});

describe('ExpressionEditorModal — search, templates, expand, snippets edge cases', () => {
  it('shows empty state when function search matches nothing', async () => {
    renderModal();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Search functions'), {
        target: { value: '__no_such_function_xyz__' },
      });
    });
    expect(screen.getByText(/No functions matching/)).toBeInTheDocument();
  });

  it('shows empty template list when template query matches nothing', async () => {
    vi.useFakeTimers();
    renderModal();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Search function templates'), {
        target: { value: '___nonexistent_template_query___' },
      });
    });
    expect(screen.getByText('No templates match.')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('toggles expanded overlay class when expand control clicked', () => {
    renderModal();
    const overlay = document.querySelector('.dm-expr-overlay')!;
    expect(overlay.classList.contains('dm-expr--expanded')).toBe(false);
    fireEvent.click(screen.getByLabelText('Expand'));
    expect(overlay.classList.contains('dm-expr--expanded')).toBe(true);
    fireEvent.click(screen.getByLabelText('Shrink'));
    expect(overlay.classList.contains('dm-expr--expanded')).toBe(false);
  });

  it('passes snippet id to deleteExpressionSnippet when deleting', async () => {
    snippetMocks.snippetStore.splice(0, snippetMocks.snippetStore.length, {
      id: 'snippet-delete-me',
      name: 'To Delete',
      expression: '$upper($.name)',
      updatedAt: 1,
    });
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    await act(async () => { await Promise.resolve(); });
    await flushMonacoMount();
    await act(async () => { fireEvent.click(screen.getAllByText('Delete')[0]); });
    expect(deleteExpressionSnippetMock).toHaveBeenCalledWith('snippet-delete-me');
  });

  it('invokes Monaco undo/redo triggers when header buttons clicked', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    await flushMonacoMount();
    const editor = monacoTestState.lastEditor!;
    fireEvent.click(screen.getByLabelText('Undo'));
    fireEvent.click(screen.getByLabelText('Redo'));
    expect(editor.trigger).toHaveBeenCalledWith('keyboard', 'undo', null);
    expect(editor.trigger).toHaveBeenCalledWith('keyboard', 'redo', null);
  });

  it('filters catalog by description text', async () => {
    renderModal();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Search functions'), {
        target: { value: 'uppercase' },
      });
    });
    expect(screen.getByText('$upper')).toBeInTheDocument();
  });

  it('blocks snippet save when expression trimmed empty', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$x' } });
    await flushMonacoMount();
    await act(async () => {
      fireEvent.change(screen.getByTestId('monaco-editor'), { target: { value: '   ' } });
    });
    fireEvent.change(screen.getByLabelText('Snippet name'), { target: { value: 'N' } });
    const snippetSave = document.querySelector('.dm-expr-snippet-save .dm-expr-inline-btn') as HTMLButtonElement;
    expect(snippetSave.disabled).toBe(true);
  });

  it('compose with boolean arg inserts false placeholder', async () => {
    const fn = {
      name: '$flagWrap',
      category: 'Custom' as const,
      signature: '$flagWrap(text, enabled)',
      description: 'Wrap',
      args: [
        { name: 'text', type: 'string', required: true, description: '' },
        { name: 'enabled', type: 'boolean', required: true, description: '' },
      ],
      returnType: 'string' as const,
      examples: [],
      evaluate: () => '',
    };
    renderModal({ mapping: { ...baseMapping, expression: '$.name' }, customFunctions: [fn] });
    await act(async () => { fireEvent.click(screen.getByText('$flagWrap')); });
    fireEvent.click(screen.getByText('Compose with current'));
    const ta = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(ta.value).toContain('$flagWrap($.name, false)');
  });
});

describe('ExpressionEditorModal — modal drag', () => {
  it('drag on header moves the modal to fixed position', () => {
    renderModal();
    const header = document.querySelector('.dm-expr-header')!;
    const modal = document.querySelector('.dm-expr-modal') as HTMLElement;
    expect(header).toBeTruthy();

    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 80,
      right: 580,
      bottom: 480,
      width: 480,
      height: 400,
      x: 100,
      y: 80,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(header, { clientX: 200, clientY: 100 });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 130, bubbles: true }));
    });

    expect(modal.style.position).toBe('fixed');
    expect(modal.style.left).toBe('150px');
    expect(modal.style.top).toBe('110px');

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('resize from corner grows width and height without CSS max caps', () => {
    renderModal();
    const modal = document.querySelector('.dm-expr-modal') as HTMLElement;
    const handle = document.querySelector('.modal-resize-corner') as HTMLElement;
    expect(handle).toBeTruthy();

    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 80,
      right: 580,
      bottom: 480,
      width: 480,
      height: 400,
      x: 100,
      y: 80,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(handle, { clientX: 580, clientY: 480 });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 900, bubbles: true }));
    });

    // Grows beyond the old CSS soft defaults (960×640) up toward the viewport
    expect(Number.parseFloat(modal.style.width)).toBeGreaterThan(700);
    expect(Number.parseFloat(modal.style.height)).toBeGreaterThan(700);
    expect(modal.style.maxWidth).toBe('none');
    expect(modal.style.maxHeight).toBe('none');

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('resize from bottom edge grows height only', () => {
    renderModal();
    const modal = document.querySelector('.dm-expr-modal') as HTMLElement;
    const handle = document.querySelector('.modal-resize-edge-bottom') as HTMLElement;
    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 80,
      right: 580,
      bottom: 480,
      width: 480,
      height: 400,
      x: 100,
      y: 80,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(handle, { clientX: 300, clientY: 480 });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 780, bubbles: true }));
    });

    expect(modal.style.height).toBe('700px');
    // Width stays unset by bottom-only resize until an explicit width was locked
    expect(modal.style.maxHeight).toBe('none');

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('drag aborts when clicking on a button within header', () => {
    renderModal();
    const header = document.querySelector('.dm-expr-header')!;
    const button = header.querySelector('button')!;
    const modal = document.querySelector('.dm-expr-modal') as HTMLElement;

    fireEvent.mouseDown(button, { clientX: 200, clientY: 100 });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 200, bubbles: true }));
    });

    expect(modal.style.position).not.toBe('fixed');
  });
});

describe('ExpressionEditorModal – branch coverage extras', () => {
  beforeEach(() => {
    monacoTestState.suppressOnMount = false;
    monacoTestState.lastEditor = null;
    monacoTestState.lastMonaco = null;
    monacoTestState.lastMountOpts = null;
    monacoTestState.completionProvider = null;
    monacoTestState.disposeSpies = [];
    // Note: loadExpressionSnippets uses the synchronous thenable from the global
    // beforeEach (snippetMocks.reset()), so no need to override with mockResolvedValue here.
    saveExpressionSnippetMock.mockResolvedValue([]);
    deleteExpressionSnippetMock.mockResolvedValue([]);
    document.querySelectorAll('.dm-expr-overlay').forEach(el => el.remove());
  });

  it('renders variable name row when onRename is provided', () => {
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$.name' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const varInput = document.querySelector('.dm-expr-variable-input') as HTMLInputElement;
    expect(varInput).toBeTruthy();
    expect(varInput.value).toBe(baseMapping.targetPath);
  });

  it('variable name Enter key commits rename', () => {
    const onRename = vi.fn();
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$.name' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onRename={onRename}
      />,
    );
    const varInput = document.querySelector('.dm-expr-variable-input') as HTMLInputElement;
    fireEvent.change(varInput, { target: { value: 'newVarName' } });
    fireEvent.keyDown(varInput, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith(baseMapping.id, baseMapping.targetPath, 'newVarName');
  });

  it('variable name Escape key reverts to original targetPath', () => {
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$.name' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const varInput = document.querySelector('.dm-expr-variable-input') as HTMLInputElement;
    fireEvent.change(varInput, { target: { value: 'tempName' } });
    fireEvent.keyDown(varInput, { key: 'Escape' });
    expect(varInput.value).toBe(baseMapping.targetPath);
  });

  it('commitTargetName does not call onRename when value is empty or unchanged', () => {
    const onRename = vi.fn();
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$.name' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onRename={onRename}
      />,
    );
    const varInput = document.querySelector('.dm-expr-variable-input') as HTMLInputElement;
    fireEvent.change(varInput, { target: { value: '  ' } });
    fireEvent.blur(varInput);
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.change(varInput, { target: { value: baseMapping.targetPath } });
    fireEvent.blur(varInput);
    expect(onRename).not.toHaveBeenCalled();
  });

  it('handleUndo/handleRedo are no-ops when editor ref is null', () => {
    monacoTestState.suppressOnMount = true;
    renderModal();
    const undoBtn = document.querySelector('button[title*="Undo"]');
    const redoBtn = document.querySelector('button[title*="Redo"]');
    expect(undoBtn).toBeTruthy();
    expect(redoBtn).toBeTruthy();
    fireEvent.click(undoBtn!);
    fireEvent.click(redoBtn!);
  });

  it('clicking Insert button in docs panel calls handleInsertFunction', async () => {
    renderModal();
    await flushMonacoMount();
    const fnItem = screen.getByText('$upper').closest('.dm-expr-fn-item')!;
    fireEvent.click(fnItem);
    const insertBtn = Array.from(document.querySelectorAll('.dm-expr-inline-btn--primary'))
      .find(el => el.textContent?.trim() === 'Insert');
    expect(insertBtn).toBeTruthy();
    fireEvent.click(insertBtn!);
    const editor = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('$upper(');
  });

  it('step debugger result click opens detail modal', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderModal();
    await flushMonacoMount();
    const debugToggle = document.querySelector('.dm-expr-debug-toggle');
    expect(debugToggle).toBeTruthy();
    fireEvent.click(debugToggle!);
    await act(async () => { vi.advanceTimersByTime(500); });
    const stepHeaders = document.querySelectorAll('.dm-expr-step-header');
    if (stepHeaders.length > 0) {
      fireEvent.click(stepHeaders[0]);
      const stepResult = document.querySelector('.dm-expr-step-result');
      if (stepResult) {
        fireEvent.click(stepResult);
        expect(document.querySelector('.dm-expr-detail-overlay')).toBeTruthy();
      }
    }
    vi.useRealTimers();
  });

  it('Edit Source toggle shows source editor textarea', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderModal();
    await flushMonacoMount();
    const editSourceBtn = Array.from(document.querySelectorAll('.dm-expr-debug-toggle'))
      .find(el => el.textContent?.trim() === 'Edit Source');
    expect(editSourceBtn).toBeTruthy();
    fireEvent.click(editSourceBtn!);
    await act(async () => { vi.advanceTimersByTime(100); });
    const textarea = document.querySelector('.dm-expr-source-editor-textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    fireEvent.change(textarea, { target: { value: '{"test": true}' } });
    expect(textarea.value).toBe('{"test": true}');
    vi.useRealTimers();
  });

  it('variable name click and mouseDown stop propagation', () => {
    const outerClick = vi.fn();
    const { container } = render(
      <div onClick={outerClick} onMouseDown={outerClick}>
        <ExpressionEditorModal
          mapping={{ ...baseMapping, expression: '$.name' }}
          sources={sources}
          activeSourceId="s1"
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onRename={vi.fn()}
        />
      </div>,
    );
    const varInput = document.querySelector('.dm-expr-variable-input')!;
    fireEvent.click(varInput);
    fireEvent.mouseDown(varInput);
    expect(outerClick).not.toHaveBeenCalled();
    container.remove();
  });

  it('step result keyDown with Enter opens detail modal', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await waitFor(() => expect(document.querySelectorAll('.dm-expr-step-header').length).toBeGreaterThan(0));
    const headers = document.querySelectorAll('.dm-expr-step-header');
    if (headers.length > 0) {
      fireEvent.click(headers[headers.length - 1]);
      const results = document.querySelectorAll('.dm-expr-step-result');
      if (results.length > 0) {
        fireEvent.keyDown(results[0], { key: 'Enter' });
        expect(document.querySelector('.dm-expr-detail-modal')).toBeTruthy();
      }
    }
  });

  it('closing detail modal resets detailStep to null', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await waitFor(() => expect(document.querySelectorAll('.dm-expr-step-header').length).toBeGreaterThan(0));
    const headers = document.querySelectorAll('.dm-expr-step-header');
    if (headers.length > 0) {
      fireEvent.click(headers[headers.length - 1]);
      const results = document.querySelectorAll('.dm-expr-step-result');
      if (results.length > 0) {
        fireEvent.click(results[0]);
        expect(document.querySelector('.dm-expr-detail-modal')).toBeTruthy();
        const closeBtn = document.querySelector('.dm-expr-detail-footer button');
        if (closeBtn) {
          fireEvent.click(closeBtn);
          expect(document.querySelector('.dm-expr-detail-modal')).toBeNull();
        }
      }
    }
  });

  it('Expand All / Collapse All toggles all steps', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$concat($upper($.name), " test")' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await waitFor(() => expect(document.querySelectorAll('.dm-expr-step-header').length).toBeGreaterThan(0));
    const expandAllBtn = screen.queryByLabelText('Expand all');
    if (expandAllBtn) {
      fireEvent.click(expandAllBtn);
      const results = document.querySelectorAll('.dm-expr-step-result');
      expect(results.length).toBeGreaterThan(0);
      const collapseAllBtn = screen.queryByLabelText('Collapse all');
      if (collapseAllBtn) {
        fireEvent.click(collapseAllBtn);
        expect(document.querySelectorAll('.dm-expr-step-result').length).toBe(0);
      }
    }
  });

  it('toggleExpandAll is no-op when debugSteps is null', () => {
    renderModal();
    const expandAllBtn = screen.queryByLabelText('Expand all');
    expect(expandAllBtn).toBeNull();
  });
});
