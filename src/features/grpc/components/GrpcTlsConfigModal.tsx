/**
 * gRPC TLS configuration modal (Phase 4J-B).
 * Tri-mode + GrpcSecretField masking — not the shared GQL/WS TlsConfigModal.
 */
import { createPortal } from 'react-dom';
import type { GrpcTlsConfig, GrpcTlsMode } from '../../../shared/grpc/contracts';
import type { GrpcTlsValidationIssue } from '../../../shared/grpc/grpcTlsPolicy';
import type { GrpcMaskedSecretFields, GrpcTlsSecretFieldKey } from '../utils/grpcSecretFieldUi';
import { GrpcTlsConfigBody, type GrpcTlsTestResult } from './GrpcTlsConfigBody';
import AppModalFrame from '../../../shared/components/AppModalFrame';

export interface GrpcTlsConfigModalProps {
  open: boolean;
  tlsMode: GrpcTlsMode;
  tlsConfig: GrpcTlsConfig | undefined;
  issues: GrpcTlsValidationIssue[];
  maskedSecretFields?: GrpcMaskedSecretFields['tls'];
  dirty: boolean;
  disabled?: boolean;
  testResult?: GrpcTlsTestResult | null;
  onTlsModeChange: (mode: GrpcTlsMode) => void;
  onTlsConfigChange: (patch: Partial<GrpcTlsConfig>) => void;
  onUnmaskSecretField?: (field: GrpcTlsSecretFieldKey) => void;
  onClearSecretField?: (field: GrpcTlsSecretFieldKey) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
  onTestConnection?: () => void;
  onResetDefaults?: () => void;
}

export function GrpcTlsConfigModal({
  open,
  tlsMode,
  tlsConfig,
  issues,
  maskedSecretFields,
  dirty,
  disabled = false,
  testResult,
  onTlsModeChange,
  onTlsConfigChange,
  onUnmaskSecretField,
  onClearSecretField,
  onSave,
  onCancel,
  onClose,
  onTestConnection,
  onResetDefaults,
}: GrpcTlsConfigModalProps) {
  if (!open) return null;

  return createPortal(
    <AppModalFrame
      title={
        <span className="ws-tls-modal-title">
          <span aria-hidden="true">🔒</span> TLS / mTLS Configuration
        </span>
      }
      onClose={onClose}
      overlayClassName="ws-tls-overlay"
      dialogClassName="ws-tls-modal grpc-tls-config-modal"
      headerClassName="ws-tls-modal-header modal-header"
      bodyClassName="ws-tls-modal-body"
      footerClassName="ws-tls-modal-footer grpc-tls-config-modal-footer"
      titleId="grpc-tls-modal-title"
      showExpandButton={false}
      showResizeHandles
      closeButtonKind="none"
      minWidth={720}
      minHeight={520}
      footer={
        <>
          <div className="grpc-tls-modal-footer-group grpc-tls-modal-footer-group--left">
            {onTestConnection && (
              <button
                type="button"
                className="btn btn-ghost btn-sm grpc-tls-test-btn"
                onClick={onTestConnection}
                disabled={disabled}
                data-testid="grpc-tls-test"
              >
                Test TLS Connection
              </button>
            )}
            {onResetDefaults && (
              <button
                type="button"
                className="btn btn-ghost btn-sm grpc-tls-reset-btn"
                onClick={onResetDefaults}
                disabled={disabled}
                data-testid="grpc-tls-reset"
              >
                Reset to Defaults
              </button>
            )}
          </div>
          <div className="grpc-tls-modal-footer-group grpc-tls-modal-footer-group--right">
            <button
              type="button"
              className="btn"
              onClick={onCancel}
              data-testid="grpc-tls-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSave}
              disabled={!dirty}
              data-testid="grpc-tls-save"
            >
              Save
            </button>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              data-testid="grpc-tls-close"
            >
              Close
            </button>
          </div>
        </>
      }
    >
      <GrpcTlsConfigBody
        tlsMode={tlsMode}
        tlsConfig={tlsConfig}
        issues={issues}
        maskedSecretFields={maskedSecretFields}
        disabled={disabled}
        testResult={testResult}
        onTlsModeChange={onTlsModeChange}
        onTlsConfigChange={onTlsConfigChange}
        onUnmaskSecretField={onUnmaskSecretField}
        onClearSecretField={onClearSecretField}
      />
    </AppModalFrame>,
    document.body,
  );
}
