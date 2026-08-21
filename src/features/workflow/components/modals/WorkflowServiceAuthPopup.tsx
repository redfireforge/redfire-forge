import { useCallback, useEffect, useRef, useState } from 'react';
import type { GlobalAuthProfile } from '../../../../shared/types';
import type { EnvAuthState } from '../../../requests/utils/requestAuthState';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

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

export const MIN_POPUP_W = 400;
export const MIN_POPUP_H = 200;
export const DEFAULT_POPUP_W = 560;
export const DEFAULT_POPUP_H = 380;

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

export function ServiceAuthPopup({ envName, authState, globalAuthProfiles, anchor, onUpdate, onReset, onSave, onCancel }: ServiceAuthPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(anchor);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: DEFAULT_POPUP_W, h: DEFAULT_POPUP_H });
  const [validationError, setValidationError] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origX: number; origY: number; dir: string } | null>(null);

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
    if (!rect) return;
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: rect.width, origH: rect.height, origX: pos.left, origY: pos.top, dir };
    const onMove = (ev: MouseEvent) => {
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
