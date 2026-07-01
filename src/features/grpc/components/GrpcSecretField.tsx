import type { ChangeEvent } from 'react';
import { GRPC_SECRET_STORED_LABEL } from '../utils/grpcSecretFieldUi';

export interface GrpcSecretFieldProps {
  id: string;
  label: string;
  testId: string;
  value: string;
  masked: boolean;
  disabled?: boolean;
  multiline?: boolean;
  placeholder?: string;
  /** Use auth panel two-tone rows (152px label) instead of TLS modal rows. */
  layout?: 'auth' | 'tls';
  onChange: (value: string) => void;
  onUnmask: () => void;
  onClearStored?: () => void;
}

export function GrpcSecretField({
  id,
  label,
  testId,
  value,
  masked,
  disabled = false,
  multiline = false,
  placeholder,
  layout = 'tls',
  onChange,
  onUnmask,
  onClearStored,
}: GrpcSecretFieldProps) {
  const hasStoredValue = masked && value.trim().length > 0;
  const displayValue = masked ? '' : value;
  const isAuthLayout = layout === 'auth';
  const rowClass = isAuthLayout ? 'grpc-auth-form-row' : 'grpc-tls-form-row';
  const labelClass = isAuthLayout ? 'grpc-auth-form-label' : 'grpc-tls-form-label';
  const ctrlClass = isAuthLayout
    ? 'grpc-auth-form-ctrl grpc-secret-field-ctrl'
    : 'grpc-tls-form-ctrl grpc-secret-field-ctrl';

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (masked) onUnmask();
    onChange(event.target.value);
  };

  const handleClearStored = () => {
    onClearStored?.();
  };

  return (
    <div className={`grpc-secret-field${isAuthLayout ? ' grpc-secret-field--auth' : ''}`}>
      <div className={rowClass}>
        <label className={labelClass} htmlFor={id}>
          {label}
        </label>
        <div className={ctrlClass}>
          {multiline ? (
            <textarea
              id={id}
              className="grpc-tls-pem-input"
              data-testid={testId}
              value={displayValue}
              disabled={disabled}
              spellCheck={false}
              rows={4}
              placeholder={hasStoredValue ? undefined : placeholder}
              aria-describedby={hasStoredValue ? `${id}-stored-hint` : undefined}
              onChange={handleChange}
            />
          ) : (
            <input
              id={id}
              className="grpc-auth-text-input"
              data-testid={testId}
              type="password"
              value={displayValue}
              disabled={disabled}
              autoComplete="off"
              placeholder={hasStoredValue ? undefined : placeholder}
              aria-describedby={hasStoredValue ? `${id}-stored-hint` : undefined}
              onChange={handleChange}
            />
          )}
          {hasStoredValue && onClearStored && (
            <button
              type="button"
              className="grpc-secret-field-clear-btn"
              data-testid={`${testId}-clear`}
              disabled={disabled}
              aria-label={`Clear stored ${label}`}
              onClick={handleClearStored}
            >
              Clear stored
            </button>
          )}
        </div>
      </div>
      {hasStoredValue && (
        <p
          id={`${id}-stored-hint`}
          className="grpc-secret-field-stored-hint"
          data-testid={`${testId}-stored-hint`}
          role="status"
        >
          {GRPC_SECRET_STORED_LABEL}
          {' — '}
          enter a new value to replace, or use Clear stored to remove.
        </p>
      )}
    </div>
  );
}
