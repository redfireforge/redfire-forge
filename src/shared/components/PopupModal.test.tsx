/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PopupModal from './PopupModal';

vi.mock('./AppModalFrame', () => ({
  __esModule: true,
  default: ({ title, onClose, children, footer, overlayClassName, dialogClassName, footerClassName, closeButtonKind }: {
    title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
    overlayClassName?: string; dialogClassName?: string; footerClassName?: string; closeButtonKind?: string;
  }) => (
    <div data-testid="app-modal-frame" data-overlay={overlayClassName} data-dialog={dialogClassName} data-footer={footerClassName} data-close-kind={closeButtonKind}>
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-body">{children}</div>
      {footer && <div data-testid="modal-footer">{footer}</div>}
    </div>
  ),
}));

describe('PopupModal', () => {
  const onClose = vi.fn();

  beforeEach(() => { onClose.mockClear(); });

  it('renders title and children', () => {
    render(
      <PopupModal title="Test Title" onClose={onClose}>
        <p>Body content</p>
      </PopupModal>,
    );
    expect(screen.getByTestId('modal-title').textContent).toContain('Test Title');
    screen.getByText('Body content');
  });

  it('passes popup-modal-overlay and popup-modal classes', () => {
    render(<PopupModal title="T" onClose={onClose}>Content</PopupModal>);
    const frame = screen.getByTestId('app-modal-frame');
    expect(frame.dataset.overlay).toContain('popup-modal-overlay');
    expect(frame.dataset.dialog).toContain('popup-modal');
    expect(frame.dataset.dialog).toContain('modal-no-chrome');
    expect(frame.dataset.footer).toContain('popup-modal-footer');
    expect(frame.dataset.closeKind).toBe('none');
  });

  it('appends extra overlay/dialog/footer class names', () => {
    render(
      <PopupModal title="T" onClose={onClose} overlayClassName="extra-overlay" dialogClassName="extra-dialog" footerClassName="extra-footer">
        Content
      </PopupModal>,
    );
    const frame = screen.getByTestId('app-modal-frame');
    expect(frame.dataset.overlay).toContain('extra-overlay');
    expect(frame.dataset.dialog).toContain('extra-dialog');
    expect(frame.dataset.footer).toContain('extra-footer');
  });

  it('renders default Cancel footer when footer prop is omitted', () => {
    render(<PopupModal title="T" onClose={onClose}>Content</PopupModal>);
    const cancelBtn = screen.getByText('Cancel');
    expect(cancelBtn).toBeTruthy();
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders custom footer when provided', () => {
    render(
      <PopupModal title="T" onClose={onClose} footer={<button>Save</button>}>
        Content
      </PopupModal>,
    );
    screen.getByText('Save');
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('renders no footer when footer is null', () => {
    render(<PopupModal title="T" onClose={onClose} footer={null}>Content</PopupModal>);
    expect(screen.queryByTestId('modal-footer')).toBeNull();
  });
});
