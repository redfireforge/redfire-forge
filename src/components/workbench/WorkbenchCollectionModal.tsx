import { useState, useMemo } from 'react';
import type { WorkbenchCollection, WorkbenchEnv, Project, AuthConfig, GlobalAuthProfile } from '../../types';

type AuthType = 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2' | 'global-profile';

interface Props {
  collection: WorkbenchCollection | null;
  collections: WorkbenchCollection[];
  environments: WorkbenchEnv[];
  projects: Project[];
  globalAuthProfiles: GlobalAuthProfile[];
  onSave: (col: Omit<WorkbenchCollection, 'id' | 'requests'> & { id?: string }) => void;
  onClose: () => void;
}

function getAuthType(auth?: AuthConfig, allProfiles?: GlobalAuthProfile[]): AuthType {
  if (!auth || auth.type === 'none' || auth.type === 'inherit') return 'none';
  if ((auth as any).globalProfileId && allProfiles?.length) return 'global-profile';
  return auth.type as AuthType;
}

interface EnvAuthState {
  authType: AuthType;
  bearerPrefix: string;
  bearerToken: string;
  basicUser: string;
  basicPass: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyIn: 'header' | 'query';
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  selectedProfileId: string;
}

function authToState(auth: AuthConfig | undefined, profiles: GlobalAuthProfile[]): EnvAuthState {
  return {
    authType: getAuthType(auth, profiles),
    bearerPrefix: auth?.prefix ?? 'Bearer',
    bearerToken: auth?.token ?? '',
    basicUser: auth?.username ?? '',
    basicPass: auth?.password ?? '',
    apiKeyName: auth?.apiKeyName ?? '',
    apiKeyValue: auth?.apiKeyValue ?? '',
    apiKeyIn: auth?.apiKeyIn ?? 'header',
    tokenUrl: auth?.tokenUrl ?? '',
    clientId: auth?.clientId ?? '',
    clientSecret: auth?.clientSecret ?? '',
    selectedProfileId: (auth as any)?.globalProfileId ?? (profiles[0]?.id ?? ''),
  };
}

function stateToAuth(s: EnvAuthState, profiles: GlobalAuthProfile[]): AuthConfig | undefined {
  switch (s.authType) {
    case 'bearer': return { type: 'bearer', prefix: s.bearerPrefix, token: s.bearerToken };
    case 'basic': return { type: 'basic', username: s.basicUser, password: s.basicPass };
    case 'api-key': return { type: 'api-key' as any, apiKeyName: s.apiKeyName, apiKeyValue: s.apiKeyValue, apiKeyIn: s.apiKeyIn };
    case 'oauth2': return { type: 'oauth2', tokenUrl: s.tokenUrl, clientId: s.clientId, clientSecret: s.clientSecret };
    case 'global-profile': {
      const profile = profiles.find(p => p.id === s.selectedProfileId);
      if (profile) return { ...profile.auth, globalProfileId: s.selectedProfileId } as any;
      return undefined;
    }
    default: return undefined;
  }
}

function emptyAuthState(profiles: GlobalAuthProfile[]): EnvAuthState {
  return authToState(undefined, profiles);
}

