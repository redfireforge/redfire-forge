import { useState, useMemo, useEffect } from 'react';
import type { RequestCollection, RequestEnv, GlobalAuthProfile, Microservice, Environment, AuthConfig } from '@shared/types';
import type { ModalAuthType, EnvAuthState } from '../utils/requestAuthState';
import { authToState, stateToAuth, emptyAuthState } from '../utils/requestAuthState';
import { useToast } from '@shared/hooks/useToast';
import { useDraggableModal } from '../../environments/components/microserviceProtocolPanel/useDraggableModal';
import WfDarkSelect from '../../workflow/components/modals/WfDarkSelect';

interface Props {
  collection: RequestCollection | null;
  collections: RequestCollection[];
  environments: RequestEnv[];
  appEnvironments: Environment[];
  appMicroservices: Microservice[];
  globalAuthProfiles: GlobalAuthProfile[];
  defaultMode?: 'direct' | 'multi-env';
  onSave: (col: Omit<RequestCollection, 'id' | 'requests'> & { id?: string }) => void;
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
      <WfDarkSelect
        testId="req-auth-type-select"
        aria-label="Authentication type"
        value={state.authType}
        onChange={(v) => onChange({ authType: v as ModalAuthType })}
        options={[
          { value: 'none', label: 'No Auth' },
          ...(globalAuthProfiles.length > 0 ? [{ value: 'global-profile', label: 'Global Auth Profile' }] : []),
          { value: 'bearer', label: 'Bearer Token' },
          { value: 'basic', label: 'Basic Auth' },
          { value: 'apikey', label: 'API Key' },
          { value: 'oauth2', label: 'OAuth2 Client Credentials' },
        ]}
      />

