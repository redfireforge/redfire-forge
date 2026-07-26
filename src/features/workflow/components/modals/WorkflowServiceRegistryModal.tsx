import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Environment, GlobalAuthProfile, Microservice } from '../../../../shared/types';
import type { WorkflowService, ServiceEndpoint } from '../../types/workflow';
import type { EnvAuthState } from '../../../requests/utils/requestAuthState';
import { authToState, stateToAuth, emptyAuthState } from '../../../requests/utils/requestAuthState';
import WorkflowEditorModalFrame from './WorkflowEditorModalFrame';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

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
  const [authPopupEnvId, setAuthPopupEnvId] = useState<string | null>(null);
  const [authPopupAnchor, setAuthPopupAnchor] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const cloned = (JSON.parse(JSON.stringify(services)) as WorkflowService[]).map((svc) => ({
      ...svc,
      endpoints: ensureAllEnvRows(svc.endpoints ?? [], environments),
    }));
    setDrafts(cloned);  
    setSelectedId(cloned[0]?.id ?? null);
    setAuthPopupEnvId(null);
    setAuthPopupAnchor(null);
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
    setAuthPopupEnvId(null);
  };

  const deleteService = (id: string) => {
    setDrafts((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) {
      const remaining = drafts.filter((s) => s.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }
    setAuthPopupEnvId(null);
  };

  const openAuthPopup = (envId: string, anchorEl: HTMLElement) => {
    const rect = anchorEl.getBoundingClientRect();
    setAuthPopupAnchor({ top: rect.bottom + 4, left: rect.left });
    setAuthPopupEnvId(envId);
    const ep = selected?.endpoints.find((e) => e.envId === envId);
    if (ep && ep.authMode === 'inherit') {
      let prefillAuth = selected?.defaultAuth;
      if (selected?.microserviceId) {
        const ms = microservices.find((m) => m.id === selected.microserviceId);
        const profileId = ms?.authProfileIds?.[envId];
        if (profileId) {
          const profile = globalAuthProfiles.find((g) => g.id === profileId);
          if (profile) prefillAuth = profile.auth;
        }
      }
      updateEndpoint(envId, { authMode: 'custom', auth: prefillAuth });
    }
  };

  const closeAuthPopup = () => {
    setAuthPopupEnvId(null);
    setAuthPopupAnchor(null);
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

  /** Check if a service has a configured endpoint for the currently selected env. */
  const svcEnvReady = (svc: WorkflowService) => {
    if (!selectedEnvId) return 'none'; // no env selected
    const ep = (svc.endpoints ?? []).find((e) => e.envId === selectedEnvId);
    if (ep && ep.enabled && ep.url.trim()) return 'ready';
    return 'missing';
  };

  const activeEnvs = selected?.endpoints.filter(ep => ep.enabled && ep.url.trim()).length ?? 0;

  return (
    <WorkflowEditorModalFrame
      open={open}
      title={`Service Registry${workflowName ? ` — ${workflowName}` : ''}`}
      onClose={onClose}
      dialogClassName="wf-svc-registry-modal"
      hideCloseButton
      hideExpandButton
      bodyScrollable={false}
      headerClassName="settings-header"
      minWidth={600}
      minHeight={360}
      constrainDragToViewport
      footer={(
        <>
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm btn-primary" onClick={apply}>Apply</button>
        </>
      )}
    >
        <div className="wf-svc-registry-body">
          {/* ── Left: service list ── */}
          <div className="wf-svc-registry-left">
            <div className="wf-svc-registry-left-head">
              <div className="wf-svc-left-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15 1.65 1.65 0 003.09 14H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6 1.65 1.65 0 0010 3.09V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                <span>Services</span>
              </div>
              <button className="btn btn-xs btn-primary wf-svc-add-btn" onClick={addService}>+ Add</button>
            </div>
            <div className="wf-svc-registry-list">
              {drafts.map((svc) => {
                const status = svcEnvReady(svc);
                const enabledCount = (svc.endpoints ?? []).filter((ep) => ep.enabled && ep.url.trim()).length;
                return (
                <button
                  key={svc.id}
                  type="button"
                  className={`wf-svc-registry-row ${selectedId === svc.id ? 'active' : ''}`}
                  onClick={() => { setSelectedId(svc.id); closeAuthPopup(); }}
                >
                  <div className="wf-svc-row-info">
                    <span className={`wf-svc-row-status ${status}`} />
                    <span className="wf-svc-row-name">{svc.name}</span>
                  </div>
                  <div className="wf-svc-row-actions">
                    <span className="wf-svc-row-badge">{enabledCount}</span>
                    <button
                      type="button"
                      className="wf-svc-row-delete"
                      title="Delete service"
                      onClick={(e) => { e.stopPropagation(); deleteService(svc.id); }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </button>
                );
              })}
              {drafts.length === 0 && (
                <div className="wf-svc-registry-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <path d="M12 12h.01" />
                    <path d="M17 12h.01" />
                    <path d="M7 12h.01" />
                  </svg>
                  <span>No services yet</span>
                  <span className="wf-svc-empty-hint">Click <strong>+ Add</strong> to create one</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: service config ── */}
          <div className="wf-svc-registry-right">
            {!selected ? (
              <div className="wf-svc-registry-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
                </svg>
                <span>Select a service to configure</span>
              </div>
            ) : (
              <div className="wf-svc-registry-form">
                {/* ── Service Identity Section ── */}
                <div className="wf-svc-identity">
                  <div className="wf-svc-identity-fields">
                    <div className="wf-svc-field-group">
                      <label className="wf-svc-field-label">Service Name</label>
                      <input
                        className="wf-svc-field-input"
                        value={selected.name}
                        onChange={(e) => updateSelected({ name: e.target.value })}
                        placeholder="e.g. user-api, payment-gateway"
                      />
                    </div>
                    <div className="wf-svc-field-group">
                      <label className="wf-svc-field-label">Linked Microservice</label>
                      <CustomSelect
                        value={selected.microserviceId ?? ''}
                        onChange={(v) => handleMicroserviceChange(v || undefined)}
                        placeholder="None (manual)"
                        options={[
                          { value: '', label: 'None (manual)' },
                          ...microservices.map((m) => ({ value: m.id, label: m.name })),
                        ]}
                      />
                    </div>
                  </div>
                  {linkedMs && (
                    <div className="wf-svc-linked-notice">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      <span>URLs managed by <strong>{linkedMs.name}</strong> microservice config</span>
                    </div>
                  )}
                </div>

                {/* ── Environments Section ── */}
                <div className="wf-svc-env-section">
                  <div className="wf-svc-env-header">
                    <span className="wf-svc-env-title">Environments</span>
                    <span className="wf-svc-env-count">{activeEnvs} active</span>
                  </div>

                  <div className="wf-svc-endpoint-matrix">
                    <div className="wf-svc-matrix-header">
                      <span className="wf-svc-matrix-col-on" />
                      <span className="wf-svc-matrix-col-env">Environment</span>
                      <span className="wf-svc-matrix-col-url">Base URL</span>
                      <span className="wf-svc-matrix-col-auth">Auth</span>
                    </div>
                    {selected.endpoints.map((ep) => {
                      const isActiveEnv = ep.envId === selectedEnvId;
                      return (
                        <div key={ep.envId} className={`wf-svc-matrix-entry ${ep.enabled ? '' : 'disabled'} ${isActiveEnv ? 'active-env' : ''}`}>
                          <div className="wf-svc-matrix-row">
                            <span className="wf-svc-matrix-col-on">
                              <input type="checkbox" checked={ep.enabled} onChange={(e) => updateEndpoint(ep.envId, { enabled: e.target.checked })} />
                            </span>
                            <span className="wf-svc-matrix-col-env">{envName(ep.envId)}</span>
                            <span className="wf-svc-matrix-col-url">
                              <input
                                value={ep.url}
                                onChange={(e) => updateEndpoint(ep.envId, { url: e.target.value, source: 'manual' })}
                                placeholder={`https://svc.${envName(ep.envId)}.example.com`}
                                readOnly={!!linkedMs}
                                className={linkedMs ? 'wf-svc-url-linked' : ''}
                              />
                            </span>
                            <span className="wf-svc-matrix-col-auth">
                              <button
                                className={`wf-svc-auth-pill ${ep.authMode === 'custom' ? 'custom' : 'inherit'} ${authPopupEnvId === ep.envId ? 'expanded' : ''}`}
                                onClick={(e) => {
                                  if (authPopupEnvId === ep.envId) {
                                    closeAuthPopup();
                                  } else {
                                    openAuthPopup(ep.envId, e.currentTarget);
                                  }
                                }}
                              >
                                <span className="wf-svc-auth-pill-text">{authSummary(ep, defaultAuth, globalAuthProfiles)}</span>
                                <svg className="wf-svc-auth-pill-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </button>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Auth Popup Modal */}
        {authPopupEnvId && authPopupAnchor && selected && (() => {
          const ep = selected.endpoints.find((e) => e.envId === authPopupEnvId);
          if (!ep) return null;
          const epAuth = getEndpointAuth(ep);
          return (
            <ServiceAuthPopup
              envName={envName(authPopupEnvId)}
              authState={epAuth}
              globalAuthProfiles={globalAuthProfiles}
              anchor={authPopupAnchor}
              onUpdate={(patch) => updateEndpointAuth(authPopupEnvId, patch)}
              onReset={() => { updateEndpoint(authPopupEnvId, { authMode: 'inherit', auth: undefined }); closeAuthPopup(); }}
              onClose={closeAuthPopup}
            />
          );
        })()}
    </WorkflowEditorModalFrame>
  );
}

/* ─── Service Auth Popup Modal ────────────────────────────────────── */

interface ServiceAuthPopupProps {
  envName: string;
  authState: EnvAuthState;
  globalAuthProfiles: GlobalAuthProfile[];
  anchor: { top: number; left: number };
  onUpdate: (patch: Partial<EnvAuthState>) => void;
  onReset: () => void;
  onClose: () => void;
}

function ServiceAuthPopup({ envName, authState, globalAuthProfiles, anchor, onUpdate, onReset, onClose }: ServiceAuthPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(anchor);

  useEffect(() => {
    if (!popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { top, left } = pos;
    if (left + rect.width > vw - 12) left = vw - rect.width - 12;
    if (top + rect.height > vh - 12) top = anchor.top - rect.height - 8;
    if (left < 12) left = 12;
    if (top < 12) top = 12;
    if (left !== pos.left || top !== pos.top) setPos({ top, left });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="wf-svc-auth-popup-backdrop" onMouseDown={handleBackdropClick}>
      <div className="wf-svc-auth-popup" ref={popupRef} style={{ top: pos.top, left: pos.left }}>
        <div className="wf-svc-auth-popup-header">
          <div className="wf-svc-auth-popup-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Authentication — <strong>{envName}</strong></span>
          </div>
          <div className="wf-svc-auth-popup-type">
            <CustomSelect
              value={authState.authType}
              onChange={(v) => onUpdate({ authType: v as EnvAuthState['authType'] })}
              options={[
                { value: 'none', label: 'No Auth' },
                ...(globalAuthProfiles.length > 0 ? [{ value: 'global-profile', label: 'Global Auth Profile' }] : []),
                { value: 'bearer', label: 'Bearer Token' },
                { value: 'basic', label: 'Basic Auth' },
                { value: 'apikey', label: 'API Key' },
                { value: 'oauth2', label: 'OAuth2 Client Credentials' },
              ]}
            />
          </div>
        </div>

        {authState.authType !== 'none' && (
          <div className="wf-svc-auth-popup-body">
            {renderAuthFields(authState, onUpdate, globalAuthProfiles)}
          </div>
        )}

        <div className="wf-svc-auth-popup-footer">
          <button className="wf-svc-auth-reset-btn" onClick={onReset} title="Reset auth to inherit from microservice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Reset to Inherit
          </button>
          <button className="btn btn-sm btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

/** Auth fields rendered in a structured grid layout per auth type. */
function renderAuthFields(
  authState: EnvAuthState,
  updateAuth: (patch: Partial<EnvAuthState>) => void,
  globalAuthProfiles: GlobalAuthProfile[],
) {
  if (authState.authType === 'global-profile') {
    return (
      <div className="wf-svc-auth-grid wf-svc-auth-grid--1col">
        <div className="wf-svc-auth-field">
          <label className="wf-svc-auth-field-label">Profile</label>
          <CustomSelect
            value={authState.selectedProfileId}
            onChange={(v) => updateAuth({ selectedProfileId: v })}
            options={globalAuthProfiles.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.auth.type})`,
            }))}
          />
        </div>
      </div>
    );
  }
  if (authState.authType === 'bearer') {
    return (
      <div className="wf-svc-auth-grid wf-svc-auth-grid--2col">
        <div className="wf-svc-auth-field">
          <label className="wf-svc-auth-field-label">Prefix</label>
          <input value={authState.bearerPrefix} onChange={(e) => updateAuth({ bearerPrefix: e.target.value })} placeholder="Bearer" />
        </div>
        <div className="wf-svc-auth-field">
          <label className="wf-svc-auth-field-label">Token</label>
          <input value={authState.bearerToken} onChange={(e) => updateAuth({ bearerToken: e.target.value })} placeholder="eyJhbGciOiJIUzI1NiIs..." />
        </div>
      </div>
    );
  }
  if (authState.authType === 'basic') {
    return (
      <div className="wf-svc-auth-grid wf-svc-auth-grid--2col">
        <div className="wf-svc-auth-field">
          <label className="wf-svc-auth-field-label">Username</label>
          <input value={authState.basicUser} onChange={(e) => updateAuth({ basicUser: e.target.value })} placeholder="username" />
        </div>
        <div className="wf-svc-auth-field">
          <label className="wf-svc-auth-field-label">Password</label>
          <input type="password" value={authState.basicPass} onChange={(e) => updateAuth({ basicPass: e.target.value })} placeholder="••••••••" />
        </div>
      </div>
    );
  }
  if (authState.authType === 'apikey') {
    return (
      <div className="wf-svc-auth-grid wf-svc-auth-grid--3col">
        <div className="wf-svc-auth-field">
          <label className="wf-svc-auth-field-label">Key Name</label>
          <input value={authState.apiKeyName} onChange={(e) => updateAuth({ apiKeyName: e.target.value })} placeholder="X-API-Key" />
        </div>
        <div className="wf-svc-auth-field">
          <label className="wf-svc-auth-field-label">Value</label>
          <input value={authState.apiKeyValue} onChange={(e) => updateAuth({ apiKeyValue: e.target.value })} placeholder="sk_live_..." />
        </div>
        <div className="wf-svc-auth-field">
          <label className="wf-svc-auth-field-label">Location</label>
          <CustomSelect
            value={authState.apiKeyIn}
            onChange={(v) => updateAuth({ apiKeyIn: v as 'header' | 'query' })}
            options={[
              { value: 'header', label: 'Header' },
              { value: 'query', label: 'Query Param' },
            ]}
          />
        </div>
      </div>
    );
  }
  if (authState.authType === 'oauth2') {
    return (
      <div className="wf-svc-auth-grid wf-svc-auth-grid--oauth2">
        <div className="wf-svc-auth-field wf-svc-auth-field--full">
          <label className="wf-svc-auth-field-label">Token URL</label>
          <input value={authState.tokenUrl} onChange={(e) => updateAuth({ tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
        </div>
        <div className="wf-svc-auth-field">
          <label className="wf-svc-auth-field-label">Client ID</label>
          <input value={authState.clientId} onChange={(e) => updateAuth({ clientId: e.target.value })} placeholder="client_abc123" />
        </div>
        <div className="wf-svc-auth-field">
          <label className="wf-svc-auth-field-label">Client Secret</label>
          <input type="password" value={authState.clientSecret} onChange={(e) => updateAuth({ clientSecret: e.target.value })} placeholder="••••••••" />
        </div>
      </div>
    );
  }
  return null;
}
