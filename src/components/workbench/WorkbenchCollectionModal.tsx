import { useState, useMemo } from 'react';
import type { WorkbenchCollection, WorkbenchEnv, GlobalAuthProfile, Microservice, Environment } from '../../types';
import type { ModalAuthType, EnvAuthState } from '../../utils/workbenchAuthState';
import { authToState, stateToAuth, emptyAuthState } from '../../utils/workbenchAuthState';

interface Props {
  collection: WorkbenchCollection | null;
  collections: WorkbenchCollection[];
  environments: WorkbenchEnv[];
  appEnvironments: Environment[];
  appMicroservices: Microservice[];
  globalAuthProfiles: GlobalAuthProfile[];
  onSave: (col: Omit<WorkbenchCollection, 'id' | 'requests'> & { id?: string }) => void;
  onAddEnv: (name: string) => void;
  onClose: () => void;
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
        onChange={(e) => onChange({ authType: e.target.value as ModalAuthType })}>
        <option value="none">No Auth</option>
        {globalAuthProfiles.length > 0 && <option value="global-profile">Global Auth Profile</option>}
        <option value="bearer">Bearer Token</option>
        <option value="basic">Basic Auth</option>
        <option value="apikey">API Key</option>
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

      {state.authType === 'apikey' && (
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

export default function WorkbenchCollectionModal({ collection, collections, environments, appEnvironments, appMicroservices, globalAuthProfiles, onSave, onAddEnv, onClose }: Props) {
  const [name, setName] = useState(collection?.name ?? '');
  const [mode, setMode] = useState<'direct' | 'multi-env'>(collection?.mode ?? 'direct');
  const [microserviceId, setMicroserviceId] = useState<string | undefined>(collection?.microserviceId);
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>(collection?.baseUrls ?? {});
  const [newEnvName, setNewEnvName] = useState('');

  const linkedSvc = useMemo(
    () => microserviceId ? appMicroservices.find(s => s.id === microserviceId) : undefined,
    [microserviceId, appMicroservices],
  );

  const linkedEnvRows = useMemo(() => {
    if (!linkedSvc) return [];
    const allEnvs = [...appEnvironments, ...(linkedSvc.customEnvs ?? [])];
    return allEnvs
      .filter(e => linkedSvc.baseUrls[e.id])
      .map(e => ({ envId: e.id, envName: e.name, baseUrl: linkedSvc.baseUrls[e.id] }));
  }, [linkedSvc, appEnvironments]);

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

  const updatePerEnvAuth = (envId: string, patch: Partial<EnvAuthState>) => {
    setPerEnvAuth((prev) => ({
      ...prev,
      [envId]: { ...(prev[envId] ?? emptyAuthState(globalAuthProfiles)), ...patch },
    }));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const nameUnchanged = collection && collection.name.toLowerCase() === name.trim().toLowerCase();
    if (!nameUnchanged) {
      const duplicate = collections.some(c =>
        c.id !== collection?.id && c.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicate) {
        alert(`A collection with the name "${name.trim()}" already exists.`);
        return;
      }
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
      mode: linkedSvc ? 'multi-env' : mode,
      microserviceId: microserviceId || undefined,
      baseUrls: linkedSvc ? undefined : (mode === 'multi-env' ? baseUrls : undefined),
      auth: linkedSvc ? undefined : auth,
      authPerEnv: linkedSvc ? undefined : authPerEnv,
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
            <label>Linked Microservice</label>
            <select className="wb-select" value={microserviceId ?? ''} onChange={e => setMicroserviceId(e.target.value || undefined)}>
              <option value="">None (manual config)</option>
              {appMicroservices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {linkedSvc && (
              <p className="wb-hint" style={{ marginTop: 4 }}>Base URLs and auth are inherited from Environments.</p>
            )}
          </div>

          {linkedSvc ? (
            <div className="wb-form-group">
              <label>Environments (from Environments config)</label>
              {linkedEnvRows.length > 0 ? (
                <div className="wb-base-url-list">
                  {linkedEnvRows.map(r => (
                    <div key={r.envId} className="wb-base-url-row">
                      <span className="wb-env-label">{r.envName}</span>
                      <div className="wb-base-url-input-group">
                        <input className="wb-input" value={r.baseUrl} readOnly style={{ opacity: 0.7 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="wb-hint">No environments configured for this microservice.</p>
              )}
              <p className="wb-hint" style={{ marginTop: 6, fontStyle: 'italic' }}>To edit, go to Environments.</p>
            </div>
          ) : (
            <>
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
                    <p className="wb-hint">No environments defined yet. Add one below or go to the Environments tab.</p>
                  ) : (
                    <div className="wb-base-url-list">
                      {environments.map((env) => (
                        <div key={env.id} className="wb-base-url-row">
                          <span className="wb-env-label">{env.name}</span>
                          <div className="wb-base-url-input-group">
                            <input className="wb-input" value={baseUrls[env.id] ?? ''}
                              onChange={(e) => handleBaseUrlChange(env.id, e.target.value)}
                              placeholder={`https://${name || 'service'}.${env.name}.example.com`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="wb-add-env-row">
                    <input className="wb-input" value={newEnvName}
                      onChange={(e) => setNewEnvName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newEnvName.trim()) {
                          const exists = environments.some(env => env.name.toLowerCase() === newEnvName.trim().toLowerCase());
                          if (exists) { alert(`Environment "${newEnvName.trim()}" already exists.`); return; }
                          onAddEnv(newEnvName.trim());
                          setNewEnvName('');
                        }
                      }}
                      placeholder="Add new environment (e.g. staging)" />
                    <button className="btn btn-sm" disabled={!newEnvName.trim()}
                      onClick={() => {
                        const exists = environments.some(env => env.name.toLowerCase() === newEnvName.trim().toLowerCase());
                        if (exists) { alert(`Environment "${newEnvName.trim()}" already exists.`); return; }
                        onAddEnv(newEnvName.trim());
                        setNewEnvName('');
                      }}>+ Add Env</button>
                  </div>
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
            </>
          )}
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
