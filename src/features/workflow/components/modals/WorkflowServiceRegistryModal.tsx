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
  const authSnapshotRef = useRef<{ envId: string; endpoint: ServiceEndpoint } | null>(null);

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
    /* v8 ignore next */
    if (!selectedId) return;
    setDrafts((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
  };

  const updateEndpoint = (envId: string, patch: Partial<ServiceEndpoint>) => {
    /* v8 ignore next */
    if (!selected) return;
    updateSelected({ endpoints: selected.endpoints.map((ep) => (ep.envId === envId ? { ...ep, ...patch } : ep)) });
  };

  const getEndpointAuth = (ep: ServiceEndpoint) => authToState(ep.auth, globalAuthProfiles);

  const updateEndpointAuth = (envId: string, patch: Partial<EnvAuthState>) => {
    const ep = selected?.endpoints.find((e) => e.envId === envId);
    /* v8 ignore next */
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
    const modalEl = anchorEl.closest<HTMLElement>('.wf-svc-registry-modal');
    const modalRect = modalEl?.getBoundingClientRect();
    let top: number, left: number;
    if (modalRect) {
      left = modalRect.left + (modalRect.width - DEFAULT_POPUP_W) / 2;
      top = modalRect.top - 100;
    } else {
      left = (window.innerWidth - DEFAULT_POPUP_W) / 2;
      top = window.innerHeight * 0.15;
    }
    setAuthPopupAnchor({ top, left });
    setAuthPopupEnvId(envId);
    const ep = selected?.endpoints.find((e) => e.envId === envId);
    if (ep) authSnapshotRef.current = { envId, endpoint: JSON.parse(JSON.stringify(ep)) };
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
    authSnapshotRef.current = null;
    setAuthPopupEnvId(null);
    setAuthPopupAnchor(null);
  };

  const cancelAuthPopup = () => {
    if (authSnapshotRef.current && selected) {
      const snap = authSnapshotRef.current;
      updateEndpoint(snap.envId, { authMode: snap.endpoint.authMode, auth: snap.endpoint.auth });
    }
    closeAuthPopup();
  };

  const handleMicroserviceChange = (msId: string | undefined) => {
    /* v8 ignore next */
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
    if (!selectedEnvId) return 'none';
    const ep = (svc.endpoints ?? []).find((e) => e.envId === selectedEnvId)
      ?? (svc.endpoints ?? []).find((e) => e.envId === '__all__');
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
                <div
                  key={svc.id}
                  role="button"
                  tabIndex={0}
                  className={`wf-svc-registry-row ${selectedId === svc.id ? 'active' : ''}`}
                  onClick={() => { setSelectedId(svc.id); closeAuthPopup(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(svc.id); closeAuthPopup(); } }}
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
                </div>
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
              onSave={closeAuthPopup}
              onCancel={cancelAuthPopup}
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
  onSave: () => void;
  onCancel: () => void;
}

const MIN_POPUP_W = 400;
const MIN_POPUP_H = 200;
const DEFAULT_POPUP_W = 560;
const DEFAULT_POPUP_H = 380;

function getAuthValidationError(s: EnvAuthState): string | null {
  switch (s.authType) {
    case 'none': return null;
    case 'bearer': return !s.bearerToken.trim() ? 'Token is required' : null;
    case 'basic': return !s.basicUser.trim() ? 'Username is required' : !s.basicPass.trim() ? 'Password is required' : null;
    case 'apikey': return !s.apiKeyName.trim() ? 'Key Name is required' : !s.apiKeyValue.trim() ? 'Value is required' : null;
    case 'oauth2': return !s.tokenUrl.trim() ? 'Token URL is required' : !s.clientId.trim() ? 'Client ID is required' : !s.clientSecret.trim() ? 'Client Secret is required' : null;
    case 'global-profile': return !s.selectedProfileId ? 'Please select a profile' : null;
    default: return null;
  }
}

function ServiceAuthPopup({ envName, authState, globalAuthProfiles, anchor, onUpdate, onReset, onSave, onCancel }: ServiceAuthPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(anchor);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: DEFAULT_POPUP_W, h: DEFAULT_POPUP_H });
  const [validationError, setValidationError] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origX: number; origY: number; dir: string } | null>(null);

  useEffect(() => {
    /* v8 ignore next */
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

  useEffect(() => {
    if (validationError) setValidationError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.authType, authState.bearerToken, authState.basicUser, authState.basicPass,
      authState.apiKeyName, authState.apiKeyValue, authState.tokenUrl, authState.clientId,
      authState.clientSecret, authState.selectedProfileId]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.custom-select-container, button, input')) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.left, origY: pos.top };
    const onMove = (ev: MouseEvent) => {
      /* v8 ignore next */
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - 100, dragRef.current.origX + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - 40, dragRef.current.origY + dy));
      setPos({ top: newTop, left: newLeft });
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos]);

  const handleResizeStart = useCallback((dir: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = popupRef.current?.getBoundingClientRect();
    /* v8 ignore next */
    if (!rect) return;
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: rect.width, origH: rect.height, origX: pos.left, origY: pos.top, dir };
    const onMove = (ev: MouseEvent) => {
      /* v8 ignore next */
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startX;
      const dy = ev.clientY - resizeRef.current.startY;
      const d = resizeRef.current.dir;
      let newW = resizeRef.current.origW;
      let newH = resizeRef.current.origH;
      let newX = resizeRef.current.origX;
      let newY = resizeRef.current.origY;
      if (d.includes('e')) newW = Math.max(MIN_POPUP_W, resizeRef.current.origW + dx);
      if (d.includes('w')) { newW = Math.max(MIN_POPUP_W, resizeRef.current.origW - dx); newX = resizeRef.current.origX + (resizeRef.current.origW - newW); }
      if (d.includes('s')) newH = Math.max(MIN_POPUP_H, resizeRef.current.origH + dy);
      if (d.includes('n')) { newH = Math.max(MIN_POPUP_H, resizeRef.current.origH - dy); newY = resizeRef.current.origY + (resizeRef.current.origH - newH); }
      setSize({ w: newW, h: newH });
      setPos({ top: newY, left: newX });
    };
    const onUp = () => { resizeRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos]);

  const popupStyle: React.CSSProperties = {
    top: pos.top,
    left: pos.left,
    width: size.w,
    height: size.h,
  };

  return (
    <div className="wf-svc-auth-popup-backdrop" onMouseDown={handleBackdropClick}>
      <div className="wf-svc-auth-popup" ref={popupRef} style={popupStyle}>
        <div className="wf-svc-auth-popup-header" onMouseDown={handleDragStart}>
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

        <div className="wf-svc-auth-popup-body">
          {authState.authType === 'none' ? (
            <div className="wf-svc-auth-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>No authentication configured</span>
              <span className="wf-svc-auth-empty-hint">Select an auth type above to configure credentials for this environment</span>
            </div>
          ) : (
            renderAuthFields(authState, onUpdate, globalAuthProfiles)
          )}
        </div>

        {validationError && (
          <div className="wf-svc-auth-validation-alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {validationError}
          </div>
        )}

        <div className="wf-svc-auth-popup-footer">
          <button className="wf-svc-auth-reset-btn" onClick={onReset} title="Reset auth to inherit from microservice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Reset to Inherit
          </button>
          <div className="wf-svc-auth-footer-actions">
            <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={() => {
              const err = getAuthValidationError(authState);
              if (err) { setValidationError(err); return; }
              setValidationError(null);
              onSave();
            }}>Save</button>
          </div>
        </div>

        {/* Resize handles */}
        <div className="wf-svc-auth-resize wf-svc-auth-resize--n" onMouseDown={(e) => handleResizeStart('n', e)} />
        <div className="wf-svc-auth-resize wf-svc-auth-resize--s" onMouseDown={(e) => handleResizeStart('s', e)} />
        <div className="wf-svc-auth-resize wf-svc-auth-resize--e" onMouseDown={(e) => handleResizeStart('e', e)} />
        <div className="wf-svc-auth-resize wf-svc-auth-resize--w" onMouseDown={(e) => handleResizeStart('w', e)} />
        <div className="wf-svc-auth-resize wf-svc-auth-resize--ne" onMouseDown={(e) => handleResizeStart('ne', e)} />
        <div className="wf-svc-auth-resize wf-svc-auth-resize--nw" onMouseDown={(e) => handleResizeStart('nw', e)} />
        <div className="wf-svc-auth-resize wf-svc-auth-resize--se" onMouseDown={(e) => handleResizeStart('se', e)} />
        <div className="wf-svc-auth-resize wf-svc-auth-resize--sw" onMouseDown={(e) => handleResizeStart('sw', e)} />
      </div>
    </div>
  );
}

function AuthRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="wf-svc-auth-row">
      <div className="wf-svc-auth-row-label">
        <span className="wf-svc-auth-row-icon">{icon}</span>
        {label}
      </div>
      <div className="wf-svc-auth-row-ctrl">{children}</div>
    </div>
  );
}

const AUTH_ICONS = {
  key: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  token: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  tag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  value: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  location: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  id: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  profile: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M16 21v-1a4 4 0 0 0-8 0v1"/><circle cx="12" cy="10" r="3"/></svg>,
  prefix: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
};

function renderAuthFields(
  authState: EnvAuthState,
  updateAuth: (patch: Partial<EnvAuthState>) => void,
  globalAuthProfiles: GlobalAuthProfile[],
) {
  if (authState.authType === 'global-profile') {
    return (
      <div className="wf-svc-auth-rows">
        <AuthRow label="Profile" icon={AUTH_ICONS.profile}>
          <CustomSelect
            value={authState.selectedProfileId}
            onChange={(v) => updateAuth({ selectedProfileId: v })}
            options={globalAuthProfiles.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.auth.type})`,
            }))}
          />
        </AuthRow>
        <div className="wf-svc-auth-hint-row">Uses a pre-configured auth profile from Environment Manager</div>
      </div>
    );
  }
  if (authState.authType === 'bearer') {
    return (
      <div className="wf-svc-auth-rows">
        <AuthRow label="Prefix" icon={AUTH_ICONS.prefix}>
          <input value={authState.bearerPrefix} onChange={(e) => updateAuth({ bearerPrefix: e.target.value })} placeholder="Bearer" />
        </AuthRow>
        <AuthRow label="Token" icon={AUTH_ICONS.key}>
          <input value={authState.bearerToken} onChange={(e) => updateAuth({ bearerToken: e.target.value })} placeholder="eyJhbGciOiJIUzI1NiIs..." />
        </AuthRow>
        <div className="wf-svc-auth-hint-row">
          Sent as <code>Authorization: {authState.bearerPrefix || 'Bearer'} &lt;token&gt;</code>
        </div>
      </div>
    );
  }
  if (authState.authType === 'basic') {
    return (
      <div className="wf-svc-auth-rows">
        <AuthRow label="Username" icon={AUTH_ICONS.user}>
          <input value={authState.basicUser} onChange={(e) => updateAuth({ basicUser: e.target.value })} placeholder="username" />
        </AuthRow>
        <AuthRow label="Password" icon={AUTH_ICONS.lock}>
          <input type="password" value={authState.basicPass} onChange={(e) => updateAuth({ basicPass: e.target.value })} placeholder="••••••••" />
        </AuthRow>
        <div className="wf-svc-auth-hint-row">
          Sent as <code>Authorization: Basic &lt;base64&gt;</code>
        </div>
      </div>
    );
  }
  if (authState.authType === 'apikey') {
    return (
      <div className="wf-svc-auth-rows">
        <AuthRow label="Key Name" icon={AUTH_ICONS.tag}>
          <input value={authState.apiKeyName} onChange={(e) => updateAuth({ apiKeyName: e.target.value })} placeholder="X-API-Key" />
        </AuthRow>
        <AuthRow label="Value" icon={AUTH_ICONS.value}>
          <input value={authState.apiKeyValue} onChange={(e) => updateAuth({ apiKeyValue: e.target.value })} placeholder="sk_live_..." />
        </AuthRow>
        <AuthRow label="Location" icon={AUTH_ICONS.location}>
          <CustomSelect
            value={authState.apiKeyIn}
            onChange={(v) => updateAuth({ apiKeyIn: v as 'header' | 'query' })}
            options={[
              { value: 'header', label: 'Header' },
              { value: 'query', label: 'Query Param' },
            ]}
          />
        </AuthRow>
        <div className="wf-svc-auth-hint-row">
          Sent as {authState.apiKeyIn === 'query' ? 'query parameter' : 'request header'}: <code>{authState.apiKeyName || '{Key Name}'}</code>
        </div>
      </div>
    );
  }
  if (authState.authType === 'oauth2') {
    return (
      <div className="wf-svc-auth-rows">
        <AuthRow label="Token URL" icon={AUTH_ICONS.link}>
          <input value={authState.tokenUrl} onChange={(e) => updateAuth({ tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
        </AuthRow>
        <AuthRow label="Client ID" icon={AUTH_ICONS.id}>
          <input value={authState.clientId} onChange={(e) => updateAuth({ clientId: e.target.value })} placeholder="client_abc123" />
        </AuthRow>
        <AuthRow label="Client Secret" icon={AUTH_ICONS.lock}>
          <input type="password" value={authState.clientSecret} onChange={(e) => updateAuth({ clientSecret: e.target.value })} placeholder="••••••••" />
        </AuthRow>
        <div className="wf-svc-auth-hint-row">
          Acquires a token via <code>Client Credentials</code> grant before each request
        </div>
      </div>
    );
  }
  return null;
}
