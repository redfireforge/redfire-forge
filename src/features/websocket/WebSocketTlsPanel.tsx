import { useState } from 'react';
import type { WsTlsConfig } from '../../shared/websocket/types';
import { isTauri } from '../../shared/utils/platform';

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
  const [expanded, setExpanded] = useState(false);

  const skipCert = tlsConfig.rejectUnauthorized === false;
  const hasCaCert = !!tlsConfig.caCert;
  const hasMtls = !!(tlsConfig.clientCert || tlsConfig.clientKey);
  const hasTlsContent = skipCert || hasCaCert || hasMtls;

  // Derive a mode badge for the header
  const modeLabel = hasMtls ? 'mTLS' : hasCaCert ? 'Custom CA' : skipCert ? 'Skip Verify' : null;

  if (!isWss) return null;

  return (
    <div className={`ws-tls-panel${hasTlsContent ? ' ws-tls-panel--active' : ''}`} data-testid="tls-panel">

      {/* ── Collapsible header ── */}
      <button
        className="ws-tls-toggle"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        data-testid="tls-toggle"
      >
        <span className="ws-tls-toggle-chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="ws-tls-toggle-icon-lock" aria-hidden="true">🔒</span>
        <span className="ws-tls-toggle-label">TLS / mTLS</span>
        {modeLabel && (
          <span className={`ws-tls-mode-badge ws-tls-mode-badge--${hasMtls ? 'mtls' : hasCaCert ? 'ca' : 'skip'}`} data-testid="tls-indicator">
            {modeLabel}
          </span>
        )}
        {!modeLabel && !hasTlsContent && (
          <span className="ws-tls-toggle-hint">Certificate &amp; key options</span>
        )}
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="ws-tls-body" data-testid="tls-body">

          {/* Proxy-mode notice */}
          {!isProxyMode && !isTauri() && (
            <div className="ws-tls-notice" data-testid="tls-proxy-notice">
              <span className="ws-tls-notice-icon" aria-hidden="true">ℹ</span>
              <span>TLS options apply only when the proxy transport is active (i.e. when custom headers are set). Direct browser connections use built-in TLS.</span>
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
                  onChange={(e) => onTlsChange({ rejectUnauthorized: !e.target.checked })}
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
              Provide a custom Certificate Authority to trust — required when your server uses a private or self-signed CA.
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
                onChange={(e) => onTlsChange({ caCert: e.target.value || undefined })}
                placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
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
              Mutual TLS — present a client certificate so the server can authenticate you, not just you authenticating the server.
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
                onChange={(e) => onTlsChange({ clientCert: e.target.value || undefined })}
                placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
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
                onChange={(e) => onTlsChange({ clientKey: e.target.value || undefined })}
                placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
                rows={5}
                disabled={disabled}
                data-testid="tls-client-key"
                spellCheck={false}
              />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
