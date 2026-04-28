import { useCallback, useRef } from 'react';

/**
 * Reusable hook for horizontal splitter drag resizing.
 * Returns a mouseDown handler to attach to the splitter element.
 */
export function useSplitterDrag(
  currentWidth: number,
  setWidth: (w: number) => void,
  min: number,
  max: number,
  /** Direction of drag relative to width growth. 'left' = dragging left increases width. */
  direction: 'left' | 'right' = 'left',
): (e: React.MouseEvent) => void {
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  return useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: currentWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = direction === 'left'
        ? dragRef.current.startX - ev.clientX
        : ev.clientX - dragRef.current.startX;
      const newW = Math.max(min, Math.min(max, dragRef.current.startW + delta));
      setWidth(newW);
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [currentWidth, setWidth, min, max, direction]);
}
