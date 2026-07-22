/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowEditorModalFrame from './WorkflowEditorModalFrame';

/* ── Mocks ── */

vi.mock('../../../../shared/hooks/useModalFrame', () => ({
  useModalFrame: vi.fn(() => ({
    expanded: false,
    setExpanded: vi.fn(),
    toggleExpand: vi.fn(),
    expandClass: '',
    overlayStyle: {},
    dialogStyle: {},
    headerDragStyle: { cursor: 'grab' },
    onHeaderMouseDown: vi.fn(),
    onRightEdge: vi.fn(),
    onCorner: vi.fn(),
  })),
}));

vi.mock('../../../../shared/components/ModalExpandButton', () => ({
  default: ({ expanded, position }: { expanded: boolean; position?: string }) => (
    <button data-testid={`expand-btn-${position ?? 'header'}`}>
      {expanded ? 'Shrink' : 'Expand'}
    </button>
  ),
}));

vi.mock('../../../../shared/components/ModalResizeHandles', () => ({
  default: () => <div data-testid="resize-handles" />,
}));

vi.mock('./WorkflowModalScrollBody', () => ({
  default: ({ children, className }: { children: React.ReactNode; className: string }) => (
    <div data-testid="scroll-body" className={className}>{children}</div>
  ),
}));

