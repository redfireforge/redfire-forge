/**
 * TlsConfigModal — shared TLS / mTLS configuration modal used by both
 * WebSocket Studio and GraphQL Studio.
 *
 * Callers normalise their own TLS state to `TlsValues` and pass a single
 * `onChange` callback.  Body CSS comes from the `ws-tls-*` ruleset in
 * `websocket-studio.css`; footer actions use global `btn` classes.
 *
 * Optional gRPC-specific props allow the same component to be reused for
 * gRPC without duplicating the modal chrome:
 * - `headerSlot` — tri-mode selector (Plaintext / TLS / mTLS)
 * - `bodySlot` — replaces the default SharedTlsConfigPanel (for secret masking)
 * - `onTestConnection` / `onResetDefaults` — extra footer buttons, left-aligned
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
   * Optional header rendered above the body sections.
   * Used by gRPC to render the tri-mode selector (Plaintext / TLS / mTLS).
   */
  headerSlot?: ReactNode;
  /**
   * When provided, replaces the default SharedTlsConfigPanel body.
   * Used by gRPC to inject GrpcTlsConfigBody (tri-mode + secret masking).
   */
  bodySlot?: ReactNode;
  /**
   * Optional footer action shown left-aligned.
   * Provided by gRPC to run local TLS validation.
   */
  onTestConnection?: () => void;
  /**
   * Optional footer action shown left-aligned.
   * Provided by gRPC to reset mode to Plaintext.
   */
  onResetDefaults?: () => void;
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
  headerSlot,
  bodySlot,
  onTestConnection,
  onResetDefaults,
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
      dialogClassName={p === 'grpc-tls' ? 'ws-tls-modal grpc-tls-config-modal' : 'ws-tls-modal'}
      headerClassName="ws-tls-modal-header modal-header"
      bodyClassName="ws-tls-modal-body"
      footerClassName="ws-tls-modal-footer"
      titleId={`${p}-modal-title`}
      showExpandButton={false}
      showResizeHandles
      closeButtonKind="none"
      minWidth={p === 'grpc-tls' ? 520 : 560}
      minHeight={p === 'grpc-tls' ? 480 : 420}
      footer={
        <>
          <div className="tls-modal-footer-group tls-modal-footer-group--left">
            {onTestConnection && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onTestConnection}
                disabled={disabled}
                data-testid={`${p}-test`}
              >
                Test TLS Connection
              </button>
            )}
            {onResetDefaults && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onResetDefaults}
                disabled={disabled}
                data-testid={`${p}-reset`}
              >
                Reset to Defaults
              </button>
            )}
            {!onTestConnection && !onResetDefaults && <span aria-hidden="true" />}
          </div>
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
      {/* bodySlot replaces the default panel (used by gRPC for secret masking); no wrapper testId in that case since bodySlot owns its own */}
      <div {...(bodySlot ? {} : { 'data-testid': `${p}-body` })}>
        {bodySlot ?? (
          <SharedTlsConfigPanel
            values={values}
            onChange={onChange}
            disabled={disabled}
            testIdPrefix={p}
            headerSlot={headerSlot}
            noticeSlot={proxyNotice}
          />
        )}
      </div>
    </AppModalFrame>,
    document.body,
  );
}
