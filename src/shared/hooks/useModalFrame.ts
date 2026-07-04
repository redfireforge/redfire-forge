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
  constrainDragToViewport?: boolean;
  dragViewportPadding?: number;
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
  constrainDragToViewport = false,
  dragViewportPadding = 8,
}: UseModalFrameOptions = {}) {
  const { expanded, setExpanded, toggleExpand, expandClass } = useModalExpand(initialExpanded, expandMode);
  const dragEnabled = !expanded;
  const {
    onDragStart,
    onPointerDragStart,
    isDragged: rawDragged,
    isDragging,
    overlayStyle: draggedOverlayStyle,
    modalStyle,
  } = useModalDrag(open && dragEnabled, {
    constrainToViewport: constrainDragToViewport,
    viewportPadding: dragViewportPadding,
  });
  const { resizeStyle, onRightEdge, onCorner, onBottomEdge, resetSize } = useModalResize(minWidth, minHeight);

  const isDragged = rawDragged && dragEnabled;
  const overlayStyle = isDragging ? draggedOverlayStyle : undefined;
  const dialogStyle = isDragged ? { ...modalStyle, ...resizeStyle } : resizeStyle;
  const headerDragStyle: CSSProperties | undefined = dragEnabled ? { cursor: 'move' } : undefined;
  const onHeaderMouseDown = dragEnabled ? onDragStart : undefined;
  const onHeaderPointerDown = dragEnabled ? onPointerDragStart : undefined;

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
    onHeaderPointerDown,
    resizeStyle,
    onRightEdge,
    onCorner,
    onBottomEdge,
    resetSize,
  } as const;
}

export type { UseModalFrameOptions };