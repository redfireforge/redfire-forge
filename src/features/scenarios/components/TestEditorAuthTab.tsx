import type { Dispatch, SetStateAction } from 'react';
import type { AuthConfig, AuthType, FeatureGroup, GlobalAuthProfile, Scenario } from '../../../shared/types';
import { CustomSelect } from '../../../shared/components/CustomSelect';

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

const AUTH_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'inherit', label: 'Inherit from Scenario', hint: 'Uses parent scenario/feature auth' },
  { value: 'none', label: 'No Auth', hint: 'No authentication header sent' },
  { value: 'basic', label: 'Basic Auth', hint: 'Username + Password (Base64)' },
  { value: 'bearer', label: 'Bearer Token', hint: 'Authorization: Bearer <token>' },
  { value: 'apikey', label: 'API Key', hint: 'Custom key in header or query' },
  { value: 'digest', label: 'Digest Auth', hint: 'Challenge-response authentication' },
  { value: 'oauth2', label: 'OAuth2 Client Credentials', hint: 'Client ID + Secret → token exchange' },
];

const AUTH_LABELS: Record<string, string> = {
  basic: 'Basic Auth', bearer: 'Bearer Token', apikey: 'API Key',
  digest: 'Digest Auth', oauth2: 'OAuth2 Client Credentials',
};

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
  const updateAuth = (patch: Partial<AuthConfig>) =>
    onDraftChange({ ...draft, auth: { ...draft.auth, ...patch } });

  return (
    <div className="auth-tab">
      {/* Type selector */}
      <div className="auth-tab-type-row">
        <span className="auth-tab-type-label">Auth Type</span>
        <CustomSelect
          className="auth-tab-type-select"
          value={draft.auth.type}
          onChange={(v) => updateAuth({ type: v as AuthType })}
          options={AUTH_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <span className="auth-tab-type-hint">
          {AUTH_OPTIONS.find((o) => o.value === draft.auth.type)?.hint}
        </span>
      </div>

      {/* Inherit hint */}
      {draft.auth.type === 'inherit' && (() => {
        const fg = featureGroups.find((f) => f.id === editingTest.fgId);
        const sc = fg?.scenarios.find((s) => s.id === editingTest.scenarioId);
        const scAuth = sc?.auth;
        const fgAuth = fg?.auth;
        let hint: string;
        if (scAuth && scAuth.type !== 'none' && scAuth.type !== 'inherit') {
          hint = `Will use scenario-level ${AUTH_LABELS[scAuth.type] ?? scAuth.type}`;
        } else if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') {
          hint = `Will use feature-level ${AUTH_LABELS[fgAuth.type] ?? fgAuth.type}`;
          if (scAuth?.type === 'inherit') hint += ' (scenario inherits from feature)';
        } else if (fgAuth?.type === 'inherit' && fg?.globalAuthProfileId) {
          const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
          hint = profile
            ? `Will use global profile "${profile.name}" (${AUTH_LABELS[profile.auth.type] ?? profile.auth.type})`
            : 'Feature references a missing global profile.';
          if (scAuth?.type === 'inherit') hint += ' (via scenario → feature → global)';
        } else {
          hint = 'No auth configured at scenario or feature level.';
        }
        return <div className="auth-tab-inherit-hint">{hint}</div>;
      })()}

      {/* Basic Auth fields */}
      {draft.auth.type === 'basic' && (
        <div className="auth-tab-fields">
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Username</span>
            <input className="auth-tab-input" value={draft.auth.username || ''} onChange={(e) => updateAuth({ username: e.target.value })} placeholder="Enter username" />
          </div>
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Password</span>
            <input className="auth-tab-input" type="password" value={draft.auth.password || ''} onChange={(e) => updateAuth({ password: e.target.value })} placeholder="Enter password" />
          </div>
        </div>
      )}

      {/* Bearer Token fields */}
      {draft.auth.type === 'bearer' && (
        <div className="auth-tab-fields">
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Token</span>
            <input className="auth-tab-input" value={draft.auth.token || ''} onChange={(e) => updateAuth({ token: e.target.value })} placeholder="eyJhbGciOi..." />
          </div>
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Prefix</span>
            <input className="auth-tab-input" value={draft.auth.prefix ?? 'Bearer'} onChange={(e) => updateAuth({ prefix: e.target.value })} placeholder="Bearer" />
          </div>
        </div>
      )}

      {/* API Key fields */}
      {draft.auth.type === 'apikey' && (
        <div className="auth-tab-fields">
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Key Name</span>
            <input className="auth-tab-input" value={draft.auth.apiKeyName || ''} onChange={(e) => updateAuth({ apiKeyName: e.target.value })} placeholder="X-API-Key" />
          </div>
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Key Value</span>
            <input className="auth-tab-input" value={draft.auth.apiKeyValue || ''} onChange={(e) => updateAuth({ apiKeyValue: e.target.value })} placeholder="your-api-key" />
          </div>
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Add to</span>
            <div className="auth-tab-radio-group">
              <label className="auth-tab-radio">
                <input type="radio" checked={draft.auth.apiKeyIn !== 'query'} onChange={() => updateAuth({ apiKeyIn: 'header' })} />
                <span>Header</span>
              </label>
              <label className="auth-tab-radio">
                <input type="radio" checked={draft.auth.apiKeyIn === 'query'} onChange={() => updateAuth({ apiKeyIn: 'query' })} />
                <span>Query Parameter</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Digest Auth fields */}
      {draft.auth.type === 'digest' && (
        <div className="auth-tab-fields">
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Username</span>
            <input className="auth-tab-input" value={draft.auth.username || ''} onChange={(e) => updateAuth({ username: e.target.value })} placeholder="Enter username" />
          </div>
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Password</span>
            <input className="auth-tab-input" type="password" value={draft.auth.password || ''} onChange={(e) => updateAuth({ password: e.target.value })} placeholder="Enter password" />
          </div>
        </div>
      )}

      {/* OAuth2 fields */}
      {draft.auth.type === 'oauth2' && (
        <div className="auth-tab-fields">
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Token URL</span>
            <input className="auth-tab-input" value={draft.auth.tokenUrl || ''} onChange={(e) => updateAuth({ tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
          </div>
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Client ID</span>
            <input className="auth-tab-input" value={draft.auth.clientId || ''} onChange={(e) => updateAuth({ clientId: e.target.value })} placeholder="Enter client ID" />
          </div>
          <div className="auth-tab-field-row">
            <span className="auth-tab-field-label">Client Secret</span>
            <div className="auth-tab-secret-wrap">
              <input className="auth-tab-input" type={showSecret ? 'text' : 'password'} value={draft.auth.clientSecret || ''} onChange={(e) => updateAuth({ clientSecret: e.target.value })} placeholder="Enter client secret" />
              <button type="button" className="auth-tab-secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Verify button */}
      {draft.auth.type !== 'none' && draft.auth.type !== 'inherit' && (
        <div className="auth-tab-verify">
          <button
            type="button"
            className="btn btn-sm auth-tab-verify-btn"
            onClick={() => { setAuthVerifyResult(null); void verifyAuth(draft.auth); }}
            disabled={authVerifying}
          >
            {authVerifying ? 'Verifying...' : 'Verify Auth'}
          </button>
          {authVerifyResult && (
            <div className={`auth-tab-verify-result ${authVerifyResult.ok ? 'auth-tab-verify-ok' : 'auth-tab-verify-fail'}`}>
              <span className="auth-tab-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>
              <div className="auth-tab-verify-body">
                <span className="auth-tab-verify-msg">{authVerifyResult.message}</span>
                {authVerifyResult.detail && <pre className="auth-tab-verify-detail">{authVerifyResult.detail}</pre>}
              </div>
            </div>
          )}
        </div>
      )}
      {draft.auth.type === 'inherit' && (() => {
        const { auth: resolved, source } = resolveEffectiveAuth();
        if (resolved.type === 'none') return null;
        return (
          <div className="auth-tab-verify">
            <button
              type="button"
              className="btn btn-sm auth-tab-verify-btn"
              onClick={() => { setAuthVerifyResult(null); void verifyAuth(resolved); }}
              disabled={authVerifying}
            >
              {authVerifying ? 'Verifying...' : `Verify Inherited Auth (${source})`}
            </button>
            {authVerifyResult && (
              <div className={`auth-tab-verify-result ${authVerifyResult.ok ? 'auth-tab-verify-ok' : 'auth-tab-verify-fail'}`}>
                <span className="auth-tab-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>
                <div className="auth-tab-verify-body">
                  <span className="auth-tab-verify-msg">{authVerifyResult.message}</span>
                  {authVerifyResult.detail && <pre className="auth-tab-verify-detail">{authVerifyResult.detail}</pre>}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
