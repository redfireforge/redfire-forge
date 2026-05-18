import type { CSSProperties, ReactNode } from 'react';
import { useModalFrame, type UseModalFrameOptions } from '../hooks/useModalFrame';
import ModalExpandButton from './ModalExpandButton';
import ModalResizeHandles from './ModalResizeHandles';

type CloseButtonKind = 'icon' | 'text' | 'none';

interface AppModalFrameRenderState {
  expanded: boolean;
  toggleExpand: () => void;
  headerDragStyle: CSSProperties | undefined;
  onHeaderMouseDown: ((event: React.MouseEvent<HTMLDivElement>) => void) | undefined;
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
  showExpandButton?: boolean;
  titleId?: string;
  bodyStyle?: CSSProperties;
  headerContent?: (state: AppModalFrameRenderState) => ReactNode;
  footerContent?: (state: AppModalFrameRenderState) => ReactNode;
  disableDrag?: boolean;
  showResizeHandles?: boolean;
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
  closeButtonKind = 'icon',
  closeButtonClassName,
  closeButtonLabel = 'Close',
  closeButtonText = 'Close',
  closeOnOverlayClick = true,
  showExpandButton = true,
  titleId,
  bodyStyle,
  headerContent,
  footerContent,
  disableDrag = false,
  showResizeHandles = true,
  initialExpanded,
  expandMode,
  minWidth,
  minHeight,
}: Props) {
  const { expanded, toggleExpand, expandClass, overlayStyle, dialogStyle, headerDragStyle, onHeaderMouseDown, onRightEdge, onCorner } = useModalFrame({
    open,
    initialExpanded,
    expandMode,
    minWidth,
    minHeight,
  });

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
    headerExpandButton,
    footerExpandButton,
    closeButton,
  };

  return (
    <div className={joinClasses('modal-overlay', overlayClassName, expandClass)} role="presentation" onClick={handleOverlayClick} style={overlayStyle}>
      <div
        className={joinClasses('modal', dialogClassName, expandClass)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        style={dialogStyle}
      >
        {headerContent ? headerContent(renderState) : (
          <div
            className={headerClassName}
            style={disableDrag ? undefined : headerDragStyle}
            onMouseDown={disableDrag ? undefined : onHeaderMouseDown}
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

        {showResizeHandles ? <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} /> : null}
      </div>
    </div>
  );
}