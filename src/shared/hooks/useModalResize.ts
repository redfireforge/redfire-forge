import { useState, useRef, useCallback } from 'react';

export type ResizeEdge = 'right' | 'corner' | 'bottom';

interface ResizeState {
  startX: number;
  startY: number;
  origW: number;
  origH: number;
  edge: ResizeEdge;
}

/**
 * Shared hook for modal resize-by-drag.
 * Provides two invisible drag handles:
 *  - Right edge: drag to change width
 *  - Bottom-right corner: drag to change width + height
 *
 * Returns `resizeHandles` JSX props and `resizeStyle` to spread onto the modal div.
 */
export function useModalResize(minWidth = 320, minHeight = 200) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const stateRef = useRef<ResizeState | null>(null);

  const startResize = useCallback(
    (e: React.MouseEvent, edge: ResizeEdge) => {
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget as HTMLElement;
      // First try to find closest dialog element (AppModalFrame structure)
      // Fall back to parentElement for test compatibility
      const modal = (handle.closest('[role="dialog"]') || handle.parentElement) as HTMLElement | null;
      if (!modal) {
        return;
      }
      const rect = modal.getBoundingClientRect();
      stateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: size?.w ?? rect.width,
        origH: size?.h ?? rect.height,
        edge,
      };

      const handleMove = (ev: MouseEvent) => {
        const s = stateRef.current;
        if (!s) return;
        const dx = ev.clientX - s.startX;
        const dy = ev.clientY - s.startY;
        const resizesW = s.edge === 'right' || s.edge === 'corner';
        const resizesH = s.edge === 'corner' || s.edge === 'bottom';
        const newW = resizesW ? Math.max(minWidth, s.origW + dx) : (size?.w ?? s.origW);
        const newH = resizesH ? Math.max(minHeight, s.origH + dy) : (size?.h ?? s.origH);
        setSize({ w: newW, h: newH });
      };

      const handleUp = () => {
        stateRef.current = null;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [size, minWidth, minHeight],
  );

  const onRightEdge = useCallback(
    (e: React.MouseEvent) => startResize(e, 'right'),
    [startResize],
  );

  const onCorner = useCallback(
    (e: React.MouseEvent) => startResize(e, 'corner'),
    [startResize],
  );

  const onBottomEdge = useCallback(
    (e: React.MouseEvent) => startResize(e, 'bottom'),
    [startResize],
  );

  // Component remount resets size automatically via useState initial value.

  const resizeStyle: React.CSSProperties | undefined = size
    ? {
        width: size.w,
        height: size.h,
        // Class-based modal max-width/max-height rules should not block manual resize.
        maxWidth: 'none',
        maxHeight: 'none',
      }
    : undefined;

  return { resizeStyle, onRightEdge, onCorner, onBottomEdge, resetSize: () => setSize(null) } as const;
}
