import { useCallback, useMemo } from 'react';
import type { AuthConfig, GlobalAuthProfile } from '../../../shared/types';
import type { CatalogSecurityScheme } from '../types/catalog';
import { useAuthVerify } from '../../requests/hooks/useAuthVerify';

interface Props {
  auth: AuthConfig;
  onAuthChange: (auth: AuthConfig) => void;
  securitySchemes: Record<string, CatalogSecurityScheme>;
  globalAuthProfiles?: GlobalAuthProfile[];
  onClose: () => void;
}

type AuthMode = 'inherit' | 'global' | 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2';

function schemeToAuthType(scheme: CatalogSecurityScheme): AuthConfig['type'] {
  if (scheme.type === 'apiKey') return 'apikey';
  if (scheme.type === 'http') {
    if (scheme.scheme === 'basic') return 'basic';
    return 'bearer';
  }
  if (scheme.type === 'oauth2') return 'bearer';
  return 'bearer';
}

function describeScheme(name: string, s: CatalogSecurityScheme): string {
  const parts = [name];
  if (s.type === 'apiKey') parts.push(`— API Key in ${s.in}: ${s.name}`);
  else if (s.type === 'http') parts.push(`— HTTP ${s.scheme ?? 'bearer'}`);
  else if (s.type === 'oauth2') parts.push('— OAuth 2.0');
  else if (s.type === 'openIdConnect') parts.push('— OpenID Connect');
  if (s.description) parts.push(`(${s.description.slice(0, 80)})`);
  return parts.join(' ');
}

