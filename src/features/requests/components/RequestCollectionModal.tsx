import { useState, useMemo } from 'react';
import type { RequestCollection, RequestEnv, GlobalAuthProfile, Microservice, Environment, AuthConfig } from '../../../shared/types';
import type { ModalAuthType, EnvAuthState } from '../utils/requestAuthState';
import { authToState, stateToAuth, emptyAuthState } from '../utils/requestAuthState';
import { useToast } from '../../../shared/hooks/useToast';

interface Props {
  collection: RequestCollection | null;
  collections: RequestCollection[];
  environments: RequestEnv[];
  appEnvironments: Environment[];
  appMicroservices: Microservice[];
  globalAuthProfiles: GlobalAuthProfile[];
  defaultMode?: 'direct' | 'multi-env';
  onSave: (col: Omit<RequestCollection, 'id' | 'requests'> & { id?: string }) => void;
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
      <select className="req-select" value={state.authType}
        onChange={(e) => onChange({ authType: e.target.value as ModalAuthType })}>
        <option value="none">No Auth</option>
        {globalAuthProfiles.length > 0 && <option value="global-profile">Global Auth Profile</option>}
        <option value="bearer">Bearer Token</option>
        <option value="basic">Basic Auth</option>
        <option value="apikey">API Key</option>
        <option value="oauth2">OAuth2 Client Credentials</option>
      </select>

      {state.authType === 'global-profile' && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Select Profile</label>
          <select className="req-select" value={state.selectedProfileId}
            onChange={(e) => onChange({ selectedProfileId: e.target.value })}>
            {globalAuthProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
            ))}
          </select>
          {selectedProfile && (
            <div className="req-profile-info">
              <span className="req-profile-type-badge">{selectedProfile.auth.type.toUpperCase()}</span>
              <span>{selectedProfile.name}</span>
            </div>
          )}
        </div>
      )}

      {state.authType === 'bearer' && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Prefix</label>
          <input className="req-input" value={state.bearerPrefix} onChange={(e) => onChange({ bearerPrefix: e.target.value })} placeholder="Bearer" />
          <label className="req-auth-label">Token</label>
          <input className="req-input" value={state.bearerToken} onChange={(e) => onChange({ bearerToken: e.target.value })} placeholder="Paste your token" />
        </div>
      )}

      {state.authType === 'basic' && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Username</label>
          <input className="req-input" value={state.basicUser} onChange={(e) => onChange({ basicUser: e.target.value })} placeholder="Username" />
          <label className="req-auth-label">Password</label>
          <input className="req-input" type="password" value={state.basicPass} onChange={(e) => onChange({ basicPass: e.target.value })} placeholder="Password" />
        </div>
      )}

      {state.authType === 'apikey' && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Key Name</label>
          <input className="req-input" value={state.apiKeyName} onChange={(e) => onChange({ apiKeyName: e.target.value })} placeholder="e.g. X-API-Key" />
          <label className="req-auth-label">Key Value</label>
          <input className="req-input" value={state.apiKeyValue} onChange={(e) => onChange({ apiKeyValue: e.target.value })} placeholder="Key value" />
          <label className="req-auth-label">Add To</label>
          <select className="req-select" value={state.apiKeyIn} onChange={(e) => onChange({ apiKeyIn: e.target.value as 'header' | 'query' })}>
            <option value="header">Header</option>
            <option value="query">Query String</option>
          </select>
        </div>
      )}

      {state.authType === 'oauth2' && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Token URL</label>
          <input className="req-input" value={state.tokenUrl} onChange={(e) => onChange({ tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
          <label className="req-auth-label">Client ID</label>
          <input className="req-input" value={state.clientId} onChange={(e) => onChange({ clientId: e.target.value })} placeholder="Client ID" />
          <label className="req-auth-label">Client Secret</label>
          <input className="req-input" type="password" value={state.clientSecret} onChange={(e) => onChange({ clientSecret: e.target.value })} placeholder="Client Secret" />
        </div>
      )}
    </>
  );
}

