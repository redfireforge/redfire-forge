import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Environment, GlobalAuthProfile, Microservice } from '../../../../shared/types';
import type { WorkflowService, ServiceEndpoint } from '../../types/workflow';
import type { EnvAuthState } from '../../../requests/utils/requestAuthState';
import { authToState, stateToAuth, emptyAuthState } from '../../../requests/utils/requestAuthState';
import WorkflowEditorModalFrame from './WorkflowEditorModalFrame';

const ADHOC_ENV_ID = '__adhoc__';

interface Props {
  open: boolean;
  services: WorkflowService[];
  environments: Environment[];
  microservices: Microservice[];
  globalAuthProfiles: GlobalAuthProfile[];
  selectedEnvId: string;
  workflowName?: string;
  onApply: (services: WorkflowService[]) => void;
  onClose: () => void;
}

function makeEndpoint(envId: string, url = '', source: ServiceEndpoint['source'] = 'manual'): ServiceEndpoint {
  return { envId, url, enabled: !!url, authMode: 'inherit', source };
}

function ensureAllEnvRows(endpoints: ServiceEndpoint[], environments: Environment[]): ServiceEndpoint[] {
  const envIds = [...environments.map((e) => e.id), ADHOC_ENV_ID];
  const existing = new Map(endpoints.map((ep) => [ep.envId, ep]));
  return envIds.map((envId) => existing.get(envId) ?? makeEndpoint(envId));
}

/** Short auth summary label for the matrix row. */
/** Resolve the inherited auth label for an endpoint row by looking up the microservice's authProfileIds. */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveInheritLabel(
  envId: string,
  microserviceId: string | undefined,
  microservices: Microservice[],
  globalAuthProfiles: GlobalAuthProfile[],
): string {
  if (!microserviceId) return 'No microservice linked';
  const ms = microservices.find((m) => m.id === microserviceId);
  if (!ms?.authProfileIds) return 'No auth configured for this env';
  const profileId = ms.authProfileIds[envId];
  if (!profileId) return 'No auth profile for this env';
  const profile = globalAuthProfiles.find((g) => g.id === profileId);
  return profile ? `${profile.name} (${profile.auth.type})` : 'Profile not found';
}

// eslint-disable-next-line react-refresh/only-export-components
export function authSummary(ep: ServiceEndpoint, _defaultAuth: EnvAuthState, globalAuthProfiles: GlobalAuthProfile[]): string {
  if (ep.authMode === 'inherit') return 'inherit';
  if (!ep.auth) return 'none';
  const st = authToState(ep.auth, globalAuthProfiles);
  if (st.authType === 'none') return 'none';
  if (st.authType === 'global-profile') {
    const p = globalAuthProfiles.find((g) => g.id === st.selectedProfileId);
    return p ? p.name : 'profile';
  }
  if (st.authType === 'bearer') return 'Bearer';
  if (st.authType === 'basic') return 'Basic';
  if (st.authType === 'apikey') return `Key: ${st.apiKeyName || '…'}`;
  if (st.authType === 'oauth2') return 'OAuth2';
  return st.authType;
}

