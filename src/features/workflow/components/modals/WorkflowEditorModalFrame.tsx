import type { ReactNode } from 'react';
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
  overlayClassName?: string;
  dialogClassName?: string;
  bodyViewportClassName?: string;
  footerClassName?: string;
  bodyScrollable?: boolean;
  closeAriaLabel?: string;
  headerClassName?: string;
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
  overlayClassName = 'wf-config-modal-overlay',
  dialogClassName = 'wf-config-modal',
  bodyViewportClassName = 'wf-config-modal-scroll',
  footerClassName = 'wf-config-modal-footer',
  bodyScrollable = true,
  closeAriaLabel = 'Close',
  headerClassName,
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
            <ModalExpandButton expanded={expanded} onToggle={toggleExpand} />
            <button type="button" className="ram-modal-close" onClick={onClose} aria-label={closeAriaLabel}>
              &times;
            </button>
          </div>
        </div>

        {bodyScrollable ? (
          <WorkflowModalScrollBody className="wf-config-modal-body" viewportClassName={bodyViewportClassName}>
            {children}
          </WorkflowModalScrollBody>
        ) : (
          <div className="wf-config-modal-body">{children}</div>
        )}

        {footer ? (
          <div className={footerClassName}>
            <ModalExpandButton expanded={expanded} onToggle={toggleExpand} position="footer" />
            {footer}
          </div>
        ) : null}

        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} />
      </div>
    </div>
  );
}