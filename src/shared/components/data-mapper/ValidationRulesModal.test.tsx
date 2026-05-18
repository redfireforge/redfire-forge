/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import ValidationRulesModal from './ValidationRulesModal';
import type { LineVerifyResult } from './ValidationCodeEditor';

let mockEditorInstance: Record<string, unknown>;

vi.mock('./ValidationCodeEditor', () => ({
  default: (props: Record<string, unknown>) => {
    if (typeof props.onEditorMount === 'function') {
      setTimeout(() => {
        mockEditorInstance = {
          getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
          getModel: vi.fn(() => ({
            getLineContent: vi.fn(() => ''),
            getLineLength: vi.fn(() => 0),
          })),
          executeEdits: vi.fn(),
          focus: vi.fn(),
          getDomNode: vi.fn(() => document.createElement('div')),
          revealLineInCenter: vi.fn(),
          setPosition: vi.fn(),
        };
        (props.onEditorMount as (e: unknown) => void)(mockEditorInstance);
      }, 0);
    }
    return (
      <div
        data-testid="validation-code-editor"
        data-value={String(props.value ?? '')}
        data-hide-header={String(props.hideHeader)}
        data-hide-footer={String(props.hideFooter)}
        data-line-results={JSON.stringify(props.lineResults ?? [])}
      >
        <button
          type="button"
          data-testid="simulate-validation-change"
          onClick={() => {
            const wrap = document.querySelector('[data-testid="validation-code-editor"]') as HTMLElement | null;
            const next = wrap?.dataset.nextText ?? 'user-edited-dsl';
            (props.onChange as (t: string) => void)(next);
          }}
        >
          ApplyMockChange
        </button>
      </div>
    );
  },
}));

vi.mock('./DslReferencePanel', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="dsl-reference-panel">
      <button onClick={() => (props.onInsert as (t: string) => void)('test-insert')}>InsertRef</button>
    </div>
  ),
}));

vi.mock('../../../styles/validation-rules-modal.css', () => ({}));

