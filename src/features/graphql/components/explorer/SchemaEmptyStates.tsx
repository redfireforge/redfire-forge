/**
 * SchemaEmptyStates.tsx — empty / loading / error state panels for the Schema Explorer.
 *
 * All non-loaded states are extracted here so GraphqlSchemaExplorer.tsx can
 * focus purely on the loaded-schema layout.
 */

interface IntrospectButtonProps {
  onIntrospect?: () => void;
  introspecting: boolean;
  label: string;
  retryingLabel: string;
  variant?: 'default' | 'warn' | 'error';
}

function IntrospectButton({ onIntrospect, introspecting, label, retryingLabel, variant = 'default' }: IntrospectButtonProps) {
  if (!onIntrospect) return null;
  const variantClass = variant === 'warn'
    ? ' gql-se-empty-action--warn'
    : variant === 'error'
    ? ' gql-se-empty-action--error'
    : '';
  return (
    <button
      type="button"
      className={`gql-se-empty-action${variantClass}`}
      onClick={onIntrospect}
      disabled={introspecting}
      aria-label={introspecting ? retryingLabel : label}
      data-testid={variant === 'default' ? 'gql-se-idle-introspect-btn' : 'gql-se-retry-btn'}
    >
      {introspecting ? (
        <><span className="gql-se-btn-spinner" aria-hidden="true" />{retryingLabel}</>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

interface SchemaIdleStateProps {
  onIntrospect?: () => void;
  introspecting: boolean;
}

export function SchemaIdleState({ onIntrospect, introspecting }: SchemaIdleStateProps) {
  return (
    <div className="gql-se-empty" data-testid="gql-se-empty-idle">
      <div className="gql-se-empty-icon" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12h6M12 9v6" />
        </svg>
      </div>
      <div className="gql-se-empty-title">No schema loaded</div>
      <div className="gql-se-empty-desc">
        Fetch the GraphQL schema to explore types, fields, and their SDL definitions.
      </div>
      <IntrospectButton
        onIntrospect={onIntrospect}
        introspecting={introspecting}
        label="Introspect Schema"
        retryingLabel="Introspecting…"
      />
    </div>
  );
}

export function SchemaLoadingState() {
  return (
    <div className="gql-se-empty" data-testid="gql-se-loading">
      <div className="gql-se-spinner" aria-hidden="true" />
      <div className="gql-se-empty-title">Loading schema…</div>
      <div className="gql-se-empty-desc">Fetching and parsing introspection result.</div>
    </div>
  );
}

interface SchemaErrorStateProps {
  errorMessage?: string | null;
  onIntrospect?: () => void;
  introspecting: boolean;
}

export function SchemaIntrospectionDisabledState({ errorMessage, onIntrospect, introspecting }: SchemaErrorStateProps) {
  return (
    <div className="gql-se-empty gql-se-empty--warn" data-testid="gql-se-introspection-disabled">
      <div className="gql-se-empty-icon" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div className="gql-se-empty-title">Introspection disabled</div>
      <div className="gql-se-empty-desc">{errorMessage}</div>
      <IntrospectButton
        onIntrospect={onIntrospect}
        introspecting={introspecting}
        label="Retry"
        retryingLabel="Retrying…"
        variant="warn"
      />
    </div>
  );
}

export function SchemaErrorState({ errorMessage, onIntrospect, introspecting }: SchemaErrorStateProps) {
  return (
    <div className="gql-se-empty gql-se-empty--error" data-testid="gql-se-error">
      <div className="gql-se-empty-icon" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <div className="gql-se-empty-title">Introspection failed</div>
      <div className="gql-se-empty-desc">{errorMessage}</div>
      <IntrospectButton
        onIntrospect={onIntrospect}
        introspecting={introspecting}
        label="Retry"
        retryingLabel="Retrying…"
        variant="error"
      />
    </div>
  );
}