describe('WorkflowEditorModalFrame', () => {
  const onClose = vi.fn();
  const defaultProps = {
    title: 'Test Modal',
    onClose,
    children: <div data-testid="body-content">Body</div>,
  };

  beforeEach(() => { onClose.mockClear(); });

  it('renders when open (default)', () => {
    render(<WorkflowEditorModalFrame {...defaultProps} />);
    expect(screen.getByText('Test Modal')).toBeTruthy();
    expect(screen.getByTestId('body-content')).toBeTruthy();
  });

  it('renders nothing when open=false', () => {
    const { container } = render(<WorkflowEditorModalFrame {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('calls onClose when × button clicked', () => {
    render(<WorkflowEditorModalFrame {...defaultProps} hideCloseButton={false} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders footer when provided', () => {
    render(
      <WorkflowEditorModalFrame {...defaultProps} footer={<button>Apply</button>} />,
    );
    expect(screen.getByText('Apply')).toBeTruthy();
  });

  it('does not render footer when not provided', () => {
    const { container } = render(<WorkflowEditorModalFrame {...defaultProps} />);
    expect(container.querySelector('.wf-config-modal-footer')).toBeNull();
  });

  it('renders header actions', () => {
    render(
      <WorkflowEditorModalFrame {...defaultProps} headerActions={<button>Settings</button>} />,
    );
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('hides expand buttons when hideExpandButton=true', () => {
    render(
      <WorkflowEditorModalFrame {...defaultProps} hideExpandButton footer={<button>OK</button>} />,
    );
    expect(screen.queryByTestId('expand-btn-header')).toBeNull();
    expect(screen.queryByTestId('expand-btn-footer')).toBeNull();
  });

  it('shows both expand buttons when hideExpandButton is false', () => {
    render(
      <WorkflowEditorModalFrame {...defaultProps} footer={<button>OK</button>} />,
    );
    expect(screen.getByTestId('expand-btn-header')).toBeTruthy();
    expect(screen.getByTestId('expand-btn-footer')).toBeTruthy();
  });

  it('hides close button when hideCloseButton=true', () => {
    render(<WorkflowEditorModalFrame {...defaultProps} hideCloseButton />);
    expect(screen.queryByLabelText('Close')).toBeNull();
  });

  it('uses scrollable body by default', () => {
    render(<WorkflowEditorModalFrame {...defaultProps} />);
    expect(screen.getByTestId('scroll-body')).toBeTruthy();
  });

  it('uses non-scrollable body when bodyScrollable=false', () => {
    render(<WorkflowEditorModalFrame {...defaultProps} bodyScrollable={false} />);
    expect(screen.queryByTestId('scroll-body')).toBeNull();
    expect(screen.getByTestId('body-content')).toBeTruthy();
  });

  it('applies custom overlay and dialog class names', () => {
    const { container } = render(
      <WorkflowEditorModalFrame {...defaultProps} overlayClassName="custom-overlay" dialogClassName="custom-dialog" />,
    );
    expect(container.querySelector('.custom-overlay')).toBeTruthy();
    expect(container.querySelector('.custom-dialog')).toBeTruthy();
  });

  it('applies custom footer class name', () => {
    const { container } = render(
      <WorkflowEditorModalFrame {...defaultProps} footerClassName="custom-footer" footer={<button>OK</button>} />,
    );
    expect(container.querySelector('.custom-footer')).toBeTruthy();
  });

  it('applies custom body class name', () => {
    render(
      <WorkflowEditorModalFrame {...defaultProps} bodyClassName="extra-body" />,
    );
    const scrollBody = screen.getByTestId('scroll-body');
    expect(scrollBody.className).toContain('extra-body');
    expect(scrollBody.className).toContain('wf-config-modal-body');
  });

  it('applies custom header class name', () => {
    const { container } = render(
      <WorkflowEditorModalFrame {...defaultProps} headerClassName="settings-header" />,
    );
    expect(container.querySelector('.settings-header')).toBeTruthy();
    expect(container.querySelector('.ram-header')).toBeTruthy();
  });

  it('uses custom closeAriaLabel', () => {
    render(<WorkflowEditorModalFrame {...defaultProps} hideCloseButton={false} closeAriaLabel="Dismiss" />);
    expect(screen.getByLabelText('Dismiss')).toBeTruthy();
  });

  it('stops propagation on dialog click', () => {
    const { container } = render(<WorkflowEditorModalFrame {...defaultProps} />);
    const dialog = container.querySelector('[role="dialog"]')!;
    const stopProp = vi.fn();
    dialog.addEventListener('click', stopProp);
    // Click dialog; it should call stopPropagation (tested implicitly via event reaching overlay)
    fireEvent.click(dialog);
    // onClose should NOT be called (overlay click handler not triggered)
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders resize handles', () => {
    render(<WorkflowEditorModalFrame {...defaultProps} />);
    expect(screen.getByTestId('resize-handles')).toBeTruthy();
  });

  it('sets aria-labelledby when titleId provided', () => {
    const { container } = render(
      <WorkflowEditorModalFrame {...defaultProps} titleId="my-title" />,
    );
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe('my-title');
  });

  it('forceExpanded calls setExpanded', async () => {
    const { useModalFrame } = await import('../../../../shared/hooks/useModalFrame');
    const mockSetExpanded = vi.fn();
    (useModalFrame as ReturnType<typeof vi.fn>).mockReturnValue({
      expanded: false,
      setExpanded: mockSetExpanded,
      toggleExpand: vi.fn(),
      expandClass: '',
      overlayStyle: {},
      dialogStyle: {},
      headerDragStyle: {},
      onHeaderMouseDown: vi.fn(),
      onRightEdge: vi.fn(),
      onCorner: vi.fn(),
    });
    render(<WorkflowEditorModalFrame {...defaultProps} forceExpanded />);
    expect(mockSetExpanded).toHaveBeenCalledWith(true);
  });

  it('renders toolbar between header and scroll body', () => {
    const { container } = render(
      <WorkflowEditorModalFrame
        {...defaultProps}
        toolbar={<div data-testid="fixed-tabs">Tabs</div>}
      />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    const toolbar = container.querySelector('.wf-config-modal-toolbar');
    expect(toolbar).toBeTruthy();
    expect(toolbar?.querySelector('[data-testid="fixed-tabs"]')).toBeTruthy();
    const html = dialog?.innerHTML ?? '';
    expect(html.indexOf('ram-header')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('wf-config-modal-toolbar')).toBeGreaterThan(html.indexOf('ram-header'));
    expect(html.indexOf('scroll-body')).toBeGreaterThan(html.indexOf('wf-config-modal-toolbar'));
  });
});
