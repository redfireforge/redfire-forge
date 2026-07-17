/**
 * SharedTlsConfigPanel — reusable TLS / mTLS configuration panel body.
 * Used by TlsConfigModal (WebSocket/GraphQL) and GrpcTlsMtlsModal (gRPC with tri-mode).
 *
 * This component encapsulates the three common sections:
 * 1. Server Verification (skip certificate validation)
 * 2. CA Certificate (optional PEM)
 * 3. Client Identity / mTLS (client cert + key for mTLS)
 *
 * Callers can optionally render a mode selector or other custom header above this panel.
 */

import type { ReactNode } from 'react';

export interface SharedTlsValues {
  skipVerify: boolean;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
}

export interface SharedTlsConfigPanelProps {
  /** Current TLS field values. */
  values: SharedTlsValues;
  /** Called whenever the user edits a field. */
  onChange: (patch: Partial<SharedTlsValues>) => void;
  /** Disable all form fields (read-only view). */
  disabled?: boolean;
  /**
   * Prefix used for both `data-testid` and `id`/`htmlFor` attributes.
   * Examples: `'tls'` → `tls-ca-cert`, `'gql-tls'` → `gql-tls-ca-cert`
   * @default 'tls'
   */
  testIdPrefix?: string;
  /**
   * Optional custom header rendered above the panel sections.
   * Used by gRPC to render the tri-mode selector (Plaintext / TLS / mTLS).
   */
  headerSlot?: ReactNode;
  /**
   * Optional informational notice rendered at the top of the body sections.
   * Used by WebSocket to show proxy/routing notice.
   */
  noticeSlot?: ReactNode;
}

export function SharedTlsConfigPanel({
  values,
  onChange,
  disabled = false,
  testIdPrefix = 'tls',
  headerSlot,
  noticeSlot,
}: SharedTlsConfigPanelProps) {
  const p = testIdPrefix; // short alias
  const { skipVerify, caCert, clientCert, clientKey } = values;

  const hasCaCert = !!caCert?.trim();
  const hasClientCert = !!clientCert?.trim();
  const hasClientKey = !!clientKey?.trim();

  return (
    <div data-testid={`${p}-panel`}>
      {/* Optional custom header (e.g., tri-mode selector for gRPC) */}
      {headerSlot}

      {/* Optional notice (e.g., proxy notice for WebSocket) */}
      {noticeSlot != null && (
        <div className="ws-tls-notice" data-testid={`${p}-proxy-notice`}>
          <span className="ws-tls-notice-icon" aria-hidden="true">ℹ</span>
          <span>{noticeSlot}</span>
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
  );
}
