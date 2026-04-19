import { useState, useMemo } from 'react';
import type { RequestFolder, RequestCollection, RequestEnv, AuthConfig, GlobalAuthProfile } from '../../types';

type AuthType = 'none' | 'inherit' | 'bearer' | 'basic' | 'api-key' | 'oauth2' | 'global-profile';

interface Props {
  subCollection: RequestFolder;
  parentCollection: RequestCollection;
  environments: RequestEnv[];
  globalAuthProfiles: GlobalAuthProfile[];
  onSave: (patch: Partial<Pick<RequestFolder, 'name' | 'auth' | 'baseUrls' | 'selectedEnvId'>>) => void;
  onClose: () => void;
}

function getAuthType(auth?: AuthConfig, profiles?: GlobalAuthProfile[]): AuthType {
  if (!auth) return 'inherit';
  if (auth.type === 'none') return 'none';
  if (auth.type === 'inherit') return 'inherit';
  if ((auth as any).globalProfileId && profiles?.length) return 'global-profile';
  return auth.type as AuthType;
}

export default function SubCollectionModal({ subCollection, parentCollection, environments, globalAuthProfiles, onSave, onClose }: Props) {
  const [name, setName] = useState(subCollection.name);
  const [selectedEnvId, setSelectedEnvId] = useState(subCollection.selectedEnvId ?? '');
  const [authType, setAuthType] = useState<AuthType>(getAuthType(subCollection.auth, globalAuthProfiles));
  const [bearerPrefix, setBearerPrefix] = useState(subCollection.auth?.prefix ?? 'Bearer');
  const [bearerToken, setBearerToken] = useState(subCollection.auth?.token ?? '');
  const [basicUser, setBasicUser] = useState(subCollection.auth?.username ?? '');
  const [basicPass, setBasicPass] = useState(subCollection.auth?.password ?? '');
  const [apiKeyName, setApiKeyName] = useState(subCollection.auth?.apiKeyName ?? '');
  const [apiKeyValue, setApiKeyValue] = useState(subCollection.auth?.apiKeyValue ?? '');
  const [apiKeyIn, setApiKeyIn] = useState<'header' | 'query'>(subCollection.auth?.apiKeyIn ?? 'header');
  const [tokenUrl, setTokenUrl] = useState(subCollection.auth?.tokenUrl ?? '');
  const [clientId, setClientId] = useState(subCollection.auth?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState(subCollection.auth?.clientSecret ?? '');
  const [selectedProfileId, setSelectedProfileId] = useState<string>((subCollection.auth as any)?.globalProfileId ?? (globalAuthProfiles[0]?.id ?? ''));

  const [baseUrlOverride, setBaseUrlOverride] = useState(
    selectedEnvId && subCollection.baseUrls?.[selectedEnvId]
      ? subCollection.baseUrls[selectedEnvId]
      : ''
  );

  const availableEnvs = useMemo(() => {
    if (parentCollection.mode !== 'multi-env') return [];
    return environments.filter(env => parentCollection.baseUrls?.[env.id]);
  }, [parentCollection, environments]);

  const parentBaseUrl = selectedEnvId ? parentCollection.baseUrls?.[selectedEnvId] ?? '' : '';

  function buildAuth(): AuthConfig | undefined {
    switch (authType) {
      case 'inherit': return { type: 'inherit' };
      case 'none': return { type: 'none' };
      case 'bearer': return { type: 'bearer', prefix: bearerPrefix, token: bearerToken };
      case 'basic': return { type: 'basic', username: basicUser, password: basicPass };
      case 'api-key': return { type: 'api-key' as any, apiKeyName, apiKeyValue, apiKeyIn };
      case 'oauth2': return { type: 'oauth2', tokenUrl, clientId, clientSecret };
      case 'global-profile': {
        const profile = globalAuthProfiles.find(p => p.id === selectedProfileId);
        if (profile) return { ...profile.auth, globalProfileId: selectedProfileId } as any;
        return { type: 'inherit' };
      }
      default: return undefined;
    }
  }

  function handleSave() {
    const baseUrls: Record<string, string> = {};
    if (selectedEnvId && baseUrlOverride.trim()) {
      baseUrls[selectedEnvId] = baseUrlOverride.trim();
    }
    onSave({
      name: name.trim() || subCollection.name,
      auth: buildAuth(),
      selectedEnvId: selectedEnvId || undefined,
      baseUrls: Object.keys(baseUrls).length > 0 ? baseUrls : undefined,
    });
    onClose();
  }

  return (
    <div className="req-modal-overlay" onClick={onClose}>
      <div className="req-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="req-modal-header">
          <h3>📦 Sub-Collection Settings</h3>
          <button className="req-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="req-modal-body">
          <label className="req-label">Name</label>
          <input className="req-input" value={name} onChange={(e) => setName(e.target.value)} />

          {availableEnvs.length > 0 && (
            <>
              <label className="req-label" style={{ marginTop: 16 }}>Environment</label>
              <p className="req-hint">Pick one environment from the parent collection.</p>
              <select className="req-select" value={selectedEnvId}
                onChange={(e) => { setSelectedEnvId(e.target.value); setBaseUrlOverride(''); }}>
                <option value="">— Inherit all from parent —</option>
                {availableEnvs.map((env) => (
                  <option key={env.id} value={env.id}>{env.name}</option>
                ))}
              </select>
              {selectedEnvId && (
                <div className="req-sub-env-info">
                  <span className="req-sub-env-label">Parent Base URL:</span>
                  <code className="req-sub-env-url">{parentBaseUrl || '(not set)'}</code>
                  <label className="req-label" style={{ marginTop: 8 }}>Override Base URL (optional)</label>
                  <input className="req-input" value={baseUrlOverride}
                    onChange={(e) => setBaseUrlOverride(e.target.value)}
                    placeholder={parentBaseUrl || 'https://...'} />
                </div>
              )}
            </>
          )}

          <label className="req-label" style={{ marginTop: 16 }}>Authentication</label>
          <select className="req-select" value={authType}
            onChange={(e) => setAuthType(e.target.value as AuthType)}>
            <option value="inherit">Inherit from parent collection</option>
            <option value="none">No Auth</option>
            {globalAuthProfiles.length > 0 && <option value="global-profile">Global Auth Profile</option>}
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
            <option value="api-key">API Key</option>
            <option value="oauth2">OAuth2 Client Credentials</option>
          </select>

          {authType === 'global-profile' && (
            <div className="req-auth-fields">
              <label className="req-auth-label">Select Profile</label>
              <select className="req-select" value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}>
                {globalAuthProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
                ))}
              </select>
            </div>
          )}

          {authType === 'bearer' && (
            <div className="req-auth-fields">
              <label className="req-auth-label">Prefix</label>
              <input className="req-input" value={bearerPrefix} onChange={(e) => setBearerPrefix(e.target.value)} placeholder="Bearer" />
              <label className="req-auth-label">Token</label>
              <input className="req-input" value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} placeholder="Paste your token" />
            </div>
          )}

          {authType === 'basic' && (
            <div className="req-auth-fields">
              <label className="req-auth-label">Username</label>
              <input className="req-input" value={basicUser} onChange={(e) => setBasicUser(e.target.value)} placeholder="Username" />
              <label className="req-auth-label">Password</label>
              <input className="req-input" type="password" value={basicPass} onChange={(e) => setBasicPass(e.target.value)} placeholder="Password" />
            </div>
          )}

          {authType === 'api-key' && (
            <div className="req-auth-fields">
              <label className="req-auth-label">Key Name</label>
              <input className="req-input" value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} placeholder="e.g. X-API-Key" />
              <label className="req-auth-label">Key Value</label>
              <input className="req-input" value={apiKeyValue} onChange={(e) => setApiKeyValue(e.target.value)} placeholder="Key value" />
              <label className="req-auth-label">Add To</label>
              <select className="req-select" value={apiKeyIn} onChange={(e) => setApiKeyIn(e.target.value as 'header' | 'query')}>
                <option value="header">Header</option>
                <option value="query">Query String</option>
              </select>
            </div>
          )}

          {authType === 'oauth2' && (
            <div className="req-auth-fields">
              <label className="req-auth-label">Token URL</label>
              <input className="req-input" value={tokenUrl} onChange={(e) => setTokenUrl(e.target.value)} placeholder="https://auth.example.com/oauth/token" />
              <label className="req-auth-label">Client ID</label>
              <input className="req-input" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" />
              <label className="req-auth-label">Client Secret</label>
              <input className="req-input" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client Secret" />
            </div>
          )}
        </div>

        <div className="req-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
