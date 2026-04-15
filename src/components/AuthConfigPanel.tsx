import type { Dispatch, SetStateAction } from 'react';
import type { AuthConfig, AuthType, GlobalAuthProfile } from '../types';
import type { AuthVerifyResult } from '../hooks/useAuthVerify';

export interface AuthConfigPanelProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
  title: string;
  hint: string;
  showProfileSelector?: boolean;
  globalAuthProfileId?: string;
  onProfileChange?: (profileId: string | undefined) => void;
  globalAuthProfiles?: GlobalAuthProfile[];
  projectAuthProfiles?: GlobalAuthProfile[];
  allAuthProfiles?: GlobalAuthProfile[];
  inheritHint?: string | null;
  inheritedAuth?: AuthConfig | null;
  inheritedLabel?: string;
  authVerifying: boolean;
  authVerifyResult: AuthVerifyResult | null;
  setAuthVerifyResult: Dispatch<SetStateAction<AuthVerifyResult | null>>;
  verifyAuth: (auth: AuthConfig) => void;
  showSecret: boolean;
  setShowSecret: Dispatch<SetStateAction<boolean>>;
  authTypeOptions: { value: string; label: string }[];
  panelClassName?: string;
}

export default function AuthConfigPanel({
  auth,
  onChange,
  title,
  hint,
  showProfileSelector,
  globalAuthProfileId,
  onProfileChange,
  globalAuthProfiles = [],
  projectAuthProfiles = [],
  allAuthProfiles = [],
  inheritHint,
  inheritedAuth,
  inheritedLabel,
  authVerifying,
  authVerifyResult,
  setAuthVerifyResult,
  verifyAuth,
  showSecret,
  setShowSecret,
  authTypeOptions,
  panelClassName = 'scenario-auth-panel',
}: AuthConfigPanelProps) {
  const resolvedAuthToVerify: AuthConfig | null | undefined =
    showProfileSelector && auth.type === 'inherit' && globalAuthProfileId
      ? allAuthProfiles.find((p) => p.id === globalAuthProfileId)?.auth
      : auth;

  return (
    <div className={panelClassName} onClick={(e) => e.stopPropagation()}>
      <div className="scenario-auth-header">
        <strong>{title}</strong>
        <span className="auth-hint">{hint}</span>
      </div>
      <div className="auth-type-select">
        <label>Type</label>
        <select
          value={auth.type}
          onChange={(e) => onChange({ ...auth, type: e.target.value as AuthType })}
        >
          {authTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {showProfileSelector && auth.type === 'inherit' && allAuthProfiles.length > 0 && (() => {
        const selectedProfile = allAuthProfiles.find((p) => p.id === globalAuthProfileId);
        return (
          <div className="global-profile-selector">
            <label>Auth Profile</label>
            <select
              value={globalAuthProfileId || ''}
              onChange={(e) => onProfileChange?.(e.target.value || undefined)}
            >
              <option value="">— Select a profile —</option>
              {globalAuthProfiles.length > 0 && (
                <optgroup label="Global (shared across projects)">
                  {globalAuthProfiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
                  ))}
                </optgroup>
              )}
              {projectAuthProfiles.length > 0 && (
                <optgroup label="Project-level">
                  {projectAuthProfiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
                  ))}
                </optgroup>
              )}
            </select>
            {selectedProfile && (
              <span className="auth-inherit-hint">
                Using <strong>{selectedProfile.name}</strong> — {selectedProfile.auth.type.toUpperCase()}
                {globalAuthProfiles.some((g) => g.id === selectedProfile.id) ? ' (global)' : ' (project)'}
              </span>
            )}
            {!selectedProfile && globalAuthProfileId && (
              <span className="auth-inherit-hint auth-inherit-warn">
                ⚠ Selected profile no longer exists
              </span>
            )}
          </div>
        );
      })()}
      {auth.type === 'inherit' && inheritHint != null && inheritHint !== '' && (
        <div className="auth-inherit-hint">{inheritHint}</div>
      )}
      {auth.type === 'basic' && (
        <div className="form-row two-col">
          <div>
            <label>Username</label>
            <input value={auth.username || ''} onChange={(e) => onChange({ ...auth, username: e.target.value })} />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={auth.password || ''} onChange={(e) => onChange({ ...auth, password: e.target.value })} />
          </div>
        </div>
      )}
      {auth.type === 'bearer' && (
        <div className="form-row two-col">
          <div>
            <label>Token</label>
            <input value={auth.token || ''} onChange={(e) => onChange({ ...auth, token: e.target.value })} placeholder="eyJhbGciOi..." />
          </div>
          <div>
            <label>Prefix</label>
            <input value={auth.prefix ?? 'Bearer'} onChange={(e) => onChange({ ...auth, prefix: e.target.value })} placeholder="Bearer" />
          </div>
        </div>
      )}
      {auth.type === 'apikey' && (
        <>
          <div className="form-row two-col">
            <div>
              <label>Key Name</label>
              <input value={auth.apiKeyName || ''} onChange={(e) => onChange({ ...auth, apiKeyName: e.target.value })} placeholder="X-API-Key" />
            </div>
            <div>
              <label>Key Value</label>
              <input value={auth.apiKeyValue || ''} onChange={(e) => onChange({ ...auth, apiKeyValue: e.target.value })} placeholder="your-api-key" />
            </div>
          </div>
          <div className="form-row">
            <label>Add to</label>
            <div className="radio-group">
              <label className="radio-label">
                <input type="radio" checked={auth.apiKeyIn !== 'query'} onChange={() => onChange({ ...auth, apiKeyIn: 'header' })} />
                Header
              </label>
              <label className="radio-label">
                <input type="radio" checked={auth.apiKeyIn === 'query'} onChange={() => onChange({ ...auth, apiKeyIn: 'query' })} />
                Query Parameter
              </label>
            </div>
          </div>
        </>
      )}
      {auth.type === 'digest' && (
        <div className="form-row two-col">
          <div>
            <label>Username</label>
            <input value={auth.username || ''} onChange={(e) => onChange({ ...auth, username: e.target.value })} />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={auth.password || ''} onChange={(e) => onChange({ ...auth, password: e.target.value })} />
          </div>
        </div>
      )}
      {auth.type === 'oauth2' && (
        <>
          <div className="form-row">
            <label>Token URL</label>
            <input value={auth.tokenUrl || ''} onChange={(e) => onChange({ ...auth, tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
          </div>
          <div className="form-row two-col">
            <div>
              <label>Client ID</label>
              <input value={auth.clientId || ''} onChange={(e) => onChange({ ...auth, clientId: e.target.value })} />
            </div>
            <div>
              <label>Client Secret</label>
              <div className="secret-input-wrap">
                <input type={showSecret ? 'text' : 'password'} value={auth.clientSecret || ''} onChange={(e) => onChange({ ...auth, clientSecret: e.target.value })} />
                <button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
              </div>
            </div>
          </div>
        </>
      )}
      {auth.type !== 'none' && (showProfileSelector || auth.type !== 'inherit') && (() => {
        const authToVerify = showProfileSelector ? resolvedAuthToVerify : auth;
        return (
          <div className="auth-verify-section">
            <button
              className="btn btn-sm btn-verify"
              onClick={() => { setAuthVerifyResult(null); if (authToVerify && authToVerify.type !== 'none') verifyAuth(authToVerify); }}
              disabled={authVerifying || !authToVerify || authToVerify.type === 'none'}
            >
              {authVerifying ? 'Verifying...' : 'Verify Auth'}
            </button>
            {authVerifyResult && (
              <div className={`auth-verify-result ${authVerifyResult.ok ? 'auth-verify-ok' : 'auth-verify-fail'}`}>
                <span className="auth-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>
                <div className="auth-verify-body">
                  <span className="auth-verify-msg">{authVerifyResult.message}</span>
                  {authVerifyResult.detail && <pre className="auth-verify-detail">{authVerifyResult.detail}</pre>}
                </div>
              </div>
            )}
          </div>
        );
      })()}
      {!showProfileSelector && auth.type === 'inherit' && inheritedAuth && inheritedAuth.type !== 'none' && inheritedAuth.type !== 'inherit' && (
        <div className="auth-verify-section">
          <button
            className="btn btn-sm btn-verify"
            onClick={() => { setAuthVerifyResult(null); verifyAuth(inheritedAuth); }}
            disabled={authVerifying}
          >
            {authVerifying ? 'Verifying...' : `Verify Inherited Auth (${inheritedLabel ?? 'feature'})`}
          </button>
          {authVerifyResult && (
            <div className={`auth-verify-result ${authVerifyResult.ok ? 'auth-verify-ok' : 'auth-verify-fail'}`}>
              <span className="auth-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>
              <div className="auth-verify-body">
                <span className="auth-verify-msg">{authVerifyResult.message}</span>
                {authVerifyResult.detail && <pre className="auth-verify-detail">{authVerifyResult.detail}</pre>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
