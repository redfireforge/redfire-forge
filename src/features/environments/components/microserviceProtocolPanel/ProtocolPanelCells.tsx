import { useEffect, useRef, useState } from 'react';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import type { GlobalAuthProfile, Microservice, ProtocolKey } from '../../../../shared/types';
import {
  PROTOCOL_TABS,
  getExplicitBaseUrl,
  getResolvedDisplayValue,
  getRowStatus,
  statusChipLabel,
  validateProtocolValue,
} from '../../utils/protocolEndpointUtils';
import { protocolHint, statusChipClass } from './protocolPanelUtils';

export function AuthSelect({
  svc,
  envId,
  profiles,
  onSetAuthProfile,
}: {
  svc: Microservice;
  envId: string;
  profiles: GlobalAuthProfile[];
  onSetAuthProfile: (envId: string, profileId: string | undefined) => void;
}) {
  return (
    <CustomSelect
      className="env-auth-select"
      aria-label="Auth profile"
      value={svc.authProfileIds?.[envId] ?? ''}
      onChange={(v) => onSetAuthProfile(envId, v || undefined)}
      options={[
        { value: '', label: 'No Auth' },
        ...profiles.map((p) => ({ value: p.id, label: `${p.name} (${p.auth.type})` })),
      ]}
    />
  );
}

export function EndpointEditor({
  value,
  placeholder,
  validationError,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  placeholder: string;
  validationError: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="svc-env-url-edit">
      <input
        autoFocus
        data-testid="em-endpoint-edit-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        aria-invalid={validationError ? true : undefined}
      />
      {validationError && <span className="em-validation-hint">{validationError}</span>}
      <button type="button" className="btn btn-primary btn-xs" data-testid="em-endpoint-save-btn" onClick={onSave} disabled={!!validationError}>Save</button>
      <button type="button" className="btn btn-xs" onClick={onCancel}>Cancel</button>
    </div>
  );
}

export function UrlDisplayCell({
  svc,
  protocol,
  envId,
  envName,
  isEditing,
  editValue,
  onStartEdit,
  onEditValueChange,
  onSave,
  onCancel,
}: {
  svc: Microservice;
  protocol: ProtocolKey;
  envId: string;
  envName: string;
  isEditing: boolean;
  editValue: string;
  onStartEdit: (value: string) => void;
  onEditValueChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const status = getRowStatus(svc, protocol, envId);
  const explicit = getExplicitBaseUrl(svc, protocol, envId);
  const resolved = getResolvedDisplayValue(svc, protocol, envId, envName);
  const validationError = isEditing ? validateProtocolValue(protocol, editValue) : null;

  if (isEditing) {
    return (
      <EndpointEditor
        value={editValue}
        placeholder={protocol === 'grpc' ? 'host:50051' : `https://${svc.name}.${envName}.example.com`}
        validationError={validationError}
        onChange={onEditValueChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  const displayText = explicit || resolved;
  const emptyLabel = protocol === 'grpc'
    ? 'Not configured'
    : status === 'fallback'
      ? 'Not set — using HTTP fallback'
      : 'No URL configured';

  return (
    <div className="em-url-display">
      {displayText
        ? <code className="em-url-text">{displayText}</code>
        : <span className="svc-env-url-empty">{emptyLabel}</span>}
      <span className={`em-url-status ${statusChipClass(status)}`}>{statusChipLabel(status)}</span>
      <button
        type="button"
        className="btn btn-xs"
        data-testid="em-endpoint-edit-btn"
        onClick={() => onStartEdit(explicit || '')}
      >
        Edit
      </button>
    </div>
  );
}

/** Dropdown for adding a new protocol tab */
export function AddProtocolMenu({
  enabledProtocols,
  onAdd,
}: {
  enabledProtocols: ProtocolKey[];
  onAdd: (protocol: ProtocolKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const timerId = window.setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  const available = PROTOCOL_TABS.filter((t) => !enabledProtocols.includes(t.key));
  if (available.length === 0) return null;

  return (
    <div className="em-add-protocol-wrap" ref={ref}>
      <button
        type="button"
        className="em-add-protocol-btn"
        aria-label="Add protocol"
        title="Add protocol tab"
        onClick={() => setOpen((v) => !v)}
        data-testid="em-add-protocol-btn"
      >
        + Add protocol
      </button>
      {open && (
        <div className="em-add-protocol-menu" role="menu" data-testid="em-add-protocol-menu">
          <div className="em-add-protocol-menu-title">Add protocol</div>
          {available.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="menuitem"
              className="em-add-protocol-item"
              data-testid={`em-add-protocol-item-${tab.key}`}
              onClick={() => { onAdd(tab.key); setOpen(false); }}
            >
              <span className={`em-proto-tab-dot em-proto-tab-dot--${tab.cssKey}`} />
              <span className="em-add-protocol-label">{tab.label}</span>
              <span className="em-add-protocol-hint">{protocolHint(tab.key)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