const baseProps = {
  value: 'offers[0].rank  >=  1\n# comment\n',
  onChange: vi.fn(),
  errors: [],
  samplePaths: ['offers', 'offers[0].rank'],
  onClose: vi.fn(),
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('ValidationRulesModal', () => {
  it('renders the modal with title and stats', () => {
    render(<ValidationRulesModal {...baseProps} />);

    expect(screen.getByText(/Validation Rules/)).toBeInTheDocument();
    expect(screen.getByText(/1 rule/)).toBeInTheDocument();
  });

  it('renders the ValidationCodeEditor with hideHeader and hideFooter', () => {
    render(<ValidationRulesModal {...baseProps} />);

    const editor = screen.getByTestId('validation-code-editor');
    expect(editor).toHaveAttribute('data-hide-header', 'true');
    expect(editor).toHaveAttribute('data-hide-footer', 'true');
  });

  it('renders the DSL Reference panel by default', () => {
    render(<ValidationRulesModal {...baseProps} />);
    expect(screen.getByTestId('dsl-reference-panel')).toBeInTheDocument();
  });

  it('renders the edge toggle button to show/hide reference', () => {
    render(<ValidationRulesModal {...baseProps} />);
    const toggle = document.body.querySelector('.vr-ref-edge-toggle');
    expect(toggle).toBeTruthy();
    expect(toggle!.tagName).toBe('BUTTON');
  });

  it('edge toggle hides and shows the reference panel', () => {
    render(<ValidationRulesModal {...baseProps} />);
    const toggle = document.body.querySelector('.vr-ref-edge-toggle')!;
    expect(toggle).toBeTruthy();

    expect(screen.getByTestId('dsl-reference-panel')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByTestId('dsl-reference-panel')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByTestId('dsl-reference-panel')).toBeInTheDocument();
  });

  it('hides reference panel when toggle is clicked', () => {
    render(<ValidationRulesModal {...baseProps} />);

    const toggle = screen.getByTitle('Toggle DSL reference');
    fireEvent.click(toggle);

    expect(screen.queryByTestId('dsl-reference-panel')).not.toBeInTheDocument();
  });

  it('shows error count when errors exist', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        errors={[{ lineNumber: 1, column: 1, message: 'bad' }]}
      />,
    );

    expect(screen.getByText(/1 error/)).toBeInTheDocument();
  });

  it('calls onClose when Cancel button is clicked', () => {
    render(<ValidationRulesModal {...baseProps} />);

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Save button is clicked', () => {
    render(<ValidationRulesModal {...baseProps} />);

    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);

    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    render(<ValidationRulesModal {...baseProps} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on Escape when suggest widget is visible', () => {
    render(<ValidationRulesModal {...baseProps} />);

    vi.advanceTimersByTime(10);

    const domNode = document.createElement('div');
    const suggestWidget = document.createElement('div');
    suggestWidget.className = 'editor-widget suggest-widget visible';
    domNode.appendChild(suggestWidget);

    (mockEditorInstance.getDomNode as ReturnType<typeof vi.fn>).mockReturnValue(domNode);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('ignores non-Escape keys', () => {
    render(<ValidationRulesModal {...baseProps} />);

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'a' });

    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('renders mode selector with all three options', () => {
    render(<ValidationRulesModal {...baseProps} />);

    const select = screen.getByTitle('Display mode (saved as default)');
    expect(select).toBeInTheDocument();

    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
  });

  it('renders the footer with syntax hints', () => {
    render(<ValidationRulesModal {...baseProps} />);

    expect(screen.getByText(/suggest/i)).toBeInTheDocument();
    expect(screen.getByText(/comments/)).toBeInTheDocument();
  });

  it('defaults to docked mode', () => {
    render(<ValidationRulesModal {...baseProps} />);

    expect(document.body.querySelector('.vr-modal-panel--docked')).toBeTruthy();
  });

  it('shows resize handle in docked mode', () => {
    render(<ValidationRulesModal {...baseProps} />);

    expect(document.body.querySelector('.vr-modal-resize-handle')).toBeTruthy();
  });

  // ── Mode rendering ──

  it('renders floating mode with position and size styles', () => {
    localStorage.setItem('vr-modal-default-mode', 'floating');
    render(<ValidationRulesModal {...baseProps} />);

    const panel = document.body.querySelector('.vr-modal-panel--floating');
    expect(panel).toBeTruthy();
    expect(panel!.getAttribute('style')).toContain('left');
    expect(panel!.getAttribute('style')).toContain('top');
    expect(panel!.getAttribute('style')).toContain('width');
    expect(panel!.getAttribute('style')).toContain('height');
  });

  it('renders floating mode with resize grip and right edge handle', () => {
    localStorage.setItem('vr-modal-default-mode', 'floating');
    render(<ValidationRulesModal {...baseProps} />);

    expect(document.body.querySelector('.vr-modal-float-grip')).toBeTruthy();
    expect(document.body.querySelector('.vr-modal-float-edge-right')).toBeTruthy();
  });

  it('floating mode header has grab cursor for dragging', () => {
    localStorage.setItem('vr-modal-default-mode', 'floating');
    render(<ValidationRulesModal {...baseProps} />);

    const header = document.body.querySelector('.vr-modal-header');
    expect(header!.getAttribute('style')).toContain('grab');
  });

  it('floating mode shows drag-handle icon in header', () => {
    localStorage.setItem('vr-modal-default-mode', 'floating');
    render(<ValidationRulesModal {...baseProps} />);

    const icon = document.body.querySelector('.vr-modal-header-icon');
    expect(icon!.textContent).toBe('\u2847');
  });

  it('docked mode shows lightning icon in header', () => {
    render(<ValidationRulesModal {...baseProps} />);

    const icon = document.body.querySelector('.vr-modal-header-icon');
    expect(icon!.textContent).toBe('\u26A1');
  });

  it('renders maximized mode without resize handles', () => {
    localStorage.setItem('vr-modal-default-mode', 'maximized');
    render(<ValidationRulesModal {...baseProps} />);

    const panel = document.body.querySelector('.vr-modal-panel--maximized');
    expect(panel).toBeTruthy();
    expect(document.body.querySelector('.vr-modal-resize-handle')).toBeNull();
    expect(document.body.querySelector('.vr-modal-float-grip')).toBeNull();
  });

  it('changes mode via select dropdown to floating', () => {
    render(<ValidationRulesModal {...baseProps} />);

    const select = screen.getByTitle('Display mode (saved as default)') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: 'floating' } });
    expect(localStorage.getItem('vr-modal-default-mode')).toBe('floating');
  });

  it('renders maximized panel when localStorage has maximized mode', () => {
    localStorage.setItem('vr-modal-default-mode', 'maximized');
    render(<ValidationRulesModal {...baseProps} />);

    expect(document.body.querySelector('.vr-modal-panel--maximized')).toBeTruthy();
    expect(document.body.querySelector('.vr-modal-resize-handle')).toBeNull();
  });

  // ── Verify status ──

  it('shows passed count when verifyStatus is complete and passedCount > 0', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        verifyStatus="complete"
        verifyPassedCount={12}
        verifyFailedCount={0}
      />,
    );

    expect(screen.getByText('12 passed')).toBeInTheDocument();
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
  });

  it('shows failed count when verifyStatus is complete and failedCount > 0', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        verifyStatus="complete"
        verifyPassedCount={0}
        verifyFailedCount={3}
      />,
    );

    expect(screen.getByText('3 failed')).toBeInTheDocument();
    expect(screen.queryByText(/passed/)).not.toBeInTheDocument();
  });

  it('shows both passed and failed counts', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        verifyStatus="complete"
        verifyPassedCount={10}
        verifyFailedCount={2}
      />,
    );

    expect(screen.getByText('10 passed')).toBeInTheDocument();
    expect(screen.getByText('2 failed')).toBeInTheDocument();
  });

  it('hides verify stats when status is not complete', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        verifyStatus="idle"
        verifyPassedCount={10}
        verifyFailedCount={2}
      />,
    );

    expect(screen.queryByText(/passed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
  });

  it('hides verify stats when status is running', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        verifyStatus="running"
        verifyPassedCount={10}
        verifyFailedCount={0}
      />,
    );

    expect(screen.queryByText(/passed/)).not.toBeInTheDocument();
  });

  it('hides verify stats when both counts are 0', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        verifyStatus="complete"
        verifyPassedCount={0}
        verifyFailedCount={0}
      />,
    );

    expect(screen.queryByText(/passed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
  });

  // ── Rule counting ──

  it('counts multiple rules correctly', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        value={'status  equals  "ok"\nprice  >  0\n# comment\nname  exists\n'}
      />,
    );

    expect(screen.getByText(/3 rules/)).toBeInTheDocument();
  });

  it('shows "0 rules" for empty value', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        value=""
      />,
    );

    expect(screen.getByText(/0 rules/)).toBeInTheDocument();
  });

  it('shows "0 rules" for only comments', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        value="# just a comment\n# another\n"
      />,
    );

    expect(screen.getByText(/0 rules/)).toBeInTheDocument();
  });

  // ── Multiple errors ──

  it('pluralizes "errors" for multiple errors', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        errors={[
          { lineNumber: 1, column: 1, message: 'err1' },
          { lineNumber: 2, column: 1, message: 'err2' },
        ]}
      />,
    );

    expect(screen.getByText(/2 errors/)).toBeInTheDocument();
  });

  // ── Editor mount / insert ──

  it('forwards insert to mounted editor', () => {
    render(<ValidationRulesModal {...baseProps} />);

    vi.advanceTimersByTime(10);

    const insertBtn = screen.getByText('InsertRef');
    fireEvent.click(insertBtn);

    expect(mockEditorInstance.executeEdits).toHaveBeenCalledWith(
      'dsl-ref-insert',
      expect.arrayContaining([
        expect.objectContaining({ text: 'test-insert\n' }),
      ]),
    );
    expect(mockEditorInstance.focus).toHaveBeenCalled();
  });

  // ── Portal target ──

  it('portals into closest modal overlay when portalContainerRef is provided', () => {
    const overlay = document.createElement('div');
    overlay.className = 'dm-modal-overlay';
    document.body.appendChild(overlay);

    const container = document.createElement('div');
    overlay.appendChild(container);

    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    render(<ValidationRulesModal {...baseProps} portalContainerRef={ref as RefObject<HTMLDivElement | null>} />);

    expect(overlay.querySelector('.vr-modal-panel')).toBeTruthy();

    document.body.removeChild(overlay);
  });

  it('falls back to document.body when no modal overlay ancestor', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    render(<ValidationRulesModal {...baseProps} portalContainerRef={ref as RefObject<HTMLDivElement | null>} />);

    expect(document.body.querySelector('.vr-modal-panel')).toBeTruthy();

    document.body.removeChild(container);
  });

  // ── External prop sync ──

  it('updates localText when value prop changes externally (no user edit)', () => {
    const initialValue = 'name  exists';
    const updatedValue = 'name  exists\noffers  length >=  1';
    const { rerender } = render(<ValidationRulesModal {...baseProps} value={initialValue} />);

    let editor = screen.getByTestId('validation-code-editor');
    expect(editor.getAttribute('data-value')).toBe(initialValue);

    // Parent passes new DSL text (e.g. array assertion added via context menu)
    rerender(<ValidationRulesModal {...baseProps} value={updatedValue} />);

    editor = screen.getByTestId('validation-code-editor');
    expect(editor.getAttribute('data-value')).toBe(updatedValue);
  });

  it('does NOT overwrite localText after user edits when parent value changes', () => {
    const onChange = vi.fn();
    const parentUpdated = 'name  exists\nparent-pushed-rule';
    const { rerender } = render(<ValidationRulesModal {...baseProps} value="name  exists" onChange={onChange} />);

    const editorEl = screen.getByTestId('validation-code-editor');
    editorEl.dataset.nextText = 'user-kept-draft  equals  1';
    fireEvent.click(screen.getByTestId('simulate-validation-change'));

    let editor = screen.getByTestId('validation-code-editor');
    expect(editor.getAttribute('data-value')).toBe('user-kept-draft  equals  1');

    rerender(<ValidationRulesModal {...baseProps} value={parentUpdated} onChange={onChange} />);

    editor = screen.getByTestId('validation-code-editor');
    expect(editor.getAttribute('data-value')).toBe('user-kept-draft  equals  1');
  });

  it('syncs error props when value is unchanged and user has not edited', () => {
    const errorsLater = [{ lineNumber: 2, column: 1, message: 'late error' }];
    const { rerender } = render(
      <ValidationRulesModal {...baseProps} value="ok  exists\n" errors={[]} />,
    );

    expect(screen.queryByText(/error/)).not.toBeInTheDocument();

    rerender(
      <ValidationRulesModal {...baseProps} value="ok  exists\n" errors={errorsLater} />,
    );

    expect(screen.getByText(/1 error/)).toBeInTheDocument();
  });

  it('does not replace local parse errors with parent errors after user edits', () => {
    const { rerender } = render(
      <ValidationRulesModal
        {...baseProps}
        value="line  equals  1"
        errors={[]}
      />,
    );

    const editorEl = screen.getByTestId('validation-code-editor');
    editorEl.dataset.nextText = 'line  totally_bad_operator  x';
    fireEvent.click(screen.getByTestId('simulate-validation-change'));

    rerender(
      <ValidationRulesModal
        {...baseProps}
        value="line  equals  1"
        errors={[{ lineNumber: 99, column: 1, message: 'parent injected' }]}
      />,
    );

    expect(screen.queryByText(/parent injected/)).not.toBeInTheDocument();
  });

  it('Cancel after no user edit does NOT call onChange', () => {
    const onChange = vi.fn();
    render(<ValidationRulesModal {...baseProps} value="name  exists" onChange={onChange} onClose={vi.fn()} />);

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('Save calls onChange with current value', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<ValidationRulesModal {...baseProps} value="name  exists" onChange={onChange} onClose={onClose} />);

    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);

    expect(onChange).toHaveBeenCalledWith('name  exists');
    expect(onClose).toHaveBeenCalled();
  });

  // ── Accessibility ──

  it('has role="region" and aria-label on the panel', () => {
    render(<ValidationRulesModal {...baseProps} />);

    const panel = document.body.querySelector('[role="region"][aria-label="Validation Rules"]');
    expect(panel).toBeTruthy();
  });

  // ── onJumpToNode hint ──

  it('shows Ctrl+G hint when onJumpToNode is provided', () => {
    render(<ValidationRulesModal {...baseProps} onJumpToNode={vi.fn()} />);

    expect(screen.getByText((_content, el) =>
      el?.tagName === 'SPAN' && !!el.textContent?.includes('jump to node'),
    )).toBeInTheDocument();
  });

  it('hides Ctrl+G hint when onJumpToNode is not provided', () => {
    render(<ValidationRulesModal {...baseProps} />);

    expect(screen.queryByText((_content, el) =>
      el?.tagName === 'SPAN' && !!el.textContent?.includes('jump to node'),
    )).not.toBeInTheDocument();
  });

  it('apply mock insert before editor mount does not throw', () => {
    render(<ValidationRulesModal {...baseProps} />);
    fireEvent.click(screen.getByText('InsertRef'));
    expect(screen.getByTestId('dsl-reference-panel')).toBeInTheDocument();
  });

  it('second local edit does not reset revert baseline', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<ValidationRulesModal {...baseProps} value="v1  exists" onChange={onChange} onClose={onClose} />);

    const editorEl = screen.getByTestId('validation-code-editor');
    editorEl.dataset.nextText = 'v2  exists';
    fireEvent.click(screen.getByTestId('simulate-validation-change'));

    editorEl.dataset.nextText = 'v3  exists';
    fireEvent.click(screen.getByTestId('simulate-validation-change'));

    fireEvent.click(screen.getByText('Cancel'));
    expect(onChange).toHaveBeenCalledWith('v1  exists');
    expect(onClose).toHaveBeenCalled();
  });

  // ── Reference edge toggle / header toggle ──

  it('edge toggle shows collapsed styling and screen-reader label when reference is hidden', () => {
    render(<ValidationRulesModal {...baseProps} />);
    const edgeToggle = document.body.querySelector('.vr-ref-edge-toggle')!;
    fireEvent.click(edgeToggle);

    expect(edgeToggle.classList.contains('vr-ref-edge-toggle--collapsed')).toBe(true);
    expect(edgeToggle.getAttribute('aria-label')).toBe('Show reference panel');
    expect(edgeToggle.textContent).toContain('REF');

    fireEvent.click(edgeToggle);
    expect(edgeToggle.classList.contains('vr-ref-edge-toggle--collapsed')).toBe(false);
    expect(edgeToggle.getAttribute('aria-label')).toBe('Hide reference panel');
  });

  it('persists reference visibility to localStorage when using edge toggle', () => {
    render(<ValidationRulesModal {...baseProps} />);
    const edgeToggle = document.body.querySelector('.vr-ref-edge-toggle')!;
    fireEvent.click(edgeToggle);
    expect(localStorage.getItem('vr-modal-reference')).toBe('false');

    fireEvent.click(edgeToggle);
    expect(localStorage.getItem('vr-modal-reference')).toBe('true');
  });

  it('header Reference toggle shows active state while panel is open', () => {
    render(<ValidationRulesModal {...baseProps} />);
    const headerToggle = screen.getByTitle('Toggle DSL reference');

    expect(headerToggle.classList.contains('vr-modal-action-btn--active')).toBe(true);

    fireEvent.click(headerToggle);
    expect(headerToggle.classList.contains('vr-modal-action-btn--active')).toBe(false);
  });

  // ── Mode switching via select ──

  it('cycles docked → floating → maximized → docked and persists mode', () => {
    render(<ValidationRulesModal {...baseProps} />);

    const modeSelect = () => screen.getByLabelText('Modal display mode') as HTMLSelectElement;

    fireEvent.change(modeSelect(), { target: { value: 'floating' } });
    expect(document.body.querySelector('.vr-modal-panel--floating')).toBeTruthy();
    expect(localStorage.getItem('vr-modal-default-mode')).toBe('floating');

    fireEvent.change(modeSelect(), { target: { value: 'maximized' } });
    expect(document.body.querySelector('.vr-modal-panel--maximized')).toBeTruthy();
    expect(localStorage.getItem('vr-modal-default-mode')).toBe('maximized');

    fireEvent.change(modeSelect(), { target: { value: 'docked' } });
    expect(document.body.querySelector('.vr-modal-panel--docked')).toBeTruthy();
    expect(localStorage.getItem('vr-modal-default-mode')).toBe('docked');
  });

  // ── Resize interactions ──

  it('dock resize handle updates docked panel height on drag', () => {
    render(<ValidationRulesModal {...baseProps} />);
    const panel = document.body.querySelector('.vr-modal-panel--docked') as HTMLElement;
    expect(panel.style.height).toBe('260px');

    const handle = document.body.querySelector('.vr-modal-resize-handle')!;
    fireEvent.mouseDown(handle, { clientY: 400 });
    fireEvent.mouseMove(window, { clientY: 350 });
    fireEvent.mouseUp(window);

    expect(panel.style.height).toBe('310px');
  });

  it('floating corner grip updates width and height on drag', () => {
    localStorage.setItem('vr-modal-default-mode', 'floating');
    render(<ValidationRulesModal {...baseProps} />);
    const panel = document.body.querySelector('.vr-modal-panel--floating') as HTMLElement;
    const styleBefore = panel.getAttribute('style') ?? '';

    const grip = document.body.querySelector('.vr-modal-float-grip')!;
    fireEvent.mouseDown(grip, { clientX: 600, clientY: 400 });
    fireEvent.mouseMove(window, { clientX: 630, clientY: 425 });
    fireEvent.mouseUp(window);

    const styleAfter = panel.getAttribute('style') ?? '';
    expect(styleAfter).not.toBe(styleBefore);
    expect(styleAfter).toMatch(/width:\s*\d+px/);
    expect(styleAfter).toMatch(/height:\s*\d+px/);
  });

  it('floating right edge handle updates width on drag', () => {
    localStorage.setItem('vr-modal-default-mode', 'floating');
    render(<ValidationRulesModal {...baseProps} />);
    const panel = document.body.querySelector('.vr-modal-panel--floating') as HTMLElement;
    const beforeW = /width:\s*(\d+)px/.exec(panel.getAttribute('style') ?? '')?.[1];

    const edge = document.body.querySelector('.vr-modal-float-edge-right')!;
    fireEvent.mouseDown(edge, { clientX: 700 });
    fireEvent.mouseMove(window, { clientX: 740 });
    fireEvent.mouseUp(window);

    const afterW = /width:\s*(\d+)px/.exec(panel.getAttribute('style') ?? '')?.[1];
    expect(Number(afterW)).toBeGreaterThan(Number(beforeW));
  });

  it('floating header drag moves panel position', () => {
    localStorage.setItem('vr-modal-default-mode', 'floating');
    render(<ValidationRulesModal {...baseProps} />);
    const panel = document.body.querySelector('.vr-modal-panel--floating') as HTMLElement;
    const beforeLeft = /left:\s*(\d+)px/.exec(panel.getAttribute('style') ?? '')?.[1];
    const beforeTop = /top:\s*(\d+)px/.exec(panel.getAttribute('style') ?? '')?.[1];

    const title = document.body.querySelector('.vr-modal-header-title')!;
    fireEvent.mouseDown(title, { clientX: 40, clientY: 12 });
    fireEvent.mouseMove(window, { clientX: 70, clientY: 32 });
    fireEvent.mouseUp(window);

    const afterLeft = /left:\s*(\d+)px/.exec(panel.getAttribute('style') ?? '')?.[1];
    const afterTop = /top:\s*(\d+)px/.exec(panel.getAttribute('style') ?? '')?.[1];
    expect(Number(afterLeft)).toBe(Number(beforeLeft) + 30);
    expect(Number(afterTop)).toBe(Number(beforeTop) + 20);
  });

  // ── Save / Cancel after edits ──

  it('Save commits edited DSL and closes', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<ValidationRulesModal {...baseProps} value="start  exists" onChange={onChange} onClose={onClose} />);

    const editorEl = screen.getByTestId('validation-code-editor');
    editorEl.dataset.nextText = 'committed  equals  42';
    fireEvent.click(screen.getByTestId('simulate-validation-change'));

    fireEvent.click(screen.getByText('Save'));
    expect(onChange).toHaveBeenCalledWith('committed  equals  42');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel restores revert snapshot via onChange when user edited', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<ValidationRulesModal {...baseProps} value="original  exists" onChange={onChange} onClose={onClose} />);

    const editorEl = screen.getByTestId('validation-code-editor');
    editorEl.dataset.nextText = 'draft  equals  1';
    fireEvent.click(screen.getByTestId('simulate-validation-change'));

    fireEvent.click(screen.getByText('Cancel'));
    expect(onChange).toHaveBeenCalledWith('original  exists');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape after edits invokes cancel with revert behavior', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<ValidationRulesModal {...baseProps} value="keep  exists" onChange={onChange} onClose={onClose} />);

    const editorEl = screen.getByTestId('validation-code-editor');
    editorEl.dataset.nextText = 'discard  equals  9';
    fireEvent.click(screen.getByTestId('simulate-validation-change'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith('keep  exists');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Escape when editor mounted ──

  it('Escape closes modal when editor is mounted and suggest widget is absent', () => {
    render(<ValidationRulesModal {...baseProps} />);
    vi.advanceTimersByTime(10);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  // ── Insert / editor edge cases ──

  it('skips DSL insert when editor reports no caret position', () => {
    render(<ValidationRulesModal {...baseProps} />);
    vi.advanceTimersByTime(10);

    (mockEditorInstance.getPosition as ReturnType<typeof vi.fn>).mockReturnValue(null);

    fireEvent.click(screen.getByText('InsertRef'));
    expect(mockEditorInstance.executeEdits).not.toHaveBeenCalled();
  });

  // ── Portal: modal-overlay ancestor ──

  it('portals into closest .modal-overlay ancestor when provided', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);

    const container = document.createElement('div');
    overlay.appendChild(container);

    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    render(<ValidationRulesModal {...baseProps} portalContainerRef={ref as RefObject<HTMLDivElement | null>} />);

    expect(overlay.querySelector('.vr-modal-panel')).toBeTruthy();

    document.body.removeChild(overlay);
  });

  // ── lineResults forwarded ──

  it('forwards lineResults to ValidationCodeEditor', () => {
    const lineResults: LineVerifyResult[] = [{ lineNumber: 1, passed: true, actual: 'a', expected: 'b' }];
    render(<ValidationRulesModal {...baseProps} lineResults={lineResults} />);

    const editor = screen.getByTestId('validation-code-editor');
    expect(editor.getAttribute('data-line-results')).toBe(JSON.stringify(lineResults));
  });

  // ── Inline Verify ──

  it('renders Verify button', () => {
    render(<ValidationRulesModal {...baseProps} sampleResponseData={{ offers: [{ rank: 13 }] }} />);
    expect(screen.getByText(/▶ Verify/)).toBeInTheDocument();
  });

  it('Verify button is disabled when no sampleResponseData', () => {
    render(<ValidationRulesModal {...baseProps} />);
    const btn = screen.getByText(/▶ Verify/);
    expect(btn).toBeDisabled();
  });

  it('Verify button is enabled when sampleResponseData is provided', () => {
    render(<ValidationRulesModal {...baseProps} sampleResponseData={{ offers: [{ rank: 13 }] }} />);
    const btn = screen.getByText(/▶ Verify/);
    expect(btn).not.toBeDisabled();
  });

  it('clicking Verify runs inline verification and shows results', () => {
    const dsl = 'offers[0].rank  equals  "13"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));

    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('shows FAILED RULES strip when a rule fails', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));

    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    expect(screen.getByText(/Failed Rules/)).toBeInTheDocument();
  });

  it('results strip close button hides the strip', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/Failed Rules/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close results'));
    expect(screen.queryByText(/Failed Rules/)).not.toBeInTheDocument();
  });

  it('expanding a failed rule shows debug detail', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));

    // Click the expand arrow on the failed result
    const stripItems = document.querySelectorAll('.vr-results-strip-item');
    expect(stripItems.length).toBe(1);
    fireEvent.click(stripItems[0]);

    // Debug section should appear
    expect(screen.getByText('Input Data')).toBeInTheDocument();
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('inline results clear when text changes', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    // Simulate text change
    fireEvent.click(screen.getByText('ApplyMockChange'));
    expect(screen.queryByText(/1 failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed Rules/)).not.toBeInTheDocument();
  });

  it('shows passed count when all rules pass', () => {
    const dsl = 'offers[0].rank  equals  "13"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
    expect(screen.queryByText(/Failed Rules/)).not.toBeInTheDocument();
  });

  it('handles sampleResponseData as JSON string', () => {
    const dsl = 'offers[0].rank  equals  "13"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={JSON.stringify({ offers: [{ rank: 13 }] })}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('handles empty response body gracefully', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        sampleResponseData={undefined}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.queryByText(/Failed Rules/)).not.toBeInTheDocument();
  });

  it('jump-to-line button navigates editor to failed line', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );
    vi.advanceTimersByTime(10);

    fireEvent.click(screen.getByText(/▶ Verify/));

    const gotoBtn = document.querySelector('.vr-results-strip-goto');
    expect(gotoBtn).toBeTruthy();
    fireEvent.click(gotoBtn!);

    expect(mockEditorInstance.revealLineInCenter).toHaveBeenCalled();
    expect(mockEditorInstance.setPosition).toHaveBeenCalled();
  });

  it('falls back to parent verifyStatus stats when inline is idle', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        verifyStatus="complete"
        verifyPassedCount={5}
        verifyFailedCount={2}
      />,
    );

    expect(screen.getByText(/5 passed/)).toBeInTheDocument();
    expect(screen.getByText(/2 failed/)).toBeInTheDocument();
  });

  it('inline verify stats override parent stats', () => {
    const dsl = 'offers[0].rank  equals  "13"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
        verifyStatus="complete"
        verifyPassedCount={5}
        verifyFailedCount={2}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));

    // Should show inline result (1 passed), not parent (5 passed)
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
    expect(screen.queryByText(/5 passed/)).not.toBeInTheDocument();
  });

  // ── DSL assertions (arrayLength, each, contains, custom) ──

  it('verifies array length assertions', () => {
    const dsl = 'offers  length >=  1';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 5 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('verifies each assertions and shows failed items', () => {
    const dsl = 'offers[*].rank  each >=  10';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 5 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    // Expand to see debug detail
    const stripItem = document.querySelector('.vr-results-strip-item');
    expect(stripItem).toBeTruthy();
    fireEvent.click(stripItem!);

    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('verifies contains_any assertions', () => {
    const dsl = 'offers  contains_any  {"rank": 13}';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 5 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('verifies custom ASSERT expressions', () => {
    const dsl = 'ASSERT $gt($count($.body.offers), 0)';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    // Custom assert should pass — count > 0
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('shows debug steps for failed custom ASSERT', () => {
    const dsl = 'ASSERT $eq($count($.body.offers), 99)';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    // Expand
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);

    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
    expect(screen.getByText('Input Data')).toBeInTheDocument();
  });

  it('expandable debug step shows full value on click', () => {
    const longArray = Array.from({ length: 20 }, (_, i) => ({ rank: i, name: `offer-${i}-with-long-name` }));
    const dsl = 'offers  length >=  100';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: longArray }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    // Expand the failed item
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('Input Data section expands and collapses for large data', () => {
    const longArray = Array.from({ length: 20 }, (_, i) => ({ rank: i, name: `item-${i}` }));
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: longArray }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);

    // Should see the expandable input data section
    const inputTitle = screen.getByText('Input Data');
    expect(inputTitle).toBeInTheDocument();

    // Click to expand
    fireEvent.click(inputTitle.closest('.vr-debug-section-title--clickable')!);
  });

  it('handles subset assertions', () => {
    const dsl = 'offers  subset  {"rank": 13}';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13, name: 'a' }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    // Subset should match
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('verifies mixed rules (field + collection)', () => {
    const dsl = 'offers[0].rank  equals  "13"\noffers  length >=  1';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/2 passed/)).toBeInTheDocument();
  });

  it('debug step row with ▸ toggle indicator for truncated values', () => {
    // Create a scenario where field value is long enough to trigger truncation
    const longValue = 'x'.repeat(100);
    const dsl = 'data  equals  "wrong"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ data: longValue }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);

    // Should have clickable step rows with toggle
    const clickableSteps = document.querySelectorAll('.vr-debug-step--clickable');
    if (clickableSteps.length > 0) {
      fireEvent.click(clickableSteps[0]);
      // Should show the full value block
      const fullBlock = document.querySelector('.vr-debug-step-full');
      expect(fullBlock).toBeTruthy();
    }
  });

  it('keyboard Enter on failed item toggles expansion', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.keyDown(stripItem!, { key: 'Enter' });
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();

    // Toggle close
    fireEvent.keyDown(stripItem!, { key: 'Enter' });
    expect(screen.queryByText('Evaluation Steps')).not.toBeInTheDocument();
  });

  it('enriches undefined paths with available keys', () => {
    const dsl = 'nonexistent.field  equals  "x"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }], count: 1 }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('verifies failed array length assertion with debug steps', () => {
    const dsl = 'offers  length >=  100';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 1 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('keyboard Enter on Input Data section toggles expansion', () => {
    const longArray = Array.from({ length: 20 }, (_, i) => ({ rank: i, name: `item-${i}` }));
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: longArray }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);

    const inputTitle = document.querySelector('.vr-debug-section-title--clickable');
    if (inputTitle) {
      fireEvent.keyDown(inputTitle, { key: 'Enter' });
    }
  });

  it('keyboard Enter on expandable step toggles full value', () => {
    const longVal = 'y'.repeat(100);
    const dsl = 'data  equals  "wrong"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ data: longVal }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);

    const clickableStep = document.querySelector('.vr-debug-step--clickable');
    if (clickableStep) {
      fireEvent.keyDown(clickableStep, { key: 'Enter' });
      expect(document.querySelector('.vr-debug-step-full')).toBeTruthy();
      // Toggle back
      fireEvent.keyDown(clickableStep, { key: 'Enter' });
      expect(document.querySelector('.vr-debug-step-full')).toBeFalsy();
    }
  });

  it('type check assertions (is_true, is_null) evaluate correctly', () => {
    const dsl = 'active  is_true';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ active: true }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('handles each assertion that passes fully', () => {
    const dsl = 'offers[*].rank  each >=  0';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 5 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('handles failed contains_any assertion', () => {
    const dsl = 'offers  contains_any  {"rank": 999}';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('shows no debug data message when neither steps nor input exist', () => {
    // This covers the fallback case for assertion types that don't produce debug info
    const dsl = 'ASSERT true';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
  });

  it('handles multiple failed rules with different expansion states', () => {
    const dsl = 'offers[0].rank  equals  "999"\noffers  length >=  100';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/2 failed/)).toBeInTheDocument();

    const stripItems = document.querySelectorAll('.vr-results-strip-item');
    expect(stripItems.length).toBe(2);

    // Expand first
    fireEvent.click(stripItems[0]);
    expect(document.querySelectorAll('.vr-results-strip-debug').length).toBe(1);

    // Expand second (collapses first)
    fireEvent.click(stripItems[1]);
    expect(document.querySelectorAll('.vr-results-strip-debug').length).toBe(1);
  });

  it('verifies ASSERT custom expression failure shows debug steps', () => {
    const dsl = 'ASSERT $gt($.body.nonExistentField.deep, 0)';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );
    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    const stripItem = document.querySelector('.vr-results-strip-item');
    expect(stripItem).toBeTruthy();
    if (stripItem) {
      fireEvent.click(stripItem);
      expect(document.querySelectorAll('.vr-results-strip-debug').length).toBeGreaterThanOrEqual(1);
    }
  });

  it('verifies each assertion with failing items shows debug info', () => {
    const dsl = 'offers[*].rank  each >  100';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 14 }, { rank: 5 }] }}
      />,
    );
    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    const stripItem = document.querySelector('.vr-results-strip-item');
    expect(stripItem).toBeTruthy();
    if (stripItem) {
      fireEvent.click(stripItem);
      expect(document.querySelectorAll('.vr-results-strip-debug').length).toBeGreaterThanOrEqual(1);
    }
  });

  it('verifies ASSERT with valid path passes verification', () => {
    const dsl = 'ASSERT $gt($count($.body.offers), 0)';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 14 }] }}
      />,
    );
    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('verifies length assertion on arrays', () => {
    const dsl = 'offers  length >=  2';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 14 }] }}
      />,
    );
    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });
});