export default function CatalogAuthPanel({ auth, onAuthChange, securitySchemes, globalAuthProfiles = [], onClose }: Props) {
  const schemeEntries = useMemo(() => Object.entries(securitySchemes), [securitySchemes]);
  const hasSchemes = schemeEntries.length > 0;
  const hasGlobal = globalAuthProfiles.length > 0;
  const { authVerifying, authVerifyResult, setAuthVerifyResult, verifyAuth } = useAuthVerify();

  const mode: AuthMode = auth.__inherit ? 'inherit'
    : auth.__globalProfileId ? 'global'
    : auth.type === 'none' ? 'none'
    : auth.type as AuthMode;

  const handleModeChange = useCallback((newMode: string) => {
    if (newMode === 'inherit' && hasSchemes) {
      const [schemeName, scheme] = schemeEntries[0];
      const detectedType = schemeToAuthType(scheme);
      const base: AuthConfig = { type: detectedType };
      if (scheme.type === 'apiKey') {
        base.apiKeyName = scheme.name;
        base.apiKeyIn = scheme.in === 'query' ? 'query' : 'header';
      }
      if (scheme.type === 'http' && scheme.scheme === 'basic') {
        base.type = 'basic';
      }
      onAuthChange({ ...base, __inherit: true, __schemeName: schemeName });
    } else if (newMode === 'global' && hasGlobal) {
      const profile = globalAuthProfiles[0];
      onAuthChange({ ...profile.auth, __globalProfileId: profile.id, __globalProfileName: profile.name });
    } else if (newMode === 'none') {
      onAuthChange({ type: 'none' });
    } else {
      onAuthChange({ type: newMode as AuthConfig['type'] });
    }
  }, [hasSchemes, hasGlobal, schemeEntries, globalAuthProfiles, onAuthChange]);

  const handleGlobalProfileChange = useCallback((profileId: string) => {
    const profile = globalAuthProfiles.find(p => p.id === profileId);
    if (!profile) return;
    onAuthChange({ ...profile.auth, __globalProfileId: profile.id, __globalProfileName: profile.name });
  }, [globalAuthProfiles, onAuthChange]);

  const handleSchemeSwitch = useCallback((schemeName: string) => {
    const scheme = securitySchemes[schemeName];
    if (!scheme) return;
    const detectedType = schemeToAuthType(scheme);
    const base: AuthConfig = { type: detectedType };
    if (scheme.type === 'apiKey') {
      base.apiKeyName = scheme.name;
      base.apiKeyIn = scheme.in === 'query' ? 'query' : 'header';
    }
    if (scheme.type === 'http' && scheme.scheme === 'basic') {
      base.type = 'basic';
    }
    onAuthChange({ ...base, __inherit: true, __schemeName: schemeName });
  }, [securitySchemes, onAuthChange]);

  const currentSchemeName = auth.__schemeName;

  return (
    <div className="ceb-auth-panel">
      <div className="ceb-auth-header">
        <h3>Authorization</h3>
        <button className="cat-modal-close" onClick={onClose}>&times;</button>
      </div>
      <div className="ceb-auth-body">
        <div className="cep-tryit-field">
          <label className="cep-field-name">Type</label>
          <select className="cep-field-input" value={mode} onChange={e => handleModeChange(e.target.value)}>
            {hasSchemes && <option value="inherit">Inherit from Spec</option>}
            {hasGlobal && <option value="global">From Environment</option>}
            <option value="none">No Auth</option>
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
            <option value="apikey">API Key</option>
          </select>
        </div>

        {mode === 'inherit' && hasSchemes && (
          <>
            {schemeEntries.length > 1 && (
              <div className="cep-tryit-field">
                <label className="cep-field-name">Scheme</label>
                <select className="cep-field-input"
                  value={currentSchemeName ?? schemeEntries[0][0]}
                  onChange={e => handleSchemeSwitch(e.target.value)}>
                  {schemeEntries.map(([name, s]) => (
                    <option key={name} value={name}>{describeScheme(name, s)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="ceb-auth-inherit-info">
              {schemeEntries.map(([name, s]) => {
                if (schemeEntries.length > 1 && name !== (currentSchemeName ?? schemeEntries[0][0])) return null;
                return (
                  <div key={name} className="ceb-scheme-badge">
                    <span className="ceb-scheme-type">{s.type.toUpperCase()}</span>
                    <span className="ceb-scheme-detail">{describeScheme(name, s)}</span>
                  </div>
                );
              })}
            </div>

            {auth.type === 'bearer' && (
              <>
                <div className="cep-tryit-field">
                  <label className="cep-field-name">Token</label>
                  <input className="cep-field-input" placeholder="JWT or access token"
                    value={auth.token ?? ''} onChange={e => onAuthChange({ ...auth, token: e.target.value })} />
                </div>
                <div className="cep-tryit-field">
                  <label className="cep-field-name">Prefix</label>
                  <input className="cep-field-input" placeholder="Bearer"
                    value={auth.prefix ?? 'Bearer'} onChange={e => onAuthChange({ ...auth, prefix: e.target.value })} />
                </div>
              </>
            )}
            {auth.type === 'basic' && (
              <>
                <div className="cep-tryit-field">
                  <label className="cep-field-name">Username</label>
                  <input className="cep-field-input" value={auth.username ?? ''} onChange={e => onAuthChange({ ...auth, username: e.target.value })} />
                </div>
                <div className="cep-tryit-field">
                  <label className="cep-field-name">Password</label>
                  <input className="cep-field-input" type="password" value={auth.password ?? ''} onChange={e => onAuthChange({ ...auth, password: e.target.value })} />
                </div>
              </>
            )}
            {auth.type === 'apikey' && (
              <>
                <div className="cep-tryit-field">
                  <label className="cep-field-name">Key Name</label>
                  <input className="cep-field-input" value={auth.apiKeyName ?? ''} readOnly
                    title="Auto-detected from spec" />
                </div>
                <div className="cep-tryit-field">
                  <label className="cep-field-name">Value</label>
                  <input className="cep-field-input"
                    placeholder={auth.apiKeyName?.toLowerCase() === 'authorization' ? 'Paste JWT token (Bearer prefix added automatically)' : 'Enter value'}
                    value={auth.apiKeyValue ?? ''} onChange={e => onAuthChange({ ...auth, apiKeyValue: e.target.value })} />
                </div>
                <div className="cep-tryit-field">
                  <label className="cep-field-name">Add To</label>
                  <input className="cep-field-input" value={auth.apiKeyIn ?? 'header'} readOnly
                    title="Auto-detected from spec" />
                </div>
                {auth.apiKeyName?.toLowerCase() === 'authorization' && (
                  <div className="cep-auth-hint">
                    "Bearer" prefix is added automatically. Just paste the raw token.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {mode === 'global' && hasGlobal && (
          <>
            <div className="cep-tryit-field">
              <label className="cep-field-name">Profile</label>
              <select className="cep-field-input"
                value={auth.__globalProfileId ?? globalAuthProfiles[0]?.id}
                onChange={e => handleGlobalProfileChange(e.target.value)}>
                {globalAuthProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="ceb-auth-inherit-info">
              <div className="ceb-scheme-badge">
                <span className="ceb-scheme-type">{auth.type.toUpperCase()}</span>
                <span className="ceb-scheme-detail">
                  {auth.__globalProfileName ?? 'Global profile'}
                  {auth.type === 'oauth2' && ' — OAuth2 Client Credentials'}
                  {auth.type === 'bearer' && ' — Bearer Token'}
                  {auth.type === 'basic' && ' — Basic Auth'}
                  {auth.type === 'apikey' && ` — API Key: ${auth.apiKeyName ?? ''}`}
                </span>
              </div>
            </div>
            {auth.type === 'oauth2' && (
              <div className="cep-auth-hint">
                Token will be acquired automatically via client credentials when executing a request.
                {auth.tokenUrl && <><br />Token URL: <code>{auth.tokenUrl}</code></>}
              </div>
            )}
            <div className="cep-global-readonly-note">
              Credentials loaded from global profile. Edit in Settings → Global Auth.
            </div>
          </>
        )}

        {mode !== 'inherit' && mode !== 'global' && auth.type === 'bearer' && (
          <>
            <div className="cep-tryit-field">
              <label className="cep-field-name">Token</label>
              <input className="cep-field-input" placeholder="JWT or access token"
                value={auth.token ?? ''} onChange={e => onAuthChange({ ...auth, token: e.target.value })} />
            </div>
            <div className="cep-tryit-field">
              <label className="cep-field-name">Prefix</label>
              <input className="cep-field-input" placeholder="Bearer"
                value={auth.prefix ?? 'Bearer'} onChange={e => onAuthChange({ ...auth, prefix: e.target.value })} />
            </div>
          </>
        )}
        {mode !== 'inherit' && mode !== 'global' && auth.type === 'basic' && (
          <>
            <div className="cep-tryit-field">
              <label className="cep-field-name">Username</label>
              <input className="cep-field-input" value={auth.username ?? ''} onChange={e => onAuthChange({ ...auth, username: e.target.value })} />
            </div>
            <div className="cep-tryit-field">
              <label className="cep-field-name">Password</label>
              <input className="cep-field-input" type="password" value={auth.password ?? ''} onChange={e => onAuthChange({ ...auth, password: e.target.value })} />
            </div>
          </>
        )}
        {mode !== 'inherit' && mode !== 'global' && auth.type === 'apikey' && (
          <>
            <div className="cep-tryit-field">
              <label className="cep-field-name">Key Name</label>
              <input className="cep-field-input" placeholder="X-API-Key" value={auth.apiKeyName ?? ''} onChange={e => onAuthChange({ ...auth, apiKeyName: e.target.value })} />
            </div>
            <div className="cep-tryit-field">
              <label className="cep-field-name">Key Value</label>
              <input className="cep-field-input" value={auth.apiKeyValue ?? ''} onChange={e => onAuthChange({ ...auth, apiKeyValue: e.target.value })} />
            </div>
            <div className="cep-tryit-field">
              <label className="cep-field-name">Add To</label>
              <select className="cep-field-input" value={auth.apiKeyIn ?? 'header'} onChange={e => onAuthChange({ ...auth, apiKeyIn: e.target.value as 'header' | 'query' })}>
                <option value="header">Header</option>
                <option value="query">Query Parameter</option>
              </select>
            </div>
          </>
        )}

        {auth.type !== 'none' && (
          <div className="ceb-auth-verify">
            <button
              className="ceb-verify-btn"
              onClick={() => { setAuthVerifyResult(null); verifyAuth(auth); }}
              disabled={authVerifying}
            >
              {authVerifying ? 'Verifying...' : 'Verify Auth'}
            </button>
            {authVerifyResult && (
              <div className={`ceb-verify-result ${authVerifyResult.ok ? 'ceb-verify-ok' : 'ceb-verify-fail'}`}>
                <span className="ceb-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>
                <div className="ceb-verify-body">
                  <span className="ceb-verify-msg">{authVerifyResult.message}</span>
                  {authVerifyResult.detail && <pre className="ceb-verify-detail">{authVerifyResult.detail}</pre>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
