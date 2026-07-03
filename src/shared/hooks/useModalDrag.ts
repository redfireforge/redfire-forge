import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  type RefObject,
} from 'react';

export interface ModalDragAnchor {
  selector: string;
  hAlign?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'center' | 'bottom';
  padding?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
}

export interface UseModalDragOptions {
  /** Optional region to place the modal when it opens (studio workspace, panel, etc.). */
  anchor?: ModalDragAnchor;
  modalRef?: RefObject<HTMLElement | null>;
}

function computeAnchoredPosition(
  anchor: ModalDragAnchor,
  anchorEl: Element,
  modalEl: HTMLElement,
): { x: number; y: number } {
  const anchorRect = anchorEl.getBoundingClientRect();
  const modalRect = modalEl.getBoundingClientRect();
  const pad = {
    top: anchor.padding?.top ?? 0,
    right: anchor.padding?.right ?? 0,
    bottom: anchor.padding?.bottom ?? 0,
    left: anchor.padding?.left ?? 0,
  };
  const hAlign = anchor.hAlign ?? 'center';
  const vAlign = anchor.vAlign ?? 'top';

  let x: number;
  if (hAlign === 'left') {
    x = anchorRect.left + pad.left;
  } else if (hAlign === 'right') {
    x = anchorRect.right - modalRect.width - pad.right;
  } else {
    x = anchorRect.left + (anchorRect.width - modalRect.width) / 2;
  }

  let y: number;
  if (vAlign === 'top') {
    y = anchorRect.top + pad.top;
  } else if (vAlign === 'bottom') {
    y = anchorRect.bottom - modalRect.height - pad.bottom;
  } else {
    y = anchorRect.top + (anchorRect.height - modalRect.height) / 2;
  }

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Shared drag-to-move hook for modal dialogs.
 * Attach `onMouseDown={onDragStart}` to the header and spread
 * `overlayStyle` / `modalStyle` onto the overlay and modal `<div>`s.
 */
export function useModalDrag(open: boolean, options?: UseModalDragOptions) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const updateDragPosition = useCallback((clientX: number, clientY: number) => {
    if (!dragState.current) return;
    setPosition({
      x: dragState.current.origX + (clientX - dragState.current.startX),
      y: dragState.current.origY + (clientY - dragState.current.startY),
    });
  }, []);

  const finishMouseDrag = useCallback((
    handleMove: (ev: MouseEvent) => void,
    handleUp: () => void,
  ) => {
    dragState.current = null;
    setIsDragging(false);
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);
  }, []);

  const finishPointerDrag = useCallback((
    handleMove: (ev: PointerEvent) => void,
    handleUp: () => void,
  ) => {
    dragState.current = null;
    setIsDragging(false);
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleUp);
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
    const origX = position?.x ?? rect.left;
    const origY = position?.y ?? rect.top;
    dragState.current = { startX: clientX, startY: clientY, origX, origY };
    setIsDragging(true);

    const handleMove = (ev: MouseEvent) => updateDragPosition(ev.clientX, ev.clientY);
    const handleUp = () => finishMouseDrag(handleMove, handleUp);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [position, updateDragPosition, finishMouseDrag]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    startDrag(e, e.clientX, e.clientY);
  }, [startDrag]);

  const onPointerDragStart = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startDrag(e, e.clientX, e.clientY);

    const handlePointerMove = (ev: PointerEvent) => updateDragPosition(ev.clientX, ev.clientY);
    const handlePointerUp = () => {
      finishPointerDrag(handlePointerMove, handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [startDrag, updateDragPosition, finishPointerDrag]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      setIsDragging(false);
    }
  }, [open]);

  const anchorSelector = options?.anchor?.selector;
  const anchorHAlign = options?.anchor?.hAlign ?? 'center';
  const anchorVAlign = options?.anchor?.vAlign ?? 'top';
  const anchorPadTop = options?.anchor?.padding?.top ?? 0;
  const anchorPadRight = options?.anchor?.padding?.right ?? 0;
  const anchorPadBottom = options?.anchor?.padding?.bottom ?? 0;
  const anchorPadLeft = options?.anchor?.padding?.left ?? 0;

  useLayoutEffect(() => {
    if (!open || !anchorSelector) return;
    const anchorEl = document.querySelector(anchorSelector);
    const modalEl = options?.modalRef?.current;
    if (!anchorEl || !modalEl) return;
    const anchor: ModalDragAnchor = {
      selector: anchorSelector,
      hAlign: anchorHAlign,
      vAlign: anchorVAlign,
      padding: {
        top: anchorPadTop,
        right: anchorPadRight,
        bottom: anchorPadBottom,
        left: anchorPadLeft,
      },
    };
    const next = computeAnchoredPosition(anchor, anchorEl, modalEl);
    setPosition((prev) => (
      prev?.x === next.x && prev?.y === next.y ? prev : next
    ));
  }, [
    open,
    anchorSelector,
    anchorHAlign,
    anchorVAlign,
    anchorPadTop,
    anchorPadRight,
    anchorPadBottom,
    anchorPadLeft,
    options?.modalRef,
  ]);

  const isDragged = position !== null;

  const overlayStyle: React.CSSProperties | undefined = isDragging
    ? { background: 'transparent', backdropFilter: 'none', pointerEvents: 'none' }
    : undefined;

  const modalStyle: React.CSSProperties | undefined = position
    ? { position: 'fixed', left: position.x, top: position.y, margin: 0, pointerEvents: 'auto' }
    : undefined;

  return { onDragStart, onPointerDragStart, isDragged, isDragging, overlayStyle, modalStyle };
}
