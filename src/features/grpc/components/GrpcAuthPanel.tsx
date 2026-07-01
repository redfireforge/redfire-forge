import type { GrpcAuthConfig, GrpcAuthType } from '../../../shared/grpc/contracts';
import { isGrpcSecretMetadataKey } from '../../../shared/grpc/grpcSecretPolicy';
import type { GrpcAuthPreviewResult } from '../utils/grpcAuthPreview';
import type { GrpcAuthSecretFieldKey, GrpcMaskedSecretFields } from '../utils/grpcSecretFieldUi';
import { GrpcSecretField } from './GrpcSecretField';

const AUTH_TYPES: Array<{ value: GrpcAuthType; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer' },
  { value: 'basic', label: 'Basic' },
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth2' },
];

export interface GrpcAuthPanelProps {
  auth: GrpcAuthConfig | undefined;
  preview: GrpcAuthPreviewResult;
  maskedSecretFields?: GrpcMaskedSecretFields['auth'];
  disabled?: boolean;
  onChange: (auth: GrpcAuthConfig | undefined) => void;
  onUnmaskSecretField?: (field: GrpcAuthSecretFieldKey) => void;
  onClearSecretField?: (field: GrpcAuthSecretFieldKey) => void;
}

function resolveAuthType(auth: GrpcAuthConfig | undefined): GrpcAuthType {
  return auth?.type ?? 'none';
}

function maskConflictValue(key: string, value: string): string {
  return isGrpcSecretMetadataKey(key) && value.trim() ? '••••••' : value;
}

