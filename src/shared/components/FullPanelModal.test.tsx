/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FullPanelModal from './FullPanelModal';

vi.mock('../../features/workflow/components/modals/WorkflowEditorModalFrame', () => ({
  __esModule: true,
  default: ({ title, onClose, children, footer, overlayClassName, dialogClassName, bodyScrollable }: {
    title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
    overlayClassName?: string; dialogClassName?: string; bodyScrollable?: boolean;
  }) => (
    <div data-testid="wf-modal-frame" data-overlay={overlayClassName} data-dialog={dialogClassName} data-scrollable={String(bodyScrollable)}>
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-body">{children}</div>
      {footer && <div data-testid="modal-footer">{footer}</div>}
    </div>
  ),
}));

describe('FullPanelModal', () => {
  const onClose = vi.fn();

  beforeEach(() => { onClose.mockClear(); });

  it('renders title and children', () => {
    render(
      <FullPanelModal title="Panel Title" onClose={onClose}>
        <p>Panel content</p>
      </FullPanelModal>,
    );
    expect(screen.getByTestId('modal-title').textContent).toContain('Panel Title');
    screen.getByText('Panel content');
  });

  it('passes full-panel-overlay and full-panel-modal classes', () => {
    render(<FullPanelModal title="T" onClose={onClose}>C</FullPanelModal>);
    const frame = screen.getByTestId('wf-modal-frame');
    expect(frame.dataset.overlay).toContain('full-panel-overlay');
    expect(frame.dataset.dialog).toContain('full-panel-modal');
    expect(frame.dataset.dialog).toContain('modal-no-chrome');
  });

  it('appends extra overlay and dialog class names', () => {
    render(
      <FullPanelModal title="T" onClose={onClose} overlayClassName="extra-o" dialogClassName="extra-d">
        C
      </FullPanelModal>,
    );
    const frame = screen.getByTestId('wf-modal-frame');
    expect(frame.dataset.overlay).toContain('extra-o');
    expect(frame.dataset.dialog).toContain('extra-d');
  });

  it('renders default Close footer when footer prop is omitted', () => {
    render(<FullPanelModal title="T" onClose={onClose}>C</FullPanelModal>);
    const closeBtn = screen.getByText('Close');
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders custom footer when provided', () => {
    render(
      <FullPanelModal title="T" onClose={onClose} footer={<button>Save</button>}>
        C
      </FullPanelModal>,
    );
    screen.getByText('Save');
    expect(screen.queryByText('Close')).toBeNull();
  });

  it('renders no footer when footer is null', () => {
    render(<FullPanelModal title="T" onClose={onClose} footer={null}>C</FullPanelModal>);
    expect(screen.queryByTestId('modal-footer')).toBeNull();
  });

  it('defaults bodyScrollable to true', () => {
    render(<FullPanelModal title="T" onClose={onClose}>C</FullPanelModal>);
    expect(screen.getByTestId('wf-modal-frame').dataset.scrollable).toBe('true');
  });

  it('passes bodyScrollable=false', () => {
    render(<FullPanelModal title="T" onClose={onClose} bodyScrollable={false}>C</FullPanelModal>);
    expect(screen.getByTestId('wf-modal-frame').dataset.scrollable).toBe('false');
  });
});
