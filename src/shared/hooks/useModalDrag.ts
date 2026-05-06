import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Shared drag-to-move hook for modal dialogs.
 * Attach `onMouseDown={onDragStart}` to the header and spread
 * `overlayStyle` / `modalStyle` onto the overlay and modal `<div>`s.
 */
export function useModalDrag(open: boolean) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    e.preventDefault();
    const modal = (e.currentTarget as HTMLElement).closest('[role="dialog"]') as HTMLElement;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    const origX = dragPos?.x ?? rect.left;
    const origY = dragPos?.y ?? rect.top;
    dragState.current = { startX: e.clientX, startY: e.clientY, origX, origY };
    const handleMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      setDragPos({
        x: dragState.current.origX + (ev.clientX - dragState.current.startX),
        y: dragState.current.origY + (ev.clientY - dragState.current.startY),
      });
    };
    const handleUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [dragPos]);

  // Reset when modal opens/closes
  useEffect(() => { setDragPos(null); }, [open]);  

  const isDragged = dragPos !== null;

  const overlayStyle: React.CSSProperties | undefined = isDragged
    ? { background: 'transparent', backdropFilter: 'none', pointerEvents: 'none' }
    : undefined;

  const modalStyle: React.CSSProperties | undefined = isDragged
    ? { position: 'fixed', left: dragPos.x, top: dragPos.y, margin: 0, pointerEvents: 'auto' }
    : undefined;

  return { onDragStart, isDragged, overlayStyle, modalStyle };
}