export function GrpcAuthPanel({
  auth,
  preview,
  maskedSecretFields,
  disabled = false,
  onChange,
  onUnmaskSecretField,
  onClearSecretField,
}: GrpcAuthPanelProps) {
  const authType = resolveAuthType(auth);

  const handleTypeChange = (nextType: GrpcAuthType) => {
    if (nextType === authType) return;
    if (nextType === 'none') {
      onChange(undefined);
      return;
    }
    onChange({ type: nextType });
  };

  const patchAuth = (patch: Partial<GrpcAuthConfig>) => {
    onChange({ type: authType, ...auth, ...patch });
  };

  return (
    <div className="grpc-auth-panel" data-testid="grpc-auth-panel">
      <div className="grpc-auth-form-row grpc-auth-form-row--pills">
        <span className="grpc-auth-form-label">Auth type</span>
        <div className="grpc-auth-form-ctrl">
          <div
            className="grpc-auth-type-pills"
            role="tablist"
            aria-label="Auth type"
            data-testid="grpc-auth-type-pills"
          >
            {AUTH_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={authType === option.value}
                className={`grpc-auth-type-pill${authType === option.value ? ' grpc-auth-type-pill--active' : ''}`}
                data-testid={`grpc-auth-type-pill-${option.value}`}
                disabled={disabled}
                onClick={() => handleTypeChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="visually-hidden" data-testid="grpc-auth-type">{authType}</span>
        </div>
      </div>

      {authType === 'bearer' && (
        <GrpcSecretField
          id="grpc-auth-bearer-token"
          label="Bearer token"
          testId="grpc-auth-bearer-token"
          layout="auth"
          value={auth?.bearerToken ?? ''}
          masked={!!maskedSecretFields?.bearerToken}
          disabled={disabled}
          onChange={(value) => patchAuth({ bearerToken: value })}
          onUnmask={() => onUnmaskSecretField?.('bearerToken')}
          onClearStored={() => onClearSecretField?.('bearerToken')}
        />
      )}

      {authType === 'basic' && (
        <>
          <div className="grpc-auth-form-row">
            <label className="grpc-auth-form-label" htmlFor="grpc-auth-basic-user">
              Username
            </label>
            <div className="grpc-auth-form-ctrl">
              <input
                id="grpc-auth-basic-user"
                className="grpc-auth-text-input"
                data-testid="grpc-auth-basic-user"
                type="text"
                value={auth?.basicUsername ?? ''}
                disabled={disabled}
                autoComplete="off"
                onChange={(event) => patchAuth({ basicUsername: event.target.value })}
              />
            </div>
          </div>
          <GrpcSecretField
            id="grpc-auth-basic-pass"
            label="Password"
            testId="grpc-auth-basic-pass"
            layout="auth"
            value={auth?.basicPassword ?? ''}
            masked={!!maskedSecretFields?.basicPassword}
            disabled={disabled}
            onChange={(value) => patchAuth({ basicPassword: value })}
            onUnmask={() => onUnmaskSecretField?.('basicPassword')}
            onClearStored={() => onClearSecretField?.('basicPassword')}
          />
        </>
      )}

      {authType === 'api_key' && (
        <>
          <div className="grpc-auth-form-row">
            <label className="grpc-auth-form-label" htmlFor="grpc-auth-api-key-name">
              Header name
            </label>
            <div className="grpc-auth-form-ctrl">
              <input
                id="grpc-auth-api-key-name"
                className="grpc-auth-text-input"
                data-testid="grpc-auth-api-key-name"
                type="text"
                value={auth?.apiKeyName ?? ''}
                disabled={disabled}
                placeholder="x-api-key"
                autoComplete="off"
                onChange={(event) => patchAuth({ apiKeyName: event.target.value.toLowerCase() })}
              />
            </div>
          </div>
          <GrpcSecretField
            id="grpc-auth-api-key-value"
            label="API key value"
            testId="grpc-auth-api-key-value"
            layout="auth"
            value={auth?.apiKeyValue ?? ''}
            masked={!!maskedSecretFields?.apiKeyValue}
            disabled={disabled}
            onChange={(value) => patchAuth({ apiKeyValue: value })}
            onUnmask={() => onUnmaskSecretField?.('apiKeyValue')}
            onClearStored={() => onClearSecretField?.('apiKeyValue')}
          />
        </>
      )}

      {authType === 'oauth2' && (
        <>
          <p className="grpc-auth-oauth-notice" data-testid="grpc-auth-oauth-notice" role="status">
            OAuth2 client credentials are exchanged server-side at execute time. Tokens are never
            fetched in the browser and are not stored in call history.
          </p>
          <div className="grpc-auth-form-row">
            <label className="grpc-auth-form-label" htmlFor="grpc-auth-oauth-url">
              Token URL
            </label>
            <div className="grpc-auth-form-ctrl">
              <input
                id="grpc-auth-oauth-url"
                className="grpc-auth-text-input"
                data-testid="grpc-auth-oauth-token-url"
                type="url"
                value={auth?.oauth2?.tokenUrl ?? ''}
                disabled={disabled}
                onChange={(event) => patchAuth({
                  oauth2: {
                    tokenUrl: event.target.value,
                    clientId: auth?.oauth2?.clientId ?? '',
                    clientSecret: auth?.oauth2?.clientSecret ?? '',
                    scope: auth?.oauth2?.scope,
                  },
                })}
              />
            </div>
          </div>
          <div className="grpc-auth-form-row">
            <label className="grpc-auth-form-label" htmlFor="grpc-auth-oauth-client-id">
              Client ID
            </label>
            <div className="grpc-auth-form-ctrl">
              <input
                id="grpc-auth-oauth-client-id"
                className="grpc-auth-text-input"
                data-testid="grpc-auth-oauth-client-id"
                type="text"
                value={auth?.oauth2?.clientId ?? ''}
                disabled={disabled}
                onChange={(event) => patchAuth({
                  oauth2: {
                    tokenUrl: auth?.oauth2?.tokenUrl ?? '',
                    clientId: event.target.value,
                    clientSecret: auth?.oauth2?.clientSecret ?? '',
                    scope: auth?.oauth2?.scope,
                  },
                })}
              />
            </div>
          </div>
          <GrpcSecretField
            id="grpc-auth-oauth-client-secret"
            label="Client secret"
            testId="grpc-auth-oauth-client-secret"
            layout="auth"
            value={auth?.oauth2?.clientSecret ?? ''}
            masked={!!maskedSecretFields?.oauth2ClientSecret}
            disabled={disabled}
            onChange={(value) => patchAuth({
              oauth2: {
                tokenUrl: auth?.oauth2?.tokenUrl ?? '',
                clientId: auth?.oauth2?.clientId ?? '',
                clientSecret: value,
                scope: auth?.oauth2?.scope,
              },
            })}
            onUnmask={() => onUnmaskSecretField?.('oauth2ClientSecret')}
            onClearStored={() => onClearSecretField?.('oauth2ClientSecret')}
          />
          <div className="grpc-auth-form-row">
            <label className="grpc-auth-form-label" htmlFor="grpc-auth-oauth-scope">
              Scope (optional)
            </label>
            <div className="grpc-auth-form-ctrl">
              <input
                id="grpc-auth-oauth-scope"
                className="grpc-auth-text-input"
                data-testid="grpc-auth-oauth-scope"
                type="text"
                value={auth?.oauth2?.scope ?? ''}
                disabled={disabled}
                placeholder="read write"
                autoComplete="off"
                onChange={(event) => patchAuth({
                  oauth2: {
                    tokenUrl: auth?.oauth2?.tokenUrl ?? '',
                    clientId: auth?.oauth2?.clientId ?? '',
                    clientSecret: auth?.oauth2?.clientSecret ?? '',
                    scope: event.target.value || undefined,
                  },
                })}
              />
            </div>
          </div>
        </>
      )}

      {preview.conflicts.length > 0 && (
        <div className="grpc-auth-conflicts" data-testid="grpc-auth-conflicts" role="alert">
          <p className="grpc-auth-conflicts-title">Auth overrides manual metadata</p>
          <ul>
            {preview.conflicts.map((conflict) => (
              <li key={conflict.key}>
                <code>{conflict.key}</code>
                {' — manual '}
                <code>{maskConflictValue(conflict.key, conflict.manualValue)}</code>
                {' replaced by auth '}
                <code>••••••</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(preview.issues.length > 0 || preview.errorMessage) && (
        <ul className="grpc-auth-issues" data-testid="grpc-auth-issues" role="alert">
          {preview.errorMessage && <li>{preview.errorMessage}</li>}
          {preview.issues.map((issue) => (
            <li key={`${issue.field}:${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      )}

      {preview.previewEntries.length > 0 && (
        <div className="grpc-auth-preview" data-testid="grpc-auth-preview">
          <p className="grpc-auth-preview-title">Outgoing metadata (auth merged)</p>
          <ul>
            {preview.previewEntries.map((entry) => (
              <li key={entry.key}>
                <code>{entry.key}</code>
                {': '}
                <code>{entry.value}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
