import type { ReactNode } from 'react';
import WorkflowEditorModalFrame from '../../features/workflow/components/modals/WorkflowEditorModalFrame';

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
}

/**
 * A full-panel modal that fills the entire content area (right of sidebar).
 * No resize handles, no drag, no expand/close buttons.
 * Rounded corners, opaque background.
 *
 * Usage:
 *   <FullPanelModal title="Import Spec" onClose={onClose}>
 *     {content}
 *   </FullPanelModal>
 *
 *   // With custom footer:
 *   <FullPanelModal title="Edit" onClose={onClose} footer={<><button onClick={onClose}>Close</button><button onClick={onSave}>Save</button></>}>
 *     {content}
 *   </FullPanelModal>
 */
export default function FullPanelModal({
  title,
  onClose,
  children,
  footer,
  overlayClassName,
  dialogClassName,
  bodyScrollable = true,
}: Props) {
  const resolvedFooter = footer === undefined
    ? <button className="cat-btn" onClick={onClose}>Close</button>
    : footer;

  return (
    <WorkflowEditorModalFrame
      title={title}
      onClose={onClose}
      overlayClassName={['full-panel-overlay', overlayClassName].filter(Boolean).join(' ')}
      dialogClassName={['wf-config-modal full-panel-modal modal-no-chrome', dialogClassName].filter(Boolean).join(' ')}
      footer={resolvedFooter}
      bodyScrollable={bodyScrollable}
    >
      {children}
    </WorkflowEditorModalFrame>
  );
}
