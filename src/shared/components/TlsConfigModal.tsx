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
import AppModalFrame from './AppModalFrame';

export interface TlsValues {
  skipVerify: boolean;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
}

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
  const { skipVerify, caCert, clientCert, clientKey } = values;

  const hasCaCert = !!caCert?.trim();
  const hasClientCert = !!clientCert?.trim();
  const hasClientKey = !!clientKey?.trim();

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
        </>
      }
    >
      <div data-testid={`${p}-body`}>

        {/* Optional proxy/routing notice */}
        {proxyNotice != null && (
          <div className="ws-tls-notice" data-testid={`${p}-proxy-notice`}>
            <span className="ws-tls-notice-icon" aria-hidden="true">ℹ</span>
            <span>{proxyNotice}</span>
          </div>
        )}

        {/* ── Section 1: Server Verification ── */}
        <div className="ws-tls-section">
          <div className="ws-tls-section-header">
            <span className="ws-tls-section-title">Server Verification</span>
          </div>
          <label
            className={`ws-tls-option-row${skipVerify ? ' ws-tls-option-row--warn' : ''}`}
            data-testid={`${p}-skip-cert`}
          >
            <div className="ws-tls-option-check">
              <input
                type="checkbox"
                checked={skipVerify}
                onChange={(e) => onChange({ skipVerify: e.target.checked })}
                disabled={disabled}
              />
            </div>
            <div className="ws-tls-option-text">
              <span className="ws-tls-option-label">Skip certificate validation</span>
              <span className="ws-tls-option-desc">
                Disables hostname and CA checks. Use only in dev/staging with self-signed certificates.
              </span>
            </div>
            {skipVerify && <span className="ws-tls-warn-badge" aria-label="Warning: insecure">⚠</span>}
          </label>
        </div>

        {/* ── Section 2: CA Certificate ── */}
        <div className="ws-tls-section">
          <div className="ws-tls-section-header">
            <span className="ws-tls-section-title">CA Certificate</span>
            <span className="ws-tls-section-tag">Optional</span>
          </div>
          <p className="ws-tls-section-desc">
            Provide a custom Certificate Authority to trust — required when your server uses a private
            or self-signed CA. Also needed for mTLS when the server cert is not publicly trusted.
          </p>
          <div className="ws-tls-field">
            <div className="ws-tls-field-header">
              <label className="ws-tls-field-label" htmlFor={`${p}-ca-cert-input`}>
                CA Certificate (PEM)
              </label>
              {hasCaCert && <span className="ws-tls-field-set-badge">Set</span>}
            </div>
            <textarea
              id={`${p}-ca-cert-input`}
              className="ws-tls-textarea"
              value={caCert ?? ''}
              onChange={(e) => onChange({ caCert: e.target.value || undefined })}
              placeholder="Paste your CA certificate in PEM format…"
              rows={5}
              disabled={disabled}
              data-testid={`${p}-ca-cert`}
              spellCheck={false}
            />
          </div>
        </div>

        {/* ── Section 3: mTLS (Client Identity) ── */}
        <div className="ws-tls-section ws-tls-section--mtls">
          <div className="ws-tls-section-header">
            <span className="ws-tls-section-title">Client Identity</span>
            <span className="ws-tls-section-tag ws-tls-section-tag--mtls">mTLS</span>
          </div>
          <p className="ws-tls-section-desc">
            Mutual TLS — the server requires you to present a certificate proving your identity.
            Both fields below are required. If the server uses a private CA, also fill in the
            CA Certificate above.
          </p>
          <div className="ws-tls-field">
            <div className="ws-tls-field-header">
              <label className="ws-tls-field-label" htmlFor={`${p}-client-cert-input`}>
                Client Certificate (PEM)
              </label>
              {hasClientCert && <span className="ws-tls-field-set-badge">Set</span>}
            </div>
            <textarea
              id={`${p}-client-cert-input`}
              className="ws-tls-textarea"
              value={clientCert ?? ''}
              onChange={(e) => onChange({ clientCert: e.target.value || undefined })}
              placeholder="Paste your client certificate in PEM format…"
              rows={5}
              disabled={disabled}
              data-testid={`${p}-client-cert`}
              spellCheck={false}
            />
          </div>
          <div className="ws-tls-field">
            <div className="ws-tls-field-header">
              <label className="ws-tls-field-label" htmlFor={`${p}-client-key-input`}>
                Client Private Key (PEM)
              </label>
              {hasClientKey && <span className="ws-tls-field-set-badge">Set</span>}
            </div>
            <textarea
              id={`${p}-client-key-input`}
              className="ws-tls-textarea"
              value={clientKey ?? ''}
              onChange={(e) => onChange({ clientKey: e.target.value || undefined })}
              placeholder="Paste your client private key in PEM format…"
              rows={5}
              disabled={disabled}
              data-testid={`${p}-client-key`}
              spellCheck={false}
            />
          </div>
        </div>

      </div>
    </AppModalFrame>,
    document.body,
  );
}
