/**
 * SharedTlsMtlsModal — shared TLS / mTLS configuration modal with optional mode selector.
 * Extends the basic TlsConfigModal to support protocols that have multiple TLS modes (like gRPC).
 *
 * Used by:
 * - gRPC: renders with tri-mode selector (Plaintext / TLS / mTLS)
 * - Future protocols that need mode selection
 */

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SharedTlsConfigPanel, type SharedTlsValues } from './SharedTlsConfigPanel';
import AppModalFrame from './AppModalFrame';

export type SharedTlsMtlsValues = SharedTlsValues;

export interface SharedTlsMtlsModalProps {
  /** Whether the modal is currently open. */
  open: boolean;
  /** Current TLS field values. */
  values: SharedTlsMtlsValues;
  /** Called whenever the user edits a field. */
  onChange: (patch: Partial<SharedTlsMtlsValues>) => void;
  /** Called when the user clicks Save. */
  onSave: () => void;
  /** Called when the user clicks Cancel (reverts changes in the parent). */
  onCancel: () => void;
  /** Called when the user clicks Close (keeps current applied state). */
  onClose: () => void;
  /** True when any field was edited since the modal was opened. */
  dirty: boolean;
  /** Disable all form fields (read-only view). */
  disabled?: boolean;
  /**
   * Prefix used for both `data-testid` and `id`/`htmlFor` attributes.
   * Examples: `'tls'` → `tls-ca-cert`, `'grpc-tls'` → `grpc-tls-ca-cert`
   * @default 'tls'
   */
  testIdPrefix?: string;
  /**
   * Optional custom header rendered above the panel sections.
   * Used by gRPC to render the tri-mode selector (Plaintext / TLS / mTLS).
   */
  headerSlot?: ReactNode;
  /**
   * Optional informational banner shown at the top of the modal body.
   * Pass `null` / `undefined` to suppress the notice entirely.
   */
  noticeSlot?: ReactNode;
}

/**
 * Shared TLS / mTLS modal with optional mode selector slot.
 * Does NOT include the trigger button — each caller renders its own trigger.
 */
export function SharedTlsMtlsModal({
  open,
  values,
  onChange,
  onSave,
  onCancel,
  onClose,
  dirty,
  disabled = false,
  testIdPrefix = 'tls',
  headerSlot,
  noticeSlot,
}: SharedTlsMtlsModalProps) {
  if (!open) return null;

  const p = testIdPrefix; // short alias

  return createPortal(
    <AppModalFrame
      title={
        <span className="ws-tls-modal-title">
          <span aria-hidden="true">🔒</span> TLS / mTLS Configuration
        </span>
      }
      onClose={onClose}
      overlayClassName="ws-tls-overlay"
      dialogClassName="ws-tls-modal"
      headerClassName="ws-tls-modal-header modal-header"
      bodyClassName="ws-tls-modal-body"
      footerClassName="ws-tls-modal-footer"
      titleId={`${p}-modal-title`}
      showExpandButton={false}
      showResizeHandles={false}
      closeButtonKind="none"
      minWidth={460}
      minHeight={320}
      footer={
        <>
          <div className="tls-modal-footer-group tls-modal-footer-group--left" aria-hidden="true" />
          <div className="tls-modal-footer-group tls-modal-footer-group--right">
            <button
              type="button"
              className="btn"
              onClick={onCancel}
              data-testid={`${p}-cancel`}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSave}
              disabled={!dirty}
              data-testid={`${p}-save`}
            >
              Save
            </button>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              data-testid={`${p}-close`}
            >
              Close
            </button>
          </div>
        </>
      }
    >
      <div data-testid={`${p}-body`}>
        <SharedTlsConfigPanel
          values={values}
          onChange={onChange}
          disabled={disabled}
          testIdPrefix={p}
          headerSlot={headerSlot}
          noticeSlot={noticeSlot}
        />
      </div>
    </AppModalFrame>,
    document.body,
  );
}