function AuthFields({ state, onChange, globalAuthProfiles }: {
  state: EnvAuthState;
  onChange: (patch: Partial<EnvAuthState>) => void;
  globalAuthProfiles: GlobalAuthProfile[];
}) {
  const selectedProfile = globalAuthProfiles.find(p => p.id === state.selectedProfileId);

  return (
    <>
      <select className="wb-select" value={state.authType}
        onChange={(e) => onChange({ authType: e.target.value as AuthType })}>
        <option value="none">No Auth</option>
        {globalAuthProfiles.length > 0 && <option value="global-profile">Global Auth Profile</option>}
        <option value="bearer">Bearer Token</option>
        <option value="basic">Basic Auth</option>
        <option value="api-key">API Key</option>
        <option value="oauth2">OAuth2 Client Credentials</option>
      </select>

      {state.authType === 'global-profile' && (
        <div className="wb-auth-fields">
          <label className="wb-auth-label">Select Profile</label>
          <select className="wb-select" value={state.selectedProfileId}
            onChange={(e) => onChange({ selectedProfileId: e.target.value })}>
            {globalAuthProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
            ))}
          </select>
          {selectedProfile && (
            <div className="wb-profile-info">
              <span className="wb-profile-type-badge">{selectedProfile.auth.type.toUpperCase()}</span>
              <span>{selectedProfile.name}</span>
            </div>
          )}
        </div>
      )}

      {state.authType === 'bearer' && (
        <div className="wb-auth-fields">
          <label className="wb-auth-label">Prefix</label>
          <input className="wb-input" value={state.bearerPrefix} onChange={(e) => onChange({ bearerPrefix: e.target.value })} placeholder="Bearer" />
          <label className="wb-auth-label">Token</label>
          <input className="wb-input" value={state.bearerToken} onChange={(e) => onChange({ bearerToken: e.target.value })} placeholder="Paste your token" />
        </div>
      )}

      {state.authType === 'basic' && (
        <div className="wb-auth-fields">
          <label className="wb-auth-label">Username</label>
          <input className="wb-input" value={state.basicUser} onChange={(e) => onChange({ basicUser: e.target.value })} placeholder="Username" />
          <label className="wb-auth-label">Password</label>
          <input className="wb-input" type="password" value={state.basicPass} onChange={(e) => onChange({ basicPass: e.target.value })} placeholder="Password" />
        </div>
      )}

      {state.authType === 'api-key' && (
        <div className="wb-auth-fields">
          <label className="wb-auth-label">Key Name</label>
          <input className="wb-input" value={state.apiKeyName} onChange={(e) => onChange({ apiKeyName: e.target.value })} placeholder="e.g. X-API-Key" />
          <label className="wb-auth-label">Key Value</label>
          <input className="wb-input" value={state.apiKeyValue} onChange={(e) => onChange({ apiKeyValue: e.target.value })} placeholder="Key value" />
          <label className="wb-auth-label">Add To</label>
          <select className="wb-select" value={state.apiKeyIn} onChange={(e) => onChange({ apiKeyIn: e.target.value as 'header' | 'query' })}>
            <option value="header">Header</option>
            <option value="query">Query String</option>
          </select>
        </div>
      )}

      {state.authType === 'oauth2' && (
        <div className="wb-auth-fields">
          <label className="wb-auth-label">Token URL</label>
          <input className="wb-input" value={state.tokenUrl} onChange={(e) => onChange({ tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
          <label className="wb-auth-label">Client ID</label>
          <input className="wb-input" value={state.clientId} onChange={(e) => onChange({ clientId: e.target.value })} placeholder="Client ID" />
          <label className="wb-auth-label">Client Secret</label>
          <input className="wb-input" type="password" value={state.clientSecret} onChange={(e) => onChange({ clientSecret: e.target.value })} placeholder="Client Secret" />
        </div>
      )}
    </>
  );
}

export default function WorkbenchCollectionModal({ collection, collections, environments, projects, globalAuthProfiles, onSave, onClose }: Props) {
  const [name, setName] = useState(collection?.name ?? '');
  const [mode, setMode] = useState<'direct' | 'multi-env'>(collection?.mode ?? 'direct');
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>(collection?.baseUrls ?? {});
  const [importProjectId, setImportProjectId] = useState('');

  const [defaultAuth, setDefaultAuth] = useState<EnvAuthState>(
    authToState(collection?.auth, globalAuthProfiles)
  );

  const [perEnvAuth, setPerEnvAuth] = useState<Record<string, EnvAuthState>>(() => {
    const init: Record<string, EnvAuthState> = {};
    if (collection?.authPerEnv) {
      for (const [envId, auth] of Object.entries(collection.authPerEnv)) {
        init[envId] = authToState(auth, globalAuthProfiles);
      }
    }
    return init;
  });

  const [authMode, setAuthMode] = useState<'single' | 'per-env'>(
    collection?.authPerEnv && Object.keys(collection.authPerEnv).length > 0 ? 'per-env' : 'single'
  );

  const [activeEnvTab, setActiveEnvTab] = useState<string>(environments[0]?.id ?? '');

  const handleBaseUrlChange = (envId: string, url: string) => {
    setBaseUrls((prev) => ({ ...prev, [envId]: url }));
  };

  const availableUrlsByEnv = useMemo(() => {
    const result: Record<string, { label: string; url: string }[]> = {};
    for (const proj of projects) {
      for (const svc of proj.microservices) {
        for (const env of proj.environments) {
          const wbEnv = environments.find((e) => e.name === env.name);
          if (wbEnv && svc.baseUrls[env.id]) {
            if (!result[wbEnv.id]) result[wbEnv.id] = [];
            const exists = result[wbEnv.id].some(e => e.url === svc.baseUrls[env.id]);
            if (!exists) {
              result[wbEnv.id].push({ label: `${svc.name} (${proj.name})`, url: svc.baseUrls[env.id] });
            }
          }
        }
      }
    }
    return result;
  }, [projects, environments]);

  const handleImportFromProject = () => {
    const proj = projects.find((p) => p.id === importProjectId);
    if (!proj) return;
    const merged = { ...baseUrls };
    for (const svc of proj.microservices) {
      for (const env of proj.environments) {
        const wbEnv = environments.find((e) => e.name === env.name);
        if (wbEnv && svc.baseUrls[env.id]) {
          if (!merged[wbEnv.id]) merged[wbEnv.id] = svc.baseUrls[env.id];
        }
      }
    }
    setBaseUrls(merged);
  };

  const updatePerEnvAuth = (envId: string, patch: Partial<EnvAuthState>) => {
    setPerEnvAuth((prev) => ({
      ...prev,
      [envId]: { ...(prev[envId] ?? emptyAuthState(globalAuthProfiles)), ...patch },
    }));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const duplicate = collections.some(c =>
      c.id !== collection?.id && c.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      alert(`A collection with the name "${name.trim()}" already exists.`);
      return;
    }

    let auth: AuthConfig | undefined;
    let authPerEnv: Record<string, AuthConfig> | undefined;

    if (mode === 'multi-env' && authMode === 'per-env') {
      authPerEnv = {};
      for (const env of environments) {
        const s = perEnvAuth[env.id];
        if (s) {
          const built = stateToAuth(s, globalAuthProfiles);
          if (built) authPerEnv[env.id] = built;
        }
      }
      auth = undefined;
    } else {
      auth = stateToAuth(defaultAuth, globalAuthProfiles);
      authPerEnv = undefined;
    }

    onSave({
      ...(collection ? { id: collection.id } : {}),
      name: name.trim(),
      mode,
      baseUrls: mode === 'multi-env' ? baseUrls : undefined,
      auth,
      authPerEnv,
    });
  };

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="modal wb-col-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <h3>{collection ? 'Edit Collection' : 'New Collection'}</h3>
          <button className="wb-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="wb-modal-body">
          <div className="wb-form-group">
            <label>Collection Name</label>
            <input className="wb-input" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. veh-metadata, weather-api" autoFocus />
          </div>

          <div className="wb-form-group">
            <label>URL Mode</label>
            <div className="wb-mode-switcher">
              <button className={`wb-mode-btn ${mode === 'direct' ? 'active' : ''}`} onClick={() => setMode('direct')}>
                <strong>Direct URL</strong><span>Full URLs per request</span>
              </button>
              <button className={`wb-mode-btn ${mode === 'multi-env' ? 'active' : ''}`} onClick={() => setMode('multi-env')}>
                <strong>Multi-Environment</strong><span>Base URLs + relative paths</span>
              </button>
            </div>
          </div>

          {mode === 'multi-env' && (
            <div className="wb-form-group">
              <label>Base URLs per Environment</label>
              {environments.length === 0 ? (
                <p className="wb-hint">No environments defined yet. Use the gear icon in the sidebar to manage environments.</p>
              ) : (
                <div className="wb-base-url-list">
                  {environments.map((env) => {
                    const choices = availableUrlsByEnv[env.id] ?? [];
                    return (
                    <div key={env.id} className="wb-base-url-row">
                      <span className="wb-env-label">{env.name}</span>
                      <div className="wb-base-url-input-group">
                        <input className="wb-input" value={baseUrls[env.id] ?? ''}
                          onChange={(e) => handleBaseUrlChange(env.id, e.target.value)}
                          placeholder={`https://${name || 'service'}.${env.name}.example.com`} />
                        {choices.length > 0 && (
                          <select className="wb-base-url-picker"
                            value=""
                            onChange={(e) => { if (e.target.value) handleBaseUrlChange(env.id, e.target.value); }}>
                            <option value="">Pick from project...</option>
                            {choices.map((c, i) => (
                              <option key={i} value={c.url}>{c.label} — {c.url}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
              {projects.length > 0 && (
                <div className="wb-import-from-project">
                  <select className="wb-select" value={importProjectId} onChange={(e) => setImportProjectId(e.target.value)}>
                    <option value="">Import base URLs from project...</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button className="btn btn-sm" disabled={!importProjectId} onClick={handleImportFromProject}>Import</button>
                </div>
              )}
            </div>
          )}

          <div className="wb-form-group">
            <label>Default Auth</label>
            <p className="wb-hint">Requests set to "Inherit from Collection" will use this auth.</p>

            {mode === 'multi-env' && environments.length > 0 && (
              <div className="wb-auth-mode-switcher">
                <button className={`wb-auth-mode-btn ${authMode === 'single' ? 'active' : ''}`}
                  onClick={() => setAuthMode('single')}>Same for all envs</button>
                <button className={`wb-auth-mode-btn ${authMode === 'per-env' ? 'active' : ''}`}
                  onClick={() => setAuthMode('per-env')}>Per environment</button>
              </div>
            )}

            {(mode !== 'multi-env' || authMode === 'single') && (
              <AuthFields state={defaultAuth}
                onChange={(patch) => setDefaultAuth((prev) => ({ ...prev, ...patch }))}
                globalAuthProfiles={globalAuthProfiles} />
            )}

            {mode === 'multi-env' && authMode === 'per-env' && environments.length > 0 && (
              <div className="wb-env-auth-tabs">
                <div className="wb-env-tab-bar">
                  {environments.map((env) => {
                    const s = perEnvAuth[env.id];
                    const configured = s && s.authType !== 'none';
                    return (
                      <button key={env.id}
                        className={`wb-env-tab ${activeEnvTab === env.id ? 'active' : ''} ${configured ? 'configured' : ''}`}
                        onClick={() => setActiveEnvTab(env.id)}>
                        {env.name}
                        {configured && <span className="wb-env-tab-dot" />}
                      </button>
                    );
                  })}
                </div>
                <div className="wb-env-tab-content">
                  {environments.filter(env => env.id === activeEnvTab).map((env) => (
                    <AuthFields key={env.id}
                      state={perEnvAuth[env.id] ?? emptyAuthState(globalAuthProfiles)}
                      onChange={(patch) => updatePerEnvAuth(env.id, patch)}
                      globalAuthProfiles={globalAuthProfiles} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="wb-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
            {collection ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