export default function RequestCollectionModal({ collection, collections, environments, appEnvironments, appMicroservices, globalAuthProfiles, defaultMode, onSave, onAddEnv, onClose }: Props) {
  const toast = useToast();
  const [name, setName] = useState(collection?.name ?? '');
  const [mode, setMode] = useState<'direct' | 'multi-env'>(collection?.mode === 'group' ? 'direct' : (collection?.mode ?? defaultMode ?? 'direct'));
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
        toast.show('warning', 'Name already exists', `A collection with the name "${name.trim()}" already exists.`);
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
    <div className="req-modal-overlay" onClick={onClose}>
      <div className="modal req-col-modal" onClick={(e) => e.stopPropagation()}>
        <div className="req-modal-header">
          <h3>{collection ? 'Edit Collection' : 'New Collection'}</h3>
          <button className="req-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="req-modal-body">
          <div className="req-form-group">
            <label>Collection Name</label>
            <input className="req-input" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. veh-metadata, weather-api" autoFocus />
          </div>

          <div className="req-form-group">
            <label>Linked Microservice</label>
            <select className="req-select" value={microserviceId ?? ''} onChange={e => setMicroserviceId(e.target.value || undefined)}>
              <option value="">None (manual config)</option>
              {appMicroservices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {linkedSvc && (
              <p className="req-hint" style={{ marginTop: 4 }}>Base URLs and auth are inherited from Environments.</p>
            )}
          </div>

          {linkedSvc ? (
            <div className="req-form-group">
              <label>Environments (from Environments config)</label>
              {linkedEnvRows.length > 0 ? (
                <div className="req-base-url-list">
                  {linkedEnvRows.map(r => (
                    <div key={r.envId} className="req-base-url-row">
                      <span className="req-env-label">{r.envName}</span>
                      <div className="req-base-url-input-group">
                        <input className="req-input" value={r.baseUrl} readOnly style={{ opacity: 0.7 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="req-hint">No environments configured for this microservice.</p>
              )}
              <p className="req-hint" style={{ marginTop: 6, fontStyle: 'italic' }}>To edit, go to Environments.</p>
            </div>
          ) : (
            <>
              <div className="req-form-group">
                <label>URL Mode</label>
                <div className="req-mode-switcher">
                  <button className={`req-mode-btn ${mode === 'direct' ? 'active' : ''}`} onClick={() => setMode('direct')}>
                    <strong>Direct URL</strong><span>Full URLs per request</span>
                  </button>
                  <button className={`req-mode-btn ${mode === 'multi-env' ? 'active' : ''}`} onClick={() => setMode('multi-env')}>
                    <strong>Multi-Environment</strong><span>Base URLs + relative paths</span>
                  </button>
                </div>
              </div>

              {mode === 'multi-env' && (
                <div className="req-form-group">
                  <label>Base URLs per Environment</label>
                  {environments.length === 0 ? (
                    <p className="req-hint">No environments defined yet. Add one below or go to the Environments tab.</p>
                  ) : (
                    <div className="req-base-url-list">
                      {environments.map((env) => (
                        <div key={env.id} className="req-base-url-row">
                          <span className="req-env-label">{env.name}</span>
                          <div className="req-base-url-input-group">
                            <input className="req-input" value={baseUrls[env.id] ?? ''}
                              onChange={(e) => handleBaseUrlChange(env.id, e.target.value)}
                              placeholder={`https://${name || 'service'}.${env.name}.example.com`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="req-add-env-row">
                    <input className="req-input" value={newEnvName}
                      onChange={(e) => setNewEnvName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newEnvName.trim()) {
                          const exists = environments.some(env => env.name.toLowerCase() === newEnvName.trim().toLowerCase());
                          if (exists) { toast.show('warning', 'Environment already exists', `Environment "${newEnvName.trim()}" already exists.`); return; }
                          onAddEnv(newEnvName.trim());
                          setNewEnvName('');
                        }
                      }}
                      placeholder="Add new environment (e.g. staging)" />
                    <button className="btn btn-sm" disabled={!newEnvName.trim()}
                      onClick={() => {
                        const exists = environments.some(env => env.name.toLowerCase() === newEnvName.trim().toLowerCase());
                        if (exists) { toast.show('warning', 'Environment already exists', `Environment "${newEnvName.trim()}" already exists.`); return; }
                        onAddEnv(newEnvName.trim());
                        setNewEnvName('');
                      }}>+ Add Env</button>
                  </div>
                </div>
              )}

              <div className="req-form-group">
                <label>Default Auth</label>
                <p className="req-hint">Requests set to "Inherit from Collection" will use this auth.</p>

                {mode === 'multi-env' && environments.length > 0 && (
                  <div className="req-auth-mode-switcher">
                    <button className={`req-auth-mode-btn ${authMode === 'single' ? 'active' : ''}`}
                      onClick={() => setAuthMode('single')}>Same for all envs</button>
                    <button className={`req-auth-mode-btn ${authMode === 'per-env' ? 'active' : ''}`}
                      onClick={() => setAuthMode('per-env')}>Per environment</button>
                  </div>
                )}

                {(mode !== 'multi-env' || authMode === 'single') && (
                  <AuthFields state={defaultAuth}
                    onChange={(patch) => setDefaultAuth((prev) => ({ ...prev, ...patch }))}
                    globalAuthProfiles={globalAuthProfiles} />
                )}

                {mode === 'multi-env' && authMode === 'per-env' && environments.length > 0 && (
                  <div className="req-env-auth-tabs">
                    <div className="req-env-tab-bar">
                      {environments.map((env) => {
                        const s = perEnvAuth[env.id];
                        const configured = s && s.authType !== 'none';
                        return (
                          <button key={env.id}
                            className={`req-env-tab ${activeEnvTab === env.id ? 'active' : ''} ${configured ? 'configured' : ''}`}
                            onClick={() => setActiveEnvTab(env.id)}>
                            {env.name}
                            {configured && <span className="req-env-tab-dot" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="req-env-tab-content">
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

        <div className="req-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
            {collection ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
