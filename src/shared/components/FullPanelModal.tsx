import type { ReactNode } from 'react';
import { useModalFrame } from '../hooks/useModalFrame';
import ModalResizeHandles from './ModalResizeHandles';

interface Props {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Custom footer. If omitted, a default "Close" button is rendered. Pass `null` for no footer. */
  footer?: ReactNode | null;
  /** Extra class(es) appended to the overlay element */
  overlayClassName?: string;
  /** Extra class(es) appended to the dialog element */
  dialogClassName?: string;
  bodyScrollable?: boolean;
  /** Enable drag-to-move using the modal header (opt-in). */
  movable?: boolean;
  /** Show edge/corner resize handles (opt-in). */
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
}

/**
 * A full-panel modal that fills the entire content area (right of sidebar).
 * No resize handles, no drag, no expand/close buttons.
 * Rounded corners, opaque background.
 */
export default function FullPanelModal({
  title,
  onClose,
  children,
  footer,
  overlayClassName,
  dialogClassName,
  bodyScrollable = true,
  movable = false,
  resizable = false,
  minWidth,
  minHeight,
}: Props) {
  const {
    overlayStyle,
    dialogStyle,
    headerDragStyle,
    onHeaderMouseDown,
    onHeaderPointerDown,
    dialogRef,
    onRightEdge,
    onCorner,
    onBottomEdge,
  } = useModalFrame({
    open: true,
    minWidth,
    minHeight,
    constrainDragToViewport: true,
    dragViewportPadding: 8,
  });

  const dragEnabled = movable;
  const resizeEnabled = resizable;

  const resolvedFooter = footer === undefined
    ? <button className="cat-btn" onClick={onClose}>Close</button>
    : footer;

  const overlayClasses = ['modal-overlay full-panel-overlay', overlayClassName].filter(Boolean).join(' ');
  const dialogClasses = ['modal ram-modal wf-config-modal full-panel-modal', dialogClassName].filter(Boolean).join(' ');

  return (
    <div className={overlayClasses} role="presentation" style={dragEnabled ? overlayStyle : undefined}>
      <div
        ref={dialogRef}
        className={dialogClasses}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={(dragEnabled || resizeEnabled) ? dialogStyle : undefined}
      >
        <div
          className="ram-header"
          style={dragEnabled ? headerDragStyle : { cursor: 'default' }}
          onMouseDown={dragEnabled ? onHeaderMouseDown : undefined}
          onPointerDown={dragEnabled ? onHeaderPointerDown : undefined}
        >
          <h3>{title}</h3>
        </div>

        {bodyScrollable ? (
          <div className="wf-modal-scroll-shell wf-config-modal-body">
            <div className="wf-modal-scroll-viewport wf-config-modal-scroll">
              {children}
            </div>
          </div>
        ) : (
          <div className="wf-config-modal-body">{children}</div>
        )}

        {resolvedFooter !== null && (
          <div className="wf-config-modal-footer">{resolvedFooter}</div>
        )}

        {resizeEnabled ? <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} onBottomEdge={onBottomEdge} /> : null}
      </div>
    </div>
  );
}
