/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import ValidationRulesModal from './ValidationRulesModal';

let mockEditorInstance: Record<string, unknown>;

vi.mock('./ValidationCodeEditor', () => ({
  default: (props: Record<string, unknown>) => {
    if (typeof props.onEditorMount === 'function') {
      setTimeout(() => {
        mockEditorInstance = {
          getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
          executeEdits: vi.fn(),
          focus: vi.fn(),
          getDomNode: vi.fn(() => document.createElement('div')),
        };
        (props.onEditorMount as (e: unknown) => void)(mockEditorInstance);
      }, 0);
    }
    return (
      <div data-testid="validation-code-editor" data-hide-header={String(props.hideHeader)} data-hide-footer={String(props.hideFooter)} />
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

  it('calls onClose when close button is clicked', () => {
    render(<ValidationRulesModal {...baseProps} />);

    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);

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

    expect(screen.getByText(/suggestions/)).toBeInTheDocument();
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
});
