import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useModalFrame, type UseModalFrameOptions } from '../hooks/useModalFrame';
import ModalExpandButton from './ModalExpandButton';
import ModalResizeHandles from './ModalResizeHandles';

type CloseButtonKind = 'icon' | 'text' | 'none';

interface AppModalFrameRenderState {
  expanded: boolean;
  toggleExpand: () => void;
  headerDragStyle: CSSProperties | undefined;
  onHeaderMouseDown: ((event: React.MouseEvent<HTMLDivElement>) => void) | undefined;
  onHeaderPointerDown: ((event: React.PointerEvent<HTMLDivElement>) => void) | undefined;
  headerExpandButton: ReactNode;
  footerExpandButton: ReactNode;
  closeButton: ReactNode;
}

interface Props extends UseModalFrameOptions {
  open?: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  overlayClassName?: string;
  dialogClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  controlsClassName?: string;
  titleClassName?: string;
  closeButtonKind?: CloseButtonKind;
  closeButtonClassName?: string;
  closeButtonLabel?: string;
  closeButtonText?: ReactNode;
  closeOnOverlayClick?: boolean;
  /** Close on Escape. Opt out for modals guarding unsaved destructive work. */
  closeOnEscape?: boolean;
  showExpandButton?: boolean;
  titleId?: string;
  bodyStyle?: CSSProperties;
  headerContent?: (state: AppModalFrameRenderState) => ReactNode;
  footerContent?: (state: AppModalFrameRenderState) => ReactNode;
  disableDrag?: boolean;
  showResizeHandles?: boolean;
  constrainDragToViewport?: boolean;
  dragViewportPadding?: number;
  /** Optional test id on the overlay (e.g. for click-outside close assertions). */
  overlayTestId?: string;
  /** Optional test id on the dialog root. */
  dialogTestId?: string;
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function AppModalFrame({
  open = true,
  title,
  onClose,
  children,
  footer,
  headerActions,
  overlayClassName = 'modal-overlay',
  dialogClassName = 'modal',
  headerClassName = 'modal-header',
  bodyClassName,
  footerClassName,
  controlsClassName,
  titleClassName,
  closeButtonKind = 'none',
  closeButtonClassName,
  closeButtonLabel = 'Close',
  closeButtonText = 'Close',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showExpandButton = true,
  titleId,
  bodyStyle,
  headerContent,
  footerContent,
  disableDrag = false,
  showResizeHandles = true,
  dragAnchor,
  constrainDragToViewport = false,
  dragViewportPadding = 8,
  initialExpanded,
  expandMode,
  minWidth,
  minHeight,
  overlayTestId,
  dialogTestId,
}: Props) {
  const {
    expanded,
    toggleExpand,
    expandClass,
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
    open,
    initialExpanded,
    expandMode,
    minWidth,
    minHeight,
    dragAnchor,
    constrainDragToViewport,
    dragViewportPadding,
  });

  // Only the top-most open dialog reacts, so nested modals close one layer at a time.
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs.length > 0 && dialogs[dialogs.length - 1] !== dialogRef.current) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEscape, onClose, dialogRef]);

  if (!open) return null;

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  const renderCloseButton = () => {
    if (closeButtonKind === 'none') return null;
    if (closeButtonKind === 'text') {
      return (
        <button type="button" className={joinClasses('btn', 'btn-sm', closeButtonClassName)} onClick={onClose}>
          {closeButtonText}
        </button>
      );
    }

    return (
      <button type="button" className={joinClasses('ram-modal-close', closeButtonClassName)} onClick={onClose} aria-label={closeButtonLabel}>
        &times;
      </button>
    );
  };

  const titleContent = typeof title === 'string'
    ? <h3 id={titleId} className={titleClassName}>{title}</h3>
    : <div id={titleId} className={titleClassName}>{title}</div>;

  const headerExpandButton = showExpandButton ? <ModalExpandButton expanded={expanded} onToggle={toggleExpand} /> : null;
  const footerExpandButton = showExpandButton ? <ModalExpandButton expanded={expanded} onToggle={toggleExpand} position="footer" /> : null;
  const closeButton = renderCloseButton();
  const renderState: AppModalFrameRenderState = {
    expanded,
    toggleExpand,
    headerDragStyle: disableDrag ? undefined : headerDragStyle,
    onHeaderMouseDown: disableDrag ? undefined : onHeaderMouseDown,
    onHeaderPointerDown: disableDrag ? undefined : onHeaderPointerDown,
    headerExpandButton,
    footerExpandButton,
    closeButton,
  };

  return (
    <div
      className={joinClasses('modal-overlay', overlayClassName, expandClass)}
      role="presentation"
      onClick={handleOverlayClick}
      style={overlayStyle}
      data-testid={overlayTestId}
    >
      <div
        ref={dialogRef}
        className={joinClasses('modal', dialogClassName, expandClass)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        style={dialogStyle}
        data-testid={dialogTestId}
      >
        {headerContent ? headerContent(renderState) : (
          <div
            className={headerClassName}
            style={disableDrag ? undefined : headerDragStyle}
            onMouseDown={disableDrag ? undefined : onHeaderMouseDown}
            onPointerDown={disableDrag ? undefined : onHeaderPointerDown}
          >
            {titleContent}
            <div className={controlsClassName} style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              {headerActions}
              {headerExpandButton}
              {closeButton}
            </div>
          </div>
        )}

        <div className={bodyClassName} style={bodyStyle}>
          {children}
        </div>

        {footerContent ? footerContent(renderState) : footer ? (
          <div className={footerClassName}>
            {footer}
          </div>
        ) : null}

        {showResizeHandles ? <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} onBottomEdge={onBottomEdge} /> : null}
      </div>
    </div>
  );
}