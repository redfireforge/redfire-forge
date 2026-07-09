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
  xTarget?: 'box' | 'input-text-end';
  xTextFallback?: string;
  padding?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
}

export interface UseModalDragOptions {
  /** Optional region to place the modal when it opens (studio workspace, panel, etc.). */
  anchor?: ModalDragAnchor;
  modalRef?: RefObject<HTMLElement | null>;
  /** Keep dragged modal fully visible in viewport. */
  constrainToViewport?: boolean;
  /** Margin from viewport edges while constrained. */
  viewportPadding?: number;
}

type ResolvedModalDragAnchor = {
  selector: string;
  hAlign: 'left' | 'center' | 'right';
  vAlign: 'top' | 'center' | 'bottom';
  xTarget: 'box' | 'input-text-end';
  xTextFallback?: string;
  padding: Record<'top' | 'right' | 'bottom' | 'left', number>;
};

function computeAnchoredPosition(
  anchor: ResolvedModalDragAnchor,
  anchorEl: Element,
  modalEl: HTMLElement,
): { x: number; y: number } {
  const anchorRect = anchorEl.getBoundingClientRect();

  // Some dialogs need to align to the rendered text end inside an input,
  // not the full input box width.
  const resolveAnchorRight = () => {
    if (anchor.xTarget !== 'input-text-end' || !(anchorEl instanceof HTMLInputElement)) {
      return anchorRect.right;
    }
    const value = (anchorEl.value || anchor.xTextFallback || '').trim();
    if (!value) return anchorRect.right;
    const cs = window.getComputedStyle(anchorEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return anchorRect.right;
    ctx.font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const textWidth = ctx.measureText(value).width;
    const leftPad = parseFloat(cs.paddingLeft || '0');
    const leftBorder = parseFloat(cs.borderLeftWidth || '0');
    return anchorRect.left + leftBorder + leftPad + textWidth;
  };

  const resolvedRight = resolveAnchorRight();
  const resolvedWidth = Math.max(0, resolvedRight - anchorRect.left);
  const targetRect = {
    left: anchorRect.left,
    right: resolvedRight,
    top: anchorRect.top,
    bottom: anchorRect.bottom,
    width: resolvedWidth,
    height: anchorRect.height,
  };

  const modalRect = modalEl.getBoundingClientRect();
  const pad = anchor.padding;
  const hAlign = anchor.hAlign;
  const vAlign = anchor.vAlign;

  let x: number;
  if (hAlign === 'left') {
    x = targetRect.left + pad.left;
  } else if (hAlign === 'right') {
    x = targetRect.right - modalRect.width - pad.right;
  } else {
    x = targetRect.left + (targetRect.width - modalRect.width) / 2;
  }

  let y: number;
  if (vAlign === 'top') {
    y = targetRect.top + pad.top;
  } else if (vAlign === 'bottom') {
    y = targetRect.bottom - modalRect.height - pad.bottom;
  } else {
    y = targetRect.top + (targetRect.height - modalRect.height) / 2;
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
  const dragState = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    modalW: number;
    modalH: number;
  } | null>(null);
  // Lock the modal's rendered dimensions when drag first starts so that the
  // transition to `position: fixed` (which changes the CSS containing block)
  // cannot cause a layout-driven size change while the modal is being moved.
  const lockedSizeRef = useRef<{ w: number; h: number } | null>(null);
  const constrainToViewport = options?.constrainToViewport ?? false;
  const viewportPadding = options?.viewportPadding ?? 8;

  const updateDragPosition = useCallback((clientX: number, clientY: number) => {
    if (!dragState.current) return;
    const rawX = dragState.current.origX + (clientX - dragState.current.startX);
    const rawY = dragState.current.origY + (clientY - dragState.current.startY);

    if (!constrainToViewport) {
      setPosition({ x: rawX, y: rawY });
      return;
    }

    const maxX = Math.max(viewportPadding, window.innerWidth - dragState.current.modalW - viewportPadding);
    const maxY = Math.max(viewportPadding, window.innerHeight - dragState.current.modalH - viewportPadding);
    const x = Math.min(Math.max(rawX, viewportPadding), maxX);
    const y = Math.min(Math.max(rawY, viewportPadding), maxY);
    setPosition({ x, y });
  }, [constrainToViewport, viewportPadding]);

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
    const targetElement = e.target instanceof Element
      ? e.target
      : e.target instanceof Node
        ? e.target.parentElement
        : null;
    if (targetElement?.closest('button, input, select, textarea')) return;
    e.preventDefault();
    const modal = (e.currentTarget as HTMLElement).closest('[role="dialog"]') as HTMLElement;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    const origX = position?.x ?? rect.left;
    const origY = position?.y ?? rect.top;
    // Capture dimensions once on the very first drag so subsequent renders
    // with `position: fixed` always have an explicit width/height to hold.
    if (!lockedSizeRef.current) {
      lockedSizeRef.current = { w: rect.width, h: rect.height };
    }
    dragState.current = {
      startX: clientX,
      startY: clientY,
      origX,
      origY,
      modalW: lockedSizeRef.current.w,
      modalH: lockedSizeRef.current.h,
    };
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
      lockedSizeRef.current = null;
    }
  }, [open]);

  const anchorSelector = options?.anchor?.selector;
  const anchorHAlign = options?.anchor?.hAlign ?? 'center';
  const anchorVAlign = options?.anchor?.vAlign ?? 'top';
  const anchorXTarget = options?.anchor?.xTarget ?? 'box';
  const anchorXTextFallback = options?.anchor?.xTextFallback;
  const anchorPadTop = options?.anchor?.padding?.top ?? 0;
  const anchorPadRight = options?.anchor?.padding?.right ?? 0;
  const anchorPadBottom = options?.anchor?.padding?.bottom ?? 0;
  const anchorPadLeft = options?.anchor?.padding?.left ?? 0;

  useLayoutEffect(() => {
    if (!open || !anchorSelector) return;
    const anchorEl = document.querySelector(anchorSelector);
    const modalEl = options?.modalRef?.current;
    if (!anchorEl || !modalEl) return;
    const anchor: ResolvedModalDragAnchor = {
      selector: anchorSelector,
      hAlign: anchorHAlign,
      vAlign: anchorVAlign,
      xTarget: anchorXTarget,
      xTextFallback: anchorXTextFallback,
      padding: {
        top: anchorPadTop,
        right: anchorPadRight,
        bottom: anchorPadBottom,
        left: anchorPadLeft,
      },
    };
    const applyAnchor = () => {
      const next = computeAnchoredPosition(anchor, anchorEl, modalEl);
      setPosition((prev) => (
        prev?.x === next.x && prev?.y === next.y ? prev : next
      ));
    };

    applyAnchor();

    // Re-apply after layout settles because modal width can finalize a frame later.
    const rafId = window.requestAnimationFrame(() => {
      applyAnchor();
    });

    // Keep anchored placement stable when target/modal size changes.
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          applyAnchor();
        })
      : undefined;
    ro?.observe(modalEl);
    ro?.observe(anchorEl);

    const onWindowResize = () => applyAnchor();
    window.addEventListener('resize', onWindowResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [
    open,
    anchorSelector,
    anchorHAlign,
    anchorVAlign,
    anchorXTarget,
    anchorXTextFallback,
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

  const lockedW = lockedSizeRef.current?.w;
  const modalStyle: React.CSSProperties | undefined = position
    ? {
        position: 'fixed',
        left: position.x,
        top: position.y,
        // Base modal classes often center with translate(-50%, -50%).
        // Clear that once we switch to drag coordinates, otherwise
        // viewport clamping is applied to the wrong visual position.
        transform: 'none',
        margin: 0,
        pointerEvents: 'auto',
        // Explicitly lock the width that was captured at drag-start.
        // Without this, switching from flex-item to position:fixed changes
        // the CSS containing block, which can cause the browser to
        // recalculate width/max-width and visually shrink the modal.
        ...(lockedW !== undefined ? { width: lockedW, maxWidth: 'none' } : {}),
      }
    : undefined;

  return { onDragStart, onPointerDragStart, isDragged, isDragging, overlayStyle, modalStyle };
}
