import { useState } from 'react';
import type { WsTlsConfig } from '../../shared/websocket/types';

export interface WebSocketTlsPanelProps {
  tlsConfig: WsTlsConfig;
  onTlsChange: (patch: Partial<WsTlsConfig>) => void;
  isWss: boolean;
  isProxyMode: boolean;
}

export function WebSocketTlsPanel({
  tlsConfig,
  onTlsChange,
  isWss,
  isProxyMode,
}: WebSocketTlsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const hasTlsContent = !!(tlsConfig.caCert || tlsConfig.clientCert || tlsConfig.clientKey || tlsConfig.rejectUnauthorized === false);

  if (!isWss) return null;

  return (
    <div className="ws-tls-panel" data-testid="tls-panel">
      <button
        className="ws-tls-toggle"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        data-testid="tls-toggle"
      >
        <span className="ws-tls-toggle-icon">{expanded ? '▾' : '▸'}</span>
        <span className="ws-tls-toggle-label">TLS / mTLS Configuration</span>
        {hasTlsContent && <span className="ws-tls-indicator" data-testid="tls-indicator">●</span>}
      </button>

      {expanded && (
        <div className="ws-tls-body" data-testid="tls-body">
          {!isProxyMode && (
            <div className="ws-tls-info-banner" data-testid="tls-proxy-notice">
              TLS options only apply when using the proxy transport (connections with custom headers).
              Direct browser connections use built-in TLS handling.
            </div>
          )}

          <label className="ws-tls-checkbox-row" data-testid="tls-reject-unauthorized">
            <input
              type="checkbox"
              checked={tlsConfig.rejectUnauthorized === false}
              onChange={(e) => onTlsChange({ rejectUnauthorized: !e.target.checked })}
            />
            <span>Skip certificate validation (insecure — for dev/staging only)</span>
          </label>

          <div className="ws-tls-field">
            <label className="ws-tls-field-label">CA Certificate (PEM)</label>
            <textarea
              className="ws-tls-textarea"
              value={tlsConfig.caCert ?? ''}
              onChange={(e) => onTlsChange({ caCert: e.target.value || undefined })}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              rows={4}
              data-testid="tls-ca-cert"
            />
          </div>

          <div className="ws-tls-field">
            <label className="ws-tls-field-label">Client Certificate (PEM) — for mTLS</label>
            <textarea
              className="ws-tls-textarea"
              value={tlsConfig.clientCert ?? ''}
              onChange={(e) => onTlsChange({ clientCert: e.target.value || undefined })}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              rows={4}
              data-testid="tls-client-cert"
            />
          </div>

          <div className="ws-tls-field">
            <label className="ws-tls-field-label">Client Private Key (PEM) — for mTLS</label>
            <textarea
              className="ws-tls-textarea"
              value={tlsConfig.clientKey ?? ''}
              onChange={(e) => onTlsChange({ clientKey: e.target.value || undefined })}
              placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
              rows={4}
              data-testid="tls-client-key"
            />
          </div>
        </div>
      )}
    </div>
  );
}
