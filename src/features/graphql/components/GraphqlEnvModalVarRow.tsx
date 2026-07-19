import { useState } from 'react';
import type { GraphqlEnvironmentVariable } from '../../../shared/types/graphql';

function MaskedInput({
  value,
  onChange,
  placeholder,
  masked,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  masked: boolean;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  if (!masked) {
    return (
      <input
        type="text"
        className="gql-env-var-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-label="Variable value"
      />
    );
  }

  return (
    <div className="gql-env-masked-wrap">
      <input
        type={visible ? 'text' : 'password'}
        className="gql-env-var-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        spellCheck={false}
        disabled={disabled}
        aria-label="Variable value (secret)"
      />
      <button
        type="button"
        className="gql-env-masked-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide value' : 'Show value'}
        title={visible ? 'Hide' : 'Show'}
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
  );
}

function isVariableMasked(variable: GraphqlEnvironmentVariable): boolean {
  return variable.masked !== false;
}

export function GraphqlEnvModalVarRow({
  variable,
  onChange,
  onRemove,
}: {
  variable: GraphqlEnvironmentVariable & { _id: string };
  onChange: (patch: Partial<GraphqlEnvironmentVariable>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`gql-env-var-row${variable.enabled ? '' : ' gql-env-var-row--disabled'}`} data-testid="gql-env-var-row">
      <label className="gql-env-var-enable" title={variable.enabled ? 'Enabled — included in {{KEY}} resolution' : 'Disabled — skipped at runtime'}>
        <input
          type="checkbox"
          className="gql-env-var-enable__input"
          checked={variable.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          aria-label={`Enable variable ${variable.key || 'row'}`}
        />
        <span className="gql-env-var-enable__box" aria-hidden="true" />
      </label>

      <input
        type="text"
        className="gql-env-var-key"
        value={variable.key}
        onChange={(e) => onChange({ key: e.target.value })}
        placeholder="variableName"
        spellCheck={false}
        autoComplete="off"
        aria-label="Variable key"
        data-testid="gql-env-var-key"
      />

      <div className="gql-env-var-value-cell">
        <MaskedInput
          value={variable.value}
          onChange={(v) => onChange({ value: v })}
          placeholder="Enter value"
          masked={isVariableMasked(variable)}
        />
      </div>

      <div className="gql-env-var-row-actions">
        <button
          type="button"
          className={`gql-env-var-secret-toggle${isVariableMasked(variable) ? ' gql-env-var-secret-toggle--active' : ''}`}
          onClick={() => onChange({ masked: !isVariableMasked(variable) })}
          aria-label={
            isVariableMasked(variable)
              ? 'Show value in plain text (still editable)'
              : 'Hide value as secret (mask with dots)'
          }
          title={
            isVariableMasked(variable)
              ? 'Secret — value hidden in UI (click to show plain text; field stays editable)'
              : 'Mark as secret — hide value with •••• in the UI'
          }
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>

        <button
          type="button"
          className="gql-env-var-remove"
          onClick={onRemove}
          aria-label={`Remove variable ${variable.key || 'row'}`}
          title="Remove variable"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
