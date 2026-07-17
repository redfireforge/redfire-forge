import { useCallback, useRef, useState } from 'react';

export function useDraggableModal() {
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const [size, setSize] = useState({ width: 520, height: 460 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, dx: 0, dy: 0 });

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, dx: offset.dx, dy: offset.dy };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setOffset({
        dx: dragStart.current.dx + ev.clientX - dragStart.current.mx,
        dy: dragStart.current.dy + ev.clientY - dragStart.current.my,
      });
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [offset]);

  return { offset, size, setSize, onHeaderMouseDown };
}