      {state.authType === 'global-profile' && (
        <div className="req-auth-fields">
          <label className="req-auth-label">Select Profile</label>
          <WfDarkSelect
            testId="req-profile-select"
            aria-label="Select auth profile"
            value={state.selectedProfileId}
            onChange={(v) => onChange({ selectedProfileId: v })}
            options={globalAuthProfiles.map((p) => ({ value: p.id, label: `${p.name} (${p.auth.type})` }))}
          />
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
          <WfDarkSelect
            testId="req-apikey-in-select"
            aria-label="API key location"
            value={state.apiKeyIn}
            onChange={(v) => onChange({ apiKeyIn: v as 'header' | 'query' })}
            options={[
              { value: 'header', label: 'Header' },
              { value: 'query', label: 'Query String' },
            ]}
          />
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

export default function RequestCollectionModal({ collection, collections, environments, appEnvironments, appMicroservices, globalAuthProfiles, defaultMode, onSave, onClose }: Props) {
  const toast = useToast();
  const [name, setName] = useState(collection?.name ?? '');
  // Collection type is fixed at creation (URL vs ENV vs Group) — not switchable in the modal.
  const mode: 'direct' | 'multi-env' = collection?.mode === 'group' ? 'direct' : (collection?.mode ?? defaultMode ?? 'direct');
  const [microserviceId, setMicroserviceId] = useState<string | undefined>(collection?.microserviceId);
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>(collection?.baseUrls ?? {});

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

  const { offset, onHeaderMouseDown } = useDraggableModal();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isEnvMode = mode === 'multi-env';

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

    if (mode === 'direct') {
      // URL collections: each request owns its own hostname + auth. Lock to None / No Auth.
      onSave({
        ...(collection ? { id: collection.id } : {}),
        name: name.trim(),
        mode: 'direct',
        microserviceId: undefined,
        baseUrls: undefined,
        auth: { type: 'none' },
        authPerEnv: undefined,
      });
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
      mode: linkedSvc ? 'multi-env' : mode,
      microserviceId: microserviceId || undefined,
      baseUrls: linkedSvc ? undefined : (mode === 'multi-env' ? baseUrls : undefined),
      auth: linkedSvc ? undefined : auth,
      authPerEnv: linkedSvc ? undefined : authPerEnv,
    });
  };

  return (
    <div className="req-modal-overlay" onClick={onClose}>
      <div
        className="modal req-col-modal"
        data-testid="req-collection-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ transform: `translate(${offset.dx}px, ${offset.dy}px)` }}
      >
        <div className="req-modal-header" onMouseDown={onHeaderMouseDown}>
          <div className="req-modal-header-main">
            <span className="req-modal-header-icon" aria-hidden>{isEnvMode ? '\uD83C\uDF10' : '\uD83D\uDCE1'}</span>
            <div className="req-modal-header-text">
              <h3>{collection ? 'Edit Collection' : 'New Collection'}</h3>
              <span className="req-modal-header-sub">
                {isEnvMode ? 'Multi-environment base URLs & auth' : 'Full URLs & auth per request'}
              </span>
            </div>
          </div>
          <span className="req-modal-grip" title="Drag to move" aria-hidden>&#8942;&#8942;</span>
        </div>

        <div className="req-modal-body">
          <div className="req-form-table">
            <div className="req-form-table-row">
              <label className="req-form-table-label">Collection Name</label>
              <div className="req-form-table-ctrl">
                <input className="req-input" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. veh-metadata, weather-api" autoFocus />
              </div>
            </div>

            {mode === 'multi-env' && (
              <div className="req-form-table-row">
                <label className="req-form-table-label">Linked Microservice</label>
                <div className="req-form-table-ctrl">
                  <WfDarkSelect
                    testId="req-svc-select"
                    aria-label="Linked microservice"
                    value={microserviceId ?? ''}
                    onChange={(v) => setMicroserviceId(v || undefined)}
                    options={[
                      { value: '', label: 'None (manual config)' },
                      ...appMicroservices.map(s => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </div>
              </div>
            )}
          </div>

          {mode === 'multi-env' && linkedSvc && (
            <p className="req-hint" style={{ marginBottom: 12 }}>Base URLs and auth are inherited from Environments.</p>
          )}

          {mode === 'multi-env' && (
            <>

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
                    <label>Base URLs per Environment</label>
                    {environments.length === 0 ? (
                      <p className="req-hint">No environments defined yet. Add them in Settings → Environments, then set a base URL here.</p>
                    ) : (
                      <div className="req-base-url-list" data-testid="req-base-url-map">
                        {environments.map((env) => (
                          <div key={env.id} className="req-base-url-row" data-env-id={env.id}>
                            <span className="req-env-label">{env.name}</span>
                            <div className="req-base-url-input-group">
                              <input className="req-input" data-testid="req-base-url-input" value={baseUrls[env.id] ?? ''}
                                onChange={(e) => handleBaseUrlChange(env.id, e.target.value)}
                                placeholder={`https://${name || 'service'}.${env.name}.example.com`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="req-hint" style={{ marginTop: 6, fontStyle: 'italic' }}>Environments come from Settings → Environments.</p>
                  </div>

                  <div className="req-form-group">
                    <label>Default Auth</label>
                    <p className="req-hint">Requests set to "Inherit from Collection" will use this auth.</p>

                    {environments.length > 0 && (
                      <div className="req-auth-mode-switcher">
                        <button className={`req-auth-mode-btn ${authMode === 'single' ? 'active' : ''}`}
                          onClick={() => setAuthMode('single')}>Same for all envs</button>
                        <button className={`req-auth-mode-btn ${authMode === 'per-env' ? 'active' : ''}`}
                          onClick={() => setAuthMode('per-env')}>Per environment</button>
                      </div>
                    )}

                    {authMode === 'single' && (
                      <AuthFields state={defaultAuth}
                        onChange={(patch) => setDefaultAuth((prev) => ({ ...prev, ...patch }))}
                        globalAuthProfiles={globalAuthProfiles} />
                    )}

                    {authMode === 'per-env' && environments.length > 0 && (
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
