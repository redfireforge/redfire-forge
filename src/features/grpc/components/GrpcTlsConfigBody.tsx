/**
 * Shared TLS configuration form body (Phase 4J-C).
 * Uses the same ws-tls-* CSS classes as SharedTlsConfigPanel / GraphQL so
 * both protocols share identical visual layout.
 */
import type { ChangeEvent } from 'react';
import type { GrpcTlsConfig, GrpcTlsMode } from '../../../shared/grpc/contracts';
import type { GrpcTlsValidationIssue } from '../../../shared/grpc/grpcTlsPolicy';
import type { GrpcMaskedSecretFields, GrpcTlsSecretFieldKey } from '../utils/grpcSecretFieldUi';
import { GRPC_SECRET_STORED_LABEL } from '../utils/grpcSecretFieldUi';

const TLS_MODE_OPTIONS: Array<{ value: GrpcTlsMode; label: string; hint: string; icon: string }> = [
  { value: 'disabled', label: 'Plaintext', hint: 'No TLS — HTTP/2 cleartext', icon: '🔓' },
  { value: 'tls', label: 'TLS', hint: 'Server verification with optional custom CA', icon: '🔒' },
  { value: 'mtls', label: 'mTLS', hint: 'Mutual TLS — client cert + key required', icon: '🛡' },
];

export type GrpcTlsTestResult = {
  message: string;
  ok: boolean;
};

export interface GrpcTlsConfigBodyProps {
  tlsMode: GrpcTlsMode;
  tlsConfig: GrpcTlsConfig | undefined;
  issues: GrpcTlsValidationIssue[];
  maskedSecretFields?: GrpcMaskedSecretFields['tls'];
  disabled?: boolean;
  testResult?: GrpcTlsTestResult | null;
  onTlsModeChange: (mode: GrpcTlsMode) => void;
  onTlsConfigChange: (patch: Partial<GrpcTlsConfig>) => void;
  onUnmaskSecretField?: (field: GrpcTlsSecretFieldKey) => void;
  onClearSecretField?: (field: GrpcTlsSecretFieldKey) => void;
  onTestConnection?: () => void;
  onResetDefaults?: () => void;
  /** Workflow config uses a compact TLS mode dropdown — hide duplicate mode cards. */
  hideModePicker?: boolean;
}

interface PemFieldProps {
  id: string;
  label: string;
  testId: string;
  value: string;
  masked: boolean;
  disabled: boolean;
  placeholder: string;
  fieldIssue?: string;
  onChange: (value: string) => void;
  onUnmask: () => void;
  onClearStored?: () => void;
}

function PemField({
  id, label, testId, value, masked, disabled, placeholder, fieldIssue,
  onChange, onUnmask, onClearStored,
}: PemFieldProps) {
  const hasStoredValue = masked && value.trim().length > 0;
  const displayValue = masked ? '' : value;
  const isSet = hasStoredValue || !!value.trim();

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (masked) onUnmask();
    onChange(e.target.value);
  };

  return (
    <div className="ws-tls-field">
      <div className="ws-tls-field-header">
        <label className="ws-tls-field-label" htmlFor={id}>{label}</label>
        {isSet && <span className="ws-tls-field-set-badge">Set</span>}
      </div>
      <textarea
        id={id}
        className="ws-tls-textarea"
        data-testid={testId}
        value={displayValue}
        disabled={disabled}
        spellCheck={false}
        rows={5}
        placeholder={hasStoredValue ? undefined : placeholder}
        aria-describedby={hasStoredValue ? `${testId}-stored-hint` : undefined}
        onChange={handleChange}
      />
      {hasStoredValue && onClearStored && (
        <>
          <p
            id={`${testId}-stored-hint`}
            className="grpc-secret-field-stored-hint"
            data-testid={`${testId}-stored-hint`}
            role="status"
          >
            {GRPC_SECRET_STORED_LABEL} — enter a new value to replace, or use Clear stored to remove.
          </p>
          <button
            type="button"
            className="grpc-secret-field-clear-btn"
            data-testid={`${testId}-clear`}
            disabled={disabled}
            onClick={onClearStored}
          >
            Clear stored
          </button>
        </>
      )}
      {fieldIssue && <p className="grpc-tls-field-error" role="alert">{fieldIssue}</p>}
    </div>
  );
}

