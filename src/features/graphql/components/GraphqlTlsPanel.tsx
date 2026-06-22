/**
 * GraphqlTlsPanel — CA certificate and mTLS client identity configuration.
 *
 * The connection bar SSL toggle is the quick skip-cert control; this modal
 * holds CA PEM, client cert, and client key (Lesson GQL-5 Phase 2 + 3).
 */

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import { isTauri } from '../../../shared/utils/platform';
import AppModalFrame from '../../../shared/components/AppModalFrame';

export interface GraphqlTlsPanelProps {
  skipTlsVerify: boolean;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
  onTlsChange: (patch: Partial<GqlTlsSettings>) => void;
  disabled?: boolean;
}

type TlsSnapshot = {
  skipTlsVerify: boolean;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
};

export function GraphqlTlsPanel({
  skipTlsVerify,
  caCert,
  clientCert,
  clientKey,
  onTlsChange,
  disabled = false,
}: GraphqlTlsPanelProps) {
  const [open, setOpen] = useState(false);
  const snapshotRef = useRef<TlsSnapshot | null>(null);
  const [dirty, setDirty] = useState(false);

  const handleOpen = useCallback(() => {
    snapshotRef.current = { skipTlsVerify, caCert, clientCert, clientKey };
    setDirty(false);
    setOpen(true);
  }, [skipTlsVerify, caCert, clientCert, clientKey]);

  const handlePatch = useCallback((patch: Partial<GqlTlsSettings>) => {
    setDirty(true);
    onTlsChange(patch);
  }, [onTlsChange]);

  const handleCancel = useCallback(() => {
    if (snapshotRef.current) {
      const snap = snapshotRef.current;
      onTlsChange({
        skipTlsVerify: snap.skipTlsVerify,
        caCert: snap.caCert,
        clientCert: snap.clientCert,
        clientKey: snap.clientKey,
      });
    }
    setOpen(false);
  }, [onTlsChange]);

  const handleSave = useCallback(() => {
    snapshotRef.current = { skipTlsVerify, caCert, clientCert, clientKey };
    setDirty(false);
    setOpen(false);
  }, [skipTlsVerify, caCert, clientCert, clientKey]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const hasCaCert = !!caCert?.trim();
  const hasMtls = !!(clientCert?.trim() || clientKey?.trim());
  const hasTlsContent = skipTlsVerify || hasCaCert || hasMtls;
  const modeLabel = hasMtls ? 'mTLS' : hasCaCert ? 'Custom CA' : skipTlsVerify ? 'Skip Verify' : null;
  const modeBadgeVariant = hasMtls ? 'mtls' : hasCaCert ? 'ca' : skipTlsVerify ? 'skip' : null;

  const configureBtn = (
    <button
      type="button"
      className={`gql-tls-configure-btn${hasTlsContent ? ' gql-tls-configure-btn--active' : ''}`}
      onClick={handleOpen}
      disabled={disabled}
      data-testid="gql-tls-configure"
      aria-haspopup="dialog"
      aria-label="Configure TLS certificates"
      title="Configure CA certificate and mTLS client credentials"
    >
      <span aria-hidden="true">🔒</span>
      <span className="gql-tls-configure-label">TLS</span>
      {modeBadgeVariant && (
        <span
          className={`gql-tls-mode-badge gql-tls-mode-badge--${modeBadgeVariant}`}
          data-testid="gql-tls-indicator"
        >
          {modeLabel}
        </span>
      )}
    </button>
  );

  const modal = open ? createPortal(
    <AppModalFrame
      title={
        <span className="gql-tls-modal-title">
          <span aria-hidden="true">🔒</span> TLS / mTLS Configuration
        </span>
      }
      onClose={handleClose}
      overlayClassName="gql-tls-overlay"
      dialogClassName="gql-tls-modal"
      headerClassName="gql-tls-modal-header modal-header"
      bodyClassName="gql-tls-modal-body"
      footerClassName="gql-tls-modal-footer"
      titleId="gql-tls-modal-title"
      showExpandButton={false}
      showResizeHandles={false}
      closeButtonKind="none"
      minWidth={460}
      minHeight={320}
      footer={
        <>
          <button type="button" className="gql-tls-footer-btn" onClick={handleCancel} data-testid="gql-tls-cancel">
            Cancel
          </button>
          <button
            type="button"
            className="gql-tls-footer-btn gql-tls-footer-btn--primary"
            onClick={handleSave}
            disabled={!dirty}
            data-testid="gql-tls-save"
          >
            Save
          </button>
          <button type="button" className="gql-tls-footer-btn" onClick={handleClose} data-testid="gql-tls-close">
            Close
          </button>
        </>
      }
    >
      <div data-testid="gql-tls-body">
        {!isTauri() && (
          <div className="gql-tls-notice" data-testid="gql-tls-proxy-notice">
            <span className="gql-tls-notice-icon" aria-hidden="true">ℹ</span>
            <span>
              In web mode, HTTPS requests with custom TLS settings route through the Vite{' '}
              <code>/__proxy</code> middleware. On Tauri desktop, the same settings route through
              the Node.js proxy on port 3001.
            </span>
          </div>
        )}

        <div className="gql-tls-section">
          <div className="gql-tls-section-header">
            <span className="gql-tls-section-title">Server verification</span>
          </div>
          <label
            className={`gql-tls-option-row${skipTlsVerify ? ' gql-tls-option-row--warn' : ''}`}
            data-testid="gql-tls-skip-cert"
          >
            <div className="gql-tls-option-check">
              <input
                type="checkbox"
                checked={skipTlsVerify}
                onChange={(e) => handlePatch({ skipTlsVerify: e.target.checked })}
                disabled={disabled}
              />
            </div>
            <div className="gql-tls-option-text">
              <span className="gql-tls-option-label">Skip certificate validation</span>
              <span className="gql-tls-option-desc">
                Disables hostname and CA checks. Use only on loopback with self-signed certificates.
              </span>
            </div>
            {skipTlsVerify && <span className="gql-tls-warn-badge" aria-label="Warning: insecure">⚠</span>}
          </label>
        </div>

        <div className="gql-tls-section">
          <div className="gql-tls-section-header">
            <span className="gql-tls-section-title">CA certificate</span>
            <span className="gql-tls-section-tag">Optional</span>
          </div>
          <p className="gql-tls-section-desc">
            Paste your organisation&apos;s root CA PEM to validate internal certificates without skip-cert mode.
          </p>
          <div className="gql-tls-field">
            <div className="gql-tls-field-header">
              <label className="gql-tls-field-label" htmlFor="gql-tls-ca-cert-input">CA certificate (PEM)</label>
              {hasCaCert && <span className="gql-tls-field-set-badge">Set</span>}
            </div>
            <textarea
              id="gql-tls-ca-cert-input"
              className="gql-tls-textarea"
              value={caCert ?? ''}
              onChange={(e) => handlePatch({ caCert: e.target.value || undefined })}
              placeholder="Paste your CA certificate in PEM format…"
              rows={5}
              disabled={disabled}
              data-testid="gql-tls-ca-cert"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="gql-tls-section gql-tls-section--mtls">
          <div className="gql-tls-section-header">
            <span className="gql-tls-section-title">Client identity</span>
            <span className="gql-tls-section-tag gql-tls-section-tag--mtls">mTLS</span>
          </div>
          <p className="gql-tls-section-desc">
            Mutual TLS — the server requires a client certificate. Both fields are required for mTLS endpoints.
          </p>
          <div className="gql-tls-field">
            <div className="gql-tls-field-header">
              <label className="gql-tls-field-label" htmlFor="gql-tls-client-cert-input">Client certificate (PEM)</label>
              {!!clientCert?.trim() && <span className="gql-tls-field-set-badge">Set</span>}
            </div>
            <textarea
              id="gql-tls-client-cert-input"
              className="gql-tls-textarea"
              value={clientCert ?? ''}
              onChange={(e) => handlePatch({ clientCert: e.target.value || undefined })}
              placeholder="Paste your client certificate in PEM format…"
              rows={5}
              disabled={disabled}
              data-testid="gql-tls-client-cert"
              spellCheck={false}
            />
          </div>
          <div className="gql-tls-field">
            <div className="gql-tls-field-header">
              <label className="gql-tls-field-label" htmlFor="gql-tls-client-key-input">Client private key (PEM)</label>
              {!!clientKey?.trim() && <span className="gql-tls-field-set-badge">Set</span>}
            </div>
            <textarea
              id="gql-tls-client-key-input"
              className="gql-tls-textarea"
              value={clientKey ?? ''}
              onChange={(e) => handlePatch({ clientKey: e.target.value || undefined })}
              placeholder="Paste your client private key in PEM format…"
              rows={5}
              disabled={disabled}
              data-testid="gql-tls-client-key"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </AppModalFrame>,
    document.body,
  ) : null;

  return (
    <div data-testid="gql-tls-panel">
      {configureBtn}
      {modal}
    </div>
  );
}
