import { useState, type ChangeEvent } from 'react';
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
  const [visible, setVisible] = useState(false);
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
            <div className="grpc-secret-field-masked-wrap">
              <input
                id={id}
                className="grpc-auth-text-input"
                data-testid={testId}
                type={visible ? 'text' : 'password'}
                value={displayValue}
                disabled={disabled}
                autoComplete="off"
                placeholder={hasStoredValue ? undefined : placeholder}
                aria-describedby={hasStoredValue ? `${id}-stored-hint` : undefined}
                onChange={handleChange}
              />
              <button
                type="button"
                className="grpc-secret-field-visibility-toggle"
                data-testid={`${testId}-toggle-visibility`}
                disabled={disabled}
                aria-label={visible ? 'Hide value' : 'Show value'}
                title={visible ? 'Hide' : 'Show'}
                onClick={() => setVisible((prev) => !prev)}
              >
                {visible ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
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
