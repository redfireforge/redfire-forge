import type { ReactNode } from 'react';
import AppModalFrame from './AppModalFrame';

interface Props {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Custom footer. If omitted, a default "Cancel" button is rendered. Pass `null` for no footer. */
  footer?: ReactNode | null;
  /** Extra class(es) appended to the overlay element */
  overlayClassName?: string;
  /** Extra class(es) appended to the dialog element */
  dialogClassName?: string;
  /** Extra class(es) appended to the body element */
  bodyClassName?: string;
  /** Extra class(es) appended to the footer element */
  footerClassName?: string;
  overlayTestId?: string;
  dialogTestId?: string;
}

/**
 * A centered popup modal with semi-transparent overlay.
 * No resize handles, no expand/shrink button, no drag, no X button.
 * Users dismiss via Cancel button in footer.
 *
 * Usage:
 *   <PopupModal title="Copy Test" onClose={onClose}>
 *     {content}
 *   </PopupModal>
 *
 *   // With custom footer:
 *   <PopupModal title="Move" onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button onClick={onMove}>Move</button></>}>
 *     {content}
 *   </PopupModal>
 */
export default function PopupModal({
  title,
  onClose,
  children,
  footer,
  overlayClassName,
  dialogClassName,
  bodyClassName,
  footerClassName,
  overlayTestId,
  dialogTestId,
}: Props) {
  const resolvedFooter = footer === undefined
    ? (
      <>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={onClose}>Cancel</button>
      </>
    )
    : footer;

  return (
    <AppModalFrame
      title={title}
      onClose={onClose}
      overlayClassName={['popup-modal-overlay', overlayClassName].filter(Boolean).join(' ')}
      dialogClassName={['popup-modal modal-no-chrome', dialogClassName].filter(Boolean).join(' ')}
      bodyClassName={bodyClassName}
      footerClassName={['popup-modal-footer', footerClassName].filter(Boolean).join(' ')}
      closeButtonKind="none"
      footer={resolvedFooter}
      overlayTestId={overlayTestId}
      dialogTestId={dialogTestId}
    >
      {children}
    </AppModalFrame>
  );
}
