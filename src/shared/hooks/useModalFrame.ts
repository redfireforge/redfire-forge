import type { CSSProperties } from 'react';
import { useModalDrag } from './useModalDrag';
import { useModalExpand, type ExpandMode } from './useModalExpand';
import { useModalResize } from './useModalResize';

interface UseModalFrameOptions {
  open?: boolean;
  initialExpanded?: boolean;
  expandMode?: ExpandMode;
  minWidth?: number;
  minHeight?: number;
}

/**
 * Shared orchestration for expandable, draggable, resizable modal frames.
 * Keeps drag disabled while expanded and preserves resize state independently.
 */
export function useModalFrame({
  open = true,
  initialExpanded = false,
  expandMode = 'expanded',
  minWidth,
  minHeight,
}: UseModalFrameOptions = {}) {
  const { expanded, setExpanded, toggleExpand, expandClass } = useModalExpand(initialExpanded, expandMode);
  const dragEnabled = !expanded;
  const { onDragStart, isDragged: rawDragged, overlayStyle: draggedOverlayStyle, modalStyle } = useModalDrag(open && dragEnabled);
  const { resizeStyle, onRightEdge, onCorner, onBottomEdge, resetSize } = useModalResize(minWidth, minHeight);

  const isDragged = rawDragged && dragEnabled;
  const overlayStyle = isDragged ? draggedOverlayStyle : undefined;
  const dialogStyle = isDragged ? { ...modalStyle, ...resizeStyle } : resizeStyle;
  const headerDragStyle: CSSProperties | undefined = dragEnabled ? { cursor: 'move' } : undefined;
  const onHeaderMouseDown = dragEnabled ? onDragStart : undefined;

  return {
    expanded,
    setExpanded,
    toggleExpand,
    expandClass,
    isDragged,
    overlayStyle,
    dialogStyle,
    headerDragStyle,
    onHeaderMouseDown,
    resizeStyle,
    onRightEdge,
    onCorner,
    onBottomEdge,
    resetSize,
  } as const;
}

export type { UseModalFrameOptions };