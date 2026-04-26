/** @vitest-environment jsdom */
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ModalResizeHandles from './ModalResizeHandles';

describe('ModalResizeHandles', () => {
  it('renders right edge and corner handles', () => {
    const { container } = render(
      <ModalResizeHandles onRightEdge={vi.fn()} onCorner={vi.fn()} />
    );
    expect(container.querySelector('.modal-resize-edge-right')).toBeTruthy();
    expect(container.querySelector('.modal-resize-corner')).toBeTruthy();
  });

  it('handles are aria-hidden', () => {
    const { container } = render(
      <ModalResizeHandles onRightEdge={vi.fn()} onCorner={vi.fn()} />
    );
    const edge = container.querySelector('.modal-resize-edge-right');
    const corner = container.querySelector('.modal-resize-corner');
    expect(edge?.getAttribute('aria-hidden')).toBe('true');
    expect(corner?.getAttribute('aria-hidden')).toBe('true');
  });

  it('calls onRightEdge on right edge mousedown', () => {
    const onRightEdge = vi.fn();
    const { container } = render(
      <ModalResizeHandles onRightEdge={onRightEdge} onCorner={vi.fn()} />
    );
    const edge = container.querySelector('.modal-resize-edge-right')!;
    edge.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onRightEdge).toHaveBeenCalledTimes(1);
  });

  it('calls onCorner on corner mousedown', () => {
    const onCorner = vi.fn();
    const { container } = render(
      <ModalResizeHandles onRightEdge={vi.fn()} onCorner={onCorner} />
    );
    const corner = container.querySelector('.modal-resize-corner')!;
    corner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onCorner).toHaveBeenCalledTimes(1);
  });
});
