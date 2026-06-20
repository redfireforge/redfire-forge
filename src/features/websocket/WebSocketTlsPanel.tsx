import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WsTlsConfig } from '../../shared/websocket/types';
import { isTauri } from '../../shared/utils/platform';
import AppModalFrame from '../../shared/components/AppModalFrame';

export interface WebSocketTlsPanelProps {
  tlsConfig: WsTlsConfig;
  onTlsChange: (patch: Partial<WsTlsConfig>) => void;
  isWss: boolean;
  isProxyMode: boolean;
  disabled?: boolean;
}

export function WebSocketTlsPanel({
  tlsConfig,
  onTlsChange,
  isWss,
  isProxyMode,
  disabled = false,
}: WebSocketTlsPanelProps) {
  const [open, setOpen] = useState(false);
  /** Snapshot of config when modal opened — used by Cancel to revert */
  const snapshotRef = useRef<WsTlsConfig | null>(null);
  /** Track whether any field was modified since opening */
  const [dirty, setDirty] = useState(false);

  const handleOpen = useCallback(() => {
    snapshotRef.current = { ...tlsConfig };
    setDirty(false);
    setOpen(true);
  }, [tlsConfig]);

  const handleTlsChange = useCallback((patch: Partial<WsTlsConfig>) => {
    setDirty(true);
    onTlsChange(patch);
  }, [onTlsChange]);

  const handleCancel = useCallback(() => {
    if (snapshotRef.current) {
      onTlsChange(snapshotRef.current);
    }
    setOpen(false);
  }, [onTlsChange]);

  const handleSave = useCallback(() => {
    // Changes are already applied via onTlsChange — update snapshot and close
    snapshotRef.current = { ...tlsConfig };
    setDirty(false);
    setOpen(false);
  }, [tlsConfig]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const skipCert = tlsConfig.rejectUnauthorized === false;
  const hasCaCert = !!tlsConfig.caCert;
  const hasMtls = !!(tlsConfig.clientCert || tlsConfig.clientKey);
  const hasTlsContent = skipCert || hasCaCert || hasMtls;

  // Derive a mode badge for the trigger row
  const modeLabel = hasMtls ? 'mTLS' : hasCaCert ? 'Custom CA' : skipCert ? 'Skip Verify' : null;
  const modeBadgeVariant = hasMtls ? 'mtls' : hasCaCert ? 'ca' : skipCert ? 'skip' : null;

  if (!isWss) return null;

  // ── Trigger row (always visible in connect panel) ──
  const triggerRow = (
    <div className={`ws-tls-trigger${hasTlsContent ? ' ws-tls-trigger--active' : ''}`} data-testid="tls-panel">
      <span className="ws-tls-trigger-icon" aria-hidden="true">🔒</span>
      <span className="ws-tls-trigger-label">TLS / mTLS</span>
      {modeBadgeVariant && (
        <span className={`ws-tls-mode-badge ws-tls-mode-badge--${modeBadgeVariant}`} data-testid="tls-indicator">
          {modeLabel}
        </span>
      )}
      {!hasTlsContent && (
        <span className="ws-tls-trigger-hint">No certificates configured</span>
      )}
      <button
        className="ws-tls-trigger-btn"
        onClick={handleOpen}
        data-testid="tls-toggle"
        aria-haspopup="dialog"
      >
        {disabled ? 'View' : 'Configure'}
      </button>
    </div>
  );

  // ── Modal (portal-rendered, draggable + resizable) ──
  const modal = open ? createPortal(
    <AppModalFrame
      title={
        <span className="ws-tls-modal-title">
          <span aria-hidden="true">🔒</span> TLS / mTLS Configuration
        </span>
      }
      onClose={handleClose}
      overlayClassName="ws-tls-overlay"
      dialogClassName="ws-tls-modal"
      headerClassName="ws-tls-modal-header modal-header"
      bodyClassName="ws-tls-modal-body"
      footerClassName="ws-tls-modal-footer"
      titleId="ws-tls-modal-title"
      showExpandButton={false}
      showResizeHandles={false}
      closeButtonKind="none"
      minWidth={460}
      minHeight={320}
      footer={
        <>
          <button className="ws-connect-btn" onClick={handleCancel} data-testid="tls-cancel">
            Cancel
          </button>
          <button className="ws-connect-btn ws-connect-btn-primary" onClick={handleSave} disabled={!dirty} data-testid="tls-save">
            Save
          </button>
          <button className="ws-connect-btn" onClick={handleClose} data-testid="tls-close">
            Close
          </button>
        </>
      }
    >
      <div data-testid="tls-body">

        {/* Proxy notice */}
        {!isProxyMode && !isTauri() && (
          <div className="ws-tls-notice" data-testid="tls-proxy-notice">
            <span className="ws-tls-notice-icon" aria-hidden="true">ℹ</span>
            <span>TLS options apply only when the proxy transport is active (connections with custom headers). Direct browser connections use built-in TLS.</span>
          </div>
        )}

        {/* ── Section 1: Server Verification ── */}
        <div className="ws-tls-section">
          <div className="ws-tls-section-header">
            <span className="ws-tls-section-title">Server Verification</span>
          </div>
          <label className={`ws-tls-option-row${skipCert ? ' ws-tls-option-row--warn' : ''}`} data-testid="tls-reject-unauthorized">
            <div className="ws-tls-option-check">
              <input
                type="checkbox"
                checked={skipCert}
                onChange={(e) => handleTlsChange({ rejectUnauthorized: !e.target.checked })}
                disabled={disabled}
              />
            </div>
            <div className="ws-tls-option-text">
              <span className="ws-tls-option-label">Skip certificate validation</span>
              <span className="ws-tls-option-desc">Disables hostname and CA checks. Use only in dev/staging with self-signed certificates.</span>
            </div>
            {skipCert && <span className="ws-tls-warn-badge" aria-label="Warning: insecure">⚠</span>}
          </label>
        </div>

        {/* ── Section 2: CA Certificate ── */}
        <div className="ws-tls-section">
          <div className="ws-tls-section-header">
            <span className="ws-tls-section-title">CA Certificate</span>
            <span className="ws-tls-section-tag">Optional</span>
          </div>
          <p className="ws-tls-section-desc">
            Provide a custom Certificate Authority to trust — required when your server uses a private or self-signed CA. Also needed for mTLS when the server cert is not publicly trusted.
          </p>
          <div className="ws-tls-field">
            <div className="ws-tls-field-header">
              <label className="ws-tls-field-label" htmlFor="tls-ca-cert-input">CA Certificate (PEM)</label>
              {hasCaCert && <span className="ws-tls-field-set-badge">Set</span>}
            </div>
            <textarea
              id="tls-ca-cert-input"
              className="ws-tls-textarea"
              value={tlsConfig.caCert ?? ''}
              onChange={(e) => handleTlsChange({ caCert: e.target.value || undefined })}
              placeholder="Paste your CA certificate in PEM format…"
              rows={5}
              disabled={disabled}
              data-testid="tls-ca-cert"
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
            Mutual TLS — the server requires you to present a certificate proving your identity. Both fields below are required. If the server uses a private CA, also fill in the CA Certificate above.
          </p>
          <div className="ws-tls-field">
            <div className="ws-tls-field-header">
              <label className="ws-tls-field-label" htmlFor="tls-client-cert-input">Client Certificate (PEM)</label>
              {!!tlsConfig.clientCert && <span className="ws-tls-field-set-badge">Set</span>}
            </div>
            <textarea
              id="tls-client-cert-input"
              className="ws-tls-textarea"
              value={tlsConfig.clientCert ?? ''}
              onChange={(e) => handleTlsChange({ clientCert: e.target.value || undefined })}
              placeholder="Paste your client certificate in PEM format…"
              rows={5}
              disabled={disabled}
              data-testid="tls-client-cert"
              spellCheck={false}
            />
          </div>
          <div className="ws-tls-field">
            <div className="ws-tls-field-header">
              <label className="ws-tls-field-label" htmlFor="tls-client-key-input">Client Private Key (PEM)</label>
              {!!tlsConfig.clientKey && <span className="ws-tls-field-set-badge">Set</span>}
            </div>
            <textarea
              id="tls-client-key-input"
              className="ws-tls-textarea"
              value={tlsConfig.clientKey ?? ''}
              onChange={(e) => handleTlsChange({ clientKey: e.target.value || undefined })}
              placeholder="Paste your client private key in PEM format…"
              rows={5}
              disabled={disabled}
              data-testid="tls-client-key"
              spellCheck={false}
            />
          </div>
        </div>

      </div>
    </AppModalFrame>,
    document.body,
  ) : null;

  return (
    <>
      {triggerRow}
      {modal}
    </>
  );
}
