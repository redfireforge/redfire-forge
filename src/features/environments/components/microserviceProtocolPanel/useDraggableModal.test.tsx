/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDraggableModal } from './useDraggableModal';

function DragProbe() {
  const { offset, onHeaderMouseDown } = useDraggableModal();
  return (
    <div>
      <div data-testid="header" onMouseDown={onHeaderMouseDown}>header</div>
      <span data-testid="pos">{`${offset.dx},${offset.dy}`}</span>
    </div>
  );
}

describe('useDraggableModal', () => {
  it('updates position while dragging and ignores move events when not dragging', () => {
    render(<DragProbe />);
    const before = screen.getByTestId('pos').textContent;
    act(() => {
      fireEvent.mouseMove(document, { clientX: 500, clientY: 500 });
    });
    expect(screen.getByTestId('pos').textContent).toBe(before);

    fireEvent.mouseDown(screen.getByTestId('header'), { clientX: 100, clientY: 100 });
    act(() => {
      fireEvent.mouseMove(document, { clientX: 160, clientY: 140 });
    });
    expect(screen.getByTestId('pos').textContent).not.toBe(before);
    act(() => {
      fireEvent.mouseUp(document);
    });
  });

  it('ignores mousemove after drag ends via captured handler', () => {
    const moveHandlers: Array<(ev: MouseEvent) => void> = [];
    const origAdd = document.addEventListener.bind(document);
    const addSpy = vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'mousemove' && typeof listener === 'function') {
        moveHandlers.push(listener as (ev: MouseEvent) => void);
      }
      return origAdd(type, listener, options);
    });

    render(<DragProbe />);
    const before = screen.getByTestId('pos').textContent;

    fireEvent.mouseDown(screen.getByTestId('header'), { clientX: 100, clientY: 100 });
    const onMove = moveHandlers.at(-1);
    expect(onMove).toBeDefined();

    act(() => {
      fireEvent.mouseUp(document);
    });

    act(() => {
      onMove?.({ clientX: 200, clientY: 200 } as MouseEvent);
    });
    expect(screen.getByTestId('pos').textContent).toBe(before);

    addSpy.mockRestore();
  });
});
