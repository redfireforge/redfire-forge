/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AppModalFrame from './AppModalFrame';

const toggleExpand = vi.fn();

vi.mock('../hooks/useModalFrame', () => ({
  useModalFrame: () => ({
    expanded: false,
    toggleExpand,
    expandClass: '',
    overlayStyle: undefined,
    dialogStyle: {},
    headerDragStyle: { cursor: 'move' },
    onHeaderMouseDown: vi.fn(),
    onRightEdge: vi.fn(),
    onCorner: vi.fn(),
  }),
}));

describe('AppModalFrame', () => {
  beforeEach(() => {
    toggleExpand.mockClear();
  });

  it('returns null when open is false', () => {
    const { container } = render(
      <AppModalFrame open={false} title="T" onClose={vi.fn()}>X</AppModalFrame>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a text close button and calls onClose', () => {
    const onClose = vi.fn();
    render(
      <AppModalFrame
        title="Modal"
        onClose={onClose}
        closeButtonKind="text"
        closeButtonText="Dismiss"
      >
        Body
      </AppModalFrame>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('omits close control when closeButtonKind is none', () => {
    render(
      <AppModalFrame title="T" onClose={vi.fn()} closeButtonKind="none">
        B
      </AppModalFrame>,
    );
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
    expect(screen.queryByLabelText('Close')).toBeNull();
  });

  it('closes when the overlay is clicked and closeOnOverlayClick is true', () => {
    const onClose = vi.fn();
    render(<AppModalFrame title="T" onClose={onClose}>B</AppModalFrame>);
    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close overlay click when closeOnOverlayClick is false', () => {
    const onClose = vi.fn();
    render(
      <AppModalFrame title="T" onClose={onClose} closeOnOverlayClick={false}>
        B
      </AppModalFrame>,
    );
    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when the dialog surface is clicked', () => {
    const onClose = vi.fn();
    render(<AppModalFrame title="T" onClose={onClose}>B</AppModalFrame>);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders string title in an h3', () => {
    render(<AppModalFrame title="Plain" onClose={vi.fn()} titleClassName="ttl">B</AppModalFrame>);
    const h3 = screen.getByRole('heading', { level: 3, name: 'Plain' });
    expect(h3).toHaveClass('ttl');
  });

  it('renders non-string title in a div', () => {
    render(
      <AppModalFrame title={<span data-testid="rich">Rich</span>} onClose={vi.fn()} titleClassName="ttl">
        B
      </AppModalFrame>,
    );
    const wrap = screen.getByTestId('rich').parentElement;
    expect(wrap?.tagName.toLowerCase()).toBe('div');
    expect(wrap).toHaveClass('ttl');
  });

  it('applies closeButtonClassName to the text close button', () => {
    render(
      <AppModalFrame
        title="T"
        onClose={vi.fn()}
        closeButtonKind="text"
        closeButtonText="X"
        closeButtonClassName="extra-close"
      >
        B
      </AppModalFrame>,
    );
    expect(screen.getByRole('button', { name: 'X' })).toHaveClass('btn', 'btn-sm', 'extra-close');
  });

  it('applies closeButtonClassName to the icon close button', () => {
    render(
      <AppModalFrame title="T" onClose={vi.fn()} closeButtonClassName="icon-extra">
        B
      </AppModalFrame>,
    );
    expect(screen.getByLabelText('Close')).toHaveClass('ram-modal-close', 'icon-extra');
  });

  it('omits drag styles on the header when disableDrag is true', () => {
    render(<AppModalFrame title="T" onClose={vi.fn()} disableDrag>B</AppModalFrame>);
    const header = screen.getByRole('dialog').querySelector('.modal-header');
    expect(header).toBeTruthy();
    expect(header).not.toHaveStyle({ cursor: 'move' });
  });

  it('omits expand controls when showExpandButton is false', () => {
    render(<AppModalFrame title="T" onClose={vi.fn()} showExpandButton={false}>B</AppModalFrame>);
    expect(screen.queryByLabelText('Expand modal')).toBeNull();
  });

  it('omits resize handles when showResizeHandles is false', () => {
    render(<AppModalFrame title="T" onClose={vi.fn()} showResizeHandles={false}>B</AppModalFrame>);
    expect(screen.queryByRole('dialog')?.querySelector('.modal-resize-edge-right')).toBeNull();
  });

  it('renders footer from footer prop when footerContent is not provided', () => {
    render(
      <AppModalFrame title="T" onClose={vi.fn()} footer={<span data-testid="ft">F</span>}>
        B
      </AppModalFrame>,
    );
    expect(screen.getByTestId('ft')).toBeTruthy();
  });

  it('prefers footerContent over footer when both are provided', () => {
    render(
      <AppModalFrame
        title="T"
        onClose={vi.fn()}
        footer={<span data-testid="ft-plain">plain</span>}
        footerContent={() => <span data-testid="ft-fn">fn</span>}
      >
        B
      </AppModalFrame>,
    );
    expect(screen.getByTestId('ft-fn')).toBeTruthy();
    expect(screen.queryByTestId('ft-plain')).toBeNull();
  });

  it('renders custom header from headerContent', () => {
    render(
      <AppModalFrame
        title="ignored"
        onClose={vi.fn()}
        headerContent={() => <div data-testid="hdr">Custom</div>}
      >
        B
      </AppModalFrame>,
    );
    expect(screen.getByTestId('hdr')).toHaveTextContent('Custom');
    expect(screen.queryByRole('heading', { name: 'ignored' })).toBeNull();
  });

  it('passes toggleExpand through footerContent state', () => {
    render(
      <AppModalFrame
        title="T"
        onClose={vi.fn()}
        footerContent={({ toggleExpand: te }) => (
          <button type="button" onClick={te}>toggle</button>
        )}
      >
        B
      </AppModalFrame>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(toggleExpand).toHaveBeenCalledTimes(1);
  });

  it('merges overlay and dialog class names', () => {
    render(
      <AppModalFrame
        title="T"
        onClose={vi.fn()}
        overlayClassName="ov-extra"
        dialogClassName="dlg-extra"
      >
        B
      </AppModalFrame>,
    );
    const overlay = screen.getByRole('presentation');
    expect(overlay.className).toMatch(/modal-overlay/);
    expect(overlay.className).toMatch(/ov-extra/);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/modal/);
    expect(dialog.className).toMatch(/dlg-extra/);
  });

  it('applies bodyClassName and bodyStyle to the body region', () => {
    render(
      <AppModalFrame
        title="T"
        onClose={vi.fn()}
        bodyClassName="body-c"
        bodyStyle={{ padding: 8 }}
      >
        Inner
      </AppModalFrame>,
    );
    const dialog = screen.getByRole('dialog');
    const body = within(dialog).getByText('Inner');
    expect(body).toHaveClass('body-c');
    expect(body).toHaveStyle({ padding: '8px' });
  });
});
