/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { DefinitionVersionDiffModal } from './DefinitionVersionDiffModal';

const tabs = [
  { id: 'nodes', label: 'Nodes', count: 3 },
  { id: 'edges', label: 'Edges', count: 0 },
  { id: 'vars', label: 'Variables', count: 1 },
];

const defaultProps = {
  title: 'Version Comparison',
  olderLabel: 'v1.0',
  newerLabel: 'v2.0',
  onClose: vi.fn(),
  tabs,
  activeTab: 'nodes',
  onTabChange: vi.fn(),
};

describe('DefinitionVersionDiffModal', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('renders title, range labels (olderLabel → newerLabel)', () => {
    render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    expect(screen.getByRole('heading', { name: 'Version Comparison' })).toBeTruthy();
    expect(screen.getByText('v1.0 → v2.0')).toBeTruthy();
  });

  it('renders tabs with labels and count badges', () => {
    render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    const nodesTab = screen.getByRole('button', { name: /Nodes/ });
    expect(nodesTab.querySelector('.test-def-diff-tab-count')?.textContent).toBe('3');

    const varsTab = screen.getByRole('button', { name: /Variables/ });
    expect(varsTab.querySelector('.test-def-diff-tab-count')?.textContent).toBe('1');
  });

  it('tab with count=0 does not show badge', () => {
    render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    const edgesTab = screen.getByRole('button', { name: 'Edges' });
    expect(edgesTab.querySelector('.test-def-diff-tab-count')).toBeNull();
  });

  it("active tab has 'active' class", () => {
    render(
      <DefinitionVersionDiffModal {...defaultProps} activeTab="vars">
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    const activeTab = screen.getByRole('button', { name: /Variables/ });
    expect(activeTab.className).toContain('active');

    const inactiveTab = screen.getByRole('button', { name: /Nodes/ });
    expect(inactiveTab.className).not.toContain(' active');
  });

  it('clicking tab calls onTabChange', () => {
    const onTabChange = vi.fn();
    render(
      <DefinitionVersionDiffModal {...defaultProps} onTabChange={onTabChange}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Variables/ }));
    expect(onTabChange).toHaveBeenCalledWith('vars');
  });

  it('clicking overlay calls onClose', () => {
    const onClose = vi.fn();
    render(
      <DefinitionVersionDiffModal {...defaultProps} onClose={onClose}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.click(document.querySelector('.test-def-diff-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking modal content does NOT call onClose (stopPropagation)', () => {
    const onClose = vi.fn();
    render(
      <DefinitionVersionDiffModal {...defaultProps} onClose={onClose}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.click(document.querySelector('.test-def-diff-modal')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('footer Close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <DefinitionVersionDiffModal {...defaultProps} onClose={onClose}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key calls onClose', () => {
    const onClose = vi.fn();
    render(
      <DefinitionVersionDiffModal {...defaultProps} onClose={onClose}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders resize handles and a draggable header', () => {
    const { container } = render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    expect(container.querySelectorAll('.test-def-diff-resize').length).toBe(8);
    const header = container.querySelector('.test-def-diff-header')!;
    fireEvent.mouseDown(header, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 40, clientY: 30 });
    fireEvent.mouseUp(window);
    const modal = container.querySelector('.test-def-diff-modal') as HTMLElement;
    expect(modal.style.left).not.toBe('');
    expect(modal.style.top).not.toBe('');
  });

  it('renders children in body', () => {
    render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <p data-testid="child-content">Diff details here</p>
      </DefinitionVersionDiffModal>,
    );

    expect(screen.getByTestId('child-content')).toBeTruthy();
    expect(screen.getByText('Diff details here').closest('.test-def-diff-body')).toBeTruthy();
  });

  it('custom className prefix applies to all elements', () => {
    const { container } = render(
      <DefinitionVersionDiffModal {...defaultProps} className="custom-diff">
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    expect(container.querySelector('.custom-diff-overlay')).toBeTruthy();
    expect(container.querySelector('.custom-diff-modal')).toBeTruthy();
    expect(container.querySelector('.custom-diff-header')).toBeTruthy();
    expect(container.querySelector('.custom-diff-range')).toBeTruthy();
    expect(container.querySelector('.custom-diff-tabs')).toBeTruthy();
    expect(container.querySelector('.custom-diff-tab')).toBeTruthy();
    expect(container.querySelector('.custom-diff-tab-count')).toBeTruthy();
    expect(container.querySelector('.custom-diff-body')).toBeTruthy();
  });

  it('header drag starts from the modal header', () => {
    const { container } = render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    const modal = container.querySelector('.test-def-diff-modal') as HTMLElement;
    const initialLeft = modal.style.left;
    fireEvent.mouseDown(container.querySelector('.test-def-diff-header')!, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 80, clientY: 50 });
    fireEvent.mouseUp(window);
    expect(modal.style.left).not.toBe(initialLeft);
  });

  it('resizes east and south-east handles', () => {
    const { container } = render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    const modal = container.querySelector('.test-def-diff-modal') as HTMLElement;
    const startWidth = parseInt(modal.style.width, 10);
    const startHeight = parseInt(modal.style.height, 10);

    fireEvent.mouseDown(container.querySelector('.test-def-diff-resize-e')!, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 160, clientY: 100 });
    fireEvent.mouseUp(window);
    expect(parseInt(modal.style.width, 10)).toBeGreaterThan(startWidth);

    fireEvent.mouseDown(container.querySelector('.test-def-diff-resize-se')!, { clientX: 160, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 200, clientY: 150 });
    fireEvent.mouseUp(window);
    expect(parseInt(modal.style.height, 10)).toBeGreaterThan(startHeight);
  });

  it('resizes west and north handles with min clamps and cleans body cursor on unmount', () => {
    const { container, unmount } = render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    const modal = container.querySelector('.test-def-diff-modal') as HTMLElement;
    const startLeft = parseInt(modal.style.left, 10);
    const startTop = parseInt(modal.style.top, 10);

    fireEvent.mouseDown(container.querySelector('.test-def-diff-resize-w')!, { clientX: 200, clientY: 120 });
    fireEvent.mouseMove(window, { clientX: 400, clientY: 120 });
    fireEvent.mouseUp(window);
    expect(parseInt(modal.style.width, 10)).toBeGreaterThanOrEqual(520);
    expect(parseInt(modal.style.left, 10)).toBeGreaterThanOrEqual(startLeft);

    fireEvent.mouseDown(container.querySelector('.test-def-diff-resize-n')!, { clientX: 220, clientY: 160 });
    fireEvent.mouseMove(window, { clientX: 220, clientY: 500 });
    fireEvent.mouseUp(window);
    expect(parseInt(modal.style.height, 10)).toBeGreaterThanOrEqual(360);
    expect(parseInt(modal.style.top, 10)).toBeGreaterThanOrEqual(startTop);

    fireEvent.mouseDown(container.querySelector('.test-def-diff-resize-ne')!, { clientX: 220, clientY: 160 });
    expect(document.body.style.cursor).toBe('nesw-resize');
    unmount();
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('clamps shrinking from east and south without west/north reposition branches', () => {
    const { container } = render(
      <DefinitionVersionDiffModal {...defaultProps}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    const modal = container.querySelector('.test-def-diff-modal') as HTMLElement;

    fireEvent.mouseDown(container.querySelector('.test-def-diff-resize-e')!, { clientX: 300, clientY: 120 });
    fireEvent.mouseMove(window, { clientX: -200, clientY: 120 });
    fireEvent.mouseUp(window);
    expect(parseInt(modal.style.width, 10)).toBeGreaterThanOrEqual(520);

    fireEvent.mouseDown(container.querySelector('.test-def-diff-resize-s')!, { clientX: 220, clientY: 300 });
    fireEvent.mouseMove(window, { clientX: 220, clientY: -200 });
    fireEvent.mouseUp(window);
    expect(parseInt(modal.style.height, 10)).toBeGreaterThanOrEqual(360);
  });

  it('overlay click only closes when the overlay itself is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <DefinitionVersionDiffModal {...defaultProps} onClose={onClose}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.click(container.querySelector('.test-def-diff-tabs')!);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('.test-def-diff-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores non-Escape keys and overlay handler skips child targets', () => {
    const onClose = vi.fn();
    const { container } = render(
      <DefinitionVersionDiffModal {...defaultProps} onClose={onClose}>
        <div>Body</div>
      </DefinitionVersionDiffModal>,
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();

    const overlay = container.querySelector('.test-def-diff-overlay')!;
    const modal = container.querySelector('.test-def-diff-modal')!;
    const click = createEvent.click(overlay);
    Object.defineProperty(click, 'target', { value: modal });
    fireEvent(overlay, click);
    expect(onClose).not.toHaveBeenCalled();
  });
});