export default function WorkflowServiceRegistryModal({
  open,
  services,
  environments,
  microservices,
  globalAuthProfiles,
  selectedEnvId,
  workflowName,
  onApply,
  onClose,
}: Props) {
  const [drafts, setDrafts] = useState<WorkflowService[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Which endpoint row is expanded to show inline auth config. */
  const [expandedEnvId, setExpandedEnvId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const cloned = (JSON.parse(JSON.stringify(services)) as WorkflowService[]).map((svc) => ({
      ...svc,
      endpoints: ensureAllEnvRows(svc.endpoints ?? [], environments),
    }));
    setDrafts(cloned); // eslint-disable-line react-hooks/set-state-in-effect
    setSelectedId(cloned[0]?.id ?? null);
    setExpandedEnvId(null);
  }, [open, services, environments]);

  const selected = useMemo(() => drafts.find((s) => s.id === selectedId) ?? null, [drafts, selectedId]);

  const defaultAuth = useMemo(
    () => (selected ? authToState(selected.defaultAuth, globalAuthProfiles) : emptyAuthState(globalAuthProfiles)),
    [selected, globalAuthProfiles],
  );

  const linkedMs = useMemo(
    () => (selected?.microserviceId ? microservices.find((m) => m.id === selected.microserviceId) : undefined),
    [selected?.microserviceId, microservices],
  );

  if (!open) return null;

  const updateSelected = (patch: Partial<WorkflowService>) => {
    if (!selectedId) return;
    setDrafts((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
  };

  const updateEndpoint = (envId: string, patch: Partial<ServiceEndpoint>) => {
    if (!selected) return;
    updateSelected({ endpoints: selected.endpoints.map((ep) => (ep.envId === envId ? { ...ep, ...patch } : ep)) });
  };

  const getEndpointAuth = (ep: ServiceEndpoint) => authToState(ep.auth, globalAuthProfiles);

  const updateEndpointAuth = (envId: string, patch: Partial<EnvAuthState>) => {
    const ep = selected?.endpoints.find((e) => e.envId === envId);
    if (!ep) return;
    const merged = { ...getEndpointAuth(ep), ...patch };
    updateEndpoint(envId, { auth: stateToAuth(merged, globalAuthProfiles), authMode: 'custom' });
  };

  const addService = () => {
    const svc: WorkflowService = {
      id: uuidv4(),
      name: `service-${drafts.length + 1}`,
      endpoints: ensureAllEnvRows([], environments),
      defaultAuth: { type: 'none' },
    };
    setDrafts((prev) => [...prev, svc]);
    setSelectedId(svc.id);
    setExpandedEnvId(null);
  };


  const handleMicroserviceChange = (msId: string | undefined) => {
    if (!selected) return;
    if (msId) {
      const ms = microservices.find((m) => m.id === msId);
      if (ms) {
        const endpoints = selected.endpoints.map((ep) => {
          if (ep.envId === ADHOC_ENV_ID) return ep;
          const url = ms.baseUrls[ep.envId] ?? '';
          return { ...ep, url, enabled: !!url, source: 'microservice' as const };
        });
        updateSelected({ microserviceId: msId, endpoints });
        return;
      }
    }
    updateSelected({ microserviceId: msId });
  };

  const apply = () => { onApply(drafts); onClose(); };

  const envName = (envId: string) => {
    if (envId === ADHOC_ENV_ID) return 'adhoc';
    return environments.find((e) => e.id === envId)?.name ?? envId;
  };

  const endpointCount = (svc: WorkflowService) => {
    const enabled = (svc.endpoints ?? []).filter((ep) => ep.enabled && ep.url.trim()).length;
    return `${enabled}/${environments.length + 1}`;
  };

  /** Check if a service has a configured endpoint for the currently selected env. */
  const svcEnvReady = (svc: WorkflowService) => {
    if (!selectedEnvId) return 'none'; // no env selected
    const ep = (svc.endpoints ?? []).find((e) => e.envId === selectedEnvId);
    if (ep && ep.enabled && ep.url.trim()) return 'ready';
    return 'missing';
  };

  return (
    <WorkflowEditorModalFrame
      open={open}
      title={`Service Registry${workflowName ? ` — ${workflowName}` : ''}`}
      onClose={onClose}
      overlayClassName="wf-svc-registry-overlay"
      dialogClassName="wf-svc-registry-modal wf-svc-fullscreen"
      bodyScrollable={false}
      headerClassName="settings-header"
      footerClassName="import-center-footer"
      footer={(
        <>
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={apply}>Apply</button>
        </>
      )}
    >
        <div className="wf-svc-registry-body">
          {/* ── Left: service list ── */}
          <div className="wf-svc-registry-left">
            <div className="wf-svc-registry-left-head">
              <span>Services</span>
              <button className="btn btn-sm btn-primary" onClick={addService}>+ Add</button>
            </div>
            <div className="wf-svc-registry-list">
              {drafts.map((svc) => {
                const status = svcEnvReady(svc);
                return (
                <button
                  key={svc.id}
                  type="button"
                  className={`wf-svc-registry-row ${selectedId === svc.id ? 'active' : ''}`}
                  onClick={() => { setSelectedId(svc.id); setExpandedEnvId(null); }}
                >
                  <span className="wf-svc-registry-row-name">
                    {status === 'missing' && <span className="wf-svc-env-dot missing" title={`Not configured for selected env`}>●</span>}
                    {status === 'ready' && <span className="wf-svc-env-dot ready" title="Configured for selected env">●</span>}
                    {svc.name}
                  </span>
                  <span className="wf-svc-registry-row-mode">{endpointCount(svc)} envs</span>
                </button>
                );
              })}
              {drafts.length === 0 && (
                <div className="wf-svc-registry-empty">No services yet. Click <strong>+ Add</strong> to create one.</div>
              )}
            </div>
          </div>

          {/* ── Right: service config ── */}
          <div className="wf-svc-registry-right">
            {!selected ? (
              <div className="wf-svc-registry-empty">Select a service on the left, or add one.</div>
            ) : (
              <div className="wf-svc-registry-form">
                {/* Service name + microservice — compact row */}
                <div className="wf-svc-top-fields">
                  <div className="wf-config-field">
                    <label>Service Name</label>
                    <input
                      value={selected.name}
                      onChange={(e) => updateSelected({ name: e.target.value })}
                      placeholder="e.g. user-api, payment-gateway"
                    />
                  </div>
                  <div className="wf-config-field">
                    <label>Linked Microservice</label>
                    <select
                      value={selected.microserviceId ?? ''}
                      onChange={(e) => handleMicroserviceChange(e.target.value || undefined)}
                    >
                      <option value="">None (manual)</option>
                      {microservices.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {linkedMs && (
                  <p className="wf-svc-hint">URLs auto-populated from Environment config. Override individual rows below.</p>
                )}

                {/* ── Endpoint Matrix with inline auth ── */}
                <div className="wf-svc-endpoint-matrix">
                  <div className="wf-svc-matrix-header">
                    <span className="wf-svc-matrix-col-on">On</span>
                    <span className="wf-svc-matrix-col-env">Env</span>
                    <span className="wf-svc-matrix-col-url">Base URL</span>
                    <span className="wf-svc-matrix-col-auth">Auth</span>
                    <span className="wf-svc-matrix-col-resolved">Resolved Auth</span>
                  </div>
                  {selected.endpoints.map((ep) => {
                    const isExpanded = expandedEnvId === ep.envId;
                    const epAuth = getEndpointAuth(ep);
                    return (
                      <div key={ep.envId} className={`wf-svc-matrix-entry ${ep.enabled ? '' : 'disabled'}`}>
                        <div className="wf-svc-matrix-row">
                          <span className="wf-svc-matrix-col-on">
                            <input type="checkbox" checked={ep.enabled} onChange={(e) => updateEndpoint(ep.envId, { enabled: e.target.checked })} />
                          </span>
                          <span className="wf-svc-matrix-col-env wf-svc-env-label">{envName(ep.envId)}</span>
                          <span className="wf-svc-matrix-col-url">
                              <input
                                value={ep.url}
                                onChange={(e) => updateEndpoint(ep.envId, { url: e.target.value, source: 'manual' })}
                                placeholder={`https://svc.${envName(ep.envId)}.example.com`}
                                readOnly={!!linkedMs}
                                className={linkedMs ? 'wf-svc-url-linked' : ''}
                              />
                            {linkedMs && <span className="wf-svc-linked-icon" title="Managed by microservice config">🔗</span>}
                          </span>
                          <span className="wf-svc-matrix-col-auth">
                            <button
                              className={`btn btn-xs wf-svc-auth-toggle ${ep.authMode === 'custom' ? 'custom' : 'inherit'} ${isExpanded ? 'expanded' : ''}`}
                              onClick={() => {
                                if (isExpanded) {
                                  setExpandedEnvId(null);
                                } else {
                                  if (ep.authMode === 'inherit') {
                                    // Pre-fill from env auth profile if available, else defaultAuth
                                    let prefillAuth = selected.defaultAuth;
                                    if (selected.microserviceId) {
                                      const ms = microservices.find((m) => m.id === selected.microserviceId);
                                      const profileId = ms?.authProfileIds?.[ep.envId];
                                      if (profileId) {
                                        const profile = globalAuthProfiles.find((g) => g.id === profileId);
                                        if (profile) prefillAuth = profile.auth;
                                      }
                                    }
                                    updateEndpoint(ep.envId, { authMode: 'custom', auth: prefillAuth });
                                  }
                                  setExpandedEnvId(ep.envId);
                                }
                              }}
                            >
                              <span>{authSummary(ep, defaultAuth, globalAuthProfiles)}</span>
                              <span className="wf-svc-auth-chevron">{isExpanded ? '▲' : '▼'}</span>
                            </button>
                          </span>
                          <span className="wf-svc-matrix-col-resolved">
                            {ep.authMode === 'inherit'
                              ? resolveInheritLabel(ep.envId, selected.microserviceId, microservices, globalAuthProfiles)
                              : authSummary(ep, defaultAuth, globalAuthProfiles)}
                          </span>
                        </div>

                        {/* ── Inline auth config (expanded) ── */}
                        {isExpanded && (
                          <div className="wf-svc-matrix-auth-expanded">
                            <div className="wf-svc-inline-auth-row">
                              <div className="wf-config-field">
                                <label>Auth Type</label>
                                <select
                                  value={epAuth.authType}
                                  onChange={(e) => updateEndpointAuth(ep.envId, { authType: e.target.value as EnvAuthState['authType'] })}
                                >
                                  <option value="none">No Auth</option>
                                  {globalAuthProfiles.length > 0 && <option value="global-profile">Global Auth Profile</option>}
                                  <option value="bearer">Bearer Token</option>
                                  <option value="basic">Basic Auth</option>
                                  <option value="apikey">API Key</option>
                                  <option value="oauth2">OAuth2 Client Credentials</option>
                                </select>
                              </div>
                              {renderInlineAuthFields(epAuth, (p) => updateEndpointAuth(ep.envId, p), globalAuthProfiles)}
                            </div>
                            <div className="wf-svc-inline-auth-actions">
                              <button
                                className="btn btn-xs"
                                onClick={() => { updateEndpoint(ep.envId, { authMode: 'inherit', auth: undefined }); setExpandedEnvId(null); }}
                              >
                                Reset to Inherit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
    </WorkflowEditorModalFrame>
  );
}

/** Inline auth fields — renders horizontally for compact display. */
function renderInlineAuthFields(
  authState: EnvAuthState,
  updateAuth: (patch: Partial<EnvAuthState>) => void,
  globalAuthProfiles: GlobalAuthProfile[],
) {
  if (authState.authType === 'global-profile') {
    return (
      <div className="wf-config-field">
        <label>Profile</label>
        <select value={authState.selectedProfileId} onChange={(e) => updateAuth({ selectedProfileId: e.target.value })}>
          {globalAuthProfiles.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>))}
        </select>
      </div>
    );
  }
  if (authState.authType === 'bearer') {
    return (
      <>
        <div className="wf-config-field"><label>Prefix</label><input value={authState.bearerPrefix} onChange={(e) => updateAuth({ bearerPrefix: e.target.value })} placeholder="Bearer" /></div>
        <div className="wf-config-field"><label>Token</label><input value={authState.bearerToken} onChange={(e) => updateAuth({ bearerToken: e.target.value })} placeholder="Token" /></div>
      </>
    );
  }
  if (authState.authType === 'basic') {
    return (
      <>
        <div className="wf-config-field"><label>Username</label><input value={authState.basicUser} onChange={(e) => updateAuth({ basicUser: e.target.value })} /></div>
        <div className="wf-config-field"><label>Password</label><input type="password" value={authState.basicPass} onChange={(e) => updateAuth({ basicPass: e.target.value })} /></div>
      </>
    );
  }
  if (authState.authType === 'apikey') {
    return (
      <>
        <div className="wf-config-field"><label>Key Name</label><input value={authState.apiKeyName} onChange={(e) => updateAuth({ apiKeyName: e.target.value })} placeholder="X-API-Key" /></div>
        <div className="wf-config-field"><label>Key Value</label><input value={authState.apiKeyValue} onChange={(e) => updateAuth({ apiKeyValue: e.target.value })} /></div>
        <div className="wf-config-field"><label>In</label>
          <select value={authState.apiKeyIn} onChange={(e) => updateAuth({ apiKeyIn: e.target.value as 'header' | 'query' })}>
            <option value="header">Header</option><option value="query">Query</option>
          </select>
        </div>
      </>
    );
  }
  if (authState.authType === 'oauth2') {
    return (
      <>
        <div className="wf-config-field"><label>Token URL</label><input value={authState.tokenUrl} onChange={(e) => updateAuth({ tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" /></div>
        <div className="wf-config-field"><label>Client ID</label><input value={authState.clientId} onChange={(e) => updateAuth({ clientId: e.target.value })} /></div>
        <div className="wf-config-field"><label>Client Secret</label><input type="password" value={authState.clientSecret} onChange={(e) => updateAuth({ clientSecret: e.target.value })} /></div>
      </>
    );
  }
  return null;
}
