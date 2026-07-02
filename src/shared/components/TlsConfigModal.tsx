/**
 * TlsConfigModal — shared TLS / mTLS configuration modal used by both
 * WebSocket Studio and GraphQL Studio.
 *
 * Callers normalise their own TLS state to `TlsValues` and pass a single
 * `onChange` callback.  Body CSS comes from the `ws-tls-*` ruleset in
 * `websocket-studio.css`; footer actions use global `btn` classes.
 */

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SharedTlsConfigPanel, type SharedTlsValues } from './SharedTlsConfigPanel';
import AppModalFrame from './AppModalFrame';

export type TlsValues = SharedTlsValues;

export interface TlsConfigModalProps {
  /** Whether the modal is currently open. */
  open: boolean;
  /** Current TLS field values. */
  values: TlsValues;
  /** Called whenever the user edits a field. */
  onChange: (patch: Partial<TlsValues>) => void;
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
   * Optional informational banner shown at the top of the modal body.
   * Pass `null` / `undefined` to suppress the notice entirely.
   */
  proxyNotice?: ReactNode;
  /**
   * Prefix used for both `data-testid` attributes and `id`/`htmlFor`
   * attributes inside the modal.
   * - WebSocket: `'tls'`  → `tls-body`, `tls-ca-cert`, …
   * - GraphQL:   `'gql-tls'` → `gql-tls-body`, `gql-tls-ca-cert`, …
   * @default 'tls'
   */
  testIdPrefix?: string;
}

/**
 * Shared TLS / mTLS configuration modal (portal-rendered).
 * Does NOT include the trigger button — each caller renders its own trigger.
 */
export function TlsConfigModal({
  open,
  values,
  onChange,
  onSave,
  onCancel,
  onClose,
  dirty,
  disabled = false,
  proxyNotice,
  testIdPrefix = 'tls',
}: TlsConfigModalProps) {
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
          noticeSlot={proxyNotice}
        />
      </div>
    </AppModalFrame>,
    document.body,
  );
}