export function GrpcTlsConfigBody({
  tlsMode, tlsConfig, issues, maskedSecretFields,
  disabled = false, testResult, hideModePicker = false,
  onTlsModeChange, onTlsConfigChange,
  onUnmaskSecretField, onClearSecretField,
  onTestConnection, onResetDefaults,
}: GrpcTlsConfigBodyProps) {
  const config = tlsConfig ?? {};
  const showTlsFields = tlsMode === 'tls' || tlsMode === 'mtls';
  const issuesByField = new Map(issues.map((issue) => [issue.field, issue.message]));

  return (
    <div data-testid="grpc-tls-body">

      {!hideModePicker && (
      <div className="ws-tls-section">
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
      )}

      {showTlsFields && (
        <>
          <div className="ws-tls-section">
            <div className="ws-tls-section-header">
              <span className="ws-tls-section-title">CA Certificate</span>
              <span className="ws-tls-section-tag">Optional</span>
            </div>
            <p className="ws-tls-section-desc">
              Provide a custom Certificate Authority to trust — required when your server uses a private
              or self-signed CA. Also needed for mTLS when the server cert is not publicly trusted.
            </p>
            <PemField
              id="grpc-tls-server-ca"
              label="Server CA (PEM)"
              testId="grpc-tls-server-ca"
              value={config.serverCaPem ?? ''}
              masked={!!maskedSecretFields?.serverCaPem}
              disabled={disabled}
              placeholder="-----BEGIN CERTIFICATE-----"
              fieldIssue={issuesByField.get('tlsConfig.serverCaPem')}
              onChange={(v) => onTlsConfigChange({ serverCaPem: v || undefined })}
              onUnmask={() => onUnmaskSecretField?.('serverCaPem')}
              onClearStored={() => onClearSecretField?.('serverCaPem')}
            />
          </div>

          {tlsMode === 'mtls' && (
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
              <PemField
                id="grpc-tls-client-cert"
                label="Client Certificate (PEM)"
                testId="grpc-tls-client-cert"
                value={config.clientCertPem ?? ''}
                masked={!!maskedSecretFields?.clientCertPem}
                disabled={disabled}
                placeholder="-----BEGIN CERTIFICATE-----"
                fieldIssue={issuesByField.get('tlsConfig.clientCertPem')}
                onChange={(v) => onTlsConfigChange({ clientCertPem: v || undefined })}
                onUnmask={() => onUnmaskSecretField?.('clientCertPem')}
                onClearStored={() => onClearSecretField?.('clientCertPem')}
              />
              <PemField
                id="grpc-tls-client-key"
                label="Client Private Key (PEM)"
                testId="grpc-tls-client-key"
                value={config.clientKeyPem ?? ''}
                masked={!!maskedSecretFields?.clientKeyPem}
                disabled={disabled}
                placeholder="-----BEGIN PRIVATE KEY-----"
                fieldIssue={issuesByField.get('tlsConfig.clientKeyPem')}
                onChange={(v) => onTlsConfigChange({ clientKeyPem: v || undefined })}
                onUnmask={() => onUnmaskSecretField?.('clientKeyPem')}
                onClearStored={() => onClearSecretField?.('clientKeyPem')}
              />
            </div>
          )}

          <div className="ws-tls-section">
            <div className="ws-tls-section-header">
              <span className="ws-tls-section-title">Server Name Override</span>
              <span className="ws-tls-section-tag">Optional</span>
            </div>
            <div className="ws-tls-field">
              <div className="ws-tls-field-header">
                <label className="ws-tls-field-label" htmlFor="grpc-tls-server-name">
                  SNI hostname
                </label>
              </div>
              <input
                id="grpc-tls-server-name"
                className="grpc-tls-text-input"
                data-testid="grpc-tls-server-name"
                type="text"
                value={config.serverNameOverride ?? ''}
                disabled={disabled}
                placeholder="grpc.example.com"
                spellCheck={false}
                onChange={(e) => onTlsConfigChange({ serverNameOverride: e.target.value || undefined })}
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
        <p
          className={`grpc-tls-test-result grpc-tls-test-result--${testResult.ok ? 'ok' : 'fail'}`}
          data-testid="grpc-tls-test-result"
          role="status"
        >
          {testResult.message}
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
