/**
 * Shared TLS configuration form body (Phase 4J-C).
 * Used by GrpcTlsConfigModal and GrpcConnectionSettingsDrawer.
 */
import type { GrpcTlsConfig, GrpcTlsMode } from '../../../shared/grpc/contracts';
import type { GrpcTlsValidationIssue } from '../../../shared/grpc/grpcTlsPolicy';
import type { GrpcMaskedSecretFields, GrpcTlsSecretFieldKey } from '../utils/grpcSecretFieldUi';
import { GrpcSecretField } from './GrpcSecretField';

const TLS_MODE_OPTIONS: Array<{ value: GrpcTlsMode; label: string; hint: string; icon: string }> = [
  { value: 'disabled', label: 'Plaintext', hint: 'No TLS — HTTP/2 cleartext', icon: '🔓' },
  { value: 'tls', label: 'TLS', hint: 'Server verification with optional custom CA', icon: '🔒' },
  { value: 'mtls', label: 'mTLS', hint: 'Mutual TLS — client cert + key required', icon: '🛡' },
];

export interface GrpcTlsConfigBodyProps {
  tlsMode: GrpcTlsMode;
  tlsConfig: GrpcTlsConfig | undefined;
  issues: GrpcTlsValidationIssue[];
  maskedSecretFields?: GrpcMaskedSecretFields['tls'];
  disabled?: boolean;
  testResult?: string | null;
  onTlsModeChange: (mode: GrpcTlsMode) => void;
  onTlsConfigChange: (patch: Partial<GrpcTlsConfig>) => void;
  onUnmaskSecretField?: (field: GrpcTlsSecretFieldKey) => void;
  onClearSecretField?: (field: GrpcTlsSecretFieldKey) => void;
  onTestConnection?: () => void;
  onResetDefaults?: () => void;
}

export function GrpcTlsConfigBody({
  tlsMode,
  tlsConfig,
  issues,
  maskedSecretFields,
  disabled = false,
  testResult,
  onTlsModeChange,
  onTlsConfigChange,
  onUnmaskSecretField,
  onClearSecretField,
  onTestConnection,
  onResetDefaults,
}: GrpcTlsConfigBodyProps) {
  const config = tlsConfig ?? {};
  const showTlsFields = tlsMode === 'tls' || tlsMode === 'mtls';
  const issuesByField = new Map(issues.map((issue) => [issue.field, issue.message]));

  return (
    <div data-testid="grpc-tls-body">
      <div className="grpc-tls-modal-mode-section">
        <div className="ws-tls-section-header">
          <span className="ws-tls-section-title">TLS mode</span>
        </div>
        <div className="grpc-tls-mode-row" role="group" aria-label="TLS mode">
          {TLS_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`grpc-tls-mode-option grpc-tls-mode-option--btn${tlsMode === option.value ? ' grpc-tls-mode-option--active' : ''}`}
              data-testid={`grpc-tls-mode-${option.value}`}
              disabled={disabled}
              aria-pressed={tlsMode === option.value}
              onClick={() => onTlsModeChange(option.value)}
            >
              <span className="grpc-tls-mode-icon" aria-hidden="true">{option.icon}</span>
              <span className="grpc-tls-mode-label">{option.label}</span>
              <span className="grpc-tls-mode-hint">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {showTlsFields && (
        <>
          <GrpcSecretField
            id="grpc-tls-server-ca"
            label="Server CA (optional)"
            testId="grpc-tls-server-ca"
            value={config.serverCaPem ?? ''}
            masked={!!maskedSecretFields?.serverCaPem}
            disabled={disabled}
            multiline
            placeholder="-----BEGIN CERTIFICATE-----"
            onChange={(value) => onTlsConfigChange({ serverCaPem: value || undefined })}
            onUnmask={() => onUnmaskSecretField?.('serverCaPem')}
            onClearStored={() => onClearSecretField?.('serverCaPem')}
          />
          {issuesByField.get('tlsConfig.serverCaPem') && (
            <p className="grpc-tls-field-error" role="alert">
              {issuesByField.get('tlsConfig.serverCaPem')}
            </p>
          )}

          {tlsMode === 'mtls' && (
            <>
              <GrpcSecretField
                id="grpc-tls-client-cert"
                label="Client certificate"
                testId="grpc-tls-client-cert"
                value={config.clientCertPem ?? ''}
                masked={!!maskedSecretFields?.clientCertPem}
                disabled={disabled}
                multiline
                placeholder="-----BEGIN CERTIFICATE-----"
                onChange={(value) => onTlsConfigChange({ clientCertPem: value || undefined })}
                onUnmask={() => onUnmaskSecretField?.('clientCertPem')}
                onClearStored={() => onClearSecretField?.('clientCertPem')}
              />
              {issuesByField.get('tlsConfig.clientCertPem') && (
                <p className="grpc-tls-field-error" role="alert">
                  {issuesByField.get('tlsConfig.clientCertPem')}
                </p>
              )}

              <GrpcSecretField
                id="grpc-tls-client-key"
                label="Client private key"
                testId="grpc-tls-client-key"
                value={config.clientKeyPem ?? ''}
                masked={!!maskedSecretFields?.clientKeyPem}
                disabled={disabled}
                multiline
                placeholder="-----BEGIN PRIVATE KEY-----"
                onChange={(value) => onTlsConfigChange({ clientKeyPem: value || undefined })}
                onUnmask={() => onUnmaskSecretField?.('clientKeyPem')}
                onClearStored={() => onClearSecretField?.('clientKeyPem')}
              />
              {issuesByField.get('tlsConfig.clientKeyPem') && (
                <p className="grpc-tls-field-error" role="alert">
                  {issuesByField.get('tlsConfig.clientKeyPem')}
                </p>
              )}
            </>
          )}

          <div className="grpc-tls-form-row">
            <label className="grpc-tls-form-label" htmlFor="grpc-tls-server-name">
              Server name override
            </label>
            <div className="grpc-tls-form-ctrl">
              <input
                id="grpc-tls-server-name"
                className="grpc-tls-text-input"
                data-testid="grpc-tls-server-name"
                type="text"
                value={config.serverNameOverride ?? ''}
                disabled={disabled}
                placeholder="grpc.example.com"
                spellCheck={false}
                onChange={(event) => onTlsConfigChange({
                  serverNameOverride: event.target.value || undefined,
                })}
              />
            </div>
          </div>
        </>
      )}

      {issues.length > 0 && (
        <ul className="grpc-tls-issues" data-testid="grpc-tls-issues" role="alert">
          {issues.map((issue) => (
            <li key={`${issue.field}:${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      )}

      {testResult && (
        <p className="grpc-tls-test-result" data-testid="grpc-tls-test-result" role="status">
          {testResult}
        </p>
      )}

      {(onTestConnection || onResetDefaults) && (
        <div className="grpc-tls-drawer-actions">
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
      )}
    </div>
  );
}
