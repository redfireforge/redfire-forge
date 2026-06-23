/**
 * GraphqlTlsPanel — CA certificate and mTLS client identity configuration.
 *
 * The connection bar SSL toggle is the quick skip-cert control; this modal
 * holds CA PEM, client cert, and client key (Lesson GQL-5 Phase 2 + 3).
 */

import { useCallback, useRef, useState } from 'react';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import { isTauri } from '../../../shared/utils/platform';
import { TlsConfigModal } from '../../../shared/components/TlsConfigModal';

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

  const modal = (
    <TlsConfigModal
      open={open}
      values={{
        skipVerify: skipTlsVerify,
        caCert,
        clientCert,
        clientKey,
      }}
      onChange={(patch) => {
        const gqlPatch: Partial<GqlTlsSettings> = {};
        if (patch.skipVerify !== undefined) gqlPatch.skipTlsVerify = patch.skipVerify;
        if ('caCert' in patch) gqlPatch.caCert = patch.caCert;
        if ('clientCert' in patch) gqlPatch.clientCert = patch.clientCert;
        if ('clientKey' in patch) gqlPatch.clientKey = patch.clientKey;
        handlePatch(gqlPatch);
      }}
      onSave={handleSave}
      onCancel={handleCancel}
      onClose={handleClose}
      dirty={dirty}
      disabled={disabled}
      testIdPrefix="gql-tls"
      proxyNotice={
        !isTauri()
          ? <>
              In web mode, HTTPS requests with custom TLS settings route through the Vite{' '}
              <code>/__proxy</code> middleware. On Tauri desktop, the same settings route through
              the Node.js proxy on port 3001.
            </>
          : undefined
      }
    />
  );

  return (
    <div data-testid="gql-tls-panel">
      {configureBtn}
      {modal}
    </div>
  );
}
