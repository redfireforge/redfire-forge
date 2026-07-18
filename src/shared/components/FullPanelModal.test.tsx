/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FullPanelModal from './FullPanelModal';

describe('FullPanelModal', () => {
  const onClose = vi.fn();

  beforeEach(() => { onClose.mockClear(); });

  it('renders title and children', () => {
    render(
      <FullPanelModal title="Panel Title" onClose={onClose}>
        <p>Panel content</p>
      </FullPanelModal>,
    );
    expect(screen.getByText('Panel Title')).toBeTruthy();
    screen.getByText('Panel content');
  });

  it('applies full-panel-overlay and full-panel-modal classes', () => {
    const { container } = render(<FullPanelModal title="T" onClose={onClose}>C</FullPanelModal>);
    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.className).toContain('full-panel-overlay');
    const dialog = overlay.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.className).toContain('full-panel-modal');
  });

  it('header is not draggable', () => {
    const { container } = render(<FullPanelModal title="T" onClose={onClose}>C</FullPanelModal>);
    const header = container.querySelector('.ram-header') as HTMLElement;
    expect(header.style.cursor).toBe('default');
  });

  it('appends extra overlay and dialog class names', () => {
    const { container } = render(
      <FullPanelModal title="T" onClose={onClose} overlayClassName="extra-o" dialogClassName="extra-d">
        C
      </FullPanelModal>,
    );
    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.className).toContain('extra-o');
    const dialog = overlay.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.className).toContain('extra-d');
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
    const { container } = render(<FullPanelModal title="T" onClose={onClose} footer={null}>C</FullPanelModal>);
    expect(container.querySelector('.wf-config-modal-footer')).toBeNull();
  });

  it('uses scrollable body by default', () => {
    const { container } = render(<FullPanelModal title="T" onClose={onClose}>C</FullPanelModal>);
    expect(container.querySelector('.wf-modal-scroll-shell')).toBeTruthy();
  });

  it('uses plain body when bodyScrollable=false', () => {
    const { container } = render(<FullPanelModal title="T" onClose={onClose} bodyScrollable={false}>C</FullPanelModal>);
    expect(container.querySelector('.wf-modal-scroll-shell')).toBeNull();
    expect(container.querySelector('.wf-config-modal-body')).toBeTruthy();
  });

  it('enables drag and resize handlers when movable and resizable are true', () => {
    const { container } = render(
      <FullPanelModal title="T" onClose={onClose} movable resizable>
        C
      </FullPanelModal>,
    );
    const header = container.querySelector('.ram-header') as HTMLElement;
    expect(header.style.cursor).not.toBe('default');

    fireEvent.mouseDown(header);
    fireEvent.pointerDown(header);

    expect(container.querySelector('.modal-resize-edge-right')).toBeTruthy();
    expect(container.querySelector('.modal-resize-edge-bottom')).toBeTruthy();
    expect(container.querySelector('.modal-resize-corner')).toBeTruthy();
  });
});
