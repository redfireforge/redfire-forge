import { type ReactNode, useEffect } from 'react';
import { useModalFrame, type UseModalFrameOptions } from '../../../../shared/hooks/useModalFrame';
import ModalExpandButton from '../../../../shared/components/ModalExpandButton';
import ModalResizeHandles from '../../../../shared/components/ModalResizeHandles';
import WorkflowModalScrollBody from './WorkflowModalScrollBody';

interface Props extends UseModalFrameOptions {
  open?: boolean;
  title: ReactNode;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  /**
   * Fixed chrome between the title header and the scroll body (e.g. Config/Input tabs).
   * Stays visible while the form scrolls.
   */
  toolbar?: ReactNode;
  overlayClassName?: string;
  dialogClassName?: string;
  bodyClassName?: string;
  bodyViewportClassName?: string;
  footerClassName?: string;
  bodyScrollable?: boolean;
  closeAriaLabel?: string;
  headerClassName?: string;
  /** When true, automatically expand the modal (e.g. when a side panel opens). */
  forceExpanded?: boolean;
  /** Hide the expand/shrink toggle buttons (header + footer). */
  hideExpandButton?: boolean;
  /** Hide the × close button in the header. */
  hideCloseButton?: boolean;
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function WorkflowEditorModalFrame({
  open = true,
  title,
  titleId,
  onClose,
  children,
  footer,
  headerActions,
  toolbar,
  overlayClassName = 'wf-config-modal-overlay',
  dialogClassName = 'wf-config-modal',
  bodyClassName,
  bodyViewportClassName = 'wf-config-modal-scroll',
  footerClassName = 'wf-config-modal-footer',
  bodyScrollable = true,
  closeAriaLabel = 'Close',
  headerClassName,
  forceExpanded,
  hideExpandButton,
  hideCloseButton,
  initialExpanded,
  expandMode,
  minWidth,
  minHeight,
}: Props) {
  const { expanded, setExpanded, toggleExpand, expandClass, overlayStyle, dialogStyle, headerDragStyle, onHeaderMouseDown, onRightEdge, onCorner, onBottomEdge } = useModalFrame({
    open,
    initialExpanded,
    expandMode,
    minWidth,
    minHeight,
  });

  useEffect(() => {
    if (forceExpanded && !expanded) setExpanded(true);
  }, [forceExpanded, expanded, setExpanded]);

  if (!open) return null;

  return (
    <div className={joinClasses('modal-overlay', overlayClassName, expandClass)} role="presentation" style={overlayStyle}>
      <div
        className={joinClasses('modal', 'ram-modal', dialogClassName, expandClass)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={dialogStyle}
      >
        <div className={joinClasses('ram-header', headerClassName)} style={headerDragStyle} onMouseDown={onHeaderMouseDown}>
          <h3>{title}</h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {headerActions}
            {!hideExpandButton && <ModalExpandButton expanded={expanded} onToggle={toggleExpand} />}
            {!hideCloseButton && (
              <button type="button" className="ram-modal-close" onClick={onClose} aria-label={closeAriaLabel}>
                &times;
              </button>
            )}
          </div>
        </div>

        {toolbar ? <div className="wf-config-modal-toolbar">{toolbar}</div> : null}

        {bodyScrollable ? (
          <WorkflowModalScrollBody className={joinClasses('wf-config-modal-body', bodyClassName)} viewportClassName={bodyViewportClassName}>
            {children}
          </WorkflowModalScrollBody>
        ) : (
          <div className={joinClasses('wf-config-modal-body', bodyClassName)}>{children}</div>
        )}

        {footer ? (
          <div className={footerClassName}>
            {!hideExpandButton && <ModalExpandButton expanded={expanded} onToggle={toggleExpand} position="footer" />}
            {footer}
          </div>
        ) : null}

        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} onBottomEdge={onBottomEdge} />
      </div>
    </div>
  );
}