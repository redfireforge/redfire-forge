import { useCallback, useEffect, useRef, useState } from 'react';
import type { GrpcTlsConfig, GrpcTlsMode } from '../../../shared/grpc/contracts';
import type { GrpcTlsValidationIssue } from '../../../shared/grpc/grpcTlsPolicy';
import { validateGrpcTlsConfigContract } from '../../../shared/grpc/grpcTlsPolicy';
import type { GrpcMaskedSecretFields, GrpcTlsSecretFieldKey } from '../utils/grpcSecretFieldUi';
import { GrpcTlsConfigModal } from './GrpcTlsConfigModal';

type TlsSnapshot = {
  tlsMode: GrpcTlsMode;
  tlsConfig: GrpcTlsConfig | undefined;
};

export interface GrpcTlsPanelProps {
  tlsMode: GrpcTlsMode | undefined;
  tlsConfig: GrpcTlsConfig | undefined;
  issues: GrpcTlsValidationIssue[];
  maskedSecretFields?: GrpcMaskedSecretFields['tls'];
  disabled?: boolean;
  /** Increment from connection bar TLS badge to open modal (Phase 4J-B). */
  openRequest?: number;
  /** Increment to dismiss modal without revert (Phase 4J-C — settings drawer). */
  closeRequest?: number;
  onTlsModeChange: (mode: GrpcTlsMode) => void;
  onTlsConfigChange: (patch: Partial<GrpcTlsConfig>) => void;
  /** Cancel restores full TLS snapshot atomically. */
  onTlsStateRestore?: (state: TlsSnapshot) => void;
  onUnmaskSecretField?: (field: GrpcTlsSecretFieldKey) => void;
  onClearSecretField?: (field: GrpcTlsSecretFieldKey) => void;
}

/**
 * Headless TLS modal host — no inline PEM on the main studio surface (Phase 4J-B).
 * Connection bar TLS badge opens via `openRequest`.
 */
export function GrpcTlsPanel({
  tlsMode,
  tlsConfig,
  issues,
  maskedSecretFields,
  disabled = false,
  openRequest = 0,
  closeRequest = 0,
  onTlsModeChange,
  onTlsConfigChange,
  onTlsStateRestore,
  onUnmaskSecretField,
  onClearSecretField,
}: GrpcTlsPanelProps) {
  const mode = tlsMode ?? 'disabled';
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const snapshotRef = useRef<TlsSnapshot | null>(null);
  const prevOpenRequestRef = useRef<number | null>(null);
  const prevCloseRequestRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevOpenRequestRef.current === null) {
      prevOpenRequestRef.current = openRequest;
      return;
    }
    if (openRequest > prevOpenRequestRef.current) {
      prevOpenRequestRef.current = openRequest;
      if (!open) {
        snapshotRef.current = { tlsMode: mode, tlsConfig };
        setDirty(false);
        setTestResult(null);
        setOpen(true);
      }
    }
  }, [openRequest, mode, tlsConfig, open]);

  useEffect(() => {
    if (prevCloseRequestRef.current === null) {
      prevCloseRequestRef.current = closeRequest;
      return;
    }
    if (closeRequest > prevCloseRequestRef.current) {
      prevCloseRequestRef.current = closeRequest;
      if (open) {
        setOpen(false);
        setTestResult(null);
      }
    }
  }, [closeRequest, open]);

  const handleTlsModeChange = useCallback((nextMode: GrpcTlsMode) => {
    setDirty(true);
    setTestResult(null);
    onTlsModeChange(nextMode);
  }, [onTlsModeChange]);

  const handleTlsConfigChange = useCallback((patch: Partial<GrpcTlsConfig>) => {
    setDirty(true);
    setTestResult(null);
    onTlsConfigChange(patch);
  }, [onTlsConfigChange]);

  const handleCancel = useCallback(() => {
    const snap = snapshotRef.current;
    if (snap) {
      if (onTlsStateRestore) {
        onTlsStateRestore(snap);
      } else {
        if (snap.tlsMode !== mode) {
          onTlsModeChange(snap.tlsMode);
        }
        onTlsConfigChange(snap.tlsConfig ?? {});
      }
    }
    setOpen(false);
    setTestResult(null);
  }, [mode, onTlsConfigChange, onTlsModeChange, onTlsStateRestore]);

  const handleSave = useCallback(() => {
    snapshotRef.current = { tlsMode: mode, tlsConfig };
    setDirty(false);
    setOpen(false);
    setTestResult(null);
  }, [mode, tlsConfig]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTestResult(null);
  }, []);

  const handleTestConnection = useCallback(() => {
    const validationIssues = validateGrpcTlsConfigContract(mode, tlsConfig);
    if (validationIssues.length === 0) {
      setTestResult(
        mode === 'disabled'
          ? 'Plaintext mode — no TLS handshake required.'
          : 'TLS configuration passed local validation.',
      );
      return;
    }
    setTestResult(validationIssues.map((issue) => issue.message).join(' '));
  }, [mode, tlsConfig]);

  const handleResetDefaults = useCallback(() => {
    setDirty(true);
    setTestResult(null);
    onTlsModeChange('disabled');
  }, [onTlsModeChange]);

  return (
    <div className="grpc-tls-panel-host" data-testid="grpc-tls-panel">
      <GrpcTlsConfigModal
        open={open}
        tlsMode={mode}
        tlsConfig={tlsConfig}
        issues={issues}
        maskedSecretFields={maskedSecretFields}
        dirty={dirty}
        disabled={disabled}
        testResult={testResult}
        onTlsModeChange={handleTlsModeChange}
        onTlsConfigChange={handleTlsConfigChange}
        onUnmaskSecretField={onUnmaskSecretField}
        onClearSecretField={onClearSecretField}
        onSave={handleSave}
        onCancel={handleCancel}
        onClose={handleClose}
        onTestConnection={handleTestConnection}
        onResetDefaults={handleResetDefaults}
      />
    </div>
  );
}
