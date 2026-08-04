import { useCallback, useRef, useState } from 'react';
import type { WsTlsConfig } from '../../shared/websocket/types';
import { isTauri } from '../../shared/utils/platform';
import { TlsConfigModal, type TlsValues } from '../../shared/components/TlsConfigModal';

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

  const handleTlsChange = useCallback((patch: Partial<TlsValues>) => {
    setDirty(true);
    // Map normalised TlsValues back to WsTlsConfig
    const wsPatch: Partial<WsTlsConfig> = {};
    if (patch.skipVerify !== undefined) wsPatch.rejectUnauthorized = !patch.skipVerify;
    if ('caCert' in patch) wsPatch.caCert = patch.caCert;
    if ('clientCert' in patch) wsPatch.clientCert = patch.clientCert;
    if ('clientKey' in patch) wsPatch.clientKey = patch.clientKey;
    onTlsChange(wsPatch);
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

  // Normalise WsTlsConfig → TlsValues for the shared modal
  const tlsValues: TlsValues = {
    skipVerify: skipCert,
    caCert: tlsConfig.caCert,
    clientCert: tlsConfig.clientCert,
    clientKey: tlsConfig.clientKey,
  };

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

  return (
    <>
      {triggerRow}
      <TlsConfigModal
        open={open}
        values={tlsValues}
        onChange={handleTlsChange}
        onSave={handleSave}
        onCancel={handleCancel}
        onClose={handleClose}
        dirty={dirty}
        disabled={disabled}
        testIdPrefix="tls"
        proxyNotice={
          !isProxyMode && !isTauri()
            ? 'In browser Direct mode, TLS options are handled by the browser itself. Custom options (skip-cert, CA, mTLS) require the Proxy transport.'
            : undefined
        }
      />
    </>
  );
}

