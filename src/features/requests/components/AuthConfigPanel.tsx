import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AuthConfig, AuthType, GlobalAuthProfile } from '@shared/types';
import type { AuthVerifyResult } from '../hooks/useAuthVerify';

export interface AuthConfigPanelProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
  title: string;
  hint: string;
  showProfileSelector?: boolean;
  globalAuthProfileId?: string;
  onProfileChange?: (profileId: string | undefined) => void;
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
  useCustomTypeDropdown?: boolean;
  customTypeDropdownTestIdPrefix?: string;
  useStackedBearerFields?: boolean;
  useStackedAuthFields?: boolean;
}

export default function AuthConfigPanel({
  auth,
  onChange,
  title,
  hint,
  showProfileSelector,
  globalAuthProfileId,
  onProfileChange,
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
  useCustomTypeDropdown = false,
  customTypeDropdownTestIdPrefix = 'auth-type',
  useStackedBearerFields = false,
  useStackedAuthFields = false,
}: AuthConfigPanelProps) {
  const [isAuthTypeOpen, setIsAuthTypeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const authTypeDropdownRef = useRef<HTMLDivElement | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement | null>(null);

  const resolvedAuthToVerify: AuthConfig | null | undefined =
    showProfileSelector && auth.type === 'inherit' && globalAuthProfileId
      ? allAuthProfiles.find((p) => p.id === globalAuthProfileId)?.auth
      : auth;

  const selectedAuthTypeLabel = useMemo(
    () => authTypeOptions.find((opt) => opt.value === auth.type)?.label ?? auth.type,
    [auth.type, authTypeOptions],
  );

  useEffect(() => {
    if (!useCustomTypeDropdown || !isAuthTypeOpen) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!authTypeDropdownRef.current?.contains(target)) {
        setIsAuthTypeOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAuthTypeOpen(false);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isAuthTypeOpen, useCustomTypeDropdown]);

  useEffect(() => {
    if (!useCustomTypeDropdown || !isProfileOpen) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!profileDropdownRef.current?.contains(target)) {
        setIsProfileOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProfileOpen(false);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isProfileOpen, useCustomTypeDropdown]);

  const handleAuthTypeChange = (nextType: string) => {
    onChange({ ...auth, type: nextType as AuthType });
  };

  return (
    <div className={panelClassName} onClick={(e) => e.stopPropagation()}>
      <div className="scenario-auth-header">
        <strong>{title}</strong>
        <span className="auth-hint">{hint}</span>
      </div>
      <div className="auth-type-select">
        <label>Type</label>
        {useCustomTypeDropdown ? (
          <div className="auth-type-dropdown" ref={authTypeDropdownRef}>
            {/* Hidden native select kept for existing test/demo automation selectors. */}
            <select
              className="auth-type-hidden-select"
              value={auth.type}
              onChange={(e) => handleAuthTypeChange(e.target.value)}
              aria-hidden="true"
              tabIndex={-1}
            >
              {authTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="auth-type-trigger"
              aria-label="Auth type"
              aria-haspopup="listbox"
              aria-expanded={isAuthTypeOpen}
              onClick={() => setIsAuthTypeOpen((open) => !open)}
              data-testid={`${customTypeDropdownTestIdPrefix}-trigger`}
            >
              <span>{selectedAuthTypeLabel}</span>
              <span className="auth-type-chevron" aria-hidden>▾</span>
            </button>
            {isAuthTypeOpen && (
              <div className="auth-type-menu" role="listbox" aria-label="Auth type options">
                {authTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`auth-type-option${opt.value === auth.type ? ' active' : ''}`}
                    role="option"
                    aria-selected={opt.value === auth.type}
                    onClick={() => {
                      handleAuthTypeChange(opt.value);
                      setIsAuthTypeOpen(false);
                    }}
                    data-testid={`${customTypeDropdownTestIdPrefix}-opt-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <select
            value={auth.type}
            onChange={(e) => handleAuthTypeChange(e.target.value)}
          >
            {authTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
      </div>
      {showProfileSelector && auth.type === 'inherit' && allAuthProfiles.length > 0 && (() => {
        const selectedProfile = allAuthProfiles.find((p) => p.id === globalAuthProfileId);
        const profileLabel = selectedProfile
          ? `${selectedProfile.name} (${selectedProfile.auth.type})`
          : '— Select a profile —';
        return (
          <div className="global-profile-selector">
            <label>Auth Profile</label>
            {useCustomTypeDropdown ? (
              <div className="auth-profile-dropdown" ref={profileDropdownRef}>
                <button
                  type="button"
                  className="auth-profile-trigger"
                  aria-label="Auth profile"
                  aria-haspopup="listbox"
                  aria-expanded={isProfileOpen}
                  onClick={() => setIsProfileOpen((o) => !o)}
                >
                  <span className="auth-profile-trigger-label">{profileLabel}</span>
                  <span className="auth-type-chevron" aria-hidden>▾</span>
                </button>
                {isProfileOpen && (
                  <div className="auth-profile-menu" role="listbox" aria-label="Auth profile options">
                    <button
                      type="button"
                      className={`auth-profile-option${!globalAuthProfileId ? ' active' : ''}`}
                      role="option"
                      aria-selected={!globalAuthProfileId}
                      onClick={() => { onProfileChange?.(undefined); setIsProfileOpen(false); }}
                    >
                      — Select a profile —
                    </button>
                    {allAuthProfiles.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`auth-profile-option${p.id === globalAuthProfileId ? ' active' : ''}`}
                        role="option"
                        aria-selected={p.id === globalAuthProfileId}
                        onClick={() => { onProfileChange?.(p.id); setIsProfileOpen(false); }}
                      >
                        {p.name} <span className="auth-profile-type-badge">{p.auth.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <select
                value={globalAuthProfileId || ''}
                onChange={(e) => onProfileChange?.(e.target.value || undefined)}
              >
                <option value="">— Select a profile —</option>
                {allAuthProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
                ))}
              </select>
            )}
            {selectedProfile && (
              <span className="auth-inherit-hint">
                Using <strong>{selectedProfile.name}</strong> — {selectedProfile.auth.type.toUpperCase()}
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
        useStackedAuthFields ? (
          <div className="auth-stacked-fields">
            <div className="auth-stacked-field-row">
              <label>Username</label>
              <input
                className="auth-stacked-field-control"
                value={auth.username || ''}
                onChange={(e) => onChange({ ...auth, username: e.target.value })}
              />
            </div>
            <div className="auth-stacked-field-row">
              <label>Password</label>
              <input
                className="auth-stacked-field-control"
                type="password"
                value={auth.password || ''}
                onChange={(e) => onChange({ ...auth, password: e.target.value })}
              />
            </div>
          </div>
        ) : (
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
        )
      )}
      {auth.type === 'bearer' && (
        useStackedBearerFields ? (
          <div className="auth-bearer-fields">
            <div className="form-row auth-bearer-field-row">
              <label>Token</label>
              <textarea
                className="auth-bearer-token-textarea"
                value={auth.token || ''}
                onChange={(e) => onChange({ ...auth, token: e.target.value })}
                placeholder="eyJhbGciOi..."
                rows={3}
              />
            </div>
            <div className="form-row auth-bearer-field-row">
              <label>Prefix</label>
              <textarea
                className="auth-bearer-prefix-textarea"
                value={auth.prefix ?? 'Bearer'}
                onChange={(e) => onChange({ ...auth, prefix: e.target.value })}
                placeholder="Bearer"
                rows={1}
              />
            </div>
          </div>
        ) : (
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
        )
      )}
      {auth.type === 'apikey' && (
        useStackedAuthFields ? (
          <div className="auth-stacked-fields">
            <div className="auth-stacked-field-row">
              <label>Key Name</label>
              <input
                className="auth-stacked-field-control"
                value={auth.apiKeyName || ''}
                onChange={(e) => onChange({ ...auth, apiKeyName: e.target.value })}
                placeholder="X-API-Key"
              />
            </div>
            <div className="auth-stacked-field-row">
              <label>Key Value</label>
              <input
                className="auth-stacked-field-control"
                value={auth.apiKeyValue || ''}
                onChange={(e) => onChange({ ...auth, apiKeyValue: e.target.value })}
                placeholder="your-api-key"
              />
            </div>
            <div className="auth-stacked-field-row auth-stacked-radio-row">
              <label>Add to</label>
              <div className="radio-group auth-stacked-field-control">
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
          </div>
        ) : (
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
        )
      )}
      {auth.type === 'digest' && (
        useStackedAuthFields ? (
          <div className="auth-stacked-fields">
            <div className="auth-stacked-field-row">
              <label>Username</label>
              <input
                className="auth-stacked-field-control"
                value={auth.username || ''}
                onChange={(e) => onChange({ ...auth, username: e.target.value })}
              />
            </div>
            <div className="auth-stacked-field-row">
              <label>Password</label>
              <input
                className="auth-stacked-field-control"
                type="password"
                value={auth.password || ''}
                onChange={(e) => onChange({ ...auth, password: e.target.value })}
              />
            </div>
          </div>
        ) : (
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
        )
      )}
      {auth.type === 'oauth2' && (
        useStackedAuthFields ? (
          <div className="auth-stacked-fields">
            <div className="auth-stacked-field-row">
              <label>Token URL</label>
              <input
                className="auth-stacked-field-control"
                value={auth.tokenUrl || ''}
                onChange={(e) => onChange({ ...auth, tokenUrl: e.target.value })}
                placeholder="https://auth.example.com/oauth/token"
              />
            </div>
            <div className="auth-stacked-field-row">
              <label>Client ID</label>
              <input
                className="auth-stacked-field-control"
                value={auth.clientId || ''}
                onChange={(e) => onChange({ ...auth, clientId: e.target.value })}
              />
            </div>
            <div className="auth-stacked-field-row">
              <label>Client Secret</label>
              <div className="secret-input-wrap auth-stacked-field-control">
                <input type={showSecret ? 'text' : 'password'} value={auth.clientSecret || ''} onChange={(e) => onChange({ ...auth, clientSecret: e.target.value })} />
                <button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
              </div>
            </div>
          </div>
        ) : (
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
        )
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
