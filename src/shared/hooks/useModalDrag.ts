import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Shared drag-to-move hook for modal dialogs.
 * Attach `onMouseDown={onDragStart}` to the header and spread
 * `overlayStyle` / `modalStyle` onto the overlay and modal `<div>`s.
 */
export function useModalDrag(open: boolean) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const updateDragPosition = useCallback((clientX: number, clientY: number) => {
    if (!dragState.current) return;
    setDragPos({
      x: dragState.current.origX + (clientX - dragState.current.startX),
      y: dragState.current.origY + (clientY - dragState.current.startY),
    });
  }, []);

  const endDrag = useCallback((handleMove: (ev: MouseEvent) => void, handleUp: () => void) => {
    dragState.current = null;
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);
  }, []);

  const startDrag = useCallback((
    e: { target: EventTarget | null; currentTarget: EventTarget & Element; preventDefault: () => void },
    clientX: number,
    clientY: number,
  ) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    e.preventDefault();
    const modal = (e.currentTarget as HTMLElement).closest('[role="dialog"]') as HTMLElement;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    const origX = dragPos?.x ?? rect.left;
    const origY = dragPos?.y ?? rect.top;
    dragState.current = { startX: clientX, startY: clientY, origX, origY };

    const handleMove = (ev: MouseEvent) => updateDragPosition(ev.clientX, ev.clientY);
    const handleUp = () => endDrag(handleMove, handleUp);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [dragPos, updateDragPosition, endDrag]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    startDrag(e, e.clientX, e.clientY);
  }, [startDrag]);

  const onPointerDragStart = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startDrag(e, e.clientX, e.clientY);

    const handlePointerMove = (ev: PointerEvent) => updateDragPosition(ev.clientX, ev.clientY);
    const handlePointerUp = () => {
      dragState.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [startDrag, updateDragPosition]);

  // Reset when modal opens/closes
  useEffect(() => { setDragPos(null); }, [open]);  

  const isDragged = dragPos !== null;

  const overlayStyle: React.CSSProperties | undefined = isDragged
    ? { background: 'transparent', backdropFilter: 'none', pointerEvents: 'none' }
    : undefined;

  const modalStyle: React.CSSProperties | undefined = isDragged
    ? { position: 'fixed', left: dragPos.x, top: dragPos.y, margin: 0, pointerEvents: 'auto' }
    : undefined;

  return { onDragStart, onPointerDragStart, isDragged, overlayStyle, modalStyle };
}
