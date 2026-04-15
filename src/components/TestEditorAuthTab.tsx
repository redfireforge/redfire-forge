import type { Dispatch, SetStateAction } from 'react';
import type { AuthConfig, AuthType, FeatureGroup, GlobalAuthProfile, Scenario } from '../types';

export interface TestEditorAuthEditingContext {
  fgId: string;
  scenarioId: string;
  testId: string | 'new';
}

export interface TestEditorAuthTabProps {
  draft: Scenario;
  onDraftChange: (draft: Scenario) => void;
  featureGroups: FeatureGroup[];
  editingTest: TestEditorAuthEditingContext;
  allAuthProfiles: GlobalAuthProfile[];
  verifyAuth: (auth: AuthConfig) => void | Promise<void>;
  resolveEffectiveAuth: () => { auth: AuthConfig; source: string };
  authVerifying: boolean;
  authVerifyResult: { ok: boolean; message: string; detail?: string } | null;
  setAuthVerifyResult: (v: { ok: boolean; message: string; detail?: string } | null) => void;
  showSecret: boolean;
  setShowSecret: Dispatch<SetStateAction<boolean>>;
}

export default function TestEditorAuthTab({
  draft,
  onDraftChange,
  featureGroups,
  editingTest,
  allAuthProfiles,
  verifyAuth,
  resolveEffectiveAuth,
  authVerifying,
  authVerifyResult,
  setAuthVerifyResult,
  showSecret,
  setShowSecret,
}: TestEditorAuthTabProps) {
  return (
    <div>
      <div className="auth-type-select">
        <label>Type</label>
        <select
          value={draft.auth.type}
          onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, type: e.target.value as AuthType } })}
        >
          <option value="inherit">Inherit from Scenario</option>
          <option value="none">No Auth</option>
          <option value="basic">Basic Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="apikey">API Key</option>
          <option value="digest">Digest Auth</option>
          <option value="oauth2">OAuth2 Client Credentials</option>
        </select>
      </div>
      {draft.auth.type === 'inherit' && (() => {
        const fg = featureGroups.find((f) => f.id === editingTest.fgId);
        const sc = fg?.scenarios.find((s) => s.id === editingTest.scenarioId);
        const scAuth = sc?.auth;
        const fgAuth = fg?.auth;
        const authLabel: Record<string, string> = {
          basic: 'Basic Auth', bearer: 'Bearer Token', apikey: 'API Key',
          digest: 'Digest Auth', oauth2: 'OAuth2 Client Credentials',
        };
        let hint: string;
        if (scAuth && scAuth.type !== 'none' && scAuth.type !== 'inherit') {
          hint = `Will use scenario-level ${authLabel[scAuth.type] ?? scAuth.type}`;
        } else if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') {
          hint = `Will use feature-level ${authLabel[fgAuth.type] ?? fgAuth.type}`;
          if (scAuth?.type === 'inherit') hint += ' (scenario inherits from feature)';
        } else if (fgAuth?.type === 'inherit' && fg?.globalAuthProfileId) {
          const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
          hint = profile
            ? `Will use global profile "${profile.name}" (${authLabel[profile.auth.type] ?? profile.auth.type})`
            : 'Feature references a missing global profile.';
          if (scAuth?.type === 'inherit') hint += ' (via scenario → feature → global)';
        } else {
          hint = 'No auth configured at scenario or feature level.';
        }
        return <div className="auth-inherit-hint">{hint}</div>;
      })()}
      {draft.auth.type === 'basic' && (
        <div className="form-row two-col">
          <div>
            <label>Username</label>
            <input value={draft.auth.username || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, username: e.target.value } })} />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={draft.auth.password || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, password: e.target.value } })} />
          </div>
        </div>
      )}
      {draft.auth.type === 'bearer' && (
        <div className="form-row two-col">
          <div>
            <label>Token</label>
            <input value={draft.auth.token || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, token: e.target.value } })} placeholder="eyJhbGciOi..." />
          </div>
          <div>
            <label>Prefix</label>
            <input value={draft.auth.prefix ?? 'Bearer'} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, prefix: e.target.value } })} placeholder="Bearer" />
          </div>
        </div>
      )}
      {draft.auth.type === 'apikey' && (
        <>
          <div className="form-row two-col">
            <div>
              <label>Key Name</label>
              <input value={draft.auth.apiKeyName || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, apiKeyName: e.target.value } })} placeholder="X-API-Key" />
            </div>
            <div>
              <label>Key Value</label>
              <input value={draft.auth.apiKeyValue || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, apiKeyValue: e.target.value } })} placeholder="your-api-key" />
            </div>
          </div>
          <div className="form-row">
            <label>Add to</label>
            <div className="radio-group">
              <label className="radio-label">
                <input type="radio" checked={draft.auth.apiKeyIn !== 'query'} onChange={() => onDraftChange({ ...draft, auth: { ...draft.auth, apiKeyIn: 'header' } })} />
                Header
              </label>
              <label className="radio-label">
                <input type="radio" checked={draft.auth.apiKeyIn === 'query'} onChange={() => onDraftChange({ ...draft, auth: { ...draft.auth, apiKeyIn: 'query' } })} />
                Query Parameter
              </label>
            </div>
          </div>
        </>
      )}
      {draft.auth.type === 'digest' && (
        <div className="form-row two-col">
          <div>
            <label>Username</label>
            <input value={draft.auth.username || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, username: e.target.value } })} />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={draft.auth.password || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, password: e.target.value } })} />
          </div>
        </div>
      )}
      {draft.auth.type === 'oauth2' && (
        <>
          <div className="form-row">
            <label>Token URL</label>
            <input value={draft.auth.tokenUrl || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, tokenUrl: e.target.value } })} placeholder="https://auth.example.com/oauth/token" />
          </div>
          <div className="form-row two-col">
            <div>
              <label>Client ID</label>
              <input value={draft.auth.clientId || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, clientId: e.target.value } })} />
            </div>
            <div>
              <label>Client Secret</label>
              <div className="secret-input-wrap">
                <input type={showSecret ? 'text' : 'password'} value={draft.auth.clientSecret || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, clientSecret: e.target.value } })} />
                <button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
              </div>
            </div>
          </div>
        </>
      )}
      {draft.auth.type !== 'none' && draft.auth.type !== 'inherit' && (
        <div className="auth-verify-section">
          <button
            type="button"
            className="btn btn-sm btn-verify"
            onClick={() => { setAuthVerifyResult(null); void verifyAuth(draft.auth); }}
            disabled={authVerifying}
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
      )}
      {draft.auth.type === 'inherit' && (() => {
        const { auth: resolved, source } = resolveEffectiveAuth();
        if (resolved.type === 'none') return null;
        return (
          <div className="auth-verify-section">
            <button
              type="button"
              className="btn btn-sm btn-verify"
              onClick={() => { setAuthVerifyResult(null); void verifyAuth(resolved); }}
              disabled={authVerifying}
            >
              {authVerifying ? 'Verifying...' : `Verify Inherited Auth (${source})`}
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
    </div>
  );
}
